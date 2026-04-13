"use client";

import { useMemo, useState } from "react";
import { useRouter } from "next/navigation";
import Link from "next/link";
import { ArrowLeft, CheckCircle2, Loader2, Mic, Moon, ShieldAlert, Target, Zap } from "lucide-react";

import { checkinsApi, getApiErrorMessage, tasksApi } from "@/lib/api";
import { useAuth } from "@/lib/auth";
import { MorningCheckinResponse, CheckinQuestion, CheckinAnswerPayload } from "@/lib/types";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import { Card, CardContent } from "@/components/ui/card";
import { QcmInput } from "@/components/checkin/QcmInput";
import { NextCheckinCountdown } from "@/components/checkin/next-checkin-countdown";
import { cn } from "@/lib/utils";

type Step = "mode" | "qcm" | "result";

const mapMoodScaleToFive = (value: number) => {
  const bounded = Math.max(1, Math.min(10, value));
  return Math.max(1, Math.min(5, Math.round(1 + ((bounded - 1) / 9) * 4)));
};

export default function MorningCheckinPage() {
  const { student } = useAuth();
  const router = useRouter();
  const [step, setStep] = useState<Step>("mode");
  const [questions, setQuestions] = useState<CheckinQuestion[]>([]);
  const [answers, setAnswers] = useState<Record<string, string | number | boolean | string[]>>({});
  const [report, setReport] = useState<MorningCheckinResponse | null>(null);
  const [loadingQuestions, setLoadingQuestions] = useState(false);
  const [loadingSubmit, setLoadingSubmit] = useState(false);
  const [creatingTasks, setCreatingTasks] = useState(false);
  const [taskSelection, setTaskSelection] = useState<Record<number, boolean>>({});
  const [error, setError] = useState("");

  const requiredUnanswered = useMemo(
    () =>
      questions.some((q) => {
        if (!q.required) return false;
        const value = answers[q.id];
        if (value === undefined || value === null) return true;
        if (typeof value === "string") return value.trim() === "";
        if (Array.isArray(value)) return value.length === 0;
        return false;
      }),
    [questions, answers]
  );

  const loadQuestions = async () => {
    setError("");
    setLoadingQuestions(true);
    try {
      const res = await checkinsApi.questions("MORNING", "qcm");
      setQuestions(res.questions);
      setAnswers({});
      setStep("qcm");
    } catch (err: unknown) {
      setError(getApiErrorMessage(err, "Impossible de charger les questions personnalisées."));
    } finally {
      setLoadingQuestions(false);
    }
  };

  const setAnswer = (questionId: string, value: string | number | boolean | string[]) => {
    setAnswers((prev) => ({ ...prev, [questionId]: value }));
  };

  const buildResponses = (): CheckinAnswerPayload[] =>
    questions
      .filter((q) => answers[q.id] !== undefined)
      .map((q) => ({ question_id: q.id, value: answers[q.id] as string | number | boolean | string[] }));

  const fallbackMetric = (target: "mood_score" | "sleep_hours"): number | undefined => {
    for (const q of questions) {
      if (q.target_field !== target) continue;
      const raw = answers[q.id];
      if (raw === undefined || raw === null) continue;
      if (typeof raw === "number") {
        return target === "mood_score" ? mapMoodScaleToFive(raw) : raw;
      }
      const parsed = Number(raw);
      if (!Number.isNaN(parsed)) return target === "mood_score" ? mapMoodScaleToFive(parsed) : parsed;
    }
    return undefined;
  };

  const handleSubmit = async () => {
    setError("");
    setLoadingSubmit(true);
    try {
      const res = await checkinsApi.createMorning({
        mode: "qcm",
        question_set: questions,
        responses: buildResponses(),
        mood_score: fallbackMetric("mood_score"),
        sleep_hours: fallbackMetric("sleep_hours"),
      });
      setReport(res);
      setStep("result");
    } catch (err: unknown) {
      setError(getApiErrorMessage(err, "Erreur lors du check-in."));
    } finally {
      setLoadingSubmit(false);
    }
  };

  const toggleTaskSelection = (idx: number) => {
    setTaskSelection((prev) => ({ ...prev, [idx]: !(prev[idx] ?? true) }));
  };

  const selectedPlanCount = (report?.detailed_action_plan ?? []).filter((_, idx) => taskSelection[idx] ?? true).length;

  const selectAllPlan = () => {
    const items = report?.detailed_action_plan ?? [];
    const next: Record<number, boolean> = {};
    items.forEach((_, idx) => {
      next[idx] = true;
    });
    setTaskSelection(next);
  };

  const clearPlanSelection = () => {
    const items = report?.detailed_action_plan ?? [];
    const next: Record<number, boolean> = {};
    items.forEach((_, idx) => {
      next[idx] = false;
    });
    setTaskSelection(next);
  };

  const createTasksFromPlan = async () => {
    if (!report?.detailed_action_plan?.length) return;
    const tasks = report.detailed_action_plan
      .map((action, idx) => ({ action, idx }))
      .filter(({ idx }) => taskSelection[idx] ?? true)
      .map(({ action }) => ({
        title: action.slice(0, 180),
        source: "morning_checkin" as const,
      }));

    if (!tasks.length) return;
    setCreatingTasks(true);
    try {
      await tasksApi.createMany({ tasks });
    } catch (err: unknown) {
      setError(getApiErrorMessage(err, "Could not create tasks from your morning plan."));
    } finally {
      setCreatingTasks(false);
    }
  };

  return (
    <div className="page-enter max-w-2xl mx-auto px-2 pb-20 sm:px-6">
      <Link href="/dashboard" className="inline-flex items-center text-sm text-on-surface-variant hover:text-primary mb-6 transition-colors">
        <ArrowLeft className="h-4 w-4 mr-1" />
        Retour
      </Link>

      <div className="text-center mb-8">
        <Badge className="mb-3 px-3 py-1 shadow-sm">
          <Moon className="h-3 w-3 mr-1" />
          Check-in matinal
        </Badge>
        <h1 className="text-3xl sm:text-4xl font-bold bg-gradient-to-r from-primary to-blue-400 bg-clip-text text-transparent pb-1">
          Bonjour, {student?.first_name || "étudiant"}.
        </h1>
      </div>

      {error && <div className="bg-red-50 text-red-600 text-sm rounded-xl px-4 py-3 mb-6 shadow-sm border border-red-100">{error}</div>}

      {step === "mode" && (
        <div className="grid sm:grid-cols-2 gap-4 page-enter">
          <Card className="cursor-pointer hover:border-primary/50 transition-all hover:shadow-sanctuary group" onClick={() => router.push("/checkin/voice?period=MORNING&return=/checkin/morning")}>
            <CardContent className="p-8 text-center flex flex-col items-center">
              <div className="h-16 w-16 bg-primary/10 rounded-full flex items-center justify-center mb-4 group-hover:scale-110 transition-transform">
                <Mic className="h-8 w-8 text-primary" />
              </div>
              <h3 className="text-xl font-bold mb-2">Mode Conversation</h3>
              <p className="text-sm text-on-surface-variant">Questions vocales dynamiques générées par l&apos;IA.</p>
            </CardContent>
          </Card>

          <Card className="cursor-pointer hover:border-primary/50 transition-all hover:shadow-sanctuary group" onClick={() => void loadQuestions()}>
            <CardContent className="p-8 text-center flex flex-col items-center">
              <div className="h-16 w-16 bg-primary/10 rounded-full flex items-center justify-center mb-4 group-hover:scale-110 transition-transform">
                <Zap className="h-8 w-8 text-primary" />
              </div>
              <h3 className="text-xl font-bold mb-2">Mode QCM Dynamique</h3>
              <p className="text-sm text-on-surface-variant">{loadingQuestions ? "Génération des questions..." : "Le nombre et format de questions s&apos;adaptent à votre contexte."}</p>
            </CardContent>
          </Card>
        </div>
      )}

      {step === "qcm" && (
        <Card className="page-enter shadow-sanctuary overflow-hidden border-none outline-none bg-surface-lowest/50 backdrop-blur-md">
          <CardContent className="space-y-8 py-4 px-2 sm:p-8">
            {questions.map((question, idx) => (
              <div key={question.id} className="space-y-4">
                <h3 className="font-bold text-lg text-on-surface flex items-start gap-2.5">
                  <span className="flex-shrink-0 w-7 h-7 rounded-full bg-primary/10 text-primary text-xs flex items-center justify-center font-black">
                    {idx + 1}
                  </span>
                  <span className="flex-1 pt-0.5">{question.text} {question.required ? "*" : ""}</span>
                </h3>
                <QcmInput
                  question={question}
                  value={answers[question.id]}
                  onChange={(val) => setAnswer(question.id, val)}
                />
              </div>
            ))}

            <div className="flex gap-1 pt-4 border-t">
              <Button variant="ghost" onClick={() => setStep("mode")} className="flex-1 p-2">
                Précédent
              </Button>
              <Button onClick={handleSubmit} disabled={loadingSubmit || requiredUnanswered} className="flex-[2] bg-gradient-to-r from-primary to-blue-500">
                {loadingSubmit ? <Loader2 className="h-5 w-5 animate-spin" /> : "Soumettre le check-in"}
              </Button>
            </div>
          </CardContent>
        </Card>
      )}

      {step === "result" && report && (
        <div className="page-enter space-y-8">
          <div className="text-center">
            <div className="inline-flex h-16 w-16 bg-emerald-100 rounded-full items-center justify-center mb-4 dark:bg-emerald-900/30">
              <CheckCircle2 className="h-8 w-8 text-emerald-500" />
            </div>
            <h2 className="text-3xl font-bold mb-2">Check-in validé</h2>
            <p className="text-on-surface-variant">Voici le bilan de votre check-in matinal.</p>
          </div>

          {/* Executive Summary */}
          <div className="bg-surface-container rounded-2xl p-6 text-center shadow-sm">
            <h3 className="font-bold text-xl text-primary mb-3">Résumé Exécutif</h3>
            <div className="text-on-surface leading-relaxed text-md space-y-2">
              {(report.executive_summary || "Votre assistant Mizan a validé votre check-in.").split('\n').map((paragraph, index) => (
                <p key={index}>{paragraph}</p>
              ))}
            </div>
          </div>

          {/* Task Proposals */}
          {report.detailed_action_plan && report.detailed_action_plan.length > 0 && (
            <div className="bg-surface-container rounded-2xl p-6 shadow-sm">
              <div className="flex flex-col sm:flex-row sm:items-center sm:justify-between gap-2 mb-4">
                <h4 className="font-bold text-lg flex items-center">
                  <Target className="w-5 h-5 mr-2 text-blue-500" />
                  Tâches proposées suite à votre check-in
                </h4>
                <Badge variant="secondary">{selectedPlanCount}/{report.detailed_action_plan.length} sélectionnée(s)</Badge>
              </div>

              <div className="flex items-center gap-2 mb-4">
                <Button variant="secondary" size="sm" onClick={selectAllPlan}>
                  Tout sélectionner
                </Button>
                <Button variant="secondary" size="sm" onClick={clearPlanSelection}>
                  Tout désélectionner
                </Button>
              </div>

              <ul className="space-y-3">
                {report.detailed_action_plan.map((action, idx) => (
                  <li
                    key={idx}
                    className="group flex gap-3 rounded-xl border border-outline-variant bg-surface p-3 items-start hover:border-primary/40 hover:bg-primary/5 transition-colors cursor-pointer"
                    onClick={() => toggleTaskSelection(idx)}
                  >
                    <input
                      type="checkbox"
                      checked={taskSelection[idx] ?? true}
                      onChange={() => toggleTaskSelection(idx)}
                      className="mt-1 h-4 w-4 accent-primary"
                      onClick={(e) => e.stopPropagation()}
                    />
                    <span className="flex-shrink-0 w-6 h-6 rounded-full bg-blue-100 text-blue-700 font-bold text-sm flex items-center justify-center mt-0.5">
                      {idx + 1}
                    </span>
                    <span className="text-on-surface text-md font-medium leading-relaxed">{action}</span>
                  </li>
                ))}
              </ul>

              <div className="pt-6">
                <Button onClick={() => void createTasksFromPlan()} disabled={creatingTasks || selectedPlanCount === 0} className="w-full">
                  {creatingTasks ? <Loader2 className="h-4 w-4 animate-spin mr-2" /> : null}
                  Valider et créer les tâches
                </Button>
              </div>
            </div>
          )}

          {/* Detected Risks */}
          {report.detected_risks && report.detected_risks.length > 0 && (
            <div className="bg-purple-50/50 rounded-2xl p-6 shadow-sm">
              <h4 className="font-bold text-xl text-purple-700 flex items-center mb-3 gap-2">
                <ShieldAlert className="w-5 h-5" />
                Risques Détectés
              </h4>
              <ul className="space-y-2 list-disc list-inside">
                {report.detected_risks.map((risk, idx) => (
                  <li key={idx} className="text-purple-800/90">
                    {risk}
                  </li>
                ))}
              </ul>
            </div>
          )}

          <NextCheckinCountdown completedPeriod="MORNING" />

          <Button onClick={() => router.push("/dashboard")} className="w-full h-14 text-lg rounded-xl shadow-md">
            Aller au Tableau de Bord
          </Button>
        </div>
      )}
    </div>
  );
}
