"use client";

import clsx from "clsx";

interface StatusBarProps {
  online: boolean | null;
}

export default function StatusBar({ online }: StatusBarProps) {
  return (
    <div className="flex items-center gap-2">
      <span
        className={clsx(
          "h-2 w-2 rounded-full pulse-dot",
          online === null  && "bg-slate-500",
          online === true  && "bg-emerald-400 text-emerald-400",
          online === false && "bg-red-400 text-red-400"
        )}
      />
      <span className="text-xs text-slate-500">
        {online === null  ? "Connecting…" : online ? "Backend online" : "Backend offline"}
      </span>
    </div>
  );
}
