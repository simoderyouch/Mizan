/** Hands-free voice check-in timing (keep aligned with mobile `voiceTiming.ts`). */
export const VOICE_TIMING = {
  postQuestionDelayMs: 1_000,
  maxAnswerMs: 45_000,
  questionAudioFallbackMs: 50_000,
  manualAnswerDebounceMs: 1_500,
  meterPollMs: 100,
} as const;

export const VOICE_SILENCE = {
  speechLevelMin: -42,
  silenceHoldMs: 1_800,
  minRecordingMs: 1_200,
  minSpeechMs: 900,
} as const;

export function voiceTimingLabel() {
  const listenSec = VOICE_TIMING.postQuestionDelayMs / 1000;
  const answerSec = VOICE_TIMING.maxAnswerMs / 1000;
  const pauseSec = VOICE_SILENCE.silenceHoldMs / 1000;
  return `Mic ~${listenSec}s after each question · stops ~${pauseSec}s after you pause · max ${answerSec}s`;
}
