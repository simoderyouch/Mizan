import React, { useState } from "react";
import { Screen } from "../../../components/screen";
import { Button, ErrorBanner } from "../../../components/ui";
import { checkinsApi, getApiErrorMessage, tasksApi } from "../../../lib/api";
import type { CheckinQuestion, QuestionSource } from "../../../lib/types";
import { spacing } from "../../../theme";
import type { Nav } from "../types";
import { checkinAnswers, extractMetricFromAnswers, hasRequiredUnanswered } from "../utils";
import { todayIso } from "../constants";
import { RitualFormatPicker } from "../components";
import { CheckinResultCard } from "../components/CheckinResultCard";
import { CheckinScreenHeader } from "./CheckinScreenHeader";
import { QuestionForm } from "./QuestionForm";

export function EveningCheckinScreen({ navigation }: { navigation: Nav }) {
  const [step, setStep] = useState<"format" | "form" | "result">("format");
  const [questions, setQuestions] = useState<CheckinQuestion[]>([]);
  const [source, setSource] = useState<QuestionSource | undefined>();
  const [questionsLoading, setQuestionsLoading] = useState(false);
  const [questionStep, setQuestionStep] = useState(0);
  const [answers, setAnswers] = useState<Record<string, string | number | boolean | string[]>>({});
  const [result, setResult] = useState<string | null>(null);
  const [planTasks, setPlanTasks] = useState<string[]>([]);
  const [tasksCreated, setTasksCreated] = useState("");
  const [loading, setLoading] = useState(false);
  const [taskLoading, setTaskLoading] = useState(false);
  const [error, setError] = useState("");

  const loadQuestions = async () => {
    setQuestionsLoading(true);
    setError("");
    try {
      const res = await checkinsApi.questions("EVENING", "qcm");
      setQuestions(res.questions);
      setSource(res.source);
      setAnswers({});
      setQuestionStep(0);
      setStep("form");
    } catch (err) {
      setError(getApiErrorMessage(err, "Unable to load personalized questions."));
    } finally {
      setQuestionsLoading(false);
    }
  };

  const submit = async () => {
    if (hasRequiredUnanswered(questions, answers)) {
      setError("Please answer all required questions.");
      return;
    }
    setLoading(true);
    setError("");
    try {
      const response = await checkinsApi.createEvening({
        mode: "qcm",
        question_set: questions,
        responses: checkinAnswers(answers),
        mood_score: extractMetricFromAnswers(questions, answers, "mood_score") as number | undefined,
        plan_completed: extractMetricFromAnswers(questions, answers, "plan_completed") as boolean | undefined,
        notes: extractMetricFromAnswers(questions, answers, "notes") as string | undefined,
      });
      setResult(response.executive_summary ?? "Review saved.");
      setPlanTasks(response.detailed_action_plan ?? []);
      setTasksCreated("");
      setStep("result");
    } catch (err) {
      setError(getApiErrorMessage(err, "Could not save review."));
    } finally {
      setLoading(false);
    }
  };

  const createPlanTasks = async (selected: string[]) => {
    if (!selected.length) return;
    setTaskLoading(true);
    setError("");
    try {
      await tasksApi.createMany({
        tasks: selected.map((title) => ({
          title: title.slice(0, 180),
          due_date: todayIso(),
          source: "evening_checkin",
        })),
      });
      setTasksCreated(`${selected.length} task(s) added for today.`);
    } catch (err) {
      setError(getApiErrorMessage(err, "Could not create review tasks."));
    } finally {
      setTaskLoading(false);
    }
  };

  const goBack = () => {
    if (step === "format") navigation.goBack();
    else if (step === "result") navigation.goBack();
    else setStep("format");
  };

  return (
    <Screen variant="stackBare">
      <CheckinScreenHeader
        period="EVENING"
        step={step}
        onBack={goBack}
        questionIndex={questionStep}
        questionTotal={step === "form" ? questions.length : 0}
      />
      <ErrorBanner message={error} />

      {step === "format" ? (
        <RitualFormatPicker
          quizLoading={questionsLoading}
          onVoice={() => navigation.navigate("VoiceCheckin", { period: "EVENING" })}
          onQuiz={() => void loadQuestions()}
        />
      ) : null}

      {step === "form" ? (
        <QuestionForm
          answers={answers}
          onAnswer={(id, value) => setAnswers((prev) => ({ ...prev, [id]: value }))}
          onChangeFormat={() => setStep("format")}
          onStepChange={setQuestionStep}
          onSubmit={submit}
          onRetry={() => void loadQuestions()}
          questions={questions}
          source={source}
          submitting={loading}
        />
      ) : null}

      {step === "result" ? (
        <>
          <CheckinResultCard
            planTasks={planTasks}
            summary={result ?? ""}
            taskLoading={taskLoading}
            tasksCreated={tasksCreated}
            onCreateTasks={createPlanTasks}
          />
          <Button onPress={() => navigation.goBack()} style={{ marginTop: spacing.lg }}>
            Done
          </Button>
        </>
      ) : null}
    </Screen>
  );
}
