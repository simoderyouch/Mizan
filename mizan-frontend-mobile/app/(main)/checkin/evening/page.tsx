"use client";

import { useMemo, useState } from "react";
import { useRouter } from "next/navigation";
import Link from "next/link";
import { ArrowLeft, CheckCircle, Loader2, Mic, Moon, ShieldAlert, Target, Zap } from "lucide-react";

import { checkinsApi, getApiErrorMessage } from "@/lib/api";
import { EveningCheckinResponse, CheckinQuestion, CheckinAnswerPayload } from "@/lib/types";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import { Card, CardContent } from "@/components/ui/card";
import { QcmInput } from "@/components/checkin/QcmInput";
import { NextCheckinCountdown } from "@/components/checkin/next-checkin-countdown";
import { cn } from "@/lib/utils";

type Step = "mode" | "qcm" | "result";

const parseOption = (raw: string): { value: string; label: string } => {
  const trimmed = raw.trim();
  const valueMatch = trimmed.match(/['"]value['"]\s*:\s*['"]([^'"]+)['"]/);
  const labelMatch = trimmed.match(/['"]label['"]\s*:\s*['"]([^'"]+)['"]/);
  if (valueMatch && labelMatch) {
    return { value: valueMatch[1], label: labelMatch[1] };
  }
  return { value: raw, label: raw };
};

const mapMoodScaleToFive = (value: number) => {
  const bounded = Math.max(1, Math.min(10, value));
  return Math.max(1, Math.min(5, Math.round(1 + ((bounded - 1) / 9) * 4)));
};

const parseBooleanAnswer = (raw: unknown): boolean | undefined => {
  if (typeof raw === "boolean") return raw;
  if (typeof raw === "number") return raw !== 0;
  if (typeof raw === "string") {
    const normalized = raw.trim().toLowerCase();
    if (["true", "yes", "oui", "1", "done", "completed"].includes(normalized)) return true;
    if (["false", "no", "non", "0", "not_done", "incomplete"].includes(normalized)) return false;
  }
  return undefined;
};

export default function EveningCheckinPage() {
  const router = useRouter();
  const [step, setStep] = useState<Step>("mode");
  const [questions, setQuestions] = useState<CheckinQuestion[]>([]);
  const [answers, setAnswers] = useState<Record<string, string | number | boolean | string[]>>({});
  const [report, setReport] = useState<EveningCheckinResponse | null>(null);
  const [loadingQuestions, setLoadingQuestions] = useState(false);
  const [loadingSubmit, setLoadingSubmit] = useState(false);
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

  const setAnswer = (questionId: string, value: string | number | boolean | string[]) => {
    setAnswers((prev) => ({ ...prev, [questionId]: value }));
  };

  const loadQuestions = async () => {
    setError("");
    setLoadingQuestions(true);
    try {
      const res = await checkinsApi.questions("EVENING", "qcm");
      setQuestions(res.questions);
      setAnswers({});
      setStep("qcm");
    } catch (err: unknown) {
      setError(getApiErrorMessage(err, "Impossible de charger les questions personnalisées."));
    } finally {
      setLoadingQuestions(false);
    }
  };

  const buildResponses = (): CheckinAnswerPayload[] =>
    questions
      .filter((q) => answers[q.id] !== undefined)
      .map((q) => ({ question_id: q.id, value: answers[q.id] as string | number | boolean | string[] }));

  const fallbackValue = (target: "mood_score" | "plan_completed" | "notes"): number | boolean | string | undefined => {
    for (const q of questions) {
      if (q.target_field !== target) continue;
      const raw = answers[q.id];
      if (raw === undefined || raw === null) continue;
      if (target === "mood_score") {
        const parsed = Number(raw);
        return Number.isNaN(parsed) ? undefined : mapMoodScaleToFive(parsed);
      }
      if (target === "plan_completed") {
        return parseBooleanAnswer(raw);
      }
      return raw as string | boolean;
    }
    return undefined;
  };

  const handleSubmit = async () => {
    setError("");
    setLoadingSubmit(true);
    try {
      const res = await checkinsApi.createEvening({
        mode: "qcm",
        question_set: questions,
        responses: buildResponses(),
        mood_score: fallbackValue("mood_score") as number | undefined,
        plan_completed: fallbackValue("plan_completed") as boolean | undefined,
        notes: fallbackValue("notes") as string | undefined,
      });
      setReport(res);
      setStep("result");
    } catch (err: unknown) {
      setError(getApiErrorMessage(err, "Erreur lors du check-in."));
    } finally {
      setLoadingSubmit(false);
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
          Check-in du soir
        </Badge>
        <h1 className="text-3xl sm:text-4xl font-bold bg-gradient-to-r from-primary to-blue-400 bg-clip-text text-transparent pb-1">Bilan de la journée</h1>
      </div>

      {error && <div className="bg-red-50 text-red-600 text-sm rounded-xl px-4 py-3 mb-6 shadow-sm border border-red-100">{error}</div>}

      {step === "mode" && (
        <div className="grid sm:grid-cols-2 gap-4 page-enter">
          <Card className="cursor-pointer hover:border-primary/50 transition-all hover:shadow-sanctuary group" onClick={() => router.push("/checkin/voice?period=EVENING&return=/checkin/evening")}>
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
              <div className="h-16 w-16  bg-primary/10 rounded-full flex items-center justify-center mb-4 group-hover:scale-110 transition-transform ">
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
          <CardContent className="space-y-10 p-4 sm:p-8">
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

            <div className="flex gap-4 pt-4 border-t">
              <Button variant="ghost" onClick={() => setStep("mode")} className="flex-1">
                Précédent
              </Button>
              <Button onClick={handleSubmit} disabled={loadingSubmit || requiredUnanswered} className="flex-[2] bg-gradient-to-r from-primary to-blue-500">
                {loadingSubmit ? <Loader2 className="h-5 w-5 animate-spin" /> : "Enregistrer le check-in"}
              </Button>
            </div>
          </CardContent>
        </Card>
      )}

      {step === "result" && report && (
        <div className="page-enter space-y-8">
          <div className="text-center">
            <div className="inline-flex h-16 w-16 bg-primary/10 rounded-full items-center justify-center mb-4">
              <CheckCircle className="h-8 w-8 text-primary" />
            </div>
            <h2 className="text-3xl font-bold mb-2">Bilan enregistré</h2>
            <p className="text-on-surface-variant">Votre check-in du soir a été soumis avec succès.</p>
          </div>

          <div className="space-y-6">
            <div className="bg-surface-container rounded-2xl p-6 shadow-sm">
              <h3 className="font-bold text-xl mb-3 flex items-center gap-2">
                <Zap className="h-5 w-5 text-primary" />
                Réflexion Exécutive
              </h3>
              <p className="text-on-surface-variant leading-relaxed">
                {report.executive_summary || "Votre assistant Mizan a validé votre check-in."}
              </p>
            </div>

            {report.detailed_action_plan && report.detailed_action_plan.length > 0 && (
              <div className="bg-surface-container rounded-2xl p-6 shadow-sm">
                <h4 className="font-bold text-xl mb-4 flex items-center gap-2">
                  <Target className="w-5 h-5 text-blue-500" />
                  Bilan des Actions
                </h4>
                <ul className="space-y-3">
                  {report.detailed_action_plan.map((action, idx) => (
                    <li key={idx} className="flex gap-3 items-start">
                      <div className="flex-shrink-0 w-6 h-6 rounded-full bg-blue-100 text-blue-700 font-bold text-sm flex items-center justify-center mt-1">
                        ✓
                      </div>
                      <span className="text-on-surface-variant leading-relaxed">{action}</span>
                    </li>
                  ))}
                </ul>
              </div>
            )}

            {report.detected_risks && report.detected_risks.length > 0 && (
              <div className="bg-purple-50/50 rounded-2xl p-6 shadow-sm">
                <h4 className="font-bold text-xl text-purple-700 flex items-center mb-3 gap-2">
                  <ShieldAlert className="w-5 h-5" />
                  Points d&apos;Attention
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
          </div>

          <NextCheckinCountdown completedPeriod="EVENING" />

          <Button onClick={() => router.push("/dashboard")} size="lg" className="w-full h-14 text-lg rounded-xl shadow-lg">
            Bonne nuit, à demain !
          </Button>
        </div>
      )}
    </div>
  );
}
