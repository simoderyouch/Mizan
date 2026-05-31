"use client";

import { Suspense, useCallback, useEffect, useState } from "react";
import Link from "next/link";
import { DashboardWellbeingHero } from "@/components/checkin/dashboard-wellbeing-hero";
import { DashboardCheckinDeepLink } from "@/components/checkin/dashboard-checkin-deeplink";
import { DashboardScheduleCalendar } from "@/components/dashboard/dashboard-schedule-calendar";
import { ActiveModeBanner } from "@/components/modes/active-mode-banner";
import {
  COMMITMENTS_LABEL,
  clearPinnedCommitment,
  readPinnedCommitment,
  type PinnedCommitment,
} from "@/lib/agent-commitments";
import { agentApi, analyticsApi, getApiErrorMessage, modesApi, studentsApi } from "@/lib/api";
import { useAuth } from "@/lib/auth";
import { getGreeting, formatDateShort, formatTimeString, modeLabel, formatDate } from "@/lib/utils";
import type { AgentActionContract, ScheduleEntry, StudentContext, StudentDashboard, WeeklyReport } from "@/lib/types";
import { Card, CardContent } from "@/components/ui/card";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import { Progress } from "@/components/ui/progress";
import { Skeleton } from "@/components/ui/skeleton";
import {
  BookOpen,
  Target,
  Sparkles,
  Clock,
  ChevronRight,
  TrendingUp,
  BedDouble,
  CheckCircle2,
} from "lucide-react";

function stressLabel(level: string) {
  if (level === "LOW") return "Low — stable";
  if (level === "MEDIUM") return "Medium — balanced";
  return "High — take care";
}

export default function DashboardPage() {
  const { student } = useAuth();
  const [dashboard, setDashboard] = useState<StudentDashboard | null>(null);
  const [studentContext, setStudentContext] = useState<StudentContext | null>(null);
  const [weeklyReport, setWeeklyReport] = useState<WeeklyReport | null>(null);
  const [contracts, setContracts] = useState<AgentActionContract[]>([]);
  const [pinnedCommitment, setPinnedCommitment] = useState<PinnedCommitment | null>(readPinnedCommitment);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState("");
  const [modeActionLoading, setModeActionLoading] = useState(false);

  const [mySchedules, setMySchedules] = useState<ScheduleEntry[]>([]);

  const fetchData = useCallback(async () => {
    const [dashboardResult, weeklyResult, contextResult, schedulesResult, contractsResult] =
      await Promise.allSettled([
      analyticsApi.dashboard(),
      analyticsApi.weeklyReport(),
      studentsApi.context(),
      studentsApi.mySchedules(),
      agentApi.listContracts({ limit: 8 }),
    ]);

    if (dashboardResult.status === "fulfilled") setDashboard(dashboardResult.value);
    if (weeklyResult.status === "fulfilled") setWeeklyReport(weeklyResult.value);
    if (contextResult.status === "fulfilled") setStudentContext(contextResult.value);
    if (schedulesResult.status === "fulfilled") setMySchedules(schedulesResult.value);
    else setMySchedules([]);
    if (contractsResult.status === "fulfilled") setContracts(contractsResult.value);

    const hasSuccess =
      dashboardResult.status === "fulfilled" ||
      weeklyResult.status === "fulfilled" ||
      contextResult.status === "fulfilled" ||
      contractsResult.status === "fulfilled";

    if (!hasSuccess) {
      const firstError =
        dashboardResult.status === "rejected"
          ? dashboardResult.reason
          : weeklyResult.status === "rejected"
            ? weeklyResult.reason
            : contextResult.status === "rejected"
              ? contextResult.reason
              : null;
      setError(getApiErrorMessage(firstError, "Unable to load dashboard."));
    }

    setLoading(false);
  }, []);

  useEffect(() => {
    // eslint-disable-next-line react-hooks/set-state-in-effect
    void fetchData();
  }, [fetchData]);

  useEffect(() => {
    const onPinned = (event: Event) => {
      const detail = (event as CustomEvent<PinnedCommitment | null>).detail;
      setPinnedCommitment(detail ?? readPinnedCommitment());
    };
    window.addEventListener("mizan:commitment:pinned", onPinned);
    return () => window.removeEventListener("mizan:commitment:pinned", onPinned);
  }, []);

  useEffect(() => {
    const onCheckinCompleted = () => {
      void fetchData();
    };
    window.addEventListener("mizan:checkin:completed", onCheckinCompleted);
    return () => window.removeEventListener("mizan:checkin:completed", onCheckinCompleted);
  }, [fetchData]);

  useEffect(() => {
    if (typeof window === "undefined" || window.location.hash !== "#wellbeing") return;
    const el = document.getElementById("wellbeing");
    if (!el) return;
    const timer = window.setTimeout(() => {
      el.scrollIntoView({ behavior: "smooth", block: "start" });
    }, 100);
    return () => window.clearTimeout(timer);
  }, [loading, dashboard]);

  if (loading) {
    return (
      <div className="space-y-6">
        <Skeleton className="h-10 w-72" />
        <div className="grid grid-cols-1 lg:grid-cols-3 gap-6">
          <Skeleton className="h-72 lg:col-span-2" />
          <Skeleton className="h-56" />
          <Skeleton className="h-48" />
          <Skeleton className="h-48" />
        </div>
      </div>
    );
  }

  const greeting = getGreeting();
  const firstName =
    student?.first_name || studentContext?.student?.first_name || dashboard?.student?.first_name || "Student";
  const todaySchedule = studentContext?.today_schedule ?? dashboard?.today_schedule ?? [];
  const weeklySchedule =
    mySchedules.length > 0
      ? mySchedules
      : studentContext?.weekly_schedule ?? dashboard?.weekly_schedule ?? todaySchedule;
  const upcomingExams = studentContext?.upcoming_exams ?? dashboard?.upcoming_exams ?? [];
  const activeProjects = studentContext?.active_projects ?? [];
  const currentMode = studentContext?.current_mode ?? dashboard?.current_mode;
  const nextClass = todaySchedule[0];
  const nearestExam = upcomingExams[0];
  const nearestProject = activeProjects
    .slice()
    .sort((a, b) => new Date(a.due_date).getTime() - new Date(b.due_date).getTime())[0];
  const activeContractsCount = contracts.filter(
    (item) => item.status === "pending" || item.status === "accepted"
  ).length;
  const hasMorningCheckin =
    dashboard?.has_morning_checkin ?? studentContext?.has_morning_checkin ?? false;
  const hasEveningCheckin =
    dashboard?.has_evening_checkin ?? studentContext?.has_evening_checkin ?? false;

  const stopMode = async () => {
    setModeActionLoading(true);
    try {
      await modesApi.stop();
      await fetchData();
    } catch (err: unknown) {
      setError(getApiErrorMessage(err, "Unable to stop the active mode."));
    } finally {
      setModeActionLoading(false);
    }
  };

  return (
    <div className="page-enter space-y-6">
      <Suspense fallback={null}>
        <DashboardCheckinDeepLink ready={!loading && !!dashboard} />
      </Suspense>

      <div>
        <h1 className="text-2xl sm:text-3xl md:text-4xl font-bold">
          {greeting}, {firstName}.
        </h1>
        {(student?.class_name || student?.filiere_name) && (
          <p className="text-primary/80 mt-1 text-xs sm:text-sm font-medium">
            {[student?.class_name, student?.filiere_name].filter(Boolean).join(" · ")}
          </p>
        )}
      </div>

      {currentMode ? (
        <ActiveModeBanner
          session={currentMode}
          onStop={stopMode}
          stopping={modeActionLoading}
        />
      ) : null}

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

      <DashboardWellbeingHero
        hasMorningCheckin={hasMorningCheckin}
        hasEveningCheckin={hasEveningCheckin}
        firstName={firstName}
      />

      <DashboardScheduleCalendar
        weeklySchedule={weeklySchedule}
        exams={upcomingExams}
        projects={activeProjects}
      />

      <div className="grid grid-cols-1 lg:grid-cols-3 gap-6">
        {/* Weekly report — main card */}
        <Card className="lg:col-span-2">
          <CardContent>
            <div className="flex flex-wrap items-start justify-between gap-3 mb-5">
              <div>
                <h2 className="text-xl font-bold">Weekly report</h2>
                {weeklyReport ? (
                  <p className="text-sm text-on-surface-variant mt-1">
                    {formatDate(weeklyReport.week_start)} — {formatDate(weeklyReport.week_end)}
                  </p>
                ) : (
                  <p className="text-sm text-on-surface-variant mt-1">Complete check-ins to unlock insights.</p>
                )}
              </div>
              <Link href="/history/weekly">
                <Button variant="secondary" size="sm">
                  Full report
                  <ChevronRight className="h-4 w-4 ml-1" />
                </Button>
              </Link>
            </div>

            {weeklyReport ? (
              <>
                <div className="grid grid-cols-2 sm:grid-cols-4 gap-3 mb-5">
                  <div className="sanctuary-card-subtle !p-4 text-center">
                    <TrendingUp className="h-4 w-4 text-primary mx-auto mb-1" />
                    <p className="label-sanctuary">Mood</p>
                    <p className="text-2xl font-bold text-primary mt-1">{weeklyReport.avg_mood.toFixed(1)}</p>
                  </div>
                  <div className="sanctuary-card-subtle !p-4 text-center">
                    <BedDouble className="h-4 w-4 text-primary mx-auto mb-1" />
                    <p className="label-sanctuary">Sleep</p>
                    <p className="text-2xl font-bold text-primary mt-1">{weeklyReport.avg_sleep.toFixed(1)}h</p>
                  </div>
                  <div className="sanctuary-card-subtle !p-4 text-center">
                    <CheckCircle2 className="h-4 w-4 text-primary mx-auto mb-1" />
                    <p className="label-sanctuary">Check-ins</p>
                    <p className="text-2xl font-bold text-primary mt-1">{weeklyReport.total_checkins}</p>
                  </div>
                  <div className="sanctuary-card-subtle !p-4 text-center">
                    <Target className="h-4 w-4 text-primary mx-auto mb-1" />
                    <p className="label-sanctuary">Goals</p>
                    <p className="text-2xl font-bold text-primary mt-1">{weeklyReport.goals_achieved}</p>
                  </div>
                </div>
                

                <div className="mt-5 pt-[2rem] border-t border-outline-variant/20 grid grid-cols-1 md:grid-cols-2 gap-5">
                <Badge
                  variant={
                    weeklyReport.stress_level === "LOW"
                      ? "success"
                      : weeklyReport.stress_level === "MEDIUM"
                        ? "warning"
                        : "destructive"
                  }
                >
                  Stress: {stressLabel(String(weeklyReport.stress_level))}
                </Badge>

                  <div>
                    <p className="label-sanctuary mb-3">Mood rhythm</p>
                    {(dashboard?.mood_trend?.length ?? 0) > 0 ? (
                      <div className="flex items-end gap-2 h-20">
                        {(dashboard?.mood_trend ?? []).slice(-7).map((point) => {
                          const score = Number(point.mood_score) || 3;
                          const height = Math.max(14, score * 14);
                          return (
                            <div
                              key={point.date}
                              className="flex-1 flex flex-col justify-end rounded-md bg-primary/10"
                              style={{ height: 80 }}
                            >
                              <div
                                className="w-full rounded-md bg-primary/70"
                                style={{ height }}
                                title={`${point.date}: ${score}/5`}
                              />
                            </div>
                          );
                        })}
                      </div>
                    ) : (
                      <p className="text-sm text-on-surface-variant">
                        Mood chart fills in as you complete your daily rituals.
                      </p>
                    )}
                  </div>
                </div>
              </>
            ) : (
              <p className="text-sm text-on-surface-variant">
                Your weekly summary will appear after your first rituals this week.
              </p>
            )}
          </CardContent>
        </Card>

        {/* Today */}
        <Card>
          <CardContent>
            <h3 className="text-lg font-bold mb-4">Today</h3>
            <div className="space-y-3">
              {pinnedCommitment ? (
                <div className="sanctuary-card-subtle !p-3 border border-violet-200/70 bg-violet-50/50">
                  <div className="flex items-start justify-between gap-2">
                    <div>
                      <p className="label-sanctuary mb-1">Your focus</p>
                      <p className="text-sm font-semibold">{pinnedCommitment.title}</p>
                    </div>
                    <button
                      type="button"
                      onClick={() => {
                        clearPinnedCommitment();
                        setPinnedCommitment(null);
                      }}
                      className="text-[10px] font-semibold text-on-surface-variant hover:text-on-surface"
                    >
                      Dismiss
                    </button>
                  </div>
                  <div className="mt-2 flex flex-wrap gap-2 text-xs">
                    {pinnedCommitment.taskId ? (
                      <Link href={`/tasks?highlight=${pinnedCommitment.taskId}`} className="font-semibold text-primary hover:underline">
                        View task
                      </Link>
                    ) : null}
                    <Link href="/agent/contracts" className="font-semibold text-violet-800 hover:underline">
                      {COMMITMENTS_LABEL}
                    </Link>
                  </div>
                </div>
              ) : null}
              <div className="sanctuary-card-subtle !p-3">
                <p className="label-sanctuary mb-1">Next class</p>
                {nextClass ? (
                  <p className="text-sm font-semibold">
                    {nextClass.subject} · {formatTimeString(nextClass.start_time)}–{formatTimeString(nextClass.end_time)}
                  </p>
                ) : (
                  <p className="text-sm text-on-surface-variant">No class left today.</p>
                )}
              </div>
              <div className="sanctuary-card-subtle !p-3">
                <p className="label-sanctuary mb-1">Deadline</p>
                {nearestExam ? (
                  <p className="text-sm font-semibold">
                    {nearestExam.subject} · {formatDateShort(nearestExam.exam_date)}
                  </p>
                ) : nearestProject ? (
                  <p className="text-sm font-semibold">
                    {nearestProject.name} · {formatDateShort(nearestProject.due_date)}
                  </p>
                ) : (
                  <p className="text-sm text-on-surface-variant">Nothing urgent.</p>
                )}
              </div>
              <div className="sanctuary-card-subtle !p-3">
                <p className="label-sanctuary mb-1">Goals</p>
                <p className="text-sm font-semibold">{dashboard?.active_goals_count ?? 0} active</p>
              </div>
            </div>
          </CardContent>
        </Card>
      </div>

      <div className="grid grid-cols-1 lg:grid-cols-2 gap-6">
        {/* Mode & energy — read-only */}
        <Card>
          <CardContent>
            <div className="flex items-center justify-between mb-4">
              <h3 className="text-lg font-bold">Mode &amp; energy</h3>
              <Link href="/modes" className="text-sm font-semibold text-primary hover:underline">
                Manage
              </Link>
            </div>

            {currentMode ? (
              <div className="sanctuary-card-subtle !p-3 mb-4 flex items-center gap-3">
                <Clock className="h-5 w-5 text-primary shrink-0" />
                <div>
                  <p className="label-sanctuary">Now</p>
                  <p className="font-semibold">{modeLabel(currentMode.mode)}</p>
                </div>
              </div>
            ) : (
              <p className="text-sm text-on-surface-variant mb-4">No focus mode running.</p>
            )}

            <p className="label-sanctuary mb-3">This week</p>
            <div className="space-y-3">
              {weeklyReport?.mode_distribution?.length ? (
                weeklyReport.mode_distribution.slice(0, 4).map((md) => (
                  <div key={md.mode}>
                    <div className="flex items-center justify-between mb-1">
                      <span className="text-sm font-medium">{modeLabel(md.mode)}</span>
                      <span className="text-xs text-on-surface-variant">
                        {Math.round(md.percentage)}% · {md.total_minutes} min
                      </span>
                    </div>
                    <Progress value={md.percentage} />
                  </div>
                ))
              ) : (
                <p className="text-sm text-on-surface-variant">Mode stats appear after you use focus modes.</p>
              )}
            </div>
          </CardContent>
        </Card>

        {/* Shortcuts */}
        <Card>
          <CardContent>
            <h3 className="text-lg font-bold mb-4">Shortcuts</h3>
            <div className="grid grid-cols-1 sm:grid-cols-2 gap-2">
              <Link
                href="/goals"
                className="sanctuary-card-subtle !p-3 flex items-center gap-2 hover:bg-surface-container transition-colors rounded-xl"
              >
                <Target className="h-4 w-4 text-primary" />
                <span className="text-sm font-medium">Goals ({dashboard?.active_goals_count ?? 0})</span>
              </Link>
              <Link
                href="/modes"
                className="sanctuary-card-subtle !p-3 flex items-center gap-2 hover:bg-surface-container transition-colors rounded-xl"
              >
                <BookOpen className="h-4 w-4 text-primary" />
                <span className="text-sm font-medium">Focus modes</span>
              </Link>
              <Link
                href="/agent/chat"
                className="sanctuary-card-subtle !p-3 flex items-center gap-2 hover:bg-surface-container transition-colors rounded-xl"
              >
                <Sparkles className="h-4 w-4 text-primary" />
                <span className="text-sm font-medium">Mizan AI</span>
              </Link>
              <Link
                href="/agent/contracts"
                className="sanctuary-card-subtle !p-3 flex items-center gap-2 hover:bg-surface-container transition-colors rounded-xl"
              >
                <Sparkles className="h-4 w-4 text-primary" />
                <span className="text-sm font-medium">{COMMITMENTS_LABEL} ({activeContractsCount})</span>
              </Link>
            </div>
          </CardContent>
        </Card>
      </div>

    </div>
  );
}
