"use client";

import { useCallback, useEffect, useMemo, useState } from "react";
import Link from "next/link";
import {
  LineChart,
  Line,
  XAxis,
  YAxis,
  Tooltip,
  ResponsiveContainer,
  BarChart,
  Bar,
  Cell,
  CartesianGrid,
} from "recharts";
import {
  Activity,
  CalendarCheck,
  ChevronRight,
  Moon,
  Sparkles,
  TrendingUp,
} from "lucide-react";

import { HistoryPeriodTabs } from "@/components/history/history-period-tabs";
import { HistoryStatCard } from "@/components/history/history-stat-card";
import { HistoryTimeline, type HistoryTimelineItem } from "@/components/history/history-timeline";
import { analyticsApi, checkinsApi, getApiErrorMessage } from "@/lib/api";
import { Button } from "@/components/ui/button";
import { Card, CardContent } from "@/components/ui/card";
import { Skeleton } from "@/components/ui/skeleton";
import type { ModeDistribution, MoodGraphPoint, MorningCheckinResponse, EveningCheckinResponse } from "@/lib/types";
import { modeLabel, formatDateShort } from "@/lib/utils";

const CHART_COLORS = ["#005cae", "#4090ff", "#7ab8ff", "#004584", "#d5e3ff", "#002d5a"];

const TOOLTIP_STYLE = {
  borderRadius: "12px",
  border: "1px solid rgba(0,0,0,0.06)",
  boxShadow: "0 8px 24px rgba(28,27,27,0.08)",
  fontSize: "13px",
};

export default function HistoryPage() {
  const [days, setDays] = useState(30);
  const [moodData, setMoodData] = useState<MoodGraphPoint[]>([]);
  const [modeData, setModeData] = useState<ModeDistribution[]>([]);
  const [timelineData, setTimelineData] = useState<HistoryTimelineItem[]>([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState("");

  const fetchData = useCallback(async () => {
    setLoading(true);
    setError("");
    try {
      const [mood, modes, historyRes] = await Promise.all([
        analyticsApi.mood(days),
        analyticsApi.modes(days),
        checkinsApi.history(days),
      ]);
      setMoodData(mood);
      setModeData(modes);

      const items: HistoryTimelineItem[] = [];
      historyRes.morning_checkins.forEach((mc: MorningCheckinResponse) => {
        items.push({
          id: mc.id,
          type: "morning",
          date: mc.date,
          time: mc.checkin_time,
          mood_score: mc.mood_score,
          executive_summary: mc.executive_summary,
          detailed_action_plan: mc.detailed_action_plan,
          detected_risks: mc.detected_risks,
        });
      });
      historyRes.evening_checkins.forEach((ec: EveningCheckinResponse) => {
        items.push({
          id: ec.id,
          type: "evening",
          date: ec.date,
          time: ec.checkin_time,
          mood_score: ec.mood_score,
          executive_summary: ec.executive_summary,
          detailed_action_plan: ec.detailed_action_plan,
          detected_risks: ec.detected_risks,
        });
      });

      items.sort((a, b) => {
        const dateDiff = new Date(b.date).getTime() - new Date(a.date).getTime();
        if (dateDiff === 0) return b.time.localeCompare(a.time);
        return dateDiff;
      });

      setTimelineData(items);
    } catch (err: unknown) {
      setError(getApiErrorMessage(err, "Unable to load history."));
    } finally {
      setLoading(false);
    }
  }, [days]);

  useEffect(() => {
    void fetchData();
  }, [fetchData]);

  const stats = useMemo(() => {
    const avgMood =
      moodData.length > 0
        ? (moodData.reduce((s, p) => s + p.mood_score, 0) / moodData.length).toFixed(1)
        : "—";
    const avgSleep =
      moodData.length > 0
        ? (moodData.reduce((s, p) => s + p.sleep_hours, 0) / moodData.length).toFixed(1)
        : "—";
    const reports = timelineData.filter((t) => t.executive_summary);
    const latestMood = moodData.length > 0 ? moodData[moodData.length - 1]?.mood_score : null;
    return {
      avgMood,
      avgSleep,
      checkins: timelineData.length,
      reports: reports.length,
      latestMood: latestMood != null ? `${latestMood}/5` : "—",
      reportItems: reports,
    };
  }, [moodData, timelineData]);

  const chartMoodData = moodData.map((p) => ({
    ...p,
    dateLabel: formatDateShort(p.date),
  }));

  if (loading) {
    return (
      <div className="page-enter max-w-5xl mx-auto space-y-6 pb-16">
        <Skeleton className="h-10 w-64" />
        <Skeleton className="h-4 w-96 max-w-full" />
        <div className="grid grid-cols-2 lg:grid-cols-4 gap-3">
          {[1, 2, 3, 4].map((i) => (
            <Skeleton key={i} className="h-24 rounded-xl" />
          ))}
        </div>
        <Skeleton className="h-80 rounded-2xl" />
      </div>
    );
  }

  return (
    <div className="page-enter max-w-5xl mx-auto space-y-6 pb-16">
      <header className="space-y-4">
        <div className="flex flex-col sm:flex-row sm:items-end sm:justify-between gap-4">
          <div>
            <p className="text-xs font-semibold uppercase tracking-wide text-primary">Progress</p>
            <h1 className="text-2xl sm:text-3xl font-bold mt-1">Your wellbeing journey</h1>
            <p className="text-sm text-on-surface-variant mt-2 max-w-xl">
              Mood, sleep, focus modes, and AI check-in summaries over time.
            </p>
          </div>
          <HistoryPeriodTabs days={days} onChange={setDays} />
        </div>

        <div className="grid grid-cols-2 lg:grid-cols-4 gap-3">
          <HistoryStatCard label="Avg mood" value={stats.avgMood} hint={`Last ${days} days`} icon={Sparkles} />
          <HistoryStatCard label="Avg sleep" value={stats.avgSleep === "—" ? "—" : `${stats.avgSleep}h`} icon={Moon} />
          <HistoryStatCard label="Check-ins" value={String(stats.checkins)} hint="Morning + evening" icon={CalendarCheck} />
          <HistoryStatCard label="Latest mood" value={stats.latestMood} icon={TrendingUp} />
        </div>
      </header>

      {error ? (
        <Card className="!rounded-xl">
          <CardContent className="!p-4 flex flex-wrap items-center justify-between gap-3">
            <p className="text-sm text-red-600">{error}</p>
            <Button variant="secondary" size="sm" onClick={() => void fetchData()}>
              Retry
            </Button>
          </CardContent>
        </Card>
      ) : null}

      <Card className="!rounded-2xl border-outline-variant/15 shadow-sm overflow-hidden">
        <CardContent className="!p-4 sm:!p-6">
          <div className="flex items-center justify-between gap-2 mb-4">
            <h2 className="text-base font-bold">Mood & sleep</h2>
            <div className="flex items-center gap-3 text-xs text-on-surface-variant">
              <span className="inline-flex items-center gap-1">
                <span className="h-2 w-2 rounded-full bg-[#005cae]" />
                Mood
              </span>
              <span className="inline-flex items-center gap-1">
                <span className="h-0.5 w-3 border-t-2 border-dashed border-[#7ab8ff]" />
                Sleep
              </span>
            </div>
          </div>

          {moodData.length > 0 ? (
            <ResponsiveContainer width="100%" height={260}>
              <LineChart data={chartMoodData}>
                <CartesianGrid strokeDasharray="3 3" stroke="rgba(0,0,0,0.06)" vertical={false} />
                <XAxis dataKey="dateLabel" tick={{ fontSize: 11 }} tickMargin={8} />
                <YAxis domain={[0, 5]} tick={{ fontSize: 11 }} width={28} />
                <Tooltip
                  contentStyle={TOOLTIP_STYLE}
                  formatter={(v: number, name: string) =>
                    name === "mood_score" ? [`${v}/5`, "Mood"] : [`${v}h`, "Sleep"]
                  }
                />
                <Line type="monotone" dataKey="mood_score" stroke="#005cae" strokeWidth={2.5} dot={{ r: 3 }} activeDot={{ r: 5 }} />
                <Line type="monotone" dataKey="sleep_hours" stroke="#7ab8ff" strokeWidth={2} strokeDasharray="6 4" dot={false} />
              </LineChart>
            </ResponsiveContainer>
          ) : (
            <div className="h-[260px] flex flex-col items-center justify-center gap-3 text-center px-4">
              <Activity className="h-10 w-10 text-primary/30" />
              <p className="text-sm text-on-surface-variant">No mood data for this period yet.</p>
              <Button variant="secondary" size="sm" asChild>
                <Link href="/dashboard#wellbeing">Start a check-in</Link>
              </Button>
            </div>
          )}
        </CardContent>
      </Card>

      {modeData.length > 0 ? (
        <div className="grid grid-cols-1 lg:grid-cols-2 gap-4">
          <Card className="!rounded-2xl border-outline-variant/15 shadow-sm">
            <CardContent className="!p-4 sm:!p-6">
              <h2 className="text-base font-bold mb-4">Focus modes</h2>
              <div className="flex flex-wrap justify-center gap-4 sm:gap-6 py-2">
                {modeData.map((md, i) => (
                  <div key={md.mode} className="text-center w-24">
                    <div
                      className="mx-auto mb-2 flex h-14 w-14 items-center justify-center rounded-full text-sm font-bold tabular-nums"
                      style={{
                        backgroundColor: `${CHART_COLORS[i % CHART_COLORS.length]}18`,
                        color: CHART_COLORS[i % CHART_COLORS.length],
                      }}
                    >
                      {Math.round(md.percentage)}%
                    </div>
                    <p className="text-xs font-medium text-on-surface leading-tight">{modeLabel(md.mode)}</p>
                    <p className="text-[10px] text-on-surface-variant mt-0.5">{md.total_minutes} min</p>
                  </div>
                ))}
              </div>
            </CardContent>
          </Card>

          <Card className="!rounded-2xl border-outline-variant/15 shadow-sm">
            <CardContent className="!p-4 sm:!p-6">
              <div className="flex items-center justify-between gap-2 mb-4">
                <h2 className="text-base font-bold">Time by mode</h2>
                <Button variant="ghost" size="sm" className="h-8 text-primary" asChild>
                  <Link href="/history/weekly">
                    Weekly report
                    <ChevronRight className="h-4 w-4 ml-0.5" />
                  </Link>
                </Button>
              </div>
              <ResponsiveContainer width="100%" height={220}>
                <BarChart data={modeData.map((md) => ({ name: modeLabel(md.mode), minutes: md.total_minutes }))}>
                  <CartesianGrid strokeDasharray="3 3" stroke="rgba(0,0,0,0.06)" vertical={false} />
                  <XAxis dataKey="name" tick={{ fontSize: 10 }} interval={0} angle={-12} textAnchor="end" height={48} />
                  <YAxis tick={{ fontSize: 10 }} width={32} />
                  <Tooltip contentStyle={TOOLTIP_STYLE} formatter={(v: number) => [`${v} min`, "Focus"]} />
                  <Bar dataKey="minutes" radius={[6, 6, 0, 0]} maxBarSize={48}>
                    {modeData.map((_, i) => (
                      <Cell key={i} fill={CHART_COLORS[i % CHART_COLORS.length]} />
                    ))}
                  </Bar>
                </BarChart>
              </ResponsiveContainer>
            </CardContent>
          </Card>
        </div>
      ) : null}

      {stats.reportItems.length > 0 ? (
        <HistoryTimeline data={stats.reportItems} />
      ) : timelineData.length === 0 ? (
        <Card className="!rounded-2xl">
          <CardContent className="!p-8 text-center">
            <Sparkles className="h-10 w-10 text-primary/40 mx-auto mb-3" />
            <p className="text-sm font-semibold">No check-ins in this period</p>
            <p className="text-sm text-on-surface-variant mt-2 mb-4">
              Complete morning or evening rituals to build your history here.
            </p>
            <Button className="gradient-primary text-on-primary" asChild>
              <Link href="/dashboard#wellbeing">Open wellbeing check-in</Link>
            </Button>
          </CardContent>
        </Card>
      ) : null}
    </div>
  );
}
