"use client";

import type { LucideIcon } from "lucide-react";

import { cn } from "@/lib/utils";

type HistoryStatCardProps = {
  label: string;
  value: string;
  hint?: string;
  icon: LucideIcon;
  className?: string;
};

export function HistoryStatCard({ label, value, hint, icon: Icon, className }: HistoryStatCardProps) {
  return (
    <div
      className={cn(
        "rounded-xl border border-outline-variant/15 bg-surface-container-lowest p-4 shadow-sm",
        className
      )}
    >
      <div className="flex items-start justify-between gap-2">
        <div className="min-w-0">
          <p className="text-[11px] font-semibold uppercase tracking-wide text-on-surface-variant">{label}</p>
          <p className="text-2xl font-bold text-on-surface mt-1 tabular-nums">{value}</p>
          {hint ? <p className="text-xs text-on-surface-variant mt-1">{hint}</p> : null}
        </div>
        <div className="flex h-9 w-9 shrink-0 items-center justify-center rounded-lg bg-primary/10 text-primary">
          <Icon className="h-4 w-4" />
        </div>
      </div>
    </div>
  );
}
