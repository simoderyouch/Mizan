"use client";

import { CalendarRange } from "lucide-react";

import { formatDate } from "@/lib/utils";

type WeeklyWeekBannerProps = {
  weekStart: string;
  weekEnd: string;
  totalCheckins: number;
};

export function WeeklyWeekBanner({ weekStart, weekEnd, totalCheckins }: WeeklyWeekBannerProps) {
  return (
    <section className="rounded-2xl border border-outline-variant/15 bg-gradient-to-br from-primary/[0.08] via-surface-container-lowest to-surface-container-lowest shadow-sm overflow-hidden">
      <div className="flex flex-col sm:flex-row sm:items-center sm:justify-between gap-4 p-5 sm:p-6">
        <div className="flex items-start gap-4 min-w-0">
          <div className="flex h-12 w-12 shrink-0 items-center justify-center rounded-xl bg-primary/12 text-primary">
            <CalendarRange className="h-6 w-6" />
          </div>
          <div className="min-w-0">
            <p className="text-[11px] font-semibold uppercase tracking-wide text-primary">Reporting period</p>
            <p className="text-lg sm:text-xl font-bold text-on-surface mt-0.5">
              {formatDate(weekStart)} — {formatDate(weekEnd)}
            </p>
            <p className="text-sm text-on-surface-variant mt-1">
              Aggregated from your check-ins and focus sessions this week.
            </p>
          </div>
        </div>
        <div className="flex sm:flex-col items-center sm:items-end gap-1 rounded-xl bg-surface/80 border border-outline-variant/10 px-4 py-3 sm:min-w-[7rem]">
          <span className="text-2xl font-bold text-on-surface tabular-nums">{totalCheckins}</span>
          <span className="text-xs font-medium text-on-surface-variant uppercase tracking-wide">
            check-in{totalCheckins === 1 ? "" : "s"}
          </span>
        </div>
      </div>
    </section>
  );
}
