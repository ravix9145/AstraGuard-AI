"use client";

import { useEffect, useRef } from "react";
import {
  X,
  AlertTriangle,
  Zap,
  Activity,
  Cpu,
  Clock,
  TriangleAlert,
} from "lucide-react";
import clsx from "clsx";

// ---------------------------------------------------------------------------
// Types — mirror backend/services/ai_analyzer.py + main.py Pydantic models
// ---------------------------------------------------------------------------
export interface RecommendedManeuver {
  direction: string;
  delta_v_m_s: number;
  burn_duration_sec: number;
  fuel_cost_impact: string;
}

export interface ConjunctionReport {
  norad_id: number;
  satellite_name: string;
  hazard_level: "Low" | "Medium" | "High" | "Critical";
  risk_score: number;
  risk_summary: string;
  recommended_maneuver: RecommendedManeuver;
  analysis_model: string;
  analysed_at: string;
}

interface Props {
  report: ConjunctionReport | null;
  loading: boolean;
  error: string | null;
  onClose: () => void;
}

// ---------------------------------------------------------------------------
// Severity styling helpers
// ---------------------------------------------------------------------------
const severityStyles: Record<string, { border: string; badge: string; bar: string; icon: string }> = {
  Low:      { border: "border-emerald-500/40", badge: "bg-emerald-500/15 text-emerald-300 border-emerald-500/40", bar: "bg-emerald-400",  icon: "text-emerald-400" },
  Medium:   { border: "border-yellow-500/40",  badge: "bg-yellow-500/15 text-yellow-300 border-yellow-500/40",   bar: "bg-yellow-400",   icon: "text-yellow-400" },
  High:     { border: "border-amber-500/40",   badge: "bg-amber-500/15 text-amber-300 border-amber-500/40",      bar: "bg-amber-400",    icon: "text-amber-400" },
  Critical: { border: "border-red-500/40",     badge: "bg-red-500/15 text-red-300 border-red-500/40",            bar: "bg-red-500",      icon: "text-red-400" },
};

const fuelStyles: Record<string, string> = {
  Negligible: "text-emerald-400",
  Low:        "text-emerald-300",
  Moderate:   "text-yellow-300",
  Significant:"text-amber-400",
  Critical:   "text-red-400",
};

// ---------------------------------------------------------------------------
// Component
// ---------------------------------------------------------------------------
export default function ConjunctionDrawer({ report, loading, error, onClose }: Props) {
  const drawerRef = useRef<HTMLDivElement>(null);

  // Close on Escape key
  useEffect(() => {
    const handler = (e: KeyboardEvent) => { if (e.key === "Escape") onClose(); };
    window.addEventListener("keydown", handler);
    return () => window.removeEventListener("keydown", handler);
  }, [onClose]);

  const isOpen = loading || !!report || !!error;
  if (!isOpen) return null;

  const sev = report?.hazard_level ?? "Low";
  const style = severityStyles[sev] ?? severityStyles.Low;

  return (
    <>
      {/* Backdrop */}
      <div
        className="fixed inset-0 z-40 bg-black/60 backdrop-blur-sm"
        onClick={onClose}
        aria-hidden="true"
      />

      {/* Drawer panel */}
      <aside
        ref={drawerRef}
        className={clsx(
          "fixed right-0 top-0 z-50 flex h-full w-full max-w-[480px] flex-col",
          "border-l bg-[#050e2d] shadow-2xl",
          report ? style.border : "border-slate-700/60"
        )}
        role="dialog"
        aria-modal="true"
        aria-label="Conjunction Analysis Report"
      >
        {/* ── Header ──────────────────────────────────────────────── */}
        <div className="flex items-center justify-between border-b border-slate-700/50 px-5 py-4">
          <div className="flex items-center gap-2">
            <AlertTriangle size={18} className={report ? style.icon : "text-slate-400"} />
            <span className="text-sm font-semibold text-white">
              Conjunction Analysis
            </span>
            {report && (
              <span
                className={clsx(
                  "rounded-full border px-2 py-0.5 text-[11px] font-bold uppercase tracking-wider",
                  style.badge
                )}
              >
                {sev}
              </span>
            )}
          </div>
          <button
            onClick={onClose}
            className="rounded-md p-1 text-slate-400 transition hover:bg-slate-700/60 hover:text-white"
            aria-label="Close"
          >
            <X size={18} />
          </button>
        </div>

        {/* ── Body ────────────────────────────────────────────────── */}
        <div className="flex-1 overflow-y-auto px-5 py-5 space-y-5">

          {/* Loading skeleton */}
          {loading && (
            <div className="space-y-3 animate-pulse">
              <div className="h-4 w-3/4 rounded bg-slate-700/60" />
              <div className="h-4 w-1/2 rounded bg-slate-700/60" />
              <div className="h-24 rounded bg-slate-700/40" />
              <div className="h-4 w-2/3 rounded bg-slate-700/60" />
              <div className="h-4 w-1/3 rounded bg-slate-700/60" />
              <div className="mt-4 h-28 rounded bg-slate-700/40" />
            </div>
          )}

          {/* Error state */}
          {!loading && error && (
            <div className="flex items-start gap-3 rounded-lg border border-red-500/30 bg-red-500/10 p-4 text-sm text-red-300">
              <TriangleAlert size={16} className="mt-0.5 flex-shrink-0" />
              <span>{error}</span>
            </div>
          )}

          {/* Report */}
          {!loading && report && (
            <>
              {/* Identity */}
              <div className="rounded-lg border border-slate-700/50 bg-slate-800/30 px-4 py-3 space-y-1">
                <p className="text-xs text-slate-500 uppercase tracking-widest">Satellite</p>
                <p className="text-base font-semibold text-white">{report.satellite_name}</p>
                <p className="font-mono text-xs text-slate-400">NORAD {report.norad_id}</p>
              </div>

              {/* Risk score bar */}
              <div>
                <div className="mb-1.5 flex items-center justify-between">
                  <span className="flex items-center gap-1.5 text-xs text-slate-400">
                    <Activity size={12} />
                    Risk Score
                  </span>
                  <span className="font-mono text-xs font-semibold text-white">
                    {(report.risk_score * 100).toFixed(0)} / 100
                  </span>
                </div>
                <div className="h-2 w-full overflow-hidden rounded-full bg-slate-700/60">
                  <div
                    className={clsx("h-full rounded-full transition-all duration-700", style.bar)}
                    style={{ width: `${report.risk_score * 100}%` }}
                  />
                </div>
              </div>

              {/* AI Risk Summary */}
              <div>
                <p className="mb-2 text-xs font-semibold uppercase tracking-widest text-slate-500">
                  Risk Assessment
                </p>
                <p className="text-sm leading-relaxed text-slate-200">{report.risk_summary}</p>
              </div>

              {/* Maneuver card */}
              <div className="rounded-lg border border-slate-700/50 bg-slate-800/30 px-4 py-4 space-y-3">
                <p className="flex items-center gap-1.5 text-xs font-semibold uppercase tracking-widest text-slate-400">
                  <Zap size={12} className="text-cyan-400" />
                  Recommended Avoidance Maneuver
                </p>
                <div className="grid grid-cols-2 gap-3">
                  <Stat label="Direction" value={report.recommended_maneuver.direction} mono />
                  <Stat
                    label="Δv"
                    value={`${report.recommended_maneuver.delta_v_m_s.toFixed(3)} m/s`}
                    mono
                  />
                  <Stat
                    label="Burn Duration"
                    value={`${report.recommended_maneuver.burn_duration_sec.toFixed(1)} s`}
                    mono
                  />
                  <div>
                    <p className="mb-0.5 text-[10px] uppercase tracking-widest text-slate-500">
                      Fuel Impact
                    </p>
                    <p className={clsx(
                      "text-sm font-semibold",
                      fuelStyles[report.recommended_maneuver.fuel_cost_impact] ?? "text-slate-300"
                    )}>
                      {report.recommended_maneuver.fuel_cost_impact}
                    </p>
                  </div>
                </div>
              </div>

              {/* Footer metadata */}
              <div className="flex flex-wrap gap-x-4 gap-y-1 text-[11px] text-slate-600">
                <span className="flex items-center gap-1">
                  <Cpu size={10} />
                  {report.analysis_model}
                </span>
                <span className="flex items-center gap-1">
                  <Clock size={10} />
                  {new Date(report.analysed_at).toLocaleString()}
                </span>
              </div>
            </>
          )}
        </div>
      </aside>
    </>
  );
}

// Tiny helper for the maneuver grid
function Stat({ label, value, mono }: { label: string; value: string; mono?: boolean }) {
  return (
    <div>
      <p className="mb-0.5 text-[10px] uppercase tracking-widest text-slate-500">{label}</p>
      <p className={clsx("text-sm font-semibold text-slate-200", mono && "font-mono")}>{value}</p>
    </div>
  );
}
