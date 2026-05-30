"use client";

import type { ModeDistribution } from "@/lib/types";
import { modeLabel } from "@/lib/utils";
import { cn } from "@/lib/utils";

const CHART_COLORS = ["#005cae", "#4090ff", "#7ab8ff", "#004584", "#d5e3ff", "#002d5a"];

type WeeklyModeFocusProps = {
  modes: ModeDistribution[];
};

export function WeeklyModeFocus({ modes }: WeeklyModeFocusProps) {
  if (modes.length === 0) return null;

  const topMode = [...modes].sort((a, b) => b.percentage - a.percentage)[0];
  const totalMinutes = modes.reduce((sum, m) => sum + m.total_minutes, 0);

  return (
    <section className="rounded-2xl border border-outline-variant/15 bg-surface-container-lowest shadow-sm">
      <div className="p-5 sm:p-6 border-b border-outline-variant/10">
        <h2 className="text-base font-bold text-on-surface">How you spent your focus</h2>
        <p className="text-sm text-on-surface-variant mt-1">
          {totalMinutes > 0 ? (
            <>
              <span className="font-medium text-on-surface">{modeLabel(topMode.mode)}</span> led this week
              {" "}({Math.round(topMode.percentage)}% of tracked time).
            </>
          ) : (
            "Start a focus mode session to see your breakdown here."
          )}
        </p>
      </div>

      <div className="p-5 sm:p-6 space-y-6">
        <div className="flex flex-wrap justify-center gap-4 sm:gap-6">
          {modes.map((md, i) => {
            const color = CHART_COLORS[i % CHART_COLORS.length];
            return (
              <div key={md.mode} className="text-center w-[5.5rem] sm:w-24">
                <div
                  className="mx-auto mb-2 flex h-14 w-14 sm:h-16 sm:w-16 items-center justify-center rounded-full text-sm font-bold tabular-nums"
                  style={{
                    backgroundColor: `${color}18`,
                    color,
                  }}
                >
                  {Math.round(md.percentage)}%
                </div>
                <p className="text-xs font-medium text-on-surface leading-tight">{modeLabel(md.mode)}</p>
                <p className="text-[10px] text-on-surface-variant mt-0.5 tabular-nums">{md.total_minutes} min</p>
              </div>
            );
          })}
        </div>

        <div className="space-y-4 pt-2 border-t border-outline-variant/10">
          {modes.map((md, i) => {
            const color = CHART_COLORS[i % CHART_COLORS.length];
            return (
              <div key={`bar-${md.mode}`}>
                <div className="flex items-center justify-between mb-1.5 text-sm gap-2">
                  <span className="font-medium truncate">{modeLabel(md.mode)}</span>
                  <span className="text-on-surface-variant tabular-nums shrink-0 text-xs sm:text-sm">
                    {Math.round(md.percentage)}% · {md.total_minutes} min
                  </span>
                </div>
                <div className="h-2 rounded-full bg-surface-container-high overflow-hidden">
                  <div
                    className={cn("h-full rounded-full transition-all")}
                    style={{ width: `${Math.min(100, md.percentage)}%`, backgroundColor: color }}
                  />
                </div>
              </div>
            );
          })}
        </div>
      </div>
    </section>
  );
}
