"use client";

import { cn } from "@/lib/utils";

const PERIODS = [
  { days: 7, label: "7 days" },
  { days: 14, label: "14 days" },
  { days: 30, label: "30 days" },
] as const;

type HistoryPeriodTabsProps = {
  days: number;
  onChange: (days: number) => void;
  className?: string;
};

export function HistoryPeriodTabs({ days, onChange, className }: HistoryPeriodTabsProps) {
  return (
    <div className={cn("inline-flex rounded-lg border border-outline-variant/15 bg-surface-container/40 p-1", className)}>
      {PERIODS.map((p) => (
        <button
          key={p.days}
          type="button"
          onClick={() => onChange(p.days)}
          className={cn(
            "rounded-md px-3 py-1.5 text-sm font-medium transition-colors",
            days === p.days
              ? "bg-surface-container-lowest text-primary shadow-sm"
              : "text-on-surface-variant hover:text-on-surface"
          )}
        >
          {p.label}
        </button>
      ))}
    </div>
  );
}
