"use client";

import { Activity } from "lucide-react";

import { cn } from "@/lib/utils";

const STRESS_LEVELS = ["LOW", "MEDIUM", "HIGH"] as const;

function stressCopy(level: string) {
  if (level === "LOW") return { title: "Low stress", detail: "Your week looked relatively stable. Keep your current rhythm." };
  if (level === "MEDIUM") return { title: "Balanced week", detail: "Some pressure showed up, but you stayed in a manageable range." };
  return { title: "High stress", detail: "This week was demanding. Prioritize rest and lighter goals where you can." };
}

function stressTone(level: string) {
  if (level === "LOW") {
    return {
      bar: "bg-emerald-500",
      icon: "bg-emerald-500/12 text-emerald-700",
      border: "border-emerald-200/80",
      bg: "bg-emerald-50/80",
    };
  }
  if (level === "MEDIUM") {
    return {
      bar: "bg-amber-500",
      icon: "bg-amber-500/12 text-amber-800",
      border: "border-amber-200/80",
      bg: "bg-amber-50/80",
    };
  }
  return {
    bar: "bg-red-500",
    icon: "bg-red-500/12 text-red-700",
    border: "border-red-200/80",
    bg: "bg-red-50/80",
  };
}

type WeeklyStressCardProps = {
  stressLevel: string;
};

export function WeeklyStressCard({ stressLevel }: WeeklyStressCardProps) {
  const level = String(stressLevel).toUpperCase();
  const copy = stressCopy(level);
  const tone = stressTone(level);
  const rawIndex = STRESS_LEVELS.indexOf(level as (typeof STRESS_LEVELS)[number]);
  const activeIndex = rawIndex >= 0 ? rawIndex : 1;

  return (
    <section
      className={cn(
        "rounded-2xl border shadow-sm overflow-hidden",
        tone.border,
        tone.bg
      )}
    >
      <div className="p-5 sm:p-6">
        <div className="flex items-start gap-4">
          <div className={cn("flex h-11 w-11 shrink-0 items-center justify-center rounded-xl", tone.icon)}>
            <Activity className="h-5 w-5" />
          </div>
          <div className="min-w-0">
            <p className="text-[11px] font-semibold uppercase tracking-wide text-on-surface-variant">Stress signal</p>
            <h2 className="text-lg font-bold text-on-surface mt-0.5">{copy.title}</h2>
            <p className="text-sm text-on-surface-variant mt-1.5 leading-relaxed">{copy.detail}</p>
          </div>
        </div>

        <div className="mt-5 grid grid-cols-3 gap-2">
          {STRESS_LEVELS.map((step, index) => (
            <div key={step} className="space-y-1.5">
              <div
                className={cn(
                  "h-2 rounded-full transition-colors",
                  index <= activeIndex ? tone.bar : "bg-on-surface/10"
                )}
              />
              <p
                className={cn(
                  "text-[10px] font-semibold uppercase tracking-wide text-center",
                  index === activeIndex ? "text-on-surface" : "text-on-surface-variant/70"
                )}
              >
                {step === "LOW" ? "Low" : step === "MEDIUM" ? "Medium" : "High"}
              </p>
            </div>
          ))}
        </div>
      </div>
    </section>
  );
}
