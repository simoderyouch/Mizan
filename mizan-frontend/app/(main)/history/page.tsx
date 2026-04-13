"use client";

import { useCallback, useEffect, useState } from "react";
import { analyticsApi, checkinsApi, getApiErrorMessage } from "@/lib/api";
import { Card, CardContent } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Badge } from "@/components/ui/badge";
import { Tabs, TabsList, TabsTrigger } from "@/components/ui/tabs";
import type { MoodGraphPoint, ModeDistribution, MorningCheckinResponse, EveningCheckinResponse } from "@/lib/types";
import { modeLabel, formatDateShort } from "@/lib/utils";
import { Loader2, Moon, BookOpen, Sparkles, Sun, ShieldAlert, Target, ChevronRight } from "lucide-react";
import Link from "next/link";
import {
  LineChart, Line, XAxis, YAxis, Tooltip, ResponsiveContainer,
  BarChart, Bar, Cell,
} from "recharts";

const CHART_COLORS = ["#005cae", "#4090ff", "#d5e3ff", "#004584", "#7ab8ff", "#002d5a"];

interface TimelineItem {
  id: string;
  type: "morning" | "evening";
  date: string;
  time: string;
  mood_score: number;
  executive_summary: string | null;
  detailed_action_plan: string[] | null;
  detected_risks: string[] | null;
}

export default function HistoryPage() {
  const [days, setDays] = useState(30);
  const [moodData, setMoodData] = useState<MoodGraphPoint[]>([]);
  const [modeData, setModeData] = useState<ModeDistribution[]>([]);
  const [timelineData, setTimelineData] = useState<TimelineItem[]>([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState("");

  const fetchData = useCallback(async () => {
    setLoading(true);
    setError("");
    try {
      const [mood, modes, historyRes] = await Promise.all([
        analyticsApi.mood(days),
        analyticsApi.modes(days),
        checkinsApi.history(days)
      ]);
      setMoodData(mood);
      setModeData(modes);

      const items: TimelineItem[] = [];
      historyRes.morning_checkins.forEach((mc: MorningCheckinResponse) => {
        items.push({
          id: mc.id,
          type: "morning",
          date: mc.date,
          time: mc.checkin_time,
          mood_score: mc.mood_score,
          executive_summary: mc.executive_summary,
          detailed_action_plan: mc.detailed_action_plan,
          detected_risks: mc.detected_risks
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
          detected_risks: ec.detected_risks
        });
      });

      // Sort desc by date, then by time desc
      items.sort((a, b) => {
        const dateDiff = new Date(b.date).getTime() - new Date(a.date).getTime();
        if (dateDiff === 0) {
          return b.time.localeCompare(a.time);
        }
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

  if (loading) {
    return (
      <div className="flex items-center justify-center min-h-[50vh]">
        <Loader2 className="h-8 w-8 animate-spin text-primary" />
      </div>
    );
  }

  const avgMood = moodData.length > 0
    ? (moodData.reduce((s, p) => s + p.mood_score, 0) / moodData.length).toFixed(1)
    : "—";

  const avgSleep = moodData.length > 0
    ? (moodData.reduce((s, p) => s + p.sleep_hours, 0) / moodData.length).toFixed(1)
    : "—";

  return (
    <div className="page-enter space-y-8 max-w-5xl mx-auto px-1 pb-16">
      <div>
        <span className="label-sanctuary text-primary">Mood analytics</span>
        <h1 className="text-2xl sm:text-3xl md:text-4xl font-bold mt-1">Your wellbeing journey</h1>
        <p className="text-on-surface-variant mt-2 max-w-xl">
          Explore emotional trends and discover your wellbeing patterns.
        </p>
      </div>

      {/* Score */}
      <div className="flex justify-start sm:justify-end">
        <div className="flex items-center gap-3">
          <Sparkles className="h-5 w-5 text-primary" />
          <div className="text-right">
            <span className="label-sanctuary">Wellbeing score</span>
            <p className="text-2xl font-bold">{avgMood}/5</p>
          </div>
        </div>
      </div>

      {error && (
        <Card>
          <CardContent className="!p-4 flex flex-wrap items-center justify-between gap-3">
            <p className="text-sm text-red-600">{error}</p>
            <Button variant="secondary" size="sm" onClick={() => void fetchData()}>
              Retry
            </Button>
          </CardContent>
        </Card>
      )}

      <div className="grid grid-cols-1 lg:grid-cols-3 gap-6">
        {/* Mood Chart */}
        <Card className="lg:col-span-2 shadow-sanctuary-sm">
          <CardContent className="p-6">
            <div className="flex flex-col sm:flex-row sm:items-center justify-between mb-4 gap-3">
              <h3 className="text-lg sm:text-xl font-bold">Emotional intensity</h3>
              <Tabs value={days.toString()} onValueChange={(v) => setDays(parseInt(v))}>
                <TabsList className="w-full sm:w-auto h-10">
                  <TabsTrigger value="7">7j</TabsTrigger>
                  <TabsTrigger value="14">14j</TabsTrigger>
                  <TabsTrigger value="30">30j</TabsTrigger>
                </TabsList>
              </Tabs>
            </div>

            {moodData.length > 0 ? (
              <ResponsiveContainer width="100%" height={250}>
                <LineChart data={moodData.map((p) => ({ ...p, dateLabel: formatDateShort(p.date) }))}>
                  <XAxis dataKey="dateLabel" tick={{ fontSize: 10 }} />
                  <YAxis domain={[0, 5]} tick={{ fontSize: 10 }} />
                  <Tooltip
                    contentStyle={{ borderRadius: "16px", border: "none", boxShadow: "0 8px 24px rgba(28,27,27,0.08)" }}
                    formatter={(v: number, name: string) =>
                      name === "mood_score" ? [`${v}/5`, "Mood"] : [`${v}h`, "Sleep"]
                    }
                  />
                  <Line type="monotone" dataKey="mood_score" stroke="#005cae" strokeWidth={3} dot={{ r: 4 }} />
                  <Line type="monotone" dataKey="sleep_hours" stroke="#d5e3ff" strokeWidth={2} strokeDasharray="5 5" dot={false} />
                </LineChart>
              </ResponsiveContainer>
            ) : (
              <div className="h-[250px] flex items-center justify-center text-on-surface-variant">
                No data yet.
              </div>
            )}
          </CardContent>
        </Card>

        {/* Insights Sidebar */}
        <div className="space-y-4">
          <div className="sanctuary-card-subtle bg-surface-container-lowest">
            <div className="flex items-center gap-2 mb-2">
              <Moon className="h-4 w-4 text-primary" />
              <h4 className="font-bold text-sm">Sleep</h4>
            </div>
            <p className="text-xs text-on-surface-variant">
              Average <strong className="text-primary">{avgSleep}h</strong> over this period.
            </p>
          </div>
          <div className="sanctuary-card-subtle bg-surface-container-lowest">
            <div className="flex items-center gap-2 mb-2">
              <BookOpen className="h-4 w-4 text-primary" />
              <h4 className="font-bold text-sm">Study</h4>
            </div>
            <p className="text-xs text-on-surface-variant">
              Track how your sessions affect your mood.
            </p>
          </div>
          <div className="sanctuary-card-subtle bg-surface-container-lowest">
            <div className="flex items-center gap-2 mb-2">
              <Sparkles className="h-4 w-4 text-primary" />
              <h4 className="font-bold text-sm">Recovery</h4>
            </div>
            <p className="text-xs text-on-surface-variant">
              Active breaks improve your concentration.
            </p>
          </div>
        </div>
      </div>

      {/* Mode Distribution Section */}
      {modeData.length > 0 && (
        <div className="grid grid-cols-1 lg:grid-cols-2 gap-6">
          <Card className="shadow-sanctuary-sm">
            <CardContent className="p-6 h-full">
              <h3 className="text-xl font-bold mb-6">Mood palette</h3>
              <div className="flex justify-center mt-[3rem] align-center  gap-4 sm:gap-6 flex-wrap">
                {modeData.map((md, i) => (
                  <div key={md.mode} className="text-center group">
                    <div
                      className="w-14 h-14 sm:w-16 sm:h-16 rounded-full flex items-center justify-center mx-auto mb-3 transition-transform group-hover:scale-110"
                      style={{ backgroundColor: CHART_COLORS[i % CHART_COLORS.length] + "20", color: CHART_COLORS[i % CHART_COLORS.length] }}
                    >
                      <span className="text-sm font-bold">{Math.round(md.percentage)}%</span>
                    </div>
                    <span className="label-sanctuary text-[10px]">{modeLabel(md.mode)}</span>
                  </div>
                ))}
              </div>
            </CardContent>
          </Card>

          <Card className="shadow-sanctuary-sm">
            <CardContent className="p-6">
              <div className="flex items-center justify-between mb-6">
                <h3 className="text-xl font-bold">Weekly report</h3>
                <Link href="/history/weekly">
                  <Button variant="ghost" size="sm" className="px-2 sm:px-3 text-primary">View all</Button>
                </Link>
              </div>
              <ResponsiveContainer width="100%" height={200}>
                <BarChart data={modeData.map((md) => ({ name: modeLabel(md.mode), minutes: md.total_minutes }))}>
                  <XAxis dataKey="name" tick={{ fontSize: 10 }} />
                  <YAxis tick={{ fontSize: 10 }} />
                  <Tooltip contentStyle={{ borderRadius: "16px", border: "none", boxShadow: "0 4px 12px rgba(0,0,0,0.05)" }} />
                  <Bar dataKey="minutes" radius={[8, 8, 0, 0]}>
                    {modeData.map((_, i) => (
                      <Cell key={i} fill={CHART_COLORS[i % CHART_COLORS.length]} />
                    ))}
                  </Bar>
                </BarChart>
              </ResponsiveContainer>
            </CardContent>
          </Card>
        </div>
      )}

      {/* STRATEGY DOCUMENTS TIMELINE */}
      {timelineData.length > 0 && <TimelineReports data={timelineData.filter((t) => t.executive_summary)} />}
    </div>
  );
}

function TimelineReports({ data }: { data: TimelineItem[] }) {
  const [openItemId, setOpenItemId] = useState<string | null>(data.length > 0 ? data[0].id : null);

  const toggleItem = (id: string) => {
    setOpenItemId((prev) => (prev === id ? null : id));
  };

  return (
    <div className="mt-12">
      <div className="flex items-center justify-between mb-8">
        <h2 className="text-2xl font-bold flex items-center">
          <Sparkles className="h-6 w-6 mr-3 text-primary" />
          Your strategic reports
        </h2>
      </div>

      <div className="relative border-l border-outline-variant/40 ml-4 pl-6 space-y-6">
        {data.map((item) => {
          const isOpen = openItemId === item.id;
          const Icon = item.type === "morning" ? Sun : Moon;
          return (
            <div key={item.id} className="relative group">
              {/* Timeline Dot */}
              <div
                className={`absolute w-3 h-3 rounded-full -left-[1.95rem] top-6 border-[3px] border-surface ${item.type === "morning" ? "bg-amber-400" : "bg-blue-400"
                  }`}
              />

              <button
                onClick={() => toggleItem(item.id)}
                className="w-full text-left focus:outline-none"
              >
                <Card
                  className={`overflow-hidden border border-outline-variant/30 shadow-sm transition-all duration-300 ${isOpen ? "bg-surface/60 shadow-md border-outline-variant/50" : "bg-surface/50 hover:bg-surface hover:shadow-md"
                    }`}
                >
                  <div className="p-4 sm:p-5 flex items-center justify-between">
                    <div className="flex items-center gap-4">
                      <div
                        className={`p-2 rounded-full ${item.type === "morning"
                          ? "bg-amber-100/50 text-amber-600 dark:bg-amber-900/20"
                          : "bg-blue-100/50 text-blue-600 dark:bg-blue-900/20"
                          }`}
                      >
                        <Icon className="h-5 w-5" />
                      </div>
                      <div>
                        <h3 className="font-bold text-on-surface">
                          {item.type === "morning" ? "Morning check-in" : "Evening review"}
                        </h3>
                        <p className="text-xs text-on-surface-variant font-medium mt-0.5">
                          {formatDateShort(item.date)} • {item.time ? item.time.substring(0, 5) : ""}
                        </p>
                      </div>
                    </div>
                    <ChevronRight
                      className={`h-5 w-5 text-on-surface-variant transition-transform duration-300 ${isOpen ? "rotate-90" : ""
                        }`}
                    />
                  </div>
                </Card>
              </button>

              {isOpen && (
                <div className="mt-3 overflow-hidden page-enter">
                  <Card className="border border-outline-variant/30 bg-surface shadow-sm rounded-2xl">
                    <CardContent className="p-5 sm:p-6 space-y-6">
                      {/* Summary */}
                      <div>
                        <p className="text-sm sm:text-base text-on-surface leading-relaxed whitespace-pre-wrap">
                          {item.executive_summary}
                        </p>
                      </div>

                      {/* Action Plan */}
                      {item.detailed_action_plan && item.detailed_action_plan.length > 0 && (
                        <div className="pt-4 border-t border-outline-variant/20">
                          <h4 className="text-xs font-bold uppercase tracking-wider text-on-surface-variant flex items-center mb-3">
                            <Target className="h-4 w-4 mr-2 text-primary" />
                            Extracted action plan
                          </h4>
                          <ul className="space-y-2.5">
                            {item.detailed_action_plan.map((action, idx) => (
                              <li key={idx} className="text-sm text-on-surface flex items-start gap-3">
                                <div className="mt-1.5 h-1.5 w-1.5 rounded-full bg-primary/60 shrink-0" />
                                <span>{action}</span>
                              </li>
                            ))}
                          </ul>
                        </div>
                      )}

                      {/* Risks */}
                      {item.detected_risks && item.detected_risks.length > 0 && (
                        <div className="pt-4 border-t border-outline-variant/20">
                          <h4 className="text-xs font-bold uppercase tracking-wider text-red-600 dark:text-red-400 flex items-center mb-3">
                            <ShieldAlert className="h-4 w-4 mr-2" />
                            Risk signals
                          </h4>
                          <ul className="space-y-2.5">
                            {item.detected_risks.map((risk, idx) => (
                              <li key={idx} className="text-sm text-red-600  flex items-start gap-3">
                                <div className="mt-1.5 h-1.5 w-1.5 rounded-full bg-red-600/60 shrink-0" />
                                <span>{risk}</span>
                              </li>
                            ))}
                          </ul>
                        </div>
                      )}
                    </CardContent>
                  </Card>
                </div>
              )}
            </div>
          );
        })}
      </div>
    </div>
  );
}
