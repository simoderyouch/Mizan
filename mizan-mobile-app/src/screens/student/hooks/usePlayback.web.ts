import { useCallback, useEffect, useRef, useState } from "react";
import type { UsePlaybackOptions } from "./usePlayback.d";

/** Web: HTML Audio (expo-audio player is unreliable on web). */
export function usePlayback(uri: string | null, options?: UsePlaybackOptions) {
  const audioRef = useRef<HTMLAudioElement | null>(null);
  const onEndedRef = useRef(options?.onEnded);
  onEndedRef.current = options?.onEnded;
  const [isPlaying, setIsPlaying] = useState(false);

  useEffect(() => {
    return () => {
      if (audioRef.current) {
        audioRef.current.pause();
        audioRef.current.src = "";
        audioRef.current.onended = null;
        audioRef.current = null;
      }
    };
  }, []);

  const play = useCallback(() => {
    if (!uri || typeof Audio === "undefined") {
      onEndedRef.current?.();
      return;
    }
    try {
      if (audioRef.current) {
        audioRef.current.pause();
        audioRef.current.onended = null;
      }
      const audio = new Audio(uri);
      audio.onended = () => {
        setIsPlaying(false);
        onEndedRef.current?.();
      };
      audio.onerror = () => {
        setIsPlaying(false);
        onEndedRef.current?.();
      };
      audioRef.current = audio;
      setIsPlaying(true);
      void audio.play().catch(() => {
        setIsPlaying(false);
        onEndedRef.current?.();
      });
    } catch {
      onEndedRef.current?.();
    }
  }, [uri]);

  return { play, isPlaying };
}
