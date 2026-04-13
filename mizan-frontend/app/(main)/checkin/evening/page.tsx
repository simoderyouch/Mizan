"use client";

import { useMemo, useState } from "react";
import { useRouter } from "next/navigation";
import Link from "next/link";
import { ArrowLeft, CheckCircle, Loader2, Mic, Moon, ShieldAlert, Target, Zap } from "lucide-react";

import { checkinsApi, getApiErrorMessage } from "@/lib/api";
import type { CheckinAnswerPayload, CheckinQuestion, EveningCheckinResponse } from "@/lib/types";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import { Card, CardContent } from "@/components/ui/card";
import { Input } from "@/components/ui/input";
import { Textarea } from "@/components/ui/textarea";
import { NextCheckinCountdown } from "@/components/checkin/next-checkin-countdown";

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
      setError(getApiErrorMessage(err, "Unable to load personalized questions."));
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
      setError(getApiErrorMessage(err, "Error while submitting check-in."));
    } finally {
      setLoadingSubmit(false);
    }
  };

  const renderInput = (question: CheckinQuestion) => {
    const value = answers[question.id];
    const min = question.min_value ?? (question.answer_type === "scale" ? 1 : question.answer_type === "time_hours" ? 0 : 0);
    const max = question.max_value ?? (question.answer_type === "scale" ? 10 : question.answer_type === "time_hours" ? 16 : 10);
    const stepValue = question.step ?? (question.answer_type === "time_hours" ? 0.5 : 1);

    if (question.answer_type === "scale") {
      const scalePoints = Array.from({ length: Math.max(1, max - min + 1) }, (_, idx) => min + idx);
      const optionLabels = question.options && question.options.length === scalePoints.length ? question.options : null;
      return (
        <div className="space-y-3">
          <div className="flex justify-center gap-3">
            {scalePoints.map((score, idx) => (
              <button
                key={score}
                onClick={() => setAnswer(question.id, score)}
                className={`min-w-12 h-12 px-3 rounded-full flex items-center justify-center text-sm font-semibold transition-all ${
                  value === score ? "bg-primary text-on-primary scale-110 shadow-sanctuary-lg ring-4 ring-primary/20" : "bg-surface-container hover:bg-surface-container-high"
                }`}
              >
                {optionLabels ? optionLabels[idx] : score}
              </button>
            ))}
          </div>
        </div>
      );
    }

    if (question.answer_type === "boolean") {
      return (
        <div className="flex gap-3">
          <Button variant={value === true ? "default" : "secondary"} className="flex-1" onClick={() => setAnswer(question.id, true)}>
            Yes
          </Button>
          <Button variant={value === false ? "default" : "secondary"} className="flex-1" onClick={() => setAnswer(question.id, false)}>
            No
          </Button>
        </div>
      );
    }

    if (question.answer_type === "single_choice" && question.options?.length) {
      const parsedOptions = question.options.map(parseOption);
      return (
        <div className="grid gap-2">
          {parsedOptions.map((opt) => (
            <Button key={opt.value} variant={value === opt.value ? "default" : "secondary"} onClick={() => setAnswer(question.id, opt.value)} className="justify-start">
              {opt.label}
            </Button>
          ))}
        </div>
      );
    }

    if (question.answer_type === "multi_choice" && question.options?.length) {
      const parsedOptions = question.options.map(parseOption);
      const selected = Array.isArray(value) ? value : [];
      return (
        <div className="grid gap-2">
          {parsedOptions.map((opt) => {
            const isSelected = selected.includes(opt.value);
            return (
              <Button
                key={opt.value}
                variant={isSelected ? "default" : "secondary"}
                onClick={() =>
                  setAnswer(
                    question.id,
                    isSelected ? selected.filter((item) => item !== opt.value) : [...selected, opt.value]
                  )
                }
                className="justify-start"
              >
                {opt.label}
              </Button>
            );
          })}
        </div>
      );
    }

    if (question.answer_type === "time_hours" || question.answer_type === "number") {
      return (
        <Input
          type="number"
          min={min}
          max={max}
          step={stepValue}
          value={typeof value === "number" ? value : ""}
          onChange={(e) => setAnswer(question.id, Number(e.target.value))}
        />
      );
    }

    return (
      <Textarea
        value={typeof value === "string" ? value : ""}
        onChange={(e) => setAnswer(question.id, e.target.value)}
        placeholder="Your answer..."
        className="min-h-[100px] resize-none"
      />
    );
  };

  return (
    <div className="page-enter max-w-2xl mx-auto px-1 pb-16">
      <Link href="/dashboard" className="inline-flex items-center text-sm text-on-surface-variant hover:text-primary mb-6 transition-colors">
        <ArrowLeft className="h-4 w-4 mr-1" />
        Back
      </Link>

      <div className="text-center mb-8">
        <Badge className="mb-3 px-3 py-1 shadow-sm">
          <Moon className="h-3 w-3 mr-1" />
          Evening check-in
        </Badge>
        <h1 className="text-3xl sm:text-4xl font-bold bg-gradient-to-r from-primary to-blue-400 bg-clip-text text-transparent pb-1">Day review</h1>
      </div>

      {error && <div className="bg-red-50 text-red-600 text-sm rounded-xl px-4 py-3 mb-6 shadow-sm border border-red-100">{error}</div>}

      {step === "mode" && (
        <div className="grid sm:grid-cols-2 gap-4 page-enter">
          <Card className="cursor-pointer hover:border-primary/50 transition-all hover:shadow-sanctuary group" onClick={() => router.push("/checkin/voice?period=EVENING&return=/checkin/evening")}>
            <CardContent className="p-8 text-center flex flex-col items-center">
              <div className="h-16 w-16 bg-primary/10 rounded-full flex items-center justify-center mb-4 group-hover:scale-110 transition-transform">
                <Mic className="h-8 w-8 text-primary" />
              </div>
              <h3 className="text-xl font-bold mb-2">Conversation mode</h3>
              <p className="text-sm text-on-surface-variant">Dynamic voice questions generated by AI.</p>
            </CardContent>
          </Card>

          <Card className="cursor-pointer hover:border-primary/50 transition-all hover:shadow-sanctuary group" onClick={() => void loadQuestions()}>
            <CardContent className="p-8 text-center flex flex-col items-center">
              <div className="h-16 w-16  bg-primary/10 rounded-full flex items-center justify-center mb-4 group-hover:scale-110 transition-transform ">
                <Zap className="h-8 w-8 text-primary" />
              </div>
              <h3 className="text-xl font-bold mb-2">Dynamic quiz mode</h3>
              <p className="text-sm text-on-surface-variant">{loadingQuestions ? "Generating questions..." : "Question count and format adapt to your context."}</p>
            </CardContent>
          </Card>
        </div>
      )}

      {step === "qcm" && (
        <Card className="page-enter shadow-sanctuary">
          <CardContent className="space-y-6 p-8">
            {questions.map((question, idx) => (
              <div key={question.id} className="space-y-3">
                <h3 className="font-bold text-lg">
                  {idx + 1}. {question.text} {question.required ? "*" : ""}
                </h3>
                {renderInput(question)}
              </div>
            ))}

            <div className="flex gap-4 pt-4 border-t">
              <Button variant="ghost" onClick={() => setStep("mode")} className="flex-1">
                Back
              </Button>
              <Button onClick={handleSubmit} disabled={loadingSubmit || requiredUnanswered} className="flex-[2] bg-gradient-to-r from-primary to-blue-500">
                {loadingSubmit ? <Loader2 className="h-5 w-5 animate-spin" /> : "Save check-in"}
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
            <h2 className="text-3xl font-bold mb-2">Review saved</h2>
            <p className="text-on-surface-variant">Your evening check-in was submitted successfully.</p>
          </div>

          <div className="space-y-6">
            <div className="bg-surface-container rounded-2xl p-6 shadow-sm">
              <h3 className="font-bold text-xl mb-3 flex items-center gap-2">
                <Zap className="h-5 w-5 text-primary" />
                Executive reflection
              </h3>
              <p className="text-on-surface-variant leading-relaxed">
                {report.executive_summary || "Your Mizan assistant reviewed your check-in."}
              </p>
            </div>

            {report.detailed_action_plan && report.detailed_action_plan.length > 0 && (
              <div className="bg-surface-container rounded-2xl p-6 shadow-sm">
                <h4 className="font-bold text-xl mb-4 flex items-center gap-2">
                  <Target className="w-5 h-5 text-blue-500" />
                  Action review
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
                  Attention points
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
            Good night, see you tomorrow!
          </Button>
        </div>
      )}
    </div>
  );
}
