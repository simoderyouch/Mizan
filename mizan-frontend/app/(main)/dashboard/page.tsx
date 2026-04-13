"use client";

import { useEffect, useState } from "react";
import Link from "next/link";
import { agentApi, analyticsApi, getApiErrorMessage, modesApi, studentsApi } from "@/lib/api";
import { useAuth } from "@/lib/auth";
import { getGreeting, formatDateShort, formatTimeString, modeLabel } from "@/lib/utils";
import type { AgentActionContract, Mode, StudentContext, StudentDashboard, WeeklyReport } from "@/lib/types";
import { Card, CardContent } from "@/components/ui/card";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import { Progress } from "@/components/ui/progress";
import { Skeleton } from "@/components/ui/skeleton";
import {
  Sun, Moon, BookOpen, Calendar, Target,
  Sparkles, Clock, ChevronRight, FolderKanban,
} from "lucide-react";

export default function DashboardPage() {
  const { student } = useAuth();
  const [dashboard, setDashboard] = useState<StudentDashboard | null>(null);
  const [studentContext, setStudentContext] = useState<StudentContext | null>(null);
  const [weeklyReport, setWeeklyReport] = useState<WeeklyReport | null>(null);
  const [contracts, setContracts] = useState<AgentActionContract[]>([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState("");
  const [modeBusy, setModeBusy] = useState(false);
  const [previewMode, setPreviewMode] = useState<Mode>("REVISION");
  const [modeElapsedSeconds, setModeElapsedSeconds] = useState(0);
  const activeModeStartedAt = studentContext?.current_mode?.started_at ?? dashboard?.current_mode?.started_at ?? null;

  const fetchData = async () => {
    const [dashboardResult, weeklyResult, contextResult, contractsResult] = await Promise.allSettled([
      analyticsApi.dashboard(),
      analyticsApi.weeklyReport(),
      studentsApi.context(),
      agentApi.listContracts({ limit: 8 }),
    ]);

    if (dashboardResult.status === "fulfilled") {
      setDashboard(dashboardResult.value);
    }
    if (weeklyResult.status === "fulfilled") {
      setWeeklyReport(weeklyResult.value);
    }
    if (contextResult.status === "fulfilled") {
      setStudentContext(contextResult.value);
    }
    if (contractsResult.status === "fulfilled") {
      setContracts(contractsResult.value);
    }

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
  };

  const handleRetry = () => {
    setLoading(true);
    setError("");
    void fetchData();
  };

  const switchMode = async (mode: Mode) => {
    try {
      setModeBusy(true);
      setError("");
      if (currentMode && currentMode.mode !== mode) {
        await modesApi.stop();
      }
      await modesApi.start(mode);
      await fetchData();
    } catch (err) {
      setError(getApiErrorMessage(err, "Unable to switch mode."));
    } finally {
      setModeBusy(false);
    }
  };

  const stopMode = async () => {
    try {
      setModeBusy(true);
      setError("");
      await modesApi.stop();
      await fetchData();
    } catch (err) {
      setError(getApiErrorMessage(err, "Unable to stop active mode."));
    } finally {
      setModeBusy(false);
    }
  };

  useEffect(() => {
    // eslint-disable-next-line react-hooks/set-state-in-effect
    void fetchData();
  }, []);

  useEffect(() => {
    if (!activeModeStartedAt) {
      setModeElapsedSeconds(0);
      return;
    }
    const startMs = new Date(activeModeStartedAt).getTime();
    const tick = () => setModeElapsedSeconds(Math.max(0, Math.floor((Date.now() - startMs) / 1000)));
    tick();
    const interval = window.setInterval(tick, 1000);
    return () => window.clearInterval(interval);
  }, [activeModeStartedAt]);

  if (loading) {
    return (
      <div className="space-y-6">
        <Skeleton className="h-10 w-72" />
        <div className="grid grid-cols-1 lg:grid-cols-3 gap-6">
          <Skeleton className="h-64 lg:col-span-2" />
          <Skeleton className="h-64" />
          <Skeleton className="h-56" />
          <Skeleton className="h-56" />
          <Skeleton className="h-56" />
        </div>
      </div>
    );
  }

  const greeting = getGreeting();
  const firstName = student?.first_name || studentContext?.student?.first_name || dashboard?.student?.first_name || "Student";
  const todaySchedule = studentContext?.today_schedule ?? dashboard?.today_schedule ?? [];
  const upcomingExams = studentContext?.upcoming_exams ?? dashboard?.upcoming_exams ?? [];
  const activeProjects = studentContext?.active_projects ?? [];
  const currentMode = studentContext?.current_mode ?? dashboard?.current_mode;
  const nextClass = todaySchedule[0];
  const nearestExam = upcomingExams[0];
  const nearestProject = activeProjects
    .slice()
    .sort((a, b) => new Date(a.due_date).getTime() - new Date(b.due_date).getTime())[0];
  const completedCheckinsToday = (dashboard?.has_morning_checkin ? 1 : 0) + (dashboard?.has_evening_checkin ? 1 : 0);
  const checkinProgress = Math.round((completedCheckinsToday / 2) * 100);
  const activeContractsCount = contracts.filter((item) => item.status === "pending" || item.status === "accepted").length;
  const availableModes: Mode[] = ["REVISION", "EXAMEN", "PROJET", "REPOS", "SPORT", "COURS"];
  const modeTimerText = `${Math.floor(modeElapsedSeconds / 3600).toString().padStart(2, "0")}:${Math.floor((modeElapsedSeconds % 3600) / 60).toString().padStart(2, "0")}:${(modeElapsedSeconds % 60).toString().padStart(2, "0")}`;
  const readinessFromMood = weeklyReport ? Math.round(weeklyReport.avg_mood * 20) : 0;
  const readinessScore = Math.max(
    35,
    Math.min(
      100,
      Math.round(
        (readinessFromMood > 0 ? readinessFromMood : 55) * 0.6 +
        checkinProgress * 0.25 +
        (currentMode ? 10 : 0) +
        (activeContractsCount === 0 ? 5 : 0)
      )
    )
  );

  const recommendationCards = [
    nearestExam
      ? {
          title: "Exam priority",
          description: `${nearestExam.subject} on ${formatDateShort(nearestExam.exam_date)}. Prepare a focused sprint today.`,
          icon: <Calendar className="h-5 w-5 text-primary mt-0.5" />,
        }
      : nearestProject
        ? {
            title: "Project priority",
            description: `${nearestProject.name} due by ${formatDateShort(nearestProject.due_date)}. Progress one concrete step.`,
            icon: <FolderKanban className="h-5 w-5 text-primary mt-0.5" />,
          }
        : {
            title: "Cap du jour",
            description: nextClass
              ? `Next class: ${nextClass.subject}. Set one clear goal before it starts.`
              : "No urgent class. Move one high-impact task forward.",
            icon: <BookOpen className="h-5 w-5 text-primary mt-0.5" />,
          },
    currentMode
      ? {
          title: "Active mode",
          description: `You are in ${modeLabel(currentMode.mode)} mode. Continue with one distraction-free focus block.`,
          icon: <Clock className="h-5 w-5 text-secondary mt-0.5" />,
        }
      : {
          title: "Suggested mode",
          description: "Activate a work mode to structure your next focus block.",
          icon: <Sparkles className="h-5 w-5 text-secondary mt-0.5" />,
        },
  ];

  return (
    <div className="page-enter space-y-8">
      {/* ── Greeting ── */}
      <div>
        <h1 className="text-2xl sm:text-3xl md:text-5xl font-bold">
          {greeting}, {firstName}.
        </h1>
        {(student?.class_name || student?.filiere_name) && (
          <p className="text-primary/80 mt-1 text-xs sm:text-sm font-medium">
            {[student?.class_name, student?.filiere_name].filter(Boolean).join(" · ")}
          </p>
        )}
        <p className="text-on-surface-variant mt-2 text-sm sm:text-base md:text-lg">
          Let&apos;s find your balance today. Protect your focus and wellbeing.
        </p>
      </div>

      {error && (
        <Card>
          <CardContent className="!p-4 flex flex-wrap items-center justify-between gap-3">
            <p className="text-sm text-red-600">{error}</p>
            <Button variant="secondary" size="sm" onClick={handleRetry}>
              Retry
            </Button>
          </CardContent>
        </Card>
      )}

      {currentMode && (
        <Card className="sanctuary-card-accent">
          <CardContent className="flex flex-col sm:flex-row sm:items-center justify-between gap-4">
            <div className="flex items-center gap-3 sm:gap-4">
              <Clock className="h-6 w-6 animate-pulse-soft" />
              <div>
                <span className="label-sanctuary text-on-primary/70">Active mode</span>
                <p className="text-xl font-bold">{modeLabel(currentMode.mode)}</p>
              </div>
            </div>
            <div className="flex items-center justify-between sm:justify-start gap-3 sm:gap-4 w-full sm:w-auto">
              <span className="text-xl sm:text-2xl font-mono font-bold">{modeTimerText}</span>
              <Button
                onClick={() => void stopMode()}
                disabled={modeBusy}
                variant="secondary"
                className="!text-white !border-white/30"
              >
                Stop
              </Button>
            </div>
          </CardContent>
        </Card>
      )}

      {/* ── Main Grid ── */}
      <div className="grid grid-cols-1 lg:grid-cols-3 gap-6">
        {/* Daily focus card — spans 2 cols */}
        <Card className="lg:col-span-2">
          <CardContent>
            <div className="flex items-center gap-2 mb-4">
              <Badge>
                <Sparkles className="h-3 w-3 mr-1" />
                AI recommendation
              </Badge>
            </div>
            <h3 className="text-xl font-bold mb-4">Your daily focus space</h3>

            <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
              <div className="space-y-3">
                {recommendationCards.map((item) => (
                  <div key={item.title} className="sanctuary-card-subtle flex items-start gap-3 !p-4">
                    {item.icon}
                    <div>
                      <p className="font-semibold text-sm">{item.title}</p>
                      <p className="text-xs text-on-surface-variant">{item.description}</p>
                    </div>
                  </div>
                ))}
              </div>

              {/* Score */}
              <div className="gradient-primary-soft rounded-2xl p-4 sm:p-6 flex flex-col items-center justify-center">
                <span className="label-sanctuary text-primary/70 mb-2">Readiness score</span>
                <span className="text-3xl sm:text-5xl font-bold text-primary">
                  {readinessScore}%
                </span>
                <span className="text-xs text-primary/60 mt-1">Optimized for creativity</span>
              </div>
            </div>
          </CardContent>
        </Card>

        {/* Today's priorities */}
        <Card>
          <CardContent>
            <div className="flex items-center justify-between mb-4">
              <h3 className="text-xl font-bold">Today&apos;s priorities</h3>
              <Link href="/checkin">
                <Clock className="h-5 w-5 text-primary" />
              </Link>
            </div>

            <div className="space-y-3">
              <div className="sanctuary-card-subtle !p-3">
                <p className="label-sanctuary mb-1">Next class</p>
                {nextClass ? (
                  <p className="text-sm font-semibold">
                    {nextClass.subject} · {formatTimeString(nextClass.start_time)} - {formatTimeString(nextClass.end_time)}
                  </p>
                ) : (
                  <p className="text-sm text-on-surface-variant">No remaining classes today.</p>
                )}
              </div>

              <div className="sanctuary-card-subtle !p-3">
                <p className="label-sanctuary mb-1">Academic urgency</p>
                {nearestExam ? (
                  <p className="text-sm font-semibold">Exam: {nearestExam.subject} · {formatDateShort(nearestExam.exam_date)}</p>
                ) : nearestProject ? (
                  <p className="text-sm font-semibold">Project: {nearestProject.name} · {formatDateShort(nearestProject.due_date)}</p>
                ) : (
                  <p className="text-sm text-on-surface-variant">No upcoming deadline.</p>
                )}
              </div>
            </div>

            <div className="mt-4">
              <div className="flex items-center justify-between mb-1">
                <span className="label-sanctuary">Today&apos;s check-in progress</span>
                <span className="text-sm font-semibold">{completedCheckinsToday}/2</span>
              </div>
              <Progress value={checkinProgress} />
            </div>
          </CardContent>
        </Card>
      </div>

      {/* ── Check-in CTAs ── */}
      {dashboard && (!dashboard.has_morning_checkin || !dashboard.has_evening_checkin) && (
        <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
          {!dashboard.has_morning_checkin && (
            <Link href="/checkin">
              <Card className="sanctuary-card-accent hover:opacity-90 transition-opacity cursor-pointer">
                <CardContent className="flex items-start gap-3 sm:gap-4">
                  <Sun className="h-8 w-8" />
                  <div>
                    <h3 className="font-bold text-lg">Morning check-in</h3>
                    <p className="text-sm opacity-80">
                      Take 2 minutes to rate your mood and sleep.
                    </p>
                  </div>
                  <ChevronRight className="h-5 w-5 ml-auto hidden sm:block" />
                </CardContent>
              </Card>
            </Link>
          )}
          {!dashboard.has_evening_checkin && (
            <Link href="/checkin">
              <Card className="sanctuary-card-accent hover:opacity-90 transition-opacity cursor-pointer">
                <CardContent className="flex items-start gap-3 sm:gap-4">
                  <Moon className="h-8 w-8" />
                  <div>
                    <h3 className="font-bold text-lg">Evening check-in</h3>
                    <p className="text-sm opacity-80">
                      Reflect on your day and prepare tomorrow.
                    </p>
                  </div>
                  <ChevronRight className="h-5 w-5 ml-auto hidden sm:block" />
                </CardContent>
              </Card>
            </Link>
          )}
        </div>
      )}

      {/* ── Bottom Grid ── */}
      <div className="grid grid-cols-1 lg:grid-cols-2 gap-6">
        {/* Current mode + weekly energy */}
        <Card>
          <CardContent>
            <h3 className="text-xl font-bold mb-4">Mode & Energy</h3>

            <div className="mb-4 rounded-xl border border-outline-variant/20 p-3">
              <p className="label-sanctuary mb-2">Preview mode</p>
              <div className="flex flex-wrap gap-2">
                {availableModes.map((mode) => (
                  <Button
                    key={mode}
                    size="sm"
                    variant={previewMode === mode ? "secondary" : "ghost"}
                    onClick={() => setPreviewMode(mode)}
                    disabled={modeBusy}
                  >
                    {modeLabel(mode)}
                  </Button>
                ))}
              </div>
              <div className="mt-3 flex items-center gap-2">
                <Button
                  size="sm"
                  onClick={() => void switchMode(previewMode)}
                  disabled={modeBusy || currentMode?.mode === previewMode}
                >
                  {modeBusy ? "Switching..." : `Activate ${modeLabel(previewMode)}`}
                </Button>
                {currentMode ? (
                  <Button size="sm" variant="ghost" onClick={() => void stopMode()} disabled={modeBusy}>
                    Stop mode
                  </Button>
                ) : null}
              </div>
            </div>

            <div className="space-y-4">
              {weeklyReport?.mode_distribution?.slice(0, 3).map((md) => (
                <div key={md.mode}>
                  <div className="flex items-center justify-between mb-1">
                    <span className="label-sanctuary">{modeLabel(md.mode)}</span>
                    <span className="text-sm font-semibold">{Math.round(md.percentage)}%</span>
                  </div>
                  <Progress value={md.percentage} />
                </div>
              ))}
              {(!weeklyReport?.mode_distribution || weeklyReport.mode_distribution.length === 0) && (
                <p className="text-sm text-on-surface-variant">No data this week.</p>
              )}
            </div>

            {currentMode && (
              <div className="mt-6 sanctuary-card-subtle !p-4 flex items-center gap-3">
                <Clock className="h-5 w-5 text-primary animate-pulse-soft" />
                <div>
                  <span className="label-sanctuary">Current mode</span>
                  <p className="font-semibold">{modeLabel(currentMode.mode)}</p>
                </div>
              </div>
            )}
          </CardContent>
        </Card>

        {/* Summary + quick actions */}
        <Card>
          <CardContent>
            <h3 className="text-xl font-bold mb-4">Weekly summary</h3>

            {weeklyReport ? (
              <div className="flex items-start gap-6">
                {/* Score Ring */}
                <div className="flex-shrink-0 w-20 h-20 rounded-full flex items-center justify-center gradient-primary-soft">
                  <span className="text-2xl font-bold text-primary">
                    {weeklyReport.avg_mood.toFixed(1)}
                  </span>
                </div>

                <div className="flex-1">
                  <p className="text-sm text-on-surface-variant leading-relaxed mb-4">
                    Average sleep: <strong>{weeklyReport.avg_sleep.toFixed(1)}h</strong>.
                    {" "}{weeklyReport.total_checkins} check-ins this week.
                    {" "}{weeklyReport.goals_achieved} goals achieved.
                  </p>
                  <Link href="/history/weekly">
                    <Button variant="secondary" size="sm">
                      View full report
                    </Button>
                  </Link>
                </div>
              </div>
            ) : (
              <p className="text-sm text-on-surface-variant">
                Complete your check-ins to generate your summary.
              </p>
            )}

            {/* Quick links */}
            <div className="grid grid-cols-1 sm:grid-cols-2 gap-3 mt-6">
              <Link href="/goals" className="sanctuary-card-subtle !p-3 flex items-center gap-2 hover:bg-surface-container transition-colors rounded-xl">
                <Target className="h-4 w-4 text-primary" />
                <span className="text-sm font-medium">{dashboard?.active_goals_count || 0} goals</span>
              </Link>
              <Link href="/modes" className="sanctuary-card-subtle !p-3 flex items-center gap-2 hover:bg-surface-container transition-colors rounded-xl">
                <BookOpen className="h-4 w-4 text-primary" />
                <span className="text-sm font-medium">Modes</span>
              </Link>
            </div>

            <div className="mt-3">
              <Link href="/agent/contracts" className="sanctuary-card-subtle !p-3 flex items-center gap-2 hover:bg-surface-container transition-colors rounded-xl">
                <Sparkles className="h-4 w-4 text-primary" />
                <span className="text-sm font-medium">AI Actions ({activeContractsCount} active)</span>
              </Link>
            </div>

            <div className="mt-3">
              <Link href="/agent/chat" className="sanctuary-card-subtle !p-3 flex items-center gap-2 hover:bg-surface-container transition-colors rounded-xl">
                <Sparkles className="h-4 w-4 text-primary" />
                <span className="text-sm font-medium">Chat with Mizan AI</span>
              </Link>
            </div>
          </CardContent>
        </Card>
      </div>

      {/* ── Upcoming Exams ── */}
      {upcomingExams.length > 0 && (
        <Card>
          <CardContent>
            <h3 className="text-xl font-bold mb-4">
              <Calendar className="h-5 w-5 inline mr-2 text-primary" />
              Upcoming exams
            </h3>
            <div className="space-y-3">
              {upcomingExams.slice(0, 4).map((exam) => (
                <div key={exam.id} className="sanctuary-card-subtle !p-4 flex items-center justify-between">
                  <div>
                    <p className="font-semibold">{exam.subject}</p>
                    <p className="text-xs text-on-surface-variant">
                      {formatDateShort(exam.exam_date)} · {formatTimeString(exam.start_time)} – {formatTimeString(exam.end_time)} · Salle {exam.room}
                    </p>
                  </div>
                  <Badge variant="secondary">
                    {(() => {
                      const days = Math.ceil((new Date(exam.exam_date).getTime() - Date.now()) / 86400000);
                      return days <= 0 ? "Today" : `D-${days}`;
                    })()}
                  </Badge>
                </div>
              ))}
            </div>
          </CardContent>
        </Card>
      )}

      {/* ── Today Schedule ── */}
      {todaySchedule.length > 0 && (
        <Card>
          <CardContent>
            <h3 className="text-xl font-bold mb-4">
              <Clock className="h-5 w-5 inline mr-2 text-primary" />
              Today&apos;s schedule
            </h3>
            <div className="space-y-3">
              {todaySchedule.map((entry) => (
                <div key={entry.id} className="flex items-center gap-4">
                  <div className="text-sm font-mono text-on-surface-variant w-24">
                    {formatTimeString(entry.start_time)}–{formatTimeString(entry.end_time)}
                  </div>
                  <div className="flex-1 sanctuary-card-subtle !p-3 !rounded-xl">
                    <p className="font-semibold text-sm">{entry.subject}</p>
                    <p className="text-xs text-on-surface-variant">
                      {entry.professor} · Room {entry.room}
                    </p>
                  </div>
                </div>
              ))}
            </div>
          </CardContent>
        </Card>
      )}

      {/* ── Active Projects ── */}
      {activeProjects.length > 0 && (
        <Card>
          <CardContent>
            <h3 className="text-xl font-bold mb-4">
              <FolderKanban className="h-5 w-5 inline mr-2 text-primary" />
              Active projects
            </h3>
            <div className="space-y-3">
              {activeProjects.slice(0, 4).map((project) => (
                <div key={project.id} className="sanctuary-card-subtle !p-4 flex items-center justify-between gap-3">
                  <div>
                    <p className="font-semibold">{project.name}</p>
                    <p className="text-xs text-on-surface-variant">
                      {project.subject} · Due {formatDateShort(project.due_date)} · Members {project.members.length}
                    </p>
                  </div>
                  <Badge variant="secondary">Active</Badge>
                </div>
              ))}
            </div>
          </CardContent>
        </Card>
      )}
    </div>
  );
}
