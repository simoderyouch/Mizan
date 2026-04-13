"use client";

import { useEffect, useState } from "react";
import Link from "next/link";
import { analyticsApi, getApiErrorMessage, studentsApi } from "@/lib/api";
import { useAuth } from "@/lib/auth";
import { getGreeting, formatDateShort, formatTimeString, modeLabel } from "@/lib/utils";
import type { StudentContext, StudentDashboard, WeeklyReport } from "@/lib/types";
import { Card, CardContent } from "@/components/ui/card";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import { Progress } from "@/components/ui/progress";
import { Skeleton } from "@/components/ui/skeleton";
import {
  Sun, Moon, BookOpen, Calendar, Target,
  Sparkles, Clock, ChevronRight, FolderKanban,
} from "lucide-react";
import { ModeSelector } from "@/components/modes/ModeSelector";
import { ActiveModeBanner } from "@/components/dashboard/ActiveModeBanner";

export default function DashboardPage() {
  const { student } = useAuth();
  const [dashboard, setDashboard] = useState<StudentDashboard | null>(null);
  const [studentContext, setStudentContext] = useState<StudentContext | null>(null);
  const [weeklyReport, setWeeklyReport] = useState<WeeklyReport | null>(null);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState("");

  const fetchData = async () => {
    const [dashboardResult, weeklyResult, contextResult] = await Promise.allSettled([
      analyticsApi.dashboard(),
      analyticsApi.weeklyReport(),
      studentsApi.context(),
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

    const hasSuccess =
      dashboardResult.status === "fulfilled" ||
      weeklyResult.status === "fulfilled" ||
      contextResult.status === "fulfilled";

    if (!hasSuccess) {
      const firstError =
        dashboardResult.status === "rejected"
          ? dashboardResult.reason
          : weeklyResult.status === "rejected"
            ? weeklyResult.reason
            : contextResult.status === "rejected"
              ? contextResult.reason
              : null;
      setError(getApiErrorMessage(firstError, "Impossible de charger le tableau de bord."));
    }
    setLoading(false);
  };

  const handleRetry = () => {
    setLoading(true);
    setError("");
    void fetchData();
  };

  useEffect(() => {
    // eslint-disable-next-line react-hooks/set-state-in-effect
    void fetchData();
  }, []);

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
  const firstName = student?.first_name || studentContext?.student?.first_name || dashboard?.student?.first_name || "Étudiant";
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

  return (
    <div className="page-enter space-y-5">
      {/* ── Active Session Banner ── */}
      {currentMode && (
        <ActiveModeBanner 
          session={currentMode} 
          onStop={fetchData} 
        />
      )}

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
          Trouvons votre équilibre aujourd&apos;hui. Votre esprit est un sanctuaire, prenons-en soin.
        </p>
      </div>

      {/* ── Quick Mode Switcher ── */}
      <div className="animate-in fade-in slide-in-from-top-4 duration-700 delay-100">
        <div className="flex items-center justify-between mb-2">
          <span className="label-sanctuary">Focus du Moment</span>
          <span className="text-[10px] text-primary/50 font-medium uppercase tracking-tighter">Quick Switch</span>
        </div>
        <ModeSelector 
          currentMode={currentMode?.mode} 
          onModeChange={fetchData} 
        />
      </div>

      {error && (
        <Card>
          <CardContent className="!p-4 flex flex-wrap items-center justify-between gap-3">
            <p className="text-sm text-red-600">{error}</p>
            <Button variant="secondary" size="sm" onClick={handleRetry}>
              Réessayer
            </Button>
          </CardContent>
        </Card>
      )}

      {/* ── Main Grid ── */}
      <div className="flex flex-col gap-4">
        {/* Sanctuaire du Jour — spans 2 cols */}
        <Card className="lg:col-span-2">
          <CardContent>
            <div className="flex items-center gap-2 mb-4">
              <Badge>
                <Sparkles className="h-3 w-3 mr-1" />
                IA Recommandation
              </Badge>
            </div>
            <h3 className="text-xl font-bold mb-4">Votre Sanctuaire du Jour</h3>

            <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
              <div className="space-y-3">
                <div className="sanctuary-card-subtle flex items-start gap-3 !p-4">
                  <Sun className="h-5 w-5 text-primary mt-0.5" />
                  <div>
                    <p className="font-semibold text-sm">Focus Matinal</p>
                    <p className="text-xs text-on-surface-variant">
                      Commencez par une session de révision concentrée.
                    </p>
                  </div>
                </div>
                <div className="sanctuary-card-subtle flex items-start gap-3 !p-4">
                  <Sparkles className="h-5 w-5 text-secondary mt-0.5" />
                  <div>
                    <p className="font-semibold text-sm">Pause Sérénité</p>
                    <p className="text-xs text-on-surface-variant">
                      15 min de méditation guidée à 14h00.
                    </p>
                  </div>
                </div>
              </div>

              {/* Score */}
              <div className="gradient-primary-soft rounded-2xl p-4 sm:p-6 flex flex-col items-center justify-center">
                <span className="label-sanctuary text-primary/70 mb-2">Score de prêtitude</span>
                <span className="text-3xl sm:text-5xl font-bold text-primary">
                  {weeklyReport ? Math.round(weeklyReport.avg_mood * 20) : 85}%
                </span>
                <span className="text-xs text-primary/60 mt-1">Optimisé pour la créativité</span>
              </div>
            </div>
          </CardContent>
        </Card>

        {/* Priorités du jour */}
        <Card>
          <CardContent>
            <div className="flex items-center justify-between mb-4">
              <h3 className="text-xl font-bold">Priorités du jour</h3>
              <Link href="/checkin">
                <Clock className="h-5 w-5 text-primary" />
              </Link>
            </div>

            <div className="space-y-3">
              <div className="sanctuary-card-subtle !p-3">
                <p className="label-sanctuary mb-1">Prochain cours</p>
                {nextClass ? (
                  <p className="text-sm font-semibold">
                    {nextClass.subject} · {formatTimeString(nextClass.start_time)} - {formatTimeString(nextClass.end_time)}
                  </p>
                ) : (
                  <p className="text-sm text-on-surface-variant">Aucun cours restant aujourd&apos;hui.</p>
                )}
              </div>

              <div className="sanctuary-card-subtle !p-3">
                <p className="label-sanctuary mb-1">Urgence académique</p>
                {nearestExam ? (
                  <p className="text-sm font-semibold">Exam: {nearestExam.subject} · {formatDateShort(nearestExam.exam_date)}</p>
                ) : nearestProject ? (
                  <p className="text-sm font-semibold">Projet: {nearestProject.name} · {formatDateShort(nearestProject.due_date)}</p>
                ) : (
                  <p className="text-sm text-on-surface-variant">Aucune échéance proche.</p>
                )}
              </div>
            </div>

            <div className="mt-4">
              <div className="flex items-center justify-between mb-1">
                <span className="label-sanctuary">Progression check-ins du jour</span>
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
                    <h3 className="font-bold text-lg">Check-in du matin</h3>
                    <p className="text-sm opacity-80">
                      Prenez 2 minutes pour évaluer votre humeur et sommeil.
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
                    <h3 className="font-bold text-lg">Check-in du soir</h3>
                    <p className="text-sm opacity-80">
                      Évaluez votre journée et préparez demain.
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
      <div className="flex flex-col gap-4">
        {/* Mode actuel + Énergie Hebdo */}
        <Card>
          <CardContent>
            <h3 className="text-xl font-bold mb-4">Énergie Hebdo</h3>
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
                <p className="text-sm text-on-surface-variant">Aucune donnée cette semaine.</p>
              )}
            </div>

            {currentMode && (
              <div className="mt-6 sanctuary-card-subtle !p-4 flex items-center gap-3">
                <Clock className="h-5 w-5 text-primary animate-pulse-soft" />
                <div>
                  <span className="label-sanctuary">Mode actuel</span>
                  <p className="font-semibold">{modeLabel(currentMode.mode)}</p>
                </div>
              </div>
            )}
          </CardContent>
        </Card>

        {/* Synthèse + Actions rapides */}
        <Card>
          <CardContent>
            <h3 className="text-xl font-bold mb-4">Synthèse de la Semaine</h3>

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
                    Moyenne de sommeil : <strong>{weeklyReport.avg_sleep.toFixed(1)}h</strong>.
                    {" "}{weeklyReport.total_checkins} check-ins cette semaine.
                    {" "}{weeklyReport.goals_achieved} objectifs atteints.
                  </p>
                  <Link href="/history/weekly">
                    <Button variant="secondary" size="sm">
                      Voir le rapport complet
                    </Button>
                  </Link>
                </div>
              </div>
            ) : (
              <p className="text-sm text-on-surface-variant">
                Complétez vos check-ins pour obtenir votre synthèse.
              </p>
            )}

            {/* Quick links */}
            <div className="grid grid-cols-1 sm:grid-cols-2 gap-3 mt-6">
              <Link href="/goals" className="sanctuary-card-subtle !p-3 flex items-center gap-2 hover:bg-surface-container transition-colors rounded-xl">
                <Target className="h-4 w-4 text-primary" />
                <span className="text-sm font-medium">{dashboard?.active_goals_count || 0} objectifs</span>
              </Link>
              <Link href="/modes" className="sanctuary-card-subtle !p-3 flex items-center gap-2 hover:bg-surface-container transition-colors rounded-xl">
                <BookOpen className="h-4 w-4 text-primary" />
                <span className="text-sm font-medium">Modes</span>
              </Link>
            </div>

            <div className="mt-3">
              <Link href="/agent/chat" className="sanctuary-card-subtle !p-3 flex items-center gap-2 hover:bg-surface-container transition-colors rounded-xl">
                <Sparkles className="h-4 w-4 text-primary" />
                <span className="text-sm font-medium">Chat avec Mizan AI</span>
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
              Examens à venir
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
                      return days <= 0 ? "Aujourd'hui" : `J-${days}`;
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
              Emploi du temps du jour
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
                      {entry.professor} · Salle {entry.room}
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
              Projets actifs
            </h3>
            <div className="space-y-3">
              {activeProjects.slice(0, 4).map((project) => (
                <div key={project.id} className="sanctuary-card-subtle !p-4 flex items-center justify-between gap-3">
                  <div>
                    <p className="font-semibold">{project.name}</p>
                    <p className="text-xs text-on-surface-variant">
                      {project.subject} · Échéance {formatDateShort(project.due_date)} · Membres {project.members.length}
                    </p>
                  </div>
                  <Badge variant="secondary">Actif</Badge>
                </div>
              ))}
            </div>
          </CardContent>
        </Card>
      )}
    </div>
  );
}
