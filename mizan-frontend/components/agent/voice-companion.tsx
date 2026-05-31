"use client";

import React, { useState, useRef, useEffect } from "react";
import { Mic, Square, Loader2, Volume2, Send } from "lucide-react";
import { Button } from "@/components/ui/button";
import { ChatTaskSuggestions } from "@/components/agent/chat/chat-task-suggestions";
import { useToast } from "@/components/ui/use-toast";
import { authApi, getApiErrorMessage, resolveDirectBackendOrigin, tasksApi, voiceApi } from "@/lib/api";
import { AgentChatMessage, ChatTaskSuggestion } from "@/lib/types";
import { cn } from "@/lib/utils";
import { RichTextMessage } from "@/components/agent/rich-text-message";

const AUTO_SEND_SILENCE_MS = 2300;
const AUTO_SEND_MIN_CHARS = 24;
const REALTIME_CONNECT_TIMEOUT_MS = 12000;
const REALTIME_PING_INTERVAL_MS = 15000;
const REALTIME_RECONNECT_DELAY_MS = 900;
const REALTIME_TIMEOUT_MARKERS = ["timeout waiting for response from streaming transcription", "code=3804"];
const OPENING_QUESTION_PROMPT =
  "Start this voice chat by asking me one short, friendly question in English about my current study situation.";
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

export function VoiceCompanion() {
  const { toast } = useToast();
  const [sessionActive, setSessionActive] = useState(false);
  const [preferredCaptureMode, setPreferredCaptureMode] = useState<"realtime" | "record">("record");
  const [captureMode, setCaptureMode] = useState<"realtime" | "record">("realtime");
  const [isRecording, setIsRecording] = useState(false);
  const [isProcessing, setIsProcessing] = useState(false);
  const [isPlaying, setIsPlaying] = useState(false);
  const [, setHistory] = useState<AgentChatMessage[]>([]);
  const [lastMessage, setLastMessage] = useState("");
  const [draftTranscript, setDraftTranscript] = useState("");
  const [taskSuggestions, setTaskSuggestions] = useState<ChatTaskSuggestion[]>([]);
  const [selectedSuggestions, setSelectedSuggestions] = useState<Record<number, boolean>>({});
  const [creatingTasks, setCreatingTasks] = useState(false);
  const [taskPreviewCollapsed, setTaskPreviewCollapsed] = useState(false);
  const [taskPreviewHidden, setTaskPreviewHidden] = useState(false);

  const realtimeSocketRef = useRef<WebSocket | null>(null);
  const realtimeStreamRef = useRef<MediaStream | null>(null);
  const audioContextRef = useRef<AudioContext | null>(null);
  const sourceNodeRef = useRef<MediaStreamAudioSourceNode | null>(null);
  const processorNodeRef = useRef<ScriptProcessorNode | null>(null);

  const shouldListenRef = useRef(false);
  const draftTranscriptRef = useRef("");
  const historyRef = useRef<AgentChatMessage[]>([]);
  const audioPlayer = useRef<HTMLAudioElement | null>(null);
  const isProcessingRef = useRef(false);
  const isPlayingRef = useRef(false);
  const sessionActiveRef = useRef(false);
  const captureModeRef = useRef<"realtime" | "record">("realtime");
  const mediaRecorderRef = useRef<MediaRecorder | null>(null);
  const mediaChunksRef = useRef<Blob[]>([]);
  const sendOnRecorderStopRef = useRef(false);
  const realtimeFallbackShownRef = useRef(false);
  const autoSendTimeoutRef = useRef<number | null>(null);
  const realtimePingIntervalRef = useRef<number | null>(null);
  const realtimeReconnectAttemptsRef = useRef(0);
  const reconnectTimerRef = useRef<number | null>(null);
  const autoRecoverTimerRef = useRef<number | null>(null);
  const manualSocketCloseRef = useRef(false);
  const playbackAudioContextRef = useRef<AudioContext | null>(null);
  const playbackSourceRef = useRef<MediaElementAudioSourceNode | null>(null);
  const playbackGainRef = useRef<GainNode | null>(null);
  const playbackCompressorRef = useRef<DynamicsCompressorNode | null>(null);

  useEffect(() => {
    return () => {
      shouldListenRef.current = false;
      void stopRealtimeCapture();
      disconnectRealtimeSocket();
      if (mediaRecorderRef.current) {
        mediaRecorderRef.current.stream.getTracks().forEach((track) => track.stop());
        mediaRecorderRef.current = null;
      }
      if (audioPlayer.current) {
        audioPlayer.current.pause();
        audioPlayer.current = null;
      }
      if (autoSendTimeoutRef.current !== null) {
        window.clearTimeout(autoSendTimeoutRef.current);
        autoSendTimeoutRef.current = null;
      }
      if (realtimePingIntervalRef.current !== null) {
        window.clearInterval(realtimePingIntervalRef.current);
        realtimePingIntervalRef.current = null;
      }
      if (reconnectTimerRef.current !== null) {
        window.clearTimeout(reconnectTimerRef.current);
        reconnectTimerRef.current = null;
      }
      if (autoRecoverTimerRef.current !== null) {
        window.clearTimeout(autoRecoverTimerRef.current);
        autoRecoverTimerRef.current = null;
      }
      if (playbackAudioContextRef.current) {
        void playbackAudioContextRef.current.close();
        playbackAudioContextRef.current = null;
      }
    };
  }, []);

  useEffect(() => {
    isProcessingRef.current = isProcessing;
  }, [isProcessing]);

  useEffect(() => {
    isPlayingRef.current = isPlaying;
  }, [isPlaying]);

  useEffect(() => {
    sessionActiveRef.current = sessionActive;
  }, [sessionActive]);

  useEffect(() => {
    captureModeRef.current = captureMode;
  }, [captureMode]);

  const clearAutoSendTimer = () => {
    if (autoSendTimeoutRef.current !== null) {
      window.clearTimeout(autoSendTimeoutRef.current);
      autoSendTimeoutRef.current = null;
    }
  };

  const resetTranscriptBuffers = () => {
    draftTranscriptRef.current = "";
    setDraftTranscript("");
    clearAutoSendTimer();
  };

  const clearRealtimePing = () => {
    if (realtimePingIntervalRef.current !== null) {
      window.clearInterval(realtimePingIntervalRef.current);
      realtimePingIntervalRef.current = null;
    }
  };

  const clearReconnectTimer = () => {
    if (reconnectTimerRef.current !== null) {
      window.clearTimeout(reconnectTimerRef.current);
      reconnectTimerRef.current = null;
    }
  };

  const clearAutoRecoverTimer = () => {
    if (autoRecoverTimerRef.current !== null) {
      window.clearTimeout(autoRecoverTimerRef.current);
      autoRecoverTimerRef.current = null;
    }
  };

  const toRealtimeWsUrl = () => {
    if (typeof window === "undefined") return "";
    const token = window.localStorage.getItem("mizan_access_token");
    if (!token) return "";
    const wsBase = resolveDirectBackendOrigin().replace(/^http:\/\//i, "ws://").replace(/^https:\/\//i, "wss://");
    return `${wsBase}/api/v1/voice/realtime?token=${encodeURIComponent(token)}`;
  };

  const configurePlaybackBoost = async (audioEl: HTMLAudioElement) => {
    audioEl.volume = AI_VOICE_VOLUME;
    if (AI_VOICE_BOOST <= 1 || typeof window === "undefined") return;
    const AudioCtx = window.AudioContext || (window as typeof window & { webkitAudioContext?: typeof AudioContext }).webkitAudioContext;
    if (!AudioCtx) return;

    if (!playbackAudioContextRef.current) {
      playbackAudioContextRef.current = new AudioCtx();
    }
    const ctx = playbackAudioContextRef.current;
    if (ctx.state === "suspended") {
      await ctx.resume();
    }

    if (!playbackGainRef.current || !playbackCompressorRef.current) {
      const gainNode = ctx.createGain();
      const compressorNode = ctx.createDynamicsCompressor();
      compressorNode.threshold.value = -10;
      compressorNode.knee.value = 18;
      compressorNode.ratio.value = 4;
      compressorNode.attack.value = 0.003;
      compressorNode.release.value = 0.2;
      gainNode.connect(compressorNode);
      compressorNode.connect(ctx.destination);
      playbackGainRef.current = gainNode;
      playbackCompressorRef.current = compressorNode;
    }

    if (!playbackSourceRef.current || playbackSourceRef.current.mediaElement !== audioEl) {
      if (playbackSourceRef.current) {
        playbackSourceRef.current.disconnect();
      }
      playbackSourceRef.current = ctx.createMediaElementSource(audioEl);
    }

    playbackSourceRef.current.disconnect();
    playbackSourceRef.current.connect(playbackGainRef.current);
    playbackGainRef.current.gain.value = AI_VOICE_BOOST;
  };

  const appendRealtimeText = (text: string) => {
    const cleaned = text.trim();
    if (!cleaned) return;
    const next = `${draftTranscriptRef.current} ${cleaned}`.trim();
    draftTranscriptRef.current = next;
    setDraftTranscript(next);
  };

  const flushRealtimeTranscript = async () => {
    const outgoing = draftTranscriptRef.current.trim();
    if (!outgoing || isProcessingRef.current) return;
    resetTranscriptBuffers();
    await processUtterance(outgoing);
  };

  const scheduleRealtimeAutoSend = () => {
    if (!shouldListenRef.current || captureModeRef.current !== "realtime") return;
    clearAutoSendTimer();
    autoSendTimeoutRef.current = window.setTimeout(() => {
      autoSendTimeoutRef.current = null;
      if (!shouldListenRef.current || captureModeRef.current !== "realtime" || isProcessingRef.current) return;
      if (draftTranscriptRef.current.trim().length < AUTO_SEND_MIN_CHARS) return;
      void flushRealtimeTranscript();
    }, AUTO_SEND_SILENCE_MS);
  };

  const downsampleFloatToPcm16 = (input: Float32Array, inputSampleRate: number): Int16Array => {
    if (inputSampleRate <= 16000) {
      const output = new Int16Array(input.length);
      for (let i = 0; i < input.length; i += 1) {
        const s = Math.max(-1, Math.min(1, input[i]));
        output[i] = s < 0 ? s * 0x8000 : s * 0x7fff;
      }
      return output;
    }
    const ratio = inputSampleRate / 16000;
    const outputLength = Math.max(1, Math.round(input.length / ratio));
    const output = new Int16Array(outputLength);
    let inputOffset = 0;
    for (let i = 0; i < outputLength; i += 1) {
      const nextOffset = Math.round((i + 1) * ratio);
      let sum = 0;
      let count = 0;
      for (let j = inputOffset; j < nextOffset && j < input.length; j += 1) {
        sum += input[j];
        count += 1;
      }
      const averaged = count > 0 ? sum / count : 0;
      const sample = Math.max(-1, Math.min(1, averaged));
      output[i] = sample < 0 ? sample * 0x8000 : sample * 0x7fff;
      inputOffset = nextOffset;
    }
    return output;
  };

  const stopRealtimeCapture = async () => {
    setIsRecording(false);
    if (processorNodeRef.current) {
      processorNodeRef.current.onaudioprocess = null;
      processorNodeRef.current.disconnect();
      processorNodeRef.current = null;
    }
    if (sourceNodeRef.current) {
      sourceNodeRef.current.disconnect();
      sourceNodeRef.current = null;
    }
    if (realtimeStreamRef.current) {
      realtimeStreamRef.current.getTracks().forEach((track) => track.stop());
      realtimeStreamRef.current = null;
    }
    if (audioContextRef.current) {
      const ctx = audioContextRef.current;
      audioContextRef.current = null;
      await ctx.close();
    }
  };

  const disconnectRealtimeSocket = () => {
    const socket = realtimeSocketRef.current;
    realtimeSocketRef.current = null;
    clearRealtimePing();
    if (!socket) return;
    try {
      manualSocketCloseRef.current = true;
      if (socket.readyState === WebSocket.OPEN) {
        socket.send(JSON.stringify({ type: "stop" }));
      }
      socket.close();
    } catch {
      // noop
      manualSocketCloseRef.current = false;
    }
  };

  const switchToRecordMode = async () => {
    clearAutoSendTimer();
    clearReconnectTimer();
    await stopRealtimeCapture();
    disconnectRealtimeSocket();
    setPreferredCaptureMode("record");
    captureModeRef.current = "record";
    setCaptureMode("record");
    if (!realtimeFallbackShownRef.current) {
      realtimeFallbackShownRef.current = true;
      toast({
        title: "Realtime unavailable",
        description: "Switched to mic capture mode.",
      });
    }
  };

  const isRealtimeTimeoutError = (message: string) => {
    const lowered = message.toLowerCase();
    return REALTIME_TIMEOUT_MARKERS.some((marker) => lowered.includes(marker));
  };

  const resumeRealtimeListening = async () => {
    if (!sessionActiveRef.current || !shouldListenRef.current || captureModeRef.current !== "realtime") return;
    if (isProcessingRef.current || isPlayingRef.current) return;
    disconnectRealtimeSocket();
    const connected = await connectRealtimeSocket();
    if (!connected) {
      await switchToRecordMode();
      return;
    }
    await startRealtimeCapture();
  };

  useEffect(() => {
    if (!sessionActive || captureMode !== "realtime" || isRecording || isProcessing || isPlaying) {
      clearAutoRecoverTimer();
      return;
    }
    clearAutoRecoverTimer();
    autoRecoverTimerRef.current = window.setTimeout(() => {
      autoRecoverTimerRef.current = null;
      void resumeRealtimeListening();
    }, 350);
    return () => {
      clearAutoRecoverTimer();
    };
  }, [sessionActive, captureMode, isRecording, isProcessing, isPlaying]);

  const connectRealtimeSocket = async (): Promise<boolean> => {
    // Ensure access token is fresh before opening WS (WS does not use axios refresh interceptor).
    try {
      await authApi.me();
    } catch {
      // Keep going; if auth is invalid, WS handshake will fail and fallback will apply.
    }
    const wsUrl = toRealtimeWsUrl();
    if (!wsUrl) return false;
    const socket = new WebSocket(wsUrl);
    socket.binaryType = "arraybuffer";
    realtimeSocketRef.current = socket;

    return await new Promise<boolean>((resolve) => {
      let settled = false;
      const finalize = (ok: boolean) => {
        if (settled) return;
        settled = true;
        resolve(ok);
      };
      const timeout = window.setTimeout(() => finalize(false), REALTIME_CONNECT_TIMEOUT_MS);
      socket.onopen = () => {
        window.clearTimeout(timeout);
        realtimeReconnectAttemptsRef.current = 0;
        clearRealtimePing();
        realtimePingIntervalRef.current = window.setInterval(() => {
          if (socket.readyState === WebSocket.OPEN) {
            socket.send(JSON.stringify({ type: "ping" }));
          }
        }, REALTIME_PING_INTERVAL_MS);
        finalize(true);
      };
      socket.onerror = () => {
        window.clearTimeout(timeout);
        finalize(false);
      };
      socket.onclose = () => {
        window.clearTimeout(timeout);
        if (manualSocketCloseRef.current) {
          manualSocketCloseRef.current = false;
          return;
        }
        if (!settled) {
          finalize(false);
          return;
        }
        if (!shouldListenRef.current || captureModeRef.current !== "realtime") return;
        clearRealtimePing();
        if (realtimeReconnectAttemptsRef.current >= 2) {
          void switchToRecordMode();
          return;
        }
        realtimeReconnectAttemptsRef.current += 1;
        clearReconnectTimer();
        reconnectTimerRef.current = window.setTimeout(() => {
          reconnectTimerRef.current = null;
          if (!shouldListenRef.current || captureModeRef.current !== "realtime") return;
          void (async () => {
            const reconnected = await connectRealtimeSocket();
            if (!reconnected) {
              await switchToRecordMode();
              return;
            }
            try {
              await startRealtimeCapture();
            } catch {
              await switchToRecordMode();
            }
          })();
        }, REALTIME_RECONNECT_DELAY_MS);
      };
      socket.onmessage = (event) => {
        try {
          const payload = JSON.parse(String(event.data));
          const type = String(payload?.type || "");
          if (type === "transcript_delta") {
            appendRealtimeText(String(payload?.text || ""));
            return;
          }
          if (type === "transcript_done") {
            appendRealtimeText(String(payload?.text || ""));
            scheduleRealtimeAutoSend();
            return;
          }
          if (type === "error") {
            const message = String(payload?.message || "Realtime transcription failed.");
            if (isRealtimeTimeoutError(message)) {
              return;
            }
            toast({ title: "Realtime error", description: message, variant: "destructive" });
            if (shouldListenRef.current && captureModeRef.current === "realtime") {
              void switchToRecordMode();
            }
            return;
          }
          if (type === "pong") return;
        } catch {
          // ignore non-json ws payloads
        }
      };
    });
  };

  const startRealtimeCapture = async () => {
    const socket = realtimeSocketRef.current;
    if (!socket || socket.readyState !== WebSocket.OPEN) {
      throw new Error("Realtime socket is not open.");
    }
    const stream = await navigator.mediaDevices.getUserMedia({ audio: true });
    const AudioCtx = window.AudioContext || (window as typeof window & { webkitAudioContext?: typeof AudioContext }).webkitAudioContext;
    if (!AudioCtx) {
      stream.getTracks().forEach((track) => track.stop());
      throw new Error("Web Audio API is not supported in this browser.");
    }
    const context = new AudioCtx();
    const source = context.createMediaStreamSource(stream);
    const processor = context.createScriptProcessor(4096, 1, 1);

    processor.onaudioprocess = (event) => {
      const liveSocket = realtimeSocketRef.current;
      if (!liveSocket || liveSocket.readyState !== WebSocket.OPEN) return;
      if (!shouldListenRef.current || captureModeRef.current !== "realtime") return;
      if (isProcessingRef.current || isPlayingRef.current) return;
      const channel = event.inputBuffer.getChannelData(0);
      const pcm16 = downsampleFloatToPcm16(channel, context.sampleRate);
      if (pcm16.length > 0) {
        liveSocket.send(pcm16.buffer);
      }
    };

    source.connect(processor);
    processor.connect(context.destination);

    realtimeStreamRef.current = stream;
    audioContextRef.current = context;
    sourceNodeRef.current = source;
    processorNodeRef.current = processor;
    setIsRecording(true);
  };

  const processUtterance = async (utterance: string) => {
    const userText = utterance.trim();
    if (!userText || isProcessingRef.current) return;
    clearAutoSendTimer();
    setIsProcessing(true);
    if (captureModeRef.current === "realtime") {
      await stopRealtimeCapture();
    }

    try {
      const previousHistory = [...historyRef.current];
      const userMessage: AgentChatMessage = { role: "user", content: userText };
      historyRef.current = [...previousHistory, userMessage];
      setHistory(historyRef.current);

      const chatRes = await voiceApi.chat({
        user_text: userText,
        history: previousHistory,
      });

      const assistantMessage: AgentChatMessage = { role: "assistant", content: chatRes.agent_text };
      historyRef.current = [...historyRef.current, assistantMessage];
      setHistory(historyRef.current);
      setLastMessage(chatRes.agent_text);
      if (chatRes.agent_action?.took_action && chatRes.agent_action.message) {
        toast({
          title: "Mizan took action",
          description: chatRes.agent_action.message,
          variant: "success",
        });
        window.dispatchEvent(new CustomEvent("mizan:notifications:refresh"));
      }
      try {
        const suggestionRes = await tasksApi.suggestFromChat({
          user_message: userText,
          assistant_message: chatRes.agent_text,
        });
        setTaskSuggestions(suggestionRes.suggestions);
        setSelectedSuggestions({});
        setTaskPreviewCollapsed(false);
        setTaskPreviewHidden(false);
      } catch {
        setTaskSuggestions([]);
      }

      if (chatRes.agent_audio_base64) {
        const audioSrc = `data:audio/mp3;base64,${chatRes.agent_audio_base64}`;
        if (!audioPlayer.current) {
          audioPlayer.current = new Audio();
          audioPlayer.current.preload = "auto";
          audioPlayer.current.volume = AI_VOICE_VOLUME;
          audioPlayer.current.muted = false;
          audioPlayer.current.onended = () => {
            setIsPlaying(false);
            void resumeRealtimeListening();
          };
        }
        await configurePlaybackBoost(audioPlayer.current);
        audioPlayer.current.muted = false;
        audioPlayer.current.src = audioSrc;
        setIsPlaying(true);
        await audioPlayer.current.play();
      }
    } catch (err) {
      console.error("Voice interaction error:", err);
      toast({
        title: "Error",
        description: getApiErrorMessage(err, "Voice interaction failed."),
        variant: "destructive",
      });
    } finally {
      setIsProcessing(false);
      if (!isPlayingRef.current && sessionActiveRef.current && shouldListenRef.current && captureModeRef.current === "realtime") {
        try {
          await resumeRealtimeListening();
        } catch {
          await switchToRecordMode();
        }
      }
    }
  };

  const startRecorderCapture = async () => {
    try {
      const stream = await navigator.mediaDevices.getUserMedia({ audio: true });
      const recorder = new MediaRecorder(stream);
      mediaRecorderRef.current = recorder;
      mediaChunksRef.current = [];
      recorder.ondataavailable = (event) => {
        if (event.data.size > 0) {
          mediaChunksRef.current.push(event.data);
        }
      };
      recorder.onstop = async () => {
        stream.getTracks().forEach((track) => track.stop());
        const shouldSend = sendOnRecorderStopRef.current;
        sendOnRecorderStopRef.current = false;
        setIsRecording(false);

        if (!shouldSend) return;
        const mimeType = recorder.mimeType || mediaChunksRef.current[0]?.type || "audio/webm";
        const extension = mimeType.includes("ogg") ? "ogg" : mimeType.includes("mp4") ? "m4a" : "webm";
        const audioBlob = new Blob(mediaChunksRef.current, { type: mimeType });
        mediaChunksRef.current = [];
        if (audioBlob.size < 2048) {
          toast({
            title: "Recording too short",
            description: "Please speak a bit longer, then press Send.",
          });
          return;
        }
        try {
          const file = new File([audioBlob], `voice.${extension}`, { type: mimeType });
          const transcribeRes = await voiceApi.transcribe(file);
          await processUtterance(transcribeRes.transcription);
        } catch (err) {
          console.error("Transcription error:", err);
          toast({
            title: "Error",
            description: getApiErrorMessage(err, "Could not transcribe your recording."),
            variant: "destructive",
          });
        }
      };
      recorder.start();
      setIsRecording(true);
    } catch (err) {
      console.error(err);
      toast({
        title: "Error",
        description: "Microphone access is unavailable.",
        variant: "destructive",
      });
    }
  };

  const startConversation = async () => {
    try {
      realtimeFallbackShownRef.current = false;
      realtimeReconnectAttemptsRef.current = 0;
      captureModeRef.current = preferredCaptureMode;
      setCaptureMode(preferredCaptureMode);
      if (audioPlayer.current) {
        audioPlayer.current.pause();
        setIsPlaying(false);
      }
      shouldListenRef.current = true;
      setSessionActive(true);
      resetTranscriptBuffers();

      if (preferredCaptureMode === "realtime") {
        const connected = await connectRealtimeSocket();
        if (!connected) {
          await switchToRecordMode();
          await startRecorderCapture();
          return;
        }
      }
      await processUtterance(OPENING_QUESTION_PROMPT);
    } catch (err) {
      console.error(err);
      await switchToRecordMode();
      await startRecorderCapture();
    }
  };

  const sendCurrentTranscript = async () => {
    if (captureMode === "record") {
      if (!mediaRecorderRef.current || isProcessingRef.current) return;
      sendOnRecorderStopRef.current = true;
      mediaRecorderRef.current.stop();
      mediaRecorderRef.current = null;
      return;
    }
    await flushRealtimeTranscript();
  };

  const stopConversation = async () => {
    shouldListenRef.current = false;
      realtimeReconnectAttemptsRef.current = 0;
      setSessionActive(false);
      captureModeRef.current = preferredCaptureMode;
      setCaptureMode(preferredCaptureMode);
      clearAutoSendTimer();
      clearReconnectTimer();
      clearAutoRecoverTimer();
      await stopRealtimeCapture();
      disconnectRealtimeSocket();
    if (mediaRecorderRef.current) {
      sendOnRecorderStopRef.current = false;
      mediaRecorderRef.current.stop();
      mediaRecorderRef.current = null;
    }
    if (audioPlayer.current) {
      audioPlayer.current.pause();
      setIsPlaying(false);
    }
    resetTranscriptBuffers();
    setIsRecording(false);
  };

  const switchCaptureMode = async (mode: "realtime" | "record") => {
    setPreferredCaptureMode(mode);
    captureModeRef.current = mode;
    if (!sessionActiveRef.current) {
      setCaptureMode(mode);
      return;
    }

    if (mode === "record") {
      await stopRealtimeCapture();
      disconnectRealtimeSocket();
      setCaptureMode("record");
      setIsRecording(false);
      return;
    }

    setCaptureMode("realtime");
    try {
      await resumeRealtimeListening();
    } catch {
      await switchToRecordMode();
    }
  };

  const createTasksFromSuggestions = async () => {
    const tasks = taskSuggestions
      .map((item, idx) => ({ item, idx }))
      .filter(({ idx }) => selectedSuggestions[idx] ?? true)
      .map(({ item }) => ({
        title: item.title,
        description: item.description ?? undefined,
        source: "voice_chat" as const,
      }));
    if (!tasks.length) return;
    setCreatingTasks(true);
    try {
      await tasksApi.createMany({ tasks });
      setTaskSuggestions([]);
      setSelectedSuggestions({});
    } catch (err) {
      toast({
        title: "Task creation error",
        description: getApiErrorMessage(err, "Could not create tasks from this answer."),
        variant: "destructive",
      });
    } finally {
      setCreatingTasks(false);
    }
  };

  const selectAllSuggestions = () => {
    const next: Record<number, boolean> = {};
    taskSuggestions.forEach((_, idx) => {
      next[idx] = true;
    });
    setSelectedSuggestions(next);
  };

  const clearSuggestionsSelection = () => {
    const next: Record<number, boolean> = {};
    taskSuggestions.forEach((_, idx) => {
      next[idx] = false;
    });
    setSelectedSuggestions(next);
  };

  const statusLabel = (() => {
    if (sessionActive && isRecording) {
      return captureMode === "realtime" ? "Listening…" : "Recording…";
    }
    if (isProcessing) return "Thinking…";
    if (isPlaying) return "Speaking…";
    if (sessionActive && captureMode === "realtime") return "Connecting…";
    if (sessionActive) return "Ready — tap record when you want to answer";
    return "Press Start to begin";
  })();

  const statusTone =
    sessionActive && isRecording
      ? "text-red-600"
      : isProcessing || isPlaying
        ? "text-primary"
        : "text-on-surface-variant";

  return (
    <div className="flex flex-col w-full min-h-0 flex-1">
      <div className="flex-1 flex flex-col items-center gap-5 py-2 sm:py-4 min-h-0">
        <div className="relative flex items-center justify-center h-36 w-36 sm:h-40 sm:w-40 shrink-0">
          <div
            className={cn(
              "absolute inset-2 rounded-full transition-all duration-500",
              isRecording && "bg-red-400/20 animate-pulse",
              isPlaying && "bg-primary/25 animate-pulse-soft",
              isProcessing && "bg-primary/15",
              !isRecording && !isPlaying && !isProcessing && "bg-primary/10"
            )}
          />
          <div
            className={cn(
              "relative flex h-28 w-28 sm:h-32 sm:w-32 items-center justify-center rounded-full border-2 transition-all",
              isRecording
                ? "border-red-300/80 bg-red-50 text-red-600"
                : "border-primary/20 bg-surface-container-lowest text-primary"
            )}
          >
            {isProcessing ? (
              <Loader2 className="h-9 w-9 animate-spin" />
            ) : isPlaying ? (
              <Volume2 className="h-9 w-9" />
            ) : (
              <Mic className={cn("h-9 w-9", isRecording && "text-red-600")} />
            )}
          </div>
        </div>

        <p className={cn("text-sm font-medium text-center", statusTone)}>{statusLabel}</p>

        {(draftTranscript || lastMessage) && (
          <div className="w-full max-w-lg rounded-xl border border-outline-variant/12 bg-surface-container-lowest p-4 space-y-3 max-h-48 overflow-y-auto">
            {draftTranscript ? (
              <div>
                <p className="text-[11px] font-semibold uppercase tracking-wide text-on-surface-variant mb-1">
                  You said
                </p>
                <p className="text-sm text-on-surface leading-relaxed">{draftTranscript}</p>
              </div>
            ) : null}
            {lastMessage && !isRecording ? (
              <div className={draftTranscript ? "pt-3 border-t border-outline-variant/10" : ""}>
                <p className="text-[11px] font-semibold uppercase tracking-wide text-on-surface-variant mb-1">
                  Mizan
                </p>
                <div className="text-sm text-on-surface">
                  <RichTextMessage content={lastMessage} />
                </div>
              </div>
            ) : null}
          </div>
        )}

        <div className="w-full max-w-lg">
          <ChatTaskSuggestions
            suggestions={taskSuggestions}
            selected={selectedSuggestions}
            collapsed={taskPreviewCollapsed}
            hidden={taskPreviewHidden}
            creating={creatingTasks}
            onToggleSelected={(idx, checked) =>
              setSelectedSuggestions((prev) => ({ ...prev, [idx]: checked }))
            }
            onSelectAll={selectAllSuggestions}
            onClearSelection={clearSuggestionsSelection}
            onCreate={() => void createTasksFromSuggestions()}
            onCollapse={setTaskPreviewCollapsed}
            onHide={() => setTaskPreviewHidden(true)}
            onShow={() => setTaskPreviewHidden(false)}
          />
        </div>
      </div>

      <div className="shrink-0 border-t border-outline-variant/10 pt-4 mt-2">
        <div className="flex flex-wrap items-center justify-center gap-2 sm:gap-3">
          {!sessionActive ? (
            <Button
              type="button"
              size="lg"
              className="h-11 rounded-xl gradient-primary text-on-primary px-6"
              disabled={isProcessing}
              onClick={() => void startConversation()}
            >
              <Mic className="h-4 w-4 mr-2" />
              Start session
            </Button>
          ) : (
            <>
              {captureMode === "record" && !isRecording ? (
                <Button
                  type="button"
                  size="lg"
                  className="h-11 rounded-xl gradient-primary text-on-primary px-5"
                  disabled={isProcessing}
                  onClick={() => void startRecorderCapture()}
                >
                  <Mic className="h-4 w-4 mr-2" />
                  Record answer
                </Button>
              ) : null}
              <Button
                type="button"
                size="lg"
                variant="secondary"
                className="h-11 rounded-xl px-5"
                disabled={
                  isProcessing ||
                  (captureMode === "record" && !isRecording) ||
                  (captureMode === "realtime" && !draftTranscript.trim())
                }
                onClick={() => void sendCurrentTranscript()}
              >
                {isProcessing ? (
                  <Loader2 className="h-4 w-4 mr-2 animate-spin" />
                ) : (
                  <Send className="h-4 w-4 mr-2" />
                )}
                Send
              </Button>
              <Button
                type="button"
                size="lg"
                variant="destructive"
                className="h-11 rounded-xl px-5"
                onClick={() => void stopConversation()}
              >
                <Square className="h-4 w-4 mr-2 fill-current" />
                End
              </Button>
            </>
          )}
        </div>
      </div>
    </div>
  );
}
