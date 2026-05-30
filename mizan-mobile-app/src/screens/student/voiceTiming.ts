/** Hands-free voice check-in timing (mobile + web should stay in sync). */
export const VOICE_TIMING = {
  /** Pause after the question audio ends, then open the mic. */
  postQuestionDelayMs: 1_000,
  /** Hard cap per answer if silence is never detected. */
  maxAnswerMs: 45_000,
  /** Safety cap if question audio never fires "ended". */
  questionAudioFallbackMs: 50_000,
  /** Typed correction auto-save (when transcription needs a fix). */
  manualAnswerDebounceMs: 1_500,
  /** How often to read the mic level (native metering / web analyser). */
  meterPollMs: 100,
} as const;

/** Silence detection — stops recording when the student finishes speaking. */
export const VOICE_SILENCE = {
  /** Metering above this (dBFS, closer to 0 = louder) counts as speech. */
  speechLevelMin: -42,
  /** How long levels must stay quiet after speech before auto-stop. */
  silenceHoldMs: 1_800,
  /** Do not auto-stop before this (avoids cutting off the start). */
  minRecordingMs: 1_200,
  /** Require at least this much speech before silence can end the answer. */
  minSpeechMs: 500,
} as const;

export function voiceTimingLabel() {
  const listenSec = VOICE_TIMING.postQuestionDelayMs / 1000;
  const answerSec = VOICE_TIMING.maxAnswerMs / 1000;
  const pauseSec = VOICE_SILENCE.silenceHoldMs / 1000;
  return `Mic ~${listenSec}s after each question · stops ~${pauseSec}s after you pause · max ${answerSec}s`;
}
