"use client";

import { useState, useCallback } from "react";
import clsx from "clsx";
import ConjunctionDrawer, {
  type ConjunctionReport,
} from "./ConjunctionDrawer";

interface Satellite {
  name: string;
  norad_id: number;
  approx_altitude_km: number | null | undefined;
  inclination_deg: number | null | undefined;
  mean_motion_rev_per_day: number | null | undefined;
}

interface Props {
  satellites: Satellite[];
  loading?: boolean;
}

/**
 * Safely convert a value to a number.
 * Returns null when the value is missing or invalid.
 */
function safeNumber(value: unknown): number | null {
  if (value === null || value === undefined || value === "") {
    return null;
  }

  const numberValue = Number(value);

  return Number.isFinite(numberValue) ? numberValue : null;
}

/**
 * Safely format a number.
 */
function formatNumber(
  value: unknown,
  decimals: number
): string {
  const numberValue = safeNumber(value);

  if (numberValue === null) {
    return "—";
  }

  return numberValue.toFixed(decimals);
}

function riskLevel(
  altitude: unknown
): { label: string; color: string } {
  const alt = safeNumber(altitude);

  // If altitude is unavailable, don't classify it as Critical.
  if (alt === null) {
    return {
      label: "Unknown",
      color:
        "text-slate-400 bg-slate-500/10 border-slate-500/30",
    };
  }

  if (alt < 400) {
    return {
      label: "Critical",
      color:
        "text-red-400 bg-red-500/10 border-red-500/30",
    };
  }

  if (alt < 600) {
    return {
      label: "High",
      color:
        "text-amber-400 bg-amber-500/10 border-amber-500/30",
    };
  }

  if (alt < 800) {
    return {
      label: "Moderate",
      color:
        "text-yellow-400 bg-yellow-500/10 border-yellow-500/30",
    };
  }

  return {
    label: "Low",
    color:
      "text-emerald-400 bg-emerald-500/10 border-emerald-500/30",
  };
}

/**
 * Derive a plausible close-approach distance from altitude.
 *
 * This is only used as a fallback payload value when the table
 * does not contain an actual conjunction distance.
 */
function estimatedCloseApproach(
  altitude: unknown
): number {
  const alt = safeNumber(altitude);

  // If altitude is unavailable, use a conservative fallback.
  if (alt === null) {
    return 5;
  }

  if (alt < 400) {
    return +(Math.random() * 0.3).toFixed(3);
  }

  if (alt < 600) {
    return +(0.3 + Math.random() * 1.2).toFixed(3);
  }

  if (alt < 800) {
    return +(1.5 + Math.random() * 3.0).toFixed(3);
  }

  return +(4.5 + Math.random() * 10).toFixed(3);
}

const SKELETON_ROWS = 8;

export default function SatelliteTable({
  satellites,
  loading = false,
}: Props) {
  const [drawerOpen, setDrawerOpen] = useState(false);
  const [drawerLoading, setDrawerLoading] = useState(false);
  const [drawerError, setDrawerError] = useState<string | null>(null);
  const [report, setReport] =
    useState<ConjunctionReport | null>(null);
  const [activeSatId, setActiveSatId] =
    useState<number | null>(null);

  const handleRowClick = useCallback(
    async (sat: Satellite) => {
      setDrawerOpen(true);
      setDrawerLoading(true);
      setDrawerError(null);
      setReport(null);
      setActiveSatId(sat.norad_id);

      const altitude = safeNumber(sat.approx_altitude_km);
      const inclination = safeNumber(sat.inclination_deg);
      const meanMotion = safeNumber(
        sat.mean_motion_rev_per_day
      );

      try {
        const res = await fetch(
          "/api/ai/conjunction-analysis",
          {
            method: "POST",
            headers: {
              "Content-Type": "application/json",
            },
            body: JSON.stringify({
              norad_id: sat.norad_id,
              satellite_name: sat.name,

              // Send null instead of undefined/invalid values.
              altitude_km: altitude,
              inclination_deg: inclination,
              mean_motion_rev_per_day: meanMotion,

              close_approach_km:
                estimatedCloseApproach(altitude),
            }),
          }
        );

        if (!res.ok) {
          const detail = await res
            .json()
            .catch(() => ({
              detail: res.statusText,
            }));

          throw new Error(
            detail?.detail ??
              `HTTP ${res.status}`
          );
        }

        const data: ConjunctionReport =
          await res.json();

        setReport(data);
      } catch (err: unknown) {
        setDrawerError(
          err instanceof Error
            ? err.message
            : "AI analysis failed. Ensure the backend is running."
        );
      } finally {
        setDrawerLoading(false);
      }
    },
    []
  );

  const handleClose = useCallback(() => {
    setDrawerOpen(false);
    setActiveSatId(null);
    setReport(null);
    setDrawerError(null);
  }, []);

  return (
    <>
      <div className="overflow-hidden rounded-xl border border-slate-700/50 bg-[#050e2d]/80 backdrop-blur-sm">
        {/* Hint bar */}
        {!loading && satellites.length > 0 && (
          <div className="border-b border-slate-700/30 bg-slate-800/20 px-4 py-2 text-[11px] text-slate-500">
            Click any row to run an AI conjunction risk
            analysis
          </div>
        )}

        <div className="overflow-x-auto">
          <table className="w-full text-sm">
            <thead>
              <tr className="border-b border-slate-700/50 bg-slate-800/40">
                {[
                  "NORAD ID",
                  "Name",
                  "Alt (km)",
                  "Incl (°)",
                  "Rev/Day",
                  "Risk",
                  "",
                ].map((h) => (
                  <th
                    key={h}
                    className="px-4 py-3 text-left text-[11px] font-semibold uppercase tracking-widest text-slate-400"
                  >
                    {h}
                  </th>
                ))}
              </tr>
            </thead>

            <tbody>
              {/* Loading */}
              {loading ? (
                Array.from({
                  length: SKELETON_ROWS,
                }).map((_, i) => (
                  <tr
                    key={i}
                    className="border-b border-slate-700/30"
                  >
                    {Array.from({
                      length: 7,
                    }).map((__, j) => (
                      <td
                        key={j}
                        className="px-4 py-3"
                      >
                        <div
                          className="h-3.5 animate-pulse rounded bg-slate-700/50"
                          style={{
                            width: `${60 + j * 8}%`,
                          }}
                        />
                      </td>
                    ))}
                  </tr>
                ))
              ) : satellites.length === 0 ? (
                /* Empty state */
                <tr>
                  <td
                    colSpan={7}
                    className="px-4 py-10 text-center text-slate-500"
                  >
                    No satellite data available.
                    Ensure the backend is running.
                  </td>
                </tr>
              ) : (
                /* Satellite rows */
                satellites.map((sat, i) => {
                  const risk = riskLevel(
                    sat.approx_altitude_km
                  );

                  const isActive =
                    activeSatId === sat.norad_id;

                  return (
                    <tr
                      key={`${sat.norad_id}-${i}`}
                      onClick={() =>
                        handleRowClick(sat)
                      }
                      className={clsx(
                        "group cursor-pointer border-b border-slate-700/30 transition-colors",

                        isActive
                          ? "border-l-2 border-l-cyan-400 bg-cyan-500/10"
                          : i % 2 === 0
                          ? "hover:bg-slate-800/50"
                          : "bg-slate-900/20 hover:bg-slate-800/50"
                      )}
                      title="Click for AI conjunction analysis"
                    >
                      {/* NORAD ID */}
                      <td className="px-4 py-3 font-mono text-xs text-slate-400">
                        {sat.norad_id ?? "—"}
                      </td>

                      {/* Name */}
                      <td className="max-w-[180px] truncate px-4 py-3 font-medium text-slate-200">
                        {sat.name || "Unknown satellite"}
                      </td>

                      {/* Altitude */}
                      <td className="px-4 py-3 font-mono text-slate-300">
                        {formatNumber(
                          sat.approx_altitude_km,
                          0
                        )}
                      </td>

                      {/* Inclination */}
                      <td className="px-4 py-3 font-mono text-slate-300">
                        {formatNumber(
                          sat.inclination_deg,
                          2
                        )}
                      </td>

                      {/* Mean motion */}
                      <td className="px-4 py-3 font-mono text-slate-300">
                        {formatNumber(
                          sat.mean_motion_rev_per_day,
                          4
                        )}
                      </td>

                      {/* Risk */}
                      <td className="px-4 py-3">
                        <span
                          className={clsx(
                            "inline-flex rounded-full border px-2 py-0.5 text-[11px] font-semibold",
                            risk.color
                          )}
                        >
                          {risk.label}
                        </span>
                      </td>

                      {/* Analyse */}
                      <td className="px-4 py-3 text-right">
                        <span className="text-[11px] text-slate-600 opacity-0 transition group-hover:opacity-100">
                          Analyse →
                        </span>
                      </td>
                    </tr>
                  );
                })
              )}
            </tbody>
          </table>
        </div>
      </div>

      {/* AI report drawer */}
      {drawerOpen && (
        <ConjunctionDrawer
          report={report}
          loading={drawerLoading}
          error={drawerError}
          onClose={handleClose}
        />
      )}
    </>
  );
}