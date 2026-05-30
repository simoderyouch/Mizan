import React, { useCallback, useEffect, useRef, useState } from "react";
import {
  ActivityIndicator,
  Pressable,
  ScrollView,
  Text,
  View,
} from "react-native";
import { RouteProp, useNavigation, useRoute } from "@react-navigation/native";
import type { MainStackParamList } from "../../../navigation/types";
import { Mic, Square } from "lucide-react-native";
import { Screen } from "../../../components/screen";
import {
  Button,
  Card,
  ErrorBanner,
  styles as uiStyles,
} from "../../../components/ui";
import { getApiErrorMessage, tasksApi } from "../../../lib/api";
import { colors, spacing } from "../../../theme";
import { todayIso } from "../constants";
import { VOICE_TIMING, voiceTimingLabel } from "../voiceTiming";
import { getSuggestedVoicePeriod } from "../utils";
import { usePlayback } from "../hooks/usePlayback";
import { useVoiceSession } from "../hooks/useVoiceSession";
import { waitForRecordingUri } from "../../../lib/native-upload";
import { CheckinScreenHeader } from "./CheckinScreenHeader";
import { styles } from "../styles";

export function VoiceCheckinScreen() {
  const route = useRoute<RouteProp<MainStackParamList, "VoiceCheckin">>();
  const navigation = useNavigation();
  const initialPeriod = route.params?.period ?? getSuggestedVoicePeriod();

  const voice = useVoiceSession(initialPeriod, { handsFree: true });

  const [step, setStep] = useState<"start" | "session" | "result">("start");
  const [isQuestionPlaying, setIsQuestionPlaying] = useState(false);
  const [questionAudioUri, setQuestionAudioUri] = useState<string | null>(null);
  const [analysis, setAnalysis] = useState("");
  const [recommendations, setRecommendations] = useState<string[]>([]);
  const [taskSelection, setTaskSelection] = useState<Record<number, boolean>>({});
  const [tasksCreated, setTasksCreated] = useState("");
  const [taskLoading, setTaskLoading] = useState(false);
  const [localError, setLocalError] = useState("");
  const lastPlayedQuestionRef = useRef<number | null>(null);
  const autoRecordTimerRef = useRef<ReturnType<typeof setTimeout> | null>(null);

  const error = voice.error || localError;
  const period = voice.period;
  const isMorning = period === "MORNING";

  const clearAutoRecordTimer = useCallback(() => {
    if (autoRecordTimerRef.current) {
      clearTimeout(autoRecordTimerRef.current);
      autoRecordTimerRef.current = null;
    }
  }, []);

  const scheduleAutoRecord = useCallback(() => {
    if (step !== "session") return;
    if (voice.recording || voice.transcribing || voice.submitting) return;
    if (!voice.currentQuestion) return;
    if ((voice.transcriptions[voice.currentQuestion.index] ?? "").trim()) return;

    clearAutoRecordTimer();
    autoRecordTimerRef.current = setTimeout(() => {
      void voice.startRecording();
    }, VOICE_TIMING.postQuestionDelayMs);
  }, [
    step,
    voice.recording,
    voice.transcribing,
    voice.submitting,
    voice.currentQuestion,
    voice.transcriptions,
    voice.startRecording,
    clearAutoRecordTimer,
  ]);

  const handleQuestionAudioEnded = useCallback(() => {
    setIsQuestionPlaying(false);
    scheduleAutoRecord();
  }, [scheduleAutoRecord]);

  const { play: playQuestionAudio } = usePlayback(questionAudioUri, { onEnded: handleQuestionAudioEnded });

  useEffect(() => () => clearAutoRecordTimer(), [clearAutoRecordTimer]);

  useEffect(() => {
    if (route.params?.period) {
      voice.setPeriod(route.params.period);
    }
  }, [route.params?.period]);

  useEffect(() => {
    if (!questionAudioUri) return;
    playQuestionAudio();
    setIsQuestionPlaying(true);
    const fallback = setTimeout(() => handleQuestionAudioEnded(), 45_000);
    return () => clearTimeout(fallback);
  }, [questionAudioUri, playQuestionAudio, handleQuestionAudioEnded]);

  const playQuestionPrompt = useCallback(
    (questionIndex: number) => {
      if (!voice.session) return;
      const question = voice.session.questions[questionIndex];
      if (!question?.text) return;
      const audioBase64 =
        question.audio_base64 || (questionIndex === 0 ? voice.session.first_audio_base64 : "");
      if (audioBase64) {
        setQuestionAudioUri(`data:audio/mp3;base64,${audioBase64}`);
      } else {
        setIsQuestionPlaying(false);
        scheduleAutoRecord();
      }
    },
    [voice.session, scheduleAutoRecord]
  );

  useEffect(() => {
    if (step !== "session" || !voice.session || voice.recording || voice.transcribing) return;
    if (lastPlayedQuestionRef.current === voice.currentQuestionIndex) return;
    lastPlayedQuestionRef.current = voice.currentQuestionIndex;
    playQuestionPrompt(voice.currentQuestionIndex);
  }, [step, voice.session, voice.currentQuestionIndex, voice.recording, voice.transcribing, playQuestionPrompt]);

  const handleStartSession = async () => {
    lastPlayedQuestionRef.current = null;
    const res = await voice.startSession();
    if (res) setStep("session");
  };

  const handleSubmit = async () => {
    const res = await voice.submitSession();
    if (res) {
      setAnalysis(res.analysis);
      setRecommendations(res.recommendations ?? []);
      const selection: Record<number, boolean> = {};
      (res.recommendations ?? []).forEach((_, idx) => {
        selection[idx] = true;
      });
      setTaskSelection(selection);
      setTasksCreated("");
      setStep("result");
    }
  };

  useEffect(() => {
    if (step !== "session" || !voice.session || voice.recording || voice.transcribing || voice.submitting) return;
    if (!voice.allAnswered) return;
    if (voice.autoSubmittedRef.current === voice.session.session_id) return;
    voice.autoSubmittedRef.current = voice.session.session_id;
    void handleSubmit().catch(() => {
      voice.autoSubmittedRef.current = null;
    });
  }, [step, voice.session, voice.recording, voice.transcribing, voice.submitting, voice.allAnswered]);

  const createRecommendationTasks = async () => {
    if (!recommendations.length) return;
    const tasks = recommendations
      .map((recommendation, idx) => ({ recommendation, idx }))
      .filter(({ idx }) => taskSelection[idx] ?? true)
      .map(({ recommendation }) => ({
        title: recommendation.slice(0, 180),
        due_date: todayIso(),
        source: isMorning ? ("morning_checkin" as const) : ("evening_checkin" as const),
      }))
      .filter((item) => item.title);
    if (!tasks.length) return;
    setTaskLoading(true);
    setLocalError("");
    try {
      await tasksApi.createMany({ tasks });
      setTasksCreated(`${tasks.length} task(s) added for today.`);
    } catch (err) {
      setLocalError(getApiErrorMessage(err, "Could not create tasks."));
    } finally {
      setTaskLoading(false);
    }
  };

  const statusText = voice.recording
    ? "Speak now — recording stops shortly after you pause."
    : voice.transcribing
      ? "Saving your answer..."
      : isQuestionPlaying
        ? "Listen to the question..."
        : voice.submitting
          ? "Analyzing your check-in..."
          : "Mic opens right after each question.";

  const back = () => navigation.goBack();

  if (step === "start") {
    return (
      <Screen variant="stackBare">
        <CheckinScreenHeader period={period} step="format" onBack={back} />
        <ErrorBanner message={error} />
        {error && !voice.starting ? (
          <Button onPress={() => void handleStartSession()} style={{ marginBottom: spacing.md }}>
            Retry
          </Button>
        ) : null}

        <View style={styles.voiceStartHero}>
          <Text style={styles.voiceStartTitle}>
            {isMorning
              ? "I'm listening for your morning check-in"
              : "I'm listening for your evening check-in"}
          </Text>
          <Text style={styles.voiceStartSub}>
            {isMorning
              ? "Hands-free: Mizan reads each question, listens, and saves your answers automatically."
              : "Hands-free: speak while you keep moving — no taps between questions."}
          </Text>

          <Pressable
            disabled={voice.starting}
            onPress={() => void handleStartSession()}
            style={({ pressed }) => [styles.voiceStartOrbWrap, pressed && styles.voicePressed]}
          >
            <View
              style={{
                alignItems: "center",
                backgroundColor: colors.primary,
                borderRadius: 999,
                height: 128,
                justifyContent: "center",
                width: 128,
              }}
            >
              {voice.starting ? (
                <ActivityIndicator color={colors.onPrimary} size="large" />
              ) : (
                <Mic color={colors.onPrimary} size={40} />
              )}
            </View>
          </Pressable>

          <Text style={styles.voiceStartTap}>{voice.starting ? "Connecting..." : "Tap to start"}</Text>
          <Text style={[uiStyles.muted, { textAlign: "center", marginTop: spacing.sm, fontSize: 12 }]}>
            {voiceTimingLabel()}
          </Text>
        </View>
      </Screen>
    );
  }

  if (step === "result") {
    return (
      <Screen variant="stackBare">
        <CheckinScreenHeader period={period} step="result" onBack={back} />
        <ErrorBanner message={error} />

        <Card style={styles.gapCard}>
          <View style={[styles.voiceAnalysisCard, { alignSelf: "stretch" }]}>
            <Text style={[uiStyles.muted, { lineHeight: 22 }]}>{analysis}</Text>
          </View>

          {recommendations.length ? (
            <View style={{ alignSelf: "stretch", gap: spacing.sm, marginTop: spacing.md }}>
              <Text style={uiStyles.h3}>Recommendations</Text>
              {recommendations.map((item, idx) => (
                <Pressable
                  key={`${item}-${idx}`}
                  onPress={() => setTaskSelection((prev) => ({ ...prev, [idx]: !(prev[idx] ?? true) }))}
                  style={[
                    styles.voiceRecommendationRow,
                    (taskSelection[idx] ?? true) && styles.voiceRecommendationRowActive,
                  ]}
                >
                  <Text style={styles.bullet}>• {item}</Text>
                </Pressable>
              ))}
              {tasksCreated ? <Text style={styles.successText}>{tasksCreated}</Text> : null}
              <Button loading={taskLoading} variant="secondary" onPress={createRecommendationTasks}>
                Add selected to tasks
              </Button>
            </View>
          ) : null}

          <Button onPress={back} style={{ alignSelf: "stretch", marginTop: spacing.lg }}>
            Done
          </Button>
        </Card>
      </Screen>
    );
  }

  const currentQuestion = voice.session?.questions[voice.currentQuestionIndex];

  return (
    <Screen variant="stackBare" scroll={false}>
      <CheckinScreenHeader
        period={period}
        step="form"
        onBack={back}
        questionIndex={voice.currentQuestionIndex}
        questionTotal={voice.questions.length}
      />
      <ErrorBanner message={error} />

      <ScrollView
        contentContainerStyle={{ flexGrow: 1, paddingBottom: spacing.xl }}
        keyboardShouldPersistTaps="handled"
      >
        <View style={{ alignItems: "center", marginBottom: spacing.lg }}>
          <View
            style={{
              alignSelf: "center",
              backgroundColor: colors.primarySoft,
              borderRadius: 999,
              marginBottom: spacing.md,
              paddingHorizontal: spacing.md,
              paddingVertical: 6,
            }}
          >
            <Text style={{ color: colors.primary, fontSize: 12, fontWeight: "800" }}>
              Question {voice.currentQuestionIndex + 1} / {voice.questions.length}
            </Text>
          </View>
          <Text style={[uiStyles.h2, { marginTop: spacing.md, textAlign: "center", paddingHorizontal: spacing.md }]}>
            {currentQuestion?.text ?? "Loading question..."}
          </Text>
          <Text style={[uiStyles.muted, { fontSize: 12, marginTop: spacing.sm, textAlign: "center" }]}>
            {voiceTimingLabel()}
          </Text>
        </View>

        <View style={{ alignItems: "center", gap: spacing.lg }}>
          <Pressable
            disabled={voice.transcribing || voice.submitting || isQuestionPlaying}
            onPress={() => {
              if (voice.recording) void voice.stopRecording();
              else void voice.startRecording();
            }}
            style={({ pressed }) => [
              {
                alignItems: "center",
                backgroundColor: voice.recording ? colors.danger : colors.primary,
                borderRadius: 999,
                height: 112,
                justifyContent: "center",
                opacity: voice.transcribing || voice.submitting || isQuestionPlaying ? 0.6 : pressed ? 0.92 : 1,
                width: 112,
              },
            ]}
          >
            {voice.recording ? (
              <Square color={colors.onPrimary} size={32} />
            ) : (
              <Mic color={colors.onPrimary} size={32} />
            )}
          </Pressable>

          {voice.recording ? (
            <Button variant="secondary" onPress={() => void voice.stopRecording()} style={{ alignSelf: "stretch" }}>
              Stop early
            </Button>
          ) : null}

          <Text style={[uiStyles.muted, { fontSize: 14, textAlign: "center" }]}>{statusText}</Text>

          {(voice.transcribing || voice.submitting) && (
            <ActivityIndicator color={colors.primary} size="small" />
          )}

          {Object.keys(voice.transcriptions).length > 0 ? (
            <View style={{ alignSelf: "stretch", gap: spacing.sm, marginTop: spacing.sm }}>
              {voice.questions.map((q) => {
                const answer = voice.transcriptions[q.index]?.trim();
                if (!answer) return null;
                return (
                  <View
                    key={q.id}
                    style={{
                      backgroundColor: colors.surfaceLow,
                      borderColor: "rgba(194,198,211,0.3)",
                      borderRadius: 12,
                      borderWidth: 1,
                      padding: spacing.md,
                    }}
                  >
                    <Text style={{ color: colors.muted, fontSize: 11, fontWeight: "800", letterSpacing: 0.5 }}>
                      Q{q.index + 1}
                    </Text>
                    <Text style={{ color: colors.text, fontSize: 14, lineHeight: 20, marginTop: 4 }}>{answer}</Text>
                  </View>
                );
              })}
            </View>
          ) : null}

          {voice.submitting ? (
            <Text style={[uiStyles.muted, { textAlign: "center", marginTop: spacing.md }]}>
              Analyzing your answers...
            </Text>
          ) : null}
        </View>
      </ScrollView>
    </Screen>
  );
}
