import { useMemo } from "react";
import { useLiveNow } from "./useLiveNow";
import { getMorningWindowState, getEveningWindowState } from "../checkin/checkinWindows";

/**
 * Returns live-updating morning and evening window states.
 * Re-renders every second for countdown accuracy.
 */
export function useCheckinWindows(morningDone: boolean, eveningDone: boolean) {
  const now = useLiveNow();

  const morningWindow = useMemo(() => getMorningWindowState(morningDone, now), [morningDone, now]);
  const eveningWindow = useMemo(
    () => getEveningWindowState(morningDone, eveningDone, now),
    [morningDone, eveningDone, now]
  );

  return { morningWindow, eveningWindow, now };
}
