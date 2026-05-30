"use client";

import { useState } from "react";
import { ChevronRight, Moon, ShieldAlert, Sparkles, Sun, Target } from "lucide-react";

import { Badge } from "@/components/ui/badge";
import { formatDateShort } from "@/lib/utils";
import { cn } from "@/lib/utils";

export type HistoryTimelineItem = {
  id: string;
  type: "morning" | "evening";
  date: string;
  time: string;
  mood_score: number;
  executive_summary: string | null;
  detailed_action_plan: string[] | null;
  detected_risks: string[] | null;
};

function moodBadgeVariant(score: number) {
  if (score >= 4) return "success" as const;
  if (score >= 3) return "secondary" as const;
  return "warning" as const;
}

export function HistoryTimeline({ data }: { data: HistoryTimelineItem[] }) {
  const [openItemId, setOpenItemId] = useState<string | null>(data[0]?.id ?? null);

  if (!data.length) return null;

  return (
    <section className="space-y-4">
      <div className="flex flex-wrap items-end justify-between gap-3">
        <div>
          <h2 className="text-lg font-bold flex items-center gap-2">
            <Sparkles className="h-5 w-5 text-primary" />
            Check-in reports
          </h2>
          <p className="text-sm text-on-surface-variant mt-1">
            AI summaries from your morning and evening rituals.
          </p>
        </div>
        <Badge variant="secondary">{data.length} entries</Badge>
      </div>

      <div className="relative ml-3 sm:ml-4 border-l-2 border-outline-variant/20 pl-6 sm:pl-8 space-y-4">
        {data.map((item) => {
          const isOpen = openItemId === item.id;
          const isMorning = item.type === "morning";
          const Icon = isMorning ? Sun : Moon;

          return (
            <article key={item.id} className="relative">
              <span
                className={cn(
                  "absolute -left-[1.85rem] sm:-left-[2.35rem] top-5 h-3.5 w-3.5 rounded-full border-2 border-surface-container-lowest",
                  isMorning ? "bg-amber-400" : "bg-indigo-400"
                )}
                aria-hidden
              />

              <button
                type="button"
                onClick={() => setOpenItemId((prev) => (prev === item.id ? null : item.id))}
                className="w-full text-left rounded-xl border border-outline-variant/15 bg-surface-container-lowest shadow-sm hover:border-primary/25 transition-colors focus:outline-none focus-visible:ring-2 focus-visible:ring-primary/30"
              >
                <div className="flex items-center justify-between gap-3 p-4">
                  <div className="flex items-center gap-3 min-w-0">
                    <div
                      className={cn(
                        "flex h-10 w-10 shrink-0 items-center justify-center rounded-lg",
                        isMorning ? "bg-amber-50 text-amber-700" : "bg-indigo-50 text-indigo-700"
                      )}
                    >
                      <Icon className="h-5 w-5" />
                    </div>
                    <div className="min-w-0">
                      <p className="font-semibold text-on-surface">
                        {isMorning ? "Morning check-in" : "Evening review"}
                      </p>
                      <p className="text-xs text-on-surface-variant mt-0.5">
                        {formatDateShort(item.date)}
                        {item.time ? ` · ${item.time.substring(0, 5)}` : ""}
                      </p>
                    </div>
                  </div>
                  <div className="flex items-center gap-2 shrink-0">
                    <Badge variant={moodBadgeVariant(item.mood_score)}>{item.mood_score}/5</Badge>
                    <ChevronRight
                      className={cn(
                        "h-5 w-5 text-on-surface-variant transition-transform",
                        isOpen && "rotate-90"
                      )}
                    />
                  </div>
                </div>
              </button>

              {isOpen ? (
                <div className="mt-2 rounded-xl border border-outline-variant/12 bg-surface-container/30 p-4 sm:p-5 space-y-4">
                  {item.executive_summary ? (
                    <p className="text-sm text-on-surface leading-relaxed whitespace-pre-wrap">
                      {item.executive_summary}
                    </p>
                  ) : null}

                  {item.detailed_action_plan && item.detailed_action_plan.length > 0 ? (
                    <div className="pt-3 border-t border-outline-variant/15">
                      <h4 className="text-xs font-bold uppercase tracking-wide text-on-surface-variant flex items-center gap-2 mb-2">
                        <Target className="h-3.5 w-3.5 text-primary" />
                        Action plan
                      </h4>
                      <ul className="space-y-2">
                        {item.detailed_action_plan.map((action, idx) => (
                          <li key={idx} className="text-sm text-on-surface flex gap-2">
                            <span className="text-primary mt-1.5 h-1.5 w-1.5 shrink-0 rounded-full bg-primary/60" />
                            <span>{action}</span>
                          </li>
                        ))}
                      </ul>
                    </div>
                  ) : null}

                  {item.detected_risks && item.detected_risks.length > 0 ? (
                    <div className="pt-3 border-t border-outline-variant/15">
                      <h4 className="text-xs font-bold uppercase tracking-wide text-red-700 flex items-center gap-2 mb-2">
                        <ShieldAlert className="h-3.5 w-3.5" />
                        Risk signals
                      </h4>
                      <ul className="space-y-2 rounded-lg border border-red-200/50 bg-red-50/50 p-3">
                        {item.detected_risks.map((risk, idx) => (
                          <li key={idx} className="text-sm text-red-800/90">
                            {risk}
                          </li>
                        ))}
                      </ul>
                    </div>
                  ) : null}
                </div>
              ) : null}
            </article>
          );
        })}
      </div>
    </section>
  );
}
