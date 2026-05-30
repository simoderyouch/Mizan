import { VOICE_SILENCE, VOICE_TIMING } from "./voiceTiming";

export type SilenceTracker = {
  reset: () => void;
  /** Push a metering sample in dBFS (typically -160…0). */
  push: (levelDb: number | undefined) => void;
};

/**
 * Stops recording when the user has spoken and then stays quiet for `silenceHoldMs`.
 */
export function createSilenceTracker(onSilence: () => void): SilenceTracker {
  let recordStart = 0;
  let hasSpeech = false;
  let speechAccumMs = 0;
  let silenceStart: number | null = null;
  let fired = false;

  const reset = () => {
    recordStart = Date.now();
    hasSpeech = false;
    speechAccumMs = 0;
    silenceStart = null;
    fired = false;
  };

  const push = (levelDb: number | undefined) => {
    if (fired || levelDb === undefined || Number.isNaN(levelDb)) return;

    const now = Date.now();
    if (recordStart === 0) recordStart = now;
    if (now - recordStart < VOICE_SILENCE.minRecordingMs) return;

    const isSpeech = levelDb > VOICE_SILENCE.speechLevelMin;

    if (isSpeech) {
      hasSpeech = true;
      silenceStart = null;
      speechAccumMs += VOICE_TIMING.meterPollMs;
      return;
    }

    if (!hasSpeech) return;

    if (!silenceStart) silenceStart = now;

    if (
      speechAccumMs >= VOICE_SILENCE.minSpeechMs &&
      now - silenceStart >= VOICE_SILENCE.silenceHoldMs
    ) {
      fired = true;
      onSilence();
    }
  };

  return { reset, push };
}
