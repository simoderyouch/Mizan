import { useCallback, useEffect, useMemo, useRef, useState } from "react";
import { Platform } from "react-native";
import {
  useAudioRecorder,
  useAudioRecorderState,
  AudioModule,
  RecordingPresets,
} from "expo-audio";
import { getApiErrorMessage, voiceApi } from "../../../lib/api";
import { waitForRecordingUri } from "../../../lib/native-upload";
import type { VoicePeriod, VoiceSessionResponse } from "../../../lib/types";
import { VOICE_TIMING } from "../voiceTiming";
import { createSilenceTracker } from "../voiceSilenceTracker";

const VOICE_RECORDING_OPTIONS = {
  ...RecordingPresets.HIGH_QUALITY,
  isMeteringEnabled: true,
};

export type UseVoiceSessionOptions = {
  /** Auto-stop when the user pauses speaking + max duration cap. */
  handsFree?: boolean;
};

/**
 * Manages a complete voice check-in session lifecycle:
 * start → record per question → transcribe → auto-submit when all answered.
 */
export function useVoiceSession(initialPeriod: VoicePeriod, options: UseVoiceSessionOptions = {}) {
  const handsFree = options.handsFree ?? true;
  const [period, setPeriod] = useState<VoicePeriod>(initialPeriod);
  const [session, setSession] = useState<VoiceSessionResponse | null>(null);
  const [currentQuestionIndex, setCurrentQuestionIndex] = useState(0);
  const [transcriptions, setTranscriptions] = useState<Record<number, string>>({});
  const [recording, setRecording] = useState(false);
  const [transcribing, setTranscribing] = useState(false);
  const [starting, setStarting] = useState(false);
  const [submitting, setSubmitting] = useState(false);
  const [error, setError] = useState("");
  const recorder = useAudioRecorder(VOICE_RECORDING_OPTIONS);
  const recorderState = useAudioRecorderState(recorder, VOICE_TIMING.meterPollMs);
  const autoSubmittedRef = useRef<string | null>(null);
  const maxRecordTimerRef = useRef<ReturnType<typeof setTimeout> | null>(null);
  const stopRecordingRef = useRef<() => Promise<void>>(async () => {});
  const silenceMonitorEnabledRef = useRef(false);

  const silenceTracker = useMemo(
    () => createSilenceTracker(() => void stopRecordingRef.current()),
    []
  );

  const clearMaxRecordTimer = useCallback(() => {
    if (maxRecordTimerRef.current) {
      clearTimeout(maxRecordTimerRef.current);
      maxRecordTimerRef.current = null;
    }
  }, []);

  const questions = session?.questions ?? [];
  const currentQuestion = questions[currentQuestionIndex];
  const answeredCount = questions.filter((q) => (transcriptions[q.index] ?? "").trim().length > 0).length;
  const allAnswered = questions.length > 0 && answeredCount === questions.length;

  useEffect(() => {
    setPeriod(initialPeriod);
  }, [initialPeriod]);

  useEffect(() => {
    if (!recording || !handsFree || !silenceMonitorEnabledRef.current) return;
    silenceTracker.push(recorderState.metering);
  }, [recording, handsFree, recorderState.metering, silenceTracker]);

  const startSession = useCallback(async () => {
    setStarting(true);
    setError("");
    autoSubmittedRef.current = null;
    if (recording) {
      recorder.stop();
      setRecording(false);
    }
    try {
      const res = await voiceApi.start(period);
      setSession(res);
      setCurrentQuestionIndex(0);
      setTranscriptions({});
      return res;
    } catch (err) {
      setSession(null);
      setError(getApiErrorMessage(err, "Could not start voice session."));
      return null;
    } finally {
      setStarting(false);
    }
  }, [period, recording, recorder]);

  const startRecording = useCallback(async () => {
    if (recording || !currentQuestion || submitting) return;
    setError("");
    try {
      const permission = await AudioModule.requestRecordingPermissionsAsync();
      if (!permission.granted) {
        setError("Please allow microphone access to record your answer.");
        return;
      }
      await recorder.prepareToRecordAsync();
      recorder.record({ forDuration: VOICE_TIMING.maxAnswerMs / 1000 });
      setRecording(true);
      silenceTracker.reset();
      silenceMonitorEnabledRef.current = handsFree;
      clearMaxRecordTimer();
      if (handsFree) {
        maxRecordTimerRef.current = setTimeout(() => {
          void stopRecordingRef.current();
        }, VOICE_TIMING.maxAnswerMs + 500);
      }
    } catch (err) {
      setError(getApiErrorMessage(err, "Could not start recording."));
    }
  }, [recording, currentQuestion, submitting, recorder, handsFree, clearMaxRecordTimer, silenceTracker]);

  const stopRecording = useCallback(async () => {
    if (!recording || !currentQuestion) return;
    clearMaxRecordTimer();
    silenceMonitorEnabledRef.current = false;
    const questionIndex = currentQuestion.index;
    setTranscribing(true);
    setError("");
    try {
      recorder.stop();
      setRecording(false);
      const uri = await waitForRecordingUri(() => recorder.uri);
      if (!uri) {
        setError("No audio captured. Try speaking closer to the microphone.");
        return;
      }
      const res = await voiceApi.transcribe({
        uri,
        name: `voice-question-${questionIndex + 1}.m4a`,
        type: Platform.OS === "android" ? "audio/mp4" : "audio/m4a",
      });
      const text = res.transcription?.trim() ?? "";
      if (!text) {
        setError("We didn't catch that. Speak a bit louder, then pause when you're done.");
        return;
      }
      setTranscriptions((prev) => ({ ...prev, [questionIndex]: text }));
      if (questionIndex < questions.length - 1) {
        setCurrentQuestionIndex(questionIndex + 1);
      }
    } catch (err) {
      setError(getApiErrorMessage(err, "Could not transcribe audio. You can type your answer below."));
    } finally {
      setTranscribing(false);
    }
  }, [recording, currentQuestion, recorder, questions.length, clearMaxRecordTimer]);

  stopRecordingRef.current = stopRecording;

  useEffect(() => () => clearMaxRecordTimer(), [clearMaxRecordTimer]);

  const setManualTranscription = useCallback(
    (text: string) => {
      if (!currentQuestion) return;
      const trimmed = text.trim();
      if (!trimmed) return;
      setTranscriptions((prev) => ({ ...prev, [currentQuestion.index]: trimmed }));
      if (currentQuestion.index < questions.length - 1) {
        setCurrentQuestionIndex(currentQuestion.index + 1);
      }
    },
    [currentQuestion, questions.length]
  );

  const submitSession = useCallback(async () => {
    if (!session || submitting) return null;
    const payload = questions
      .map((q) => ({
        question_index: q.index,
        question_id: q.id,
        transcription: (transcriptions[q.index] ?? "").trim(),
      }))
      .filter((item) => item.transcription.length > 0);
    if (payload.length !== questions.length) return null;
    setSubmitting(true);
    setError("");
    try {
      const res = await voiceApi.submit({
        session_id: session.session_id,
        period,
        transcriptions: payload,
      });
      return res;
    } catch (err) {
      autoSubmittedRef.current = null;
      setError(getApiErrorMessage(err, "Could not analyze your answers."));
      return null;
    } finally {
      setSubmitting(false);
    }
  }, [session, submitting, questions, transcriptions, period]);

  return {
    period,
    setPeriod,
    session,
    questions,
    currentQuestion,
    currentQuestionIndex,
    setCurrentQuestionIndex,
    transcriptions,
    setTranscriptions,
    recording,
    transcribing,
    starting,
    submitting,
    error,
    setError,
    answeredCount,
    allAnswered,
    autoSubmittedRef,
    handsFree,
    startSession,
    startRecording,
    stopRecording,
    setManualTranscription,
    submitSession,
  };
}
