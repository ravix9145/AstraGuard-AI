import { LucideIcon } from "lucide-react";
import clsx from "clsx";

interface MetricCardProps {
  title: string;
  value: string | number;
  subtext?: string;
  icon: LucideIcon;
  accent: "cyan" | "amber" | "red" | "green" | "purple";
  trend?: "up" | "down" | "neutral";
  loading?: boolean;
}

const accentMap = {
  cyan:   { border: "border-cyan-500/40",   icon: "text-cyan-400",   glow: "shadow-cyan-500/20",   badge: "bg-cyan-500/10 text-cyan-300" },
  amber:  { border: "border-amber-500/40",  icon: "text-amber-400",  glow: "shadow-amber-500/20",  badge: "bg-amber-500/10 text-amber-300" },
  red:    { border: "border-red-500/40",    icon: "text-red-400",    glow: "shadow-red-500/20",    badge: "bg-red-500/10 text-red-300" },
  green:  { border: "border-emerald-500/40",icon: "text-emerald-400",glow: "shadow-emerald-500/20",badge: "bg-emerald-500/10 text-emerald-300" },
  purple: { border: "border-purple-500/40", icon: "text-purple-400", glow: "shadow-purple-500/20", badge: "bg-purple-500/10 text-purple-300" },
};

export default function MetricCard({
  title,
  value,
  subtext,
  icon: Icon,
  accent,
  loading = false,
}: MetricCardProps) {
  const colors = accentMap[accent];

  return (
    <div
      className={clsx(
        "relative rounded-xl border bg-[#050e2d]/80 backdrop-blur-sm p-5",
        "shadow-lg transition-all duration-300 hover:scale-[1.02] hover:shadow-xl",
        colors.border,
        colors.glow
      )}
    >
      {/* Top row */}
      <div className="flex items-start justify-between gap-3">
        <div className="flex-1 min-w-0">
          <p className="text-xs font-medium uppercase tracking-widest text-slate-400 mb-1">
            {title}
          </p>
          {loading ? (
            <div className="h-8 w-28 rounded bg-slate-700/60 animate-pulse" />
          ) : (
            <p className="text-3xl font-bold text-white leading-tight truncate">
              {value}
            </p>
          )}
        </div>
        <div
          className={clsx(
            "flex-shrink-0 rounded-lg p-2.5",
            colors.badge
          )}
        >
          <Icon size={22} className={colors.icon} strokeWidth={1.75} />
        </div>
      </div>

      {/* Subtext */}
      {subtext && !loading && (
        <p className="mt-3 text-xs text-slate-400 leading-relaxed">{subtext}</p>
      )}

      {/* Bottom accent bar */}
      <div
        className={clsx(
          "absolute bottom-0 left-0 right-0 h-[2px] rounded-b-xl opacity-60",
          accent === "cyan"   && "bg-gradient-to-r from-transparent via-cyan-400 to-transparent",
          accent === "amber"  && "bg-gradient-to-r from-transparent via-amber-400 to-transparent",
          accent === "red"    && "bg-gradient-to-r from-transparent via-red-400 to-transparent",
          accent === "green"  && "bg-gradient-to-r from-transparent via-emerald-400 to-transparent",
          accent === "purple" && "bg-gradient-to-r from-transparent via-purple-400 to-transparent"
        )}
      />
    </div>
  );
}
