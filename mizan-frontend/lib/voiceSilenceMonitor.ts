import { VOICE_SILENCE, VOICE_TIMING } from "./voiceTiming";
import { createSilenceTracker } from "./voiceSilenceTracker";

export { createSilenceTracker };
export type { SilenceTracker } from "./voiceSilenceTracker";

function rmsToDb(rms: number) {
  return 20 * Math.log10(Math.max(rms, 1e-8));
}

/** Web: monitor mic stream and call `onSilence` when the user stops speaking. */
export function startWebSilenceMonitor(
  stream: MediaStream,
  onSilence: () => void
): { stop: () => void } {
  const tracker = createSilenceTracker(onSilence);
  tracker.reset();

  const AudioCtx =
    typeof window !== "undefined"
      ? window.AudioContext ||
        (window as typeof window & { webkitAudioContext?: typeof AudioContext }).webkitAudioContext
      : null;

  if (!AudioCtx) {
    return { stop: () => undefined };
  }

  const ctx = new AudioCtx();
  const source = ctx.createMediaStreamSource(stream);
  const analyser = ctx.createAnalyser();
  analyser.fftSize = 2048;
  source.connect(analyser);

  const data = new Uint8Array(analyser.fftSize);
  let intervalId: ReturnType<typeof setInterval> | null = null;

  const tick = () => {
    analyser.getByteTimeDomainData(data);
    let sum = 0;
    for (let i = 0; i < data.length; i += 1) {
      const sample = (data[i] - 128) / 128;
      sum += sample * sample;
    }
    const rms = Math.sqrt(sum / data.length);
    tracker.push(rmsToDb(rms));
  };

  intervalId = setInterval(tick, VOICE_TIMING.meterPollMs);

  return {
    stop: () => {
      if (intervalId) clearInterval(intervalId);
      source.disconnect();
      void ctx.close();
    },
  };
}
