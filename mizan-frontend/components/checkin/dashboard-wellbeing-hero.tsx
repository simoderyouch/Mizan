"use client";

import { Heart, Mic, Moon, Sparkles, Sun } from "lucide-react";

import { Button } from "@/components/ui/button";
import { cn } from "@/lib/utils";
import { useCheckinModal } from "@/components/checkin/checkin-modal-context";

type DashboardWellbeingHeroProps = {
  hasMorningCheckin: boolean;
  hasEveningCheckin: boolean;
  firstName?: string;
};

export function DashboardWellbeingHero({
  hasMorningCheckin,
  hasEveningCheckin,
  firstName,
}: DashboardWellbeingHeroProps) {
  const { open: openCheckin } = useCheckinModal();

  const morningDone = hasMorningCheckin;
  const eveningDone = hasEveningCheckin;
  const completed = (morningDone ? 1 : 0) + (eveningDone ? 1 : 0);
  const allDone = completed === 2;

  const nextRitual = !morningDone ? "morning" : !eveningDone ? "evening" : null;

  const openNext = () => {
    if (nextRitual === "morning") openCheckin({ view: "morning" });
    else if (nextRitual === "evening") openCheckin({ view: "evening" });
    else openCheckin({ view: "hub" });
  };

  return (
    <section
      id="wellbeing"
      className="scroll-mt-24 rounded-[2rem] overflow-hidden shadow-sanctuary-lg border border-primary/10"
    >
      <div className="relative gradient-primary-soft px-5 py-6 sm:px-8 sm:py-8">
        <div
          className="pointer-events-none absolute -right-8 -top-8 h-40 w-40 rounded-full bg-primary/15 blur-2xl"
          aria-hidden
        />
        <div
          className="pointer-events-none absolute -left-6 bottom-0 h-28 w-28 rounded-full bg-amber-200/40 blur-2xl"
          aria-hidden
        />

        <div className="relative flex flex-col gap-5 sm:flex-row sm:items-center sm:justify-between">
          <div className="flex-1 min-w-0">
            <div className="inline-flex items-center gap-2 rounded-full bg-surface/80 backdrop-blur-sm px-3 py-1 text-xs font-semibold text-primary border border-primary/15 mb-3">
              <Heart className="h-3.5 w-3.5" />
              Daily wellbeing
            </div>

            <h2 className="text-xl sm:text-2xl font-bold text-on-surface leading-tight">
              {allDone
                ? firstName
                  ? `${firstName}, you’re balanced for today`
                  : "You’re balanced for today"
                : nextRitual === "morning"
                  ? "Start your morning ritual"
                  : "How was your day?"}
            </h2>

            <p className="text-sm text-on-surface-variant mt-2 max-w-md leading-relaxed">
              {allDone
                ? "Both rituals are done. Your weekly insights stay fresh when you show up each day."
                : nextRitual === "morning"
                  ? "A quick voice or quiz check-in sets your mood, sleep, and focus for the day."
                  : "Close the loop with an evening review — voice conversation or a short quiz."}
            </p>

            <div className="mt-4 flex flex-wrap gap-2">
              <RitualPill done={morningDone} label="Morning" icon={Sun} accent="amber" />
              <RitualPill done={eveningDone} label="Evening" icon={Moon} accent="indigo" />
            </div>
          </div>

          <div className="flex flex-col items-stretch sm:items-end gap-3 sm:min-w-[200px]">
            <div className="rounded-xl bg-surface/80 backdrop-blur-sm border border-white/60 px-4 py-3 min-w-[200px]">
              <p className="text-xs font-semibold uppercase tracking-wide text-on-surface-variant mb-3">
                Today&apos;s rituals
              </p>
              <div className="flex items-center gap-2">
                <RitualStep done={morningDone} icon={Sun} label="Morning" />
                <div
                  className={cn(
                    "h-0.5 flex-1 rounded-full transition-colors",
                    morningDone && eveningDone ? "bg-primary" : morningDone || eveningDone ? "bg-primary/40" : "bg-outline-variant/30"
                  )}
                  aria-hidden
                />
                <RitualStep done={eveningDone} icon={Moon} label="Evening" />
              </div>
              <p className="mt-2.5 text-center text-xs font-medium text-on-surface-variant">
                {allDone ? (
                  <span className="text-emerald-700">Both complete</span>
                ) : (
                  <>
                    <span className="font-bold text-primary">{completed}</span>
                    <span> of 2 done</span>
                  </>
                )}
              </p>
            </div>

            {!allDone ? (
              <Button
                size="lg"
                className="w-full sm:w-auto h-12 px-6 rounded-2xl shadow-sanctuary gradient-primary text-on-primary border-0"
                onClick={openNext}
              >
                {nextRitual === "morning" ? (
                  <>
                    <Sun className="h-4 w-4 mr-2" />
                    Morning check-in
                  </>
                ) : (
                  <>
                    <Moon className="h-4 w-4 mr-2" />
                    Evening check-in
                  </>
                )}
              </Button>
            ) : (
              <Button
                variant="secondary"
                size="lg"
                className="w-full sm:w-auto h-12 rounded-2xl bg-surface/90"
                onClick={() => openCheckin({ view: "hub" })}
              >
                <Sparkles className="h-4 w-4 mr-2 text-primary" />
                Open check-in center
              </Button>
            )}
          </div>
        </div>

        {!allDone && (
          <div className="relative mt-5 pt-5 border-t border-primary/10 grid grid-cols-1 sm:grid-cols-2 gap-3">
            <button
              type="button"
              onClick={() => openCheckin({ view: "voice", period: nextRitual === "evening" ? "EVENING" : "MORNING" })}
              className={cn(
                "group flex items-center gap-3 rounded-2xl bg-surface/60 hover:bg-surface/90 border border-white/50",
                "px-4 py-3 text-left transition-all hover:shadow-md hover:border-primary/20"
              )}
            >
              <span className="flex h-10 w-10 shrink-0 items-center justify-center rounded-xl bg-primary/10 text-primary group-hover:scale-105 transition-transform">
                <Mic className="h-5 w-5" />
              </span>
              <span>
                <span className="block text-sm font-bold">Voice mode</span>
                <span className="block text-xs text-on-surface-variant">Hands-free, AI-guided</span>
              </span>
            </button>
            <button
              type="button"
              onClick={() =>
                openCheckin({ view: nextRitual === "evening" ? "evening" : "morning" })
              }
              className={cn(
                "group flex items-center gap-3 rounded-2xl bg-surface/60 hover:bg-surface/90 border border-white/50",
                "px-4 py-3 text-left transition-all hover:shadow-md hover:border-primary/20"
              )}
            >
              <span className="flex h-10 w-10 shrink-0 items-center justify-center rounded-xl bg-primary/10 text-primary group-hover:scale-105 transition-transform">
                <Sparkles className="h-5 w-5" />
              </span>
              <span>
                <span className="block text-sm font-bold">Quiz mode</span>
                <span className="block text-xs text-on-surface-variant">Quick adaptive questions</span>
              </span>
            </button>
          </div>
        )}
      </div>
    </section>
  );
}

function RitualStep({
  done,
  icon: Icon,
  label,
}: {
  done: boolean;
  icon: typeof Sun;
  label: string;
}) {
  return (
    <div className="flex flex-col items-center gap-1 shrink-0">
      <span
        className={cn(
          "flex h-9 w-9 items-center justify-center rounded-full border-2 transition-colors",
          done
            ? "border-primary bg-primary text-on-primary shadow-sm"
            : "border-outline-variant/40 bg-surface text-on-surface-variant"
        )}
        title={`${label}${done ? " — done" : " — pending"}`}
      >
        <Icon className="h-4 w-4" />
      </span>
      <span className={cn("text-[10px] font-semibold leading-none", done ? "text-primary" : "text-on-surface-variant")}>
        {done ? "Done" : "Todo"}
      </span>
    </div>
  );
}

function RitualPill({
  done,
  label,
  icon: Icon,
  accent,
}: {
  done: boolean;
  label: string;
  icon: typeof Sun;
  accent: "amber" | "indigo";
}) {
  return (
    <span
      className={cn(
        "inline-flex items-center gap-1.5 rounded-full px-3 py-1 text-xs font-semibold border",
        done
          ? "bg-emerald-50 text-emerald-800 border-emerald-200"
          : accent === "amber"
            ? "bg-amber-50/90 text-amber-900 border-amber-200/80"
            : "bg-indigo-50/90 text-indigo-900 border-indigo-200/80"
      )}
    >
      <Icon className="h-3.5 w-3.5" />
      {label}
      <span className="opacity-70">{done ? "· done" : "· pending"}</span>
    </span>
  );
}
