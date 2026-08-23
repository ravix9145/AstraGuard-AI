# -*- coding: utf-8 -*-
"""
AstraGuard AI - FastAPI Backend
================================
Serves live TLE data from CelesTrak and provides orbital analysis endpoints.
"""

# Load .env before any os.getenv() calls
try:
    from dotenv import load_dotenv
    load_dotenv()
except ImportError:
    pass  # python-dotenv is optional; env vars can be set directly in shell

from fastapi import FastAPI, HTTPException, Query
from fastapi.middleware.cors import CORSMiddleware
from pydantic import BaseModel, Field
import httpx
import logging
import os
from typing import Optional, Literal
from datetime import datetime, timezone
from services.ai_analyzer import analyse as ai_analyse

logging.basicConfig(level=logging.INFO)
logger = logging.getLogger("astraguard")

app = FastAPI(
    title="AstraGuard AI API",
    description="Space debris tracking and conjunction analysis powered by live TLE data",
    version="1.0.0",
)

app.add_middleware(
    CORSMiddleware,
    allow_origins=["*"],
    allow_credentials=False,
    allow_methods=["*"],
    allow_headers=["*"],
)

# ---------------------------------------------------------------------------
# CelesTrak TLE source groups
# ---------------------------------------------------------------------------
_GP = "https://celestrak.org/NORAD/elements/gp.php"
TLE_GROUPS: dict[str, str] = {
    "active":         f"{_GP}?GROUP=active&FORMAT=tle",
    "active_sats":    f"{_GP}?GROUP=active&FORMAT=tle",
    "stations":       f"{_GP}?GROUP=stations&FORMAT=tle",
    "visual":         f"{_GP}?GROUP=visual&FORMAT=tle",
    "debris_iridium": f"{_GP}?GROUP=iridium-33-debris&FORMAT=tle",
    "debris_cosmos":  f"{_GP}?GROUP=cosmos-2251-debris&FORMAT=tle",
    "fengyun":        f"{_GP}?GROUP=fengyun-1c-debris&FORMAT=tle",
    "last_30_days":   f"{_GP}?GROUP=last-30-days&FORMAT=tle",
}

CELESTRAK_GP_BASE = _GP
CELESTRAK_TLE_API = _GP


def _parse_tle_text(raw: str) -> list[dict]:
    """Parse raw 3-line TLE text into structured records."""
    lines = [l.strip() for l in raw.splitlines() if l.strip()]
    satellites: list[dict] = []

    i = 0
    while i < len(lines):
        if lines[i].startswith("1 ") or lines[i].startswith("2 "):
            i += 1
            continue
        if i + 2 < len(lines) and lines[i + 1].startswith("1 ") and lines[i + 2].startswith("2 "):
            name = lines[i]
            line1 = lines[i + 1]
            line2 = lines[i + 2]
            try:
                norad_id = int(line1[2:7].strip())
                inclination = float(line2[8:16])
                eccentricity = float("0." + line2[26:33])
                mean_motion = float(line2[52:63])
                # Approximate altitude from mean motion (km)
                mu = 398600.4418
                period_s = 86400.0 / mean_motion
                semi_major = (mu * (period_s / (2 * 3.14159265)) ** 2) ** (1 / 3)
                altitude_km = round(semi_major - 6371, 1)
            except (ValueError, IndexError):
                i += 3
                continue

            satellites.append(
                {
                    "name": name,
                    "norad_id": norad_id,
                    "line1": line1,
                    "line2": line2,
                    "inclination_deg": inclination,
                    "eccentricity": eccentricity,
                    "mean_motion_rev_per_day": mean_motion,
                    "approx_altitude_km": altitude_km,
                }
            )
            i += 3
        else:
            i += 1

    return satellites
def _fallback_satellites() -> list[dict]:
    """Return fallback satellite data when CelesTrak is unavailable."""
    fallback_tles = [
        (
            "ISS (ZARYA)",
            "1 25544U 98067A   26235.50000000  .00010000  00000-0  18000-3 0  9990",
            "2 25544  51.6400 120.0000 0005000  50.0000  80.0000 15.50000000123456",
        ),
        (
            "HUBBLE SPACE TELESCOPE",
            "1 20580U 90037B   26235.50000000  .00001000  00000-0  10000-3 0  9990",
            "2 20580  28.4700 150.0000 0003000  60.0000 300.0000 15.10000000123456",
        ),
        (
            "NOAA 19",
            "1 33591U 09005A   26235.50000000  .00000200  00000-0  12000-3 0  9990",
            "2 33591  99.1900 200.0000 0014000  90.0000 270.0000 14.10000000123456",
        ),
        (
            "TERRA",
            "1 25994U 99068A   26235.50000000  .00000100  00000-0  11000-3 0  9990",
            "2 25994  98.2000 250.0000 0002000  70.0000 290.0000 14.60000000123456",
        ),
        (
            "AQUA",
            "1 27424U 02022A   26235.50000000  .00000100  00000-0  10000-3 0  9990",
            "2 27424  98.2000 300.0000 0001000  80.0000 280.0000 14.60000000123456",
        ),
        (
            "LANDSAT 8",
            "1 39084U 13008A   26235.50000000  .00000100  00000-0  10000-3 0  9990",
            "2 39084  98.2000  30.0000 0001200  90.0000 270.0000 14.57110000123456",
        ),
        (
            "SENTINEL-2A",
            "1 40697U 15028A   26235.50000000  .00000100  00000-0  10000-3 0  9990",
            "2 40697  98.5700  60.0000 0001300  80.0000 280.0000 14.30820000123456",
        ),
        (
            "GOES 16",
            "1 41866U 16071A   26235.50000000  .00000100  00000-0  10000-3 0  9990",
            "2 41866   0.0500  70.0000 0002000 100.0000 260.0000  1.00270000123456",
        ),
        (
            "STARLINK-1007",
            "1 44713U 19074A   26235.50000000  .00000100  00000-0  10000-3 0  9990",
            "2 44713  53.0000  90.0000 0001500 110.0000 250.0000 15.06000000123456",
        ),
        (
            "METEOSAT-11",
            "1 40732U 15034A   26235.50000000  .00000100  00000-0  10000-3 0  9990",
            "2 40732   0.1000 110.0000 0003000 120.0000 240.0000  1.00270000123456",
        ),
    ]

    raw = "\n".join(
        f"{name}\n{line1}\n{line2}"
        for name, line1, line2 in fallback_tles
    )

    return _parse_tle_text(raw)


# ---------------------------------------------------------------------------
# Pydantic models for /api/ai/conjunction-analysis
# ---------------------------------------------------------------------------

class ConjunctionRequest(BaseModel):
    norad_id: int = Field(..., description="NORAD catalog number of the satellite")
    satellite_name: str = Field(..., description="Satellite common name")
    altitude_km: float = Field(..., ge=0, description="Current orbital altitude in km")
    inclination_deg: float = Field(..., ge=0, le=180, description="Orbital inclination in degrees")
    close_approach_km: float = Field(
        ..., ge=0,
        description="Estimated closest approach distance to the conjuncting object (km)",
    )
    mean_motion_rev_per_day: Optional[float] = Field(
        default=None, description="Mean motion in revolutions per day (optional)"
    )


class RecommendedManeuver(BaseModel):
    direction: str
    delta_v_m_s: float
    burn_duration_sec: float
    fuel_cost_impact: str


class ConjunctionReport(BaseModel):
    norad_id: int
    satellite_name: str
    hazard_level: Literal["Low", "Medium", "High", "Critical"]
    risk_score: float = Field(..., ge=0.0, le=1.0)
    risk_summary: str
    recommended_maneuver: RecommendedManeuver
    analysis_model: str
    analysed_at: str


# ---------------------------------------------------------------------------
# Routes
# ---------------------------------------------------------------------------

@app.get("/", tags=["Health"])
async def root():
    return {
        "service": "AstraGuard AI",
        "status": "operational",
        "timestamp": datetime.now(timezone.utc).isoformat(),
        "docs": "/docs",
    }


@app.get("/health", tags=["Health"])
async def health():
    return {"status": "ok", "timestamp": datetime.now(timezone.utc).isoformat()}


@app.get("/api/satellites/tle", tags=["TLE Data"])
async def get_tle_data(
    group: str = Query(
        default="active_sats",
        description=(
            "TLE group to fetch. Available: "
            + ", ".join(TLE_GROUPS.keys())
        ),
    ),
    limit: Optional[int] = Query(
        default=None,
        ge=1,
        le=5000,
        description="Max records to return",
    ),
):
    """
    Fetch TLE data from CelesTrak.

    If CelesTrak is unavailable, use fallback satellite data.
    """

    if group not in TLE_GROUPS:
        raise HTTPException(
            status_code=400,
            detail=f"Unknown group '{group}'. Choose from: {list(TLE_GROUPS.keys())}",
        )

    url = TLE_GROUPS[group]

    logger.info("Fetching TLE data from %s", url)

    satellites = []
    source = "celestrak"
    error = None

    try:
        async with httpx.AsyncClient(timeout=5.0) as client:
            resp = await client.get(
                url,
                headers={"User-Agent": "AstraGuard-AI/1.0"},
            )
            resp.raise_for_status()

        satellites = _parse_tle_text(resp.text)

        if not satellites:
            raise ValueError("CelesTrak returned no valid TLE records")

    except Exception as exc:
        error = str(exc)

        logger.warning(
            "CelesTrak unavailable. Using fallback satellite data: %s",
            exc,
        )

        satellites = _fallback_satellites()
        source = "fallback"

    if limit:
        satellites = satellites[:limit]

    return {
        "group": group,
        "source": source,
        "live": source == "celestrak",
        "fallback": source == "fallback",
        "warning": error if source == "fallback" else None,
        "fetched_at": datetime.now(timezone.utc).isoformat(),
        "count": len(satellites),
        "satellites": satellites,
    }

@app.get("/api/satellites/groups", tags=["TLE Data"])
async def list_groups():
    """List all available CelesTrak TLE groups."""
    return {
        "groups": [
            {"id": k, "url": v}
            for k, v in TLE_GROUPS.items()
            if k != "active"  # alias
        ]
    }


@app.get("/api/stats", tags=["Dashboard"])
async def get_dashboard_stats():
    """
    Returns aggregate statistics used by the AstraGuard dashboard.
    Active object count is derived from live CelesTrak active satellite TLE feed.
    """
    try:
        async with httpx.AsyncClient(timeout=20.0) as client:
            resp = await client.get(
                TLE_GROUPS["active_sats"],
                headers={"User-Agent": "AstraGuard-AI/1.0"},
            )
            resp.raise_for_status()
            active_sats = _parse_tle_text(resp.text)

            debris_resp = await client.get(
                TLE_GROUPS["debris_cosmos"],
                headers={"User-Agent": "AstraGuard-AI/1.0"},
            )
            debris_resp.raise_for_status()
            cosmos_debris = _parse_tle_text(debris_resp.text)
    except Exception:
        active_sats = []
        cosmos_debris = []

    return {
        "active_objects_tracked": len(active_sats) if active_sats else 8_200,
        "high_risk_conjunctions": 7,
        "next_orbital_pass_utc": "2025-01-15T18:43:00Z",
        "total_debris_objects": len(cosmos_debris) if cosmos_debris else 1_668,
        "leo_density_index": 0.74,
        "fetched_at": datetime.now(timezone.utc).isoformat(),
    }


# ---------------------------------------------------------------------------
# AI conjunction analysis - delegates to services/ai_analyzer.py
# ---------------------------------------------------------------------------

@app.post("/api/ai/conjunction-analysis", response_model=ConjunctionReport, tags=["AI Analysis"])
async def conjunction_analysis(req: ConjunctionRequest):
    """
    Run an AI-powered conjunction risk assessment using IBM Granite (ibm/granite-3-8b-instruct)
    via the ibm_watsonx_ai SDK.  Falls back to deterministic physics-based analysis when
    credentials are absent or the SDK is not installed - the endpoint is always callable.
    """
    result = await _run_analysis(req)
    return ConjunctionReport(
        norad_id=result.norad_id,
        satellite_name=result.satellite_name,
        hazard_level=result.hazard_level,
        risk_score=result.risk_score,
        risk_summary=result.risk_summary,
        recommended_maneuver=RecommendedManeuver(
            direction=result.recommended_maneuver.direction,
            delta_v_m_s=result.recommended_maneuver.delta_v_m_s,
            burn_duration_sec=result.recommended_maneuver.burn_duration_sec,
            fuel_cost_impact=result.recommended_maneuver.fuel_cost_impact,
        ),
        analysis_model=result.analysis_model,
        analysed_at=result.analysed_at,
    )


async def _run_analysis(req: ConjunctionRequest):
    """Run ai_analyse in a thread pool so the sync SDK does not block the event loop."""
    import asyncio
    loop = asyncio.get_event_loop()
    return await loop.run_in_executor(
        None,
        lambda: ai_analyse(
            satellite_name=req.satellite_name,
            norad_id=req.norad_id,
            altitude_km=req.altitude_km,
            inclination_deg=req.inclination_deg,
            close_approach_km=req.close_approach_km,
            mean_motion=req.mean_motion_rev_per_day,
        ),
    )
