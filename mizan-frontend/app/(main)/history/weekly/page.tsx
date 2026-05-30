"use client";

import { useEffect, useMemo, useState } from "react";
import Link from "next/link";
import {
  CalendarRange,
  Moon,
  Sparkles,
  Target,
  TrendingUp,
} from "lucide-react";

import { HistoryBackLink } from "@/components/history/history-back-link";
import { HistoryStatCard } from "@/components/history/history-stat-card";
import { WeeklyModeFocus } from "@/components/history/weekly-mode-focus";
import { WeeklyStressCard } from "@/components/history/weekly-stress-card";
import { WeeklyWeekBanner } from "@/components/history/weekly-week-banner";
import { analyticsApi, getApiErrorMessage } from "@/lib/api";
import { Button } from "@/components/ui/button";
import { Card, CardContent } from "@/components/ui/card";
import { Skeleton } from "@/components/ui/skeleton";
import type { WeeklyReport } from "@/lib/types";

function moodHint(avg: number) {
  if (avg >= 4) return "Mostly positive";
  if (avg >= 3) return "Steady overall";
  if (avg > 0) return "Room to recharge";
  return undefined;
}

function sleepHint(hours: number) {
  if (hours >= 7) return "Healthy range";
  if (hours >= 6) return "Slightly short";
  if (hours > 0) return "Below target";
  return undefined;
}

export default function WeeklyReportPage() {
  const [report, setReport] = useState<WeeklyReport | null>(null);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState("");

  const fetchReport = async () => {
    setLoading(true);
    setError("");
    try {
      const data = await analyticsApi.weeklyReport();
      setReport(data);
    } catch (err: unknown) {
      setError(getApiErrorMessage(err, "Unable to load weekly report."));
    } finally {
      setLoading(false);
    }
  };

  useEffect(() => {
    void fetchReport();
  }, []);

  const insights = useMemo(() => {
    if (!report) return null;
    const parts: string[] = [];
    if (report.total_checkins >= 4) {
      parts.push("You checked in regularly — great for spotting patterns.");
    } else if (report.total_checkins > 0) {
      parts.push("A few more check-ins next week will sharpen this summary.");
    }
    if (report.goals_achieved > 0) {
      parts.push(
        `You completed ${report.goals_achieved} goal${report.goals_achieved === 1 ? "" : "s"} this week.`
      );
    }
    return parts.length > 0 ? parts.join(" ") : "Complete check-ins and focus sessions to unlock richer insights.";
  }, [report]);

  if (loading) {
    return (
      <div className="page-enter max-w-5xl mx-auto space-y-6 pb-16">
        <Skeleton className="h-5 w-36" />
        <Skeleton className="h-10 w-56" />
        <Skeleton className="h-28 rounded-2xl" />
        <div className="grid grid-cols-2 lg:grid-cols-4 gap-3">
          {[1, 2, 3, 4].map((i) => (
            <Skeleton key={i} className="h-24 rounded-xl" />
          ))}
        </div>
        <Skeleton className="h-36 rounded-2xl" />
        <Skeleton className="h-64 rounded-2xl" />
      </div>
    );
  }

  if (!report && !error) {
    return (
      <div className="page-enter max-w-5xl mx-auto space-y-6 pb-16">
        <HistoryBackLink />
        <header>
          <p className="text-xs font-semibold uppercase tracking-wide text-primary">Weekly summary</p>
          <h1 className="text-2xl sm:text-3xl font-bold mt-1">This week at a glance</h1>
        </header>
        <Card className="!rounded-2xl border-outline-variant/15 shadow-sm">
          <CardContent className="!p-8 sm:!p-10 text-center">
            <div className="mx-auto mb-4 flex h-14 w-14 items-center justify-center rounded-2xl bg-primary/10 text-primary">
              <CalendarRange className="h-7 w-7" />
            </div>
            <p className="text-base font-semibold text-on-surface">No weekly report yet</p>
            <p className="text-sm text-on-surface-variant mt-2 max-w-md mx-auto leading-relaxed">
              Check in a few times this week and your summary will appear here with mood, sleep, and focus
              breakdowns.
            </p>
            <Button className="mt-6 gradient-primary text-on-primary" asChild>
              <Link href="/dashboard#wellbeing">Start check-in</Link>
            </Button>
          </CardContent>
        </Card>
      </div>
    );
  }

  return (
    <div className="page-enter max-w-5xl mx-auto space-y-6 pb-16">
      <HistoryBackLink />

      <header>
        <p className="text-xs font-semibold uppercase tracking-wide text-primary">Weekly summary</p>
        <h1 className="text-2xl sm:text-3xl font-bold mt-1">This week at a glance</h1>
        <p className="text-sm text-on-surface-variant mt-2 max-w-2xl">
          A consolidated view of mood, sleep, check-ins, goals, stress, and focus for the current week.
        </p>
      </header>

      {error ? (
        <Card className="!rounded-xl border-red-200/80">
          <CardContent className="!p-4 flex flex-wrap items-center justify-between gap-3">
            <p className="text-sm text-red-600">{error}</p>
            <Button variant="secondary" size="sm" onClick={() => void fetchReport()}>
              Retry
            </Button>
          </CardContent>
        </Card>
      ) : null}

      {report ? (
        <>
          <WeeklyWeekBanner
            weekStart={report.week_start}
            weekEnd={report.week_end}
            totalCheckins={report.total_checkins}
          />

          {insights ? (
            <p className="text-sm text-on-surface-variant rounded-xl border border-outline-variant/15 bg-surface-container-lowest px-4 py-3 leading-relaxed">
              {insights}
            </p>
          ) : null}

          <div className="grid grid-cols-2 lg:grid-cols-4 gap-3">
            <HistoryStatCard
              label="Avg mood"
              value={report.avg_mood.toFixed(1)}
              hint={moodHint(report.avg_mood)}
              icon={Sparkles}
            />
            <HistoryStatCard
              label="Avg sleep"
              value={`${report.avg_sleep.toFixed(1)}h`}
              hint={sleepHint(report.avg_sleep)}
              icon={Moon}
            />
            <HistoryStatCard
              label="Check-ins"
              value={String(report.total_checkins)}
              hint="Morning + evening"
              icon={TrendingUp}
            />
            <HistoryStatCard
              label="Goals hit"
              value={String(report.goals_achieved)}
              hint="Completed this week"
              icon={Target}
            />
          </div>

          <WeeklyStressCard stressLevel={String(report.stress_level)} />

          <WeeklyModeFocus modes={report.mode_distribution} />

          {report.mode_distribution.length === 0 ? (
            <Card className="!rounded-2xl border-outline-variant/15 shadow-sm">
              <CardContent className="!p-6 text-center">
                <p className="text-sm font-medium text-on-surface">No focus sessions yet</p>
                <p className="text-sm text-on-surface-variant mt-1.5 mb-4">
                  Use work modes during the week to see how your time was distributed.
                </p>
                <Button variant="secondary" size="sm" asChild>
                  <Link href="/modes">Open modes</Link>
                </Button>
              </CardContent>
            </Card>
          ) : null}
        </>
      ) : null}
    </div>
  );
}
