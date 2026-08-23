# -*- coding: utf-8 -*-
"""
AstraGuard AI - Conjunction Analysis Service
=============================================
Uses IBM Granite via IBM watsonx.ai to generate structured
satellite conjunction risk reports.
"""

from __future__ import annotations

import json
import logging
import os
import re
from dataclasses import dataclass
from datetime import datetime, timezone
from typing import Literal

logger = logging.getLogger("astraguard.ai_analyzer")


# ---------------------------------------------------------------------------
# Load environment variables
# ---------------------------------------------------------------------------

try:
    from dotenv import load_dotenv
    load_dotenv()
except ImportError:
    pass


WATSONX_API_KEY = (
    os.getenv("WATSONX_API_KEY")
    or os.getenv("WATSONX_APIKEY", "")
).strip()

WATSONX_URL = os.getenv(
    "WATSONX_URL",
    "https://eu-de.ml.cloud.ibm.com"
).strip()

WATSONX_PROJECT = os.getenv(
    "WATSONX_PROJECT_ID",
    ""
).strip()

GRANITE_MODEL = os.getenv(
    "GRANITE_MODEL",
    "ibm/granite-4-h-small"
).strip()


# ---------------------------------------------------------------------------
# Data classes
# ---------------------------------------------------------------------------

@dataclass
class RecommendedManeuver:
    direction: str
    delta_v_m_s: float
    burn_duration_sec: float
    fuel_cost_impact: str


@dataclass
class ConjunctionAnalysis:
    norad_id: int
    satellite_name: str
    hazard_level: Literal["Low", "Medium", "High", "Critical"]
    risk_score: float
    risk_summary: str
    recommended_maneuver: RecommendedManeuver
    analysis_model: str
    analysed_at: str


# ---------------------------------------------------------------------------
# Prompt builder
# ---------------------------------------------------------------------------

def _build_prompt(
    satellite_name: str,
    norad_id: int,
    altitude_km: float,
    inclination_deg: float,
    close_approach_km: float,
    mean_motion: float | None,
) -> str:

    return f"""
You are an expert orbital mechanics engineer working at a
space operations centre.

Analyse the satellite conjunction event below.

IMPORTANT:
Return ONLY one valid JSON object.
Do not use Markdown.
Do not write explanations before or after the JSON.

Satellite telemetry:

NORAD ID: {norad_id}
Satellite name: {satellite_name}
Altitude: {altitude_km:.1f} km
Inclination: {inclination_deg:.2f} degrees
Close approach distance: {close_approach_km:.3f} km
Mean motion: {mean_motion if mean_motion is not None else "unknown"} rev/day

Return exactly this JSON structure:

{{
  "hazard_level": "Low",
  "risk_score": 0.0,
  "risk_summary": "Two sentence explanation.",
  "recommended_maneuver": {{
    "direction": "prograde",
    "delta_v_m_s": 0.0,
    "burn_duration_sec": 0.0,
    "fuel_cost_impact": "Negligible"
  }}
}}

Allowed hazard levels:
Low, Medium, High, Critical

Allowed maneuver directions:
prograde, retrograde, radial-in, radial-out, normal, anti-normal

Allowed fuel impacts:
Negligible, Low, Moderate, Significant, Critical
"""


# ---------------------------------------------------------------------------
# Fallback analysis
# ---------------------------------------------------------------------------

def _fallback_analysis(
    satellite_name: str,
    norad_id: int,
    altitude_km: float,
    inclination_deg: float,
    close_approach_km: float,
) -> ConjunctionAnalysis:

    # Simple deterministic risk calculation.
    # This is ONLY used if Watsonx fails.

    if close_approach_km <= 1:
        hazard = "Critical"
        risk = 0.95
    elif close_approach_km <= 5:
        hazard = "High"
        risk = 0.80
    elif close_approach_km <= 10:
        hazard = "Medium"
        risk = 0.50
    else:
        hazard = "Low"
        risk = 0.15

    return ConjunctionAnalysis(
        norad_id=norad_id,
        satellite_name=satellite_name,
        hazard_level=hazard,
        risk_score=risk,
        risk_summary=(
            "Watsonx AI analysis was unavailable, so AstraGuard "
            "used its deterministic orbital-risk fallback analysis."
        ),
        recommended_maneuver=RecommendedManeuver(
            direction="prograde",
            delta_v_m_s=0.0,
            burn_duration_sec=0.0,
            fuel_cost_impact="Negligible",
        ),
        analysis_model="deterministic-fallback",
        analysed_at=datetime.now(timezone.utc).isoformat(),
    )


# ---------------------------------------------------------------------------
# Extract JSON from Granite response
# ---------------------------------------------------------------------------

def _extract_json(response: str) -> dict:

    if not response:
        raise ValueError("Granite returned an empty response.")

    raw = response.strip()

    # Remove Markdown code fences.
    raw = re.sub(
        r"```json\s*",
        "",
        raw,
        flags=re.IGNORECASE,
    )

    raw = re.sub(
        r"```\s*",
        "",
        raw,
    )

    raw = raw.strip()

    # Find the first JSON object.
    start = raw.find("{")
    end = raw.rfind("}")

    if start == -1 or end == -1 or end <= start:
        raise ValueError(
            f"Granite did not return a JSON object. Response: {raw[:500]}"
        )

    json_text = raw[start:end + 1]

    return json.loads(json_text)


# ---------------------------------------------------------------------------
# Validate AI result
# ---------------------------------------------------------------------------

def _build_analysis_from_ai(
    ai: dict,
    satellite_name: str,
    norad_id: int,
) -> ConjunctionAnalysis:

    required_fields = [
        "hazard_level",
        "risk_score",
        "risk_summary",
        "recommended_maneuver",
    ]

    for field in required_fields:
        if field not in ai:
            raise ValueError(
                f"Granite response missing field: {field}"
            )

    maneuver = ai["recommended_maneuver"]

    required_maneuver_fields = [
        "direction",
        "delta_v_m_s",
        "burn_duration_sec",
        "fuel_cost_impact",
    ]

    for field in required_maneuver_fields:
        if field not in maneuver:
            raise ValueError(
                f"Granite maneuver response missing field: {field}"
            )

    hazard_level = str(ai["hazard_level"]).strip()

    if hazard_level not in {
        "Low",
        "Medium",
        "High",
        "Critical",
    }:
        hazard_level = "Medium"

    risk_score = float(ai["risk_score"])

    # Keep score inside the API's allowed range.
    risk_score = max(0.0, min(1.0, risk_score))

    return ConjunctionAnalysis(
        norad_id=norad_id,
        satellite_name=satellite_name,
        hazard_level=hazard_level,
        risk_score=risk_score,
        risk_summary=str(ai["risk_summary"]).strip(),
        recommended_maneuver=RecommendedManeuver(
            direction=str(
                maneuver["direction"]
            ).strip(),

            delta_v_m_s=float(
                maneuver["delta_v_m_s"]
            ),

            burn_duration_sec=float(
                maneuver["burn_duration_sec"]
            ),

            fuel_cost_impact=str(
                maneuver["fuel_cost_impact"]
            ).strip(),
        ),

        analysis_model=GRANITE_MODEL,

        analysed_at=datetime.now(
            timezone.utc
        ).isoformat(),
    )


# ---------------------------------------------------------------------------
# Main AI analysis function
# ---------------------------------------------------------------------------

def analyse(
    satellite_name: str,
    norad_id: int,
    altitude_km: float,
    inclination_deg: float,
    close_approach_km: float,
    mean_motion: float | None = None,
) -> ConjunctionAnalysis:

    # ---------------------------------------------------------------
    # Check credentials
    # ---------------------------------------------------------------

    if not WATSONX_API_KEY:
        logger.error("WATSONX_API_KEY is missing.")

        return _fallback_analysis(
            satellite_name,
            norad_id,
            altitude_km,
            inclination_deg,
            close_approach_km,
        )

    if not WATSONX_PROJECT:
        logger.error("WATSONX_PROJECT_ID is missing.")

        return _fallback_analysis(
            satellite_name,
            norad_id,
            altitude_km,
            inclination_deg,
            close_approach_km,
        )

    # ---------------------------------------------------------------
    # Import IBM watsonx.ai
    # ---------------------------------------------------------------

    try:

        from ibm_watsonx_ai import Credentials

        from ibm_watsonx_ai.foundation_models import (
            ModelInference
        )

        from ibm_watsonx_ai.metanames import (
            GenTextParamsMetaNames as Params
        )

    except ImportError as exc:

        logger.error(
            "ibm-watsonx-ai SDK is not installed: %s",
            exc,
        )

        return _fallback_analysis(
            satellite_name,
            norad_id,
            altitude_km,
            inclination_deg,
            close_approach_km,
        )

    # ---------------------------------------------------------------
    # Build prompt
    # ---------------------------------------------------------------

    prompt = _build_prompt(
        satellite_name=satellite_name,
        norad_id=norad_id,
        altitude_km=altitude_km,
        inclination_deg=inclination_deg,
        close_approach_km=close_approach_km,
        mean_motion=mean_motion,
    )

    # ---------------------------------------------------------------
    # Call Granite
    # ---------------------------------------------------------------

    try:

        logger.info(
            "Calling IBM watsonx.ai model: %s",
            GRANITE_MODEL,
        )

        credentials = Credentials(
            api_key=WATSONX_API_KEY,
            url=WATSONX_URL,
        )

        model = ModelInference(
            model_id=GRANITE_MODEL,
            credentials=credentials,
            project_id=WATSONX_PROJECT,
            params={
                Params.DECODING_METHOD: "greedy",
                Params.MAX_NEW_TOKENS: 512,
                Params.TEMPERATURE: 0,
            },
        )

        response = model.generate_text(
            prompt=prompt
        )

        logger.info(
            "Watsonx Granite response received successfully."
        )

    except Exception as exc:

        logger.error(
            "Watsonx error: %s",
            exc,
        )

        return _fallback_analysis(
            satellite_name,
            norad_id,
            altitude_km,
            inclination_deg,
            close_approach_km,
        )

    # ---------------------------------------------------------------
    # Parse Granite response
    # ---------------------------------------------------------------

    try:

        ai_result = _extract_json(
            response
        )

        result = _build_analysis_from_ai(
            ai=ai_result,
            satellite_name=satellite_name,
            norad_id=norad_id,
        )

        logger.info(
            "Granite AI analysis completed successfully."
        )

        return result

    except Exception as exc:

        logger.error(
            "JSON parse/validation error: %s",
            exc,
        )

        logger.error(
            "Raw Granite response: %s",
            str(response)[:1000],
        )

        return _fallback_analysis(
            satellite_name,
            norad_id,
            altitude_km,
            inclination_deg,
            close_approach_km,
        )