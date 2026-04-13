"use client";

import { useEffect, useMemo, useState } from "react";
import { Timer } from "lucide-react";

const MORNING_TARGET_HOUR = 8;
const EVENING_TARGET_HOUR = 20;

type CheckinPeriod = "MORNING" | "EVENING";

type NextCheckinCountdownProps = {
  completedPeriod: CheckinPeriod;
  className?: string;
};

function getNextTargetDate(completedPeriod: CheckinPeriod, now: Date): Date {
  const target = new Date(now);
  target.setSeconds(0, 0);

  if (completedPeriod === "MORNING") {
    target.setHours(EVENING_TARGET_HOUR, 0, 0, 0);
    if (target <= now) {
      target.setDate(target.getDate() + 1);
    }
    return target;
  }

  target.setDate(target.getDate() + 1);
  target.setHours(MORNING_TARGET_HOUR, 0, 0, 0);
  return target;
}

function formatDuration(ms: number): string {
  const totalSeconds = Math.max(0, Math.floor(ms / 1000));
  const hours = Math.floor(totalSeconds / 3600);
  const minutes = Math.floor((totalSeconds % 3600) / 60);
  const seconds = totalSeconds % 60;
  return `${hours}h ${minutes}m ${seconds}s`;
}

export function NextCheckinCountdown({ completedPeriod, className }: NextCheckinCountdownProps) {
  const [now, setNow] = useState<Date>(new Date());

  useEffect(() => {
    const interval = window.setInterval(() => setNow(new Date()), 1000);
    return () => window.clearInterval(interval);
  }, []);

  const targetDate = useMemo(() => getNextTargetDate(completedPeriod, now), [completedPeriod, now]);
  const remainingMs = targetDate.getTime() - now.getTime();
  const nextLabel = completedPeriod === "MORNING" ? "evening check-in" : "morning check-in";

  return (
    <div className={`rounded-xl border bg-surface-container/40 p-4 ${className ?? ""}`}>
      <p className="text-xs uppercase tracking-wide text-on-surface-variant">Next check-in countdown</p>
      <p className="mt-2 flex items-center gap-2 text-sm text-on-surface">
        <Timer className="h-4 w-4 text-primary" />
        <span>
          Time left before your {nextLabel}: <strong>{formatDuration(remainingMs)}</strong>
        </span>
      </p>
    </div>
  );
}
