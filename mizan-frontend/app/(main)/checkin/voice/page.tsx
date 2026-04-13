"use client";

import { useEffect, useRef, useState } from "react";
import { useRouter, useSearchParams } from "next/navigation";
import { getApiErrorMessage, tasksApi, voiceApi } from "@/lib/api";
import { Card, CardContent } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Badge } from "@/components/ui/badge";
import type { VoiceAnalysis, VoiceSessionResponse, VoiceTranscriptionPayload } from "@/lib/types";
import { Mic, MicOff, Loader2, ArrowLeft, Volume2, CheckCircle } from "lucide-react";
import Link from "next/link";

const parseVoiceVolume = (raw: string | undefined) => {
  const parsed = Number(raw);
  if (!Number.isFinite(parsed)) return 1;
  return Math.min(1, Math.max(0, parsed));
};
const parseVoiceBoost = (raw: string | undefined) => {
  const parsed = Number(raw);
  if (!Number.isFinite(parsed)) return 1.8;
  return Math.min(3, Math.max(1, parsed));
};
const AI_VOICE_VOLUME = parseVoiceVolume(
  process.env.NEXT_PUBLIC_AI_VOICE_VOLUME ?? process.env.NEXT_PUBLIC_AI_VOICE_GAIN
);
const AI_VOICE_BOOST = parseVoiceBoost(process.env.NEXT_PUBLIC_AI_VOICE_BOOST);

export default function VoiceCheckinPage() {
  const router = useRouter();
  const searchParams = useSearchParams();
  const requestedPeriod = searchParams.get("period");
  const period = requestedPeriod === "EVENING" ? "EVENING" : "MORNING";
  const backHref = searchParams.get("return") || (period === "EVENING" ? "/checkin/evening" : "/checkin/morning");
  const [step, setStep] = useState<"start" | "session" | "result">("start");
  const [session, setSession] = useState<VoiceSessionResponse | null>(null);
  const [currentQ, setCurrentQ] = useState(0);
  const [transcriptions, setTranscriptions] = useState<VoiceTranscriptionPayload[]>([]);
  const [isRecording, setIsRecording] = useState(false);
  const [analysis, setAnalysis] = useState<VoiceAnalysis | null>(null);
  const [starting, setStarting] = useState(false);
  const [processingAudio, setProcessingAudio] = useState(false);
  const [submitting, setSubmitting] = useState(false);
  const [creatingTasks, setCreatingTasks] = useState(false);
  const [taskSelection, setTaskSelection] = useState<Record<number, boolean>>({});
  const [error, setError] = useState("");

  const recorderRef = useRef<MediaRecorder | null>(null);
  const chunksRef = useRef<BlobPart[]>([]);
  const activeQuestionIndexRef = useRef<number>(0);
  const questionAudioRef = useRef<HTMLAudioElement | null>(null);
  const questionAudioContextRef = useRef<AudioContext | null>(null);
  const questionAudioSourceRef = useRef<MediaElementAudioSourceNode | null>(null);
  const questionAudioGainRef = useRef<GainNode | null>(null);
  const questionAudioCompressorRef = useRef<DynamicsCompressorNode | null>(null);
  const lastPlayedQuestionRef = useRef<number | null>(null);
  const autoSubmittedSessionRef = useRef<string | null>(null);
  const [isQuestionPlaying, setIsQuestionPlaying] = useState(false);

  const cleanupRecorder = () => {
    const stream = recorderRef.current?.stream;
    stream?.getTracks().forEach((track) => track.stop());
    recorderRef.current = null;
    chunksRef.current = [];
  };

  useEffect(() => {
    return () => {
      cleanupRecorder();
      if (questionAudioRef.current) {
        questionAudioRef.current.pause();
        questionAudioRef.current = null;
      }
      if (typeof window !== "undefined" && "speechSynthesis" in window) {
        window.speechSynthesis.cancel();
      }
      if (questionAudioContextRef.current) {
        void questionAudioContextRef.current.close();
        questionAudioContextRef.current = null;
      }
    };
  }, []);

  const stopQuestionPrompt = () => {
    if (questionAudioRef.current) {
      questionAudioRef.current.pause();
      questionAudioRef.current = null;
    }
    if (typeof window !== "undefined" && "speechSynthesis" in window) {
      window.speechSynthesis.cancel();
    }
    setIsQuestionPlaying(false);
  };

  const speakWithBrowser = async (text: string) => {
    if (typeof window === "undefined" || !("speechSynthesis" in window)) return;
    await new Promise<void>((resolve) => {
      const utterance = new SpeechSynthesisUtterance(text);
      utterance.lang = "en-US";
      utterance.rate = 1;
      utterance.volume = Math.min(1, AI_VOICE_VOLUME * AI_VOICE_BOOST);
      utterance.onend = () => resolve();
      utterance.onerror = () => resolve();
      window.speechSynthesis.cancel();
      window.speechSynthesis.speak(utterance);
    });
  };

  const configureQuestionPlaybackBoost = async (audioEl: HTMLAudioElement) => {
    audioEl.volume = AI_VOICE_VOLUME;
    if (AI_VOICE_BOOST <= 1 || typeof window === "undefined") return;
    const AudioCtx = window.AudioContext || (window as typeof window & { webkitAudioContext?: typeof AudioContext }).webkitAudioContext;
    if (!AudioCtx) return;

    if (!questionAudioContextRef.current) {
      questionAudioContextRef.current = new AudioCtx();
    }
    const ctx = questionAudioContextRef.current;
    if (ctx.state === "suspended") {
      await ctx.resume();
    }

    if (!questionAudioGainRef.current || !questionAudioCompressorRef.current) {
      const gainNode = ctx.createGain();
      const compressorNode = ctx.createDynamicsCompressor();
      compressorNode.threshold.value = -10;
      compressorNode.knee.value = 18;
      compressorNode.ratio.value = 4;
      compressorNode.attack.value = 0.003;
      compressorNode.release.value = 0.2;
      gainNode.connect(compressorNode);
      compressorNode.connect(ctx.destination);
      questionAudioGainRef.current = gainNode;
      questionAudioCompressorRef.current = compressorNode;
    }

    if (!questionAudioSourceRef.current || questionAudioSourceRef.current.mediaElement !== audioEl) {
      if (questionAudioSourceRef.current) {
        questionAudioSourceRef.current.disconnect();
      }
      questionAudioSourceRef.current = ctx.createMediaElementSource(audioEl);
    }

    questionAudioSourceRef.current.disconnect();
    questionAudioSourceRef.current.connect(questionAudioGainRef.current);
    questionAudioGainRef.current.gain.value = AI_VOICE_BOOST;
  };

  const playQuestionPrompt = async (questionIndex: number) => {
    if (!session) return;
    const question = session.questions[questionIndex];
    const questionText = question?.text;
    if (!questionText) return;
    stopQuestionPrompt();
    setIsQuestionPlaying(true);
    try {
      const audioBase64 = question?.audio_base64 || (questionIndex === 0 ? session.first_audio_base64 : "");
      if (audioBase64) {
        const audio = questionAudioRef.current ?? new Audio();
        audio.src = `data:audio/mp3;base64,${audioBase64}`;
        audio.preload = "auto";
        await configureQuestionPlaybackBoost(audio);
        audio.muted = false;
        questionAudioRef.current = audio;
        await audio.play();
      } else {
        await speakWithBrowser(questionText);
      }
    } catch {
      // silent fallback; question text is still visible
    } finally {
      setIsQuestionPlaying(false);
    }
  };

  useEffect(() => {
    if (step !== "session" || !session || isRecording) return;
    if (lastPlayedQuestionRef.current === currentQ) return;
    lastPlayedQuestionRef.current = currentQ;
    void playQuestionPrompt(currentQ);
  }, [step, session, currentQ, isRecording]);

  const startSession = async () => {
    setStarting(true);
    setError("");
    try {
      const res = await voiceApi.start(period);
      setSession(res);
      setCurrentQ(0);
      setTranscriptions([]);
      autoSubmittedSessionRef.current = null;
      setStep("session");
    } catch (err: unknown) {
      setError(getApiErrorMessage(err, "Unable to start the voice session."));
    } finally {
      setStarting(false);
    }
  };

  const transcribeRecording = async (audioBlob: Blob, questionIndex: number) => {
    setProcessingAudio(true);
    setError("");
    try {
      const audioType = audioBlob.type || "audio/webm";
      const audioFile = new File([audioBlob], `voice-question-${questionIndex + 1}.webm`, { type: audioType });
      const { transcription } = await voiceApi.transcribe(audioFile);

      setTranscriptions((prev) => {
        const withoutQuestion = prev.filter((entry) => entry.question_index !== questionIndex);
        const questionId = session?.questions[questionIndex]?.id;
        const next = [...withoutQuestion, { question_index: questionIndex, question_id: questionId, transcription }];
        return next.sort((a, b) => a.question_index - b.question_index);
      });

      if (session && questionIndex < session.questions.length - 1) {
        setCurrentQ(questionIndex + 1);
      }
    } catch (err: unknown) {
      setError(getApiErrorMessage(err, "Unable to transcribe audio."));
    } finally {
      setProcessingAudio(false);
    }
  };

  const startRecording = async () => {
    if (!session || processingAudio || submitting) return;
    stopQuestionPrompt();
    if (typeof window === "undefined" || !navigator.mediaDevices?.getUserMedia || !window.MediaRecorder) {
      setError("Audio recording is not supported on this device.");
      return;
    }

    setError("");
    try {
      const stream = await navigator.mediaDevices.getUserMedia({ audio: true });
      const recorder = new MediaRecorder(stream);
      recorderRef.current = recorder;
      chunksRef.current = [];
      activeQuestionIndexRef.current = currentQ;

      recorder.ondataavailable = (event) => {
        if (event.data.size > 0) {
          chunksRef.current.push(event.data);
        }
      };

      recorder.onerror = () => {
        setError("Error during audio recording.");
        setIsRecording(false);
        cleanupRecorder();
      };

      recorder.onstop = () => {
        const questionIndex = activeQuestionIndexRef.current;
        const blob = new Blob(chunksRef.current, { type: recorder.mimeType || "audio/webm" });
        cleanupRecorder();
        if (blob.size === 0) {
          setError("No sound detected. Try again closer to the microphone.");
          return;
        }
        void transcribeRecording(blob, questionIndex);
      };

      recorder.start();
      setIsRecording(true);
    } catch {
      setError("Microphone access denied. Please allow microphone access and try again.");
      cleanupRecorder();
    }
  };

  const stopRecording = () => {
    if (!recorderRef.current) return;
    recorderRef.current.stop();
    setIsRecording(false);
  };

  const toggleRecording = () => {
    if (isRecording) {
      stopRecording();
      return;
    }
    void startRecording();
  };

  const submitSession = async () => {
    if (!session || transcriptions.length !== session.questions.length || processingAudio) return;
    setSubmitting(true);
    setError("");
    try {
      const res = await voiceApi.submit({
        session_id: session.session_id,
        period,
        transcriptions,
      });
      setAnalysis(res);
      setTaskSelection({});
      setStep("result");
    } catch (err: unknown) {
      autoSubmittedSessionRef.current = null;
      setError(getApiErrorMessage(err, "Error while processing voice analysis."));
    } finally {
      setSubmitting(false);
    }
  };

  useEffect(() => {
    if (step !== "session" || !session || isRecording || processingAudio || submitting) return;
    if (session.questions.length === 0 || transcriptions.length !== session.questions.length) return;
    if (autoSubmittedSessionRef.current === session.session_id) return;
    autoSubmittedSessionRef.current = session.session_id;
    void submitSession();
  }, [step, session, isRecording, processingAudio, submitting, transcriptions]);

  const selectedRecommendationCount = (analysis?.recommendations ?? []).filter((_, idx) => taskSelection[idx] ?? true).length;

  const toggleTaskSelection = (idx: number) => {
    setTaskSelection((prev) => ({ ...prev, [idx]: !(prev[idx] ?? true) }));
  };

  const selectAllRecommendations = () => {
    const items = analysis?.recommendations ?? [];
    const next: Record<number, boolean> = {};
    items.forEach((_, idx) => {
      next[idx] = true;
    });
    setTaskSelection(next);
  };

  const clearRecommendationSelection = () => {
    const items = analysis?.recommendations ?? [];
    const next: Record<number, boolean> = {};
    items.forEach((_, idx) => {
      next[idx] = false;
    });
    setTaskSelection(next);
  };

  const createTasksFromRecommendations = async () => {
    if (period !== "MORNING" || !analysis?.recommendations?.length) return;
    const tasks = analysis.recommendations
      .map((recommendation, idx) => ({ recommendation, idx }))
      .filter(({ idx }) => taskSelection[idx] ?? true)
      .map(({ recommendation }) => ({
        title: recommendation.slice(0, 180),
        source: "morning_checkin" as const,
      }));
    if (!tasks.length) return;
    setCreatingTasks(true);
    setError("");
    try {
      await tasksApi.createMany({ tasks });
    } catch (err: unknown) {
      setError(getApiErrorMessage(err, "Could not create tasks from your voice check-in recommendations."));
    } finally {
      setCreatingTasks(false);
    }
  };

  return (
    <div className="page-enter max-w-2xl mx-auto px-1">
      <Link href={backHref} className="inline-flex items-center text-sm text-on-surface-variant hover:text-primary mb-6">
        <ArrowLeft className="h-4 w-4 mr-1" />
        Back
      </Link>

      {error && (
        <div className="bg-red-50 text-red-600 text-sm rounded-xl px-4 py-3 mb-4">{error}</div>
      )}

      {step === "start" && (
        <div className="text-center py-12 page-enter">
          <Badge className="mb-4">
            <Volume2 className="h-3 w-3 mr-1" />
            {period === "MORNING" ? "Morning voice check-in" : "Evening voice check-in"}
          </Badge>
          <h1 className="text-2xl sm:text-3xl font-bold text-primary mb-2">
            {period === "MORNING" ? "I’m listening for your morning check-in" : "I’m listening for your evening check-in"}
          </h1>
          <p className="text-on-surface-variant mb-8">
            {period === "MORNING"
              ? "Answer personalized questions about your sleep and current state."
              : "Answer personalized questions about your day and evening state."}
          </p>

          <button
            onClick={() => void startSession()}
            disabled={starting}
            className="mx-auto w-28 h-28 sm:w-40 sm:h-40 rounded-full bg-gradient-to-br from-secondary/80 to-primary flex items-center justify-center shadow-sanctuary-lg hover:scale-105 transition-transform disabled:opacity-70"
          >
            {starting ? (
              <Loader2 className="h-10 w-10 text-white animate-spin" />
            ) : (
              <Mic className="h-10 w-10 text-white" />
            )}
          </button>

          <p className="text-sm text-on-surface-variant mt-6">Tap to start</p>
        </div>
      )}

      {step === "session" && session && (
        <div className="page-enter">
          <div className="text-center mb-8">
            <Badge className="mb-3">Question {currentQ + 1} / {session.questions.length}</Badge>
            <h2 className="text-xl font-bold">{session.questions[currentQ]?.text}</h2>
          </div>

          <div className="flex flex-col items-center gap-6">
            <button
              onClick={toggleRecording}
              disabled={processingAudio || submitting}
              className={`w-24 h-24 sm:w-32 sm:h-32 rounded-full flex items-center justify-center transition-all disabled:opacity-70 ${
                isRecording
                  ? "bg-red-500 animate-pulse-soft shadow-sanctuary-lg"
                  : "bg-gradient-to-br from-secondary/80 to-primary shadow-sanctuary hover:scale-105"
              }`}
            >
              {isRecording ? (
                <MicOff className="h-8 w-8 text-white" />
              ) : (
                <Mic className="h-8 w-8 text-white" />
                )}
              </button>
            <Button onClick={toggleRecording} disabled={processingAudio || submitting} className="w-full">
              {isRecording ? "Stop my answer" : "Answer this question"}
            </Button>

            <p className="text-sm text-on-surface-variant">
              {isRecording
                ? "Speak... tap to stop."
                : processingAudio
                  ? "Transcription in progress..."
                  : isQuestionPlaying
                    ? "Listen to the question..."
                  : "Tap to record"}
            </p>

            {processingAudio && <Loader2 className="h-5 w-5 animate-spin text-primary" />}

            {transcriptions.length > 0 && (
              <div className="w-full space-y-2 mt-4">
                {transcriptions.map((transcription) => (
                  <div key={transcription.question_index} className="sanctuary-card-subtle !p-3 text-sm">
                    <span className="label-sanctuary">Q{transcription.question_index + 1}</span>
                    <p className="mt-1">{transcription.transcription}</p>
                  </div>
                ))}
              </div>
            )}

            <Button
              onClick={() => void submitSession()}
              disabled={submitting || processingAudio || transcriptions.length !== session.questions.length}
              className="w-full mt-4"
            >
              {submitting ? <Loader2 className="h-4 w-4 animate-spin" /> : "Analyze my answers"}
            </Button>
          </div>
        </div>
      )}

      {step === "result" && analysis && (
        <Card className="page-enter">
          <CardContent className="text-center">
            <CheckCircle className="h-12 w-12 text-emerald-500 mx-auto mb-4" />
            <h2 className="text-xl font-bold mb-4">Analysis complete</h2>

            <div className="sanctuary-card-subtle text-left mb-6">
              <p className="text-sm leading-relaxed whitespace-pre-wrap">{analysis.analysis}</p>
            </div>

            {analysis.recommendations.length > 0 && (
              <div className="text-left mb-6">
                <div className="flex flex-col sm:flex-row sm:items-center sm:justify-between gap-2 mb-2">
                  <h3 className="font-bold">{period === "MORNING" ? "Task proposals" : "Recommendations"}</h3>
                  {period === "MORNING" && (
                    <Badge variant="secondary">{selectedRecommendationCount}/{analysis.recommendations.length} selected</Badge>
                  )}
                </div>
                {period === "MORNING" && (
                  <div className="flex items-center gap-2 mb-3">
                    <Button variant="secondary" size="sm" onClick={selectAllRecommendations}>
                      Select all
                    </Button>
                    <Button variant="secondary" size="sm" onClick={clearRecommendationSelection}>
                      Clear all
                    </Button>
                  </div>
                )}
                <ul className="space-y-2">
                  {analysis.recommendations.map((recommendation, index) => (
                    <li
                      key={index}
                      className={`sanctuary-card-subtle !p-3 text-sm flex items-start gap-2 ${period === "MORNING" ? "cursor-pointer" : ""}`}
                      onClick={period === "MORNING" ? () => toggleTaskSelection(index) : undefined}
                    >
                      {period === "MORNING" ? (
                        <input
                          type="checkbox"
                          checked={taskSelection[index] ?? true}
                          onChange={() => toggleTaskSelection(index)}
                          className="mt-1 h-4 w-4 accent-primary"
                          onClick={(e) => e.stopPropagation()}
                        />
                      ) : (
                        <span className="text-primary">•</span>
                      )}
                      <span>{recommendation}</span>
                    </li>
                  ))}
                </ul>
                {period === "MORNING" && (
                  <div className="pt-4">
                    <Button
                      onClick={() => void createTasksFromRecommendations()}
                      disabled={creatingTasks || selectedRecommendationCount === 0}
                      className="w-full"
                    >
                      {creatingTasks ? <Loader2 className="h-4 w-4 animate-spin mr-2" /> : null}
                      Confirm and create tasks
                    </Button>
                  </div>
                )}
              </div>
            )}

            <Button onClick={() => router.push("/dashboard")} className="w-full">
              Back to home
            </Button>
          </CardContent>
        </Card>
      )}
    </div>
  );
}
