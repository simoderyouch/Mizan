import { useCallback, useEffect, useRef } from "react";
import { useAudioPlayer, useAudioPlayerStatus } from "expo-audio";
import type { UsePlaybackOptions } from "./usePlayback.d";

/** Native: expo-audio playback (iOS / Android). */
export function usePlayback(uri: string | null, options?: UsePlaybackOptions) {
  const player = useAudioPlayer(uri);
  const status = useAudioPlayerStatus(player);
  const onEndedRef = useRef(options?.onEnded);
  onEndedRef.current = options?.onEnded;
  const wasPlayingRef = useRef(false);

  useEffect(() => {
    if (status.playing) {
      wasPlayingRef.current = true;
      return;
    }
    if (wasPlayingRef.current) {
      wasPlayingRef.current = false;
      onEndedRef.current?.();
    }
  }, [status.playing]);

  const play = useCallback(() => {
    if (!uri || !player) {
      onEndedRef.current?.();
      return;
    }
    try {
      if (typeof player.play === "function") {
        player.play();
      }
    } catch {
      onEndedRef.current?.();
    }
  }, [uri, player]);

  return { play, isPlaying: status.playing };
}
