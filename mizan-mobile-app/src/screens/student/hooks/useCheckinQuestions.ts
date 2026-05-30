import { useCallback, useState } from "react";
import { useFocusEffect } from "@react-navigation/native";
import { checkinsApi, getApiErrorMessage } from "../../../lib/api";
import type { CheckinPeriod, CheckinQuestion, QuestionSource } from "../../../lib/types";

/**
 * Loads personalized check-in questions from the backend.
 * Phase 2: Exposes `source` ("llm" | "fallback") so the UI can inform the user.
 */
export function useCheckinQuestions(period: CheckinPeriod, enabled: boolean) {
  const [questions, setQuestions] = useState<CheckinQuestion[]>([]);
  const [source, setSource] = useState<QuestionSource | undefined>(undefined);
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState("");

  useFocusEffect(
    useCallback(() => {
      if (!enabled) return;
      let active = true;
      const load = async () => {
        setLoading(true);
        setError("");
        try {
          const res = await checkinsApi.questions(period, "qcm");
          if (!active) return;
          setQuestions(res.questions);
          setSource(res.source);
        } catch (err) {
          if (!active) return;
          setQuestions([]);
          setSource(undefined);
          setError(getApiErrorMessage(err, "Could not load check-in questions."));
        } finally {
          if (active) setLoading(false);
        }
      };
      void load();
      return () => {
        active = false;
      };
    }, [period, enabled])
  );

  return { questions, source, loading, error };
}
