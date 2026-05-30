export type UsePlaybackOptions = {
  onEnded?: () => void;
};

export function usePlayback(
  uri: string | null,
  options?: UsePlaybackOptions
): { play: () => void; isPlaying: boolean };
