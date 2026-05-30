export const MORNING_START_HOUR = 8;
export const EVENING_START_HOUR = 20;

export type CheckinWindowState = {
  status: string;
  countdownLabel: string;
  countdownMs: number;
  canStart: boolean;
};

function nextAt(hour: number, now: Date): Date {
  const target = new Date(now);
  target.setHours(hour, 0, 0, 0);
  if (target <= now) target.setDate(target.getDate() + 1);
  return target;
}

export function formatCountdown(ms: number): string {
  const total = Math.max(0, Math.floor(ms / 1000));
  const h = Math.floor(total / 3600);
  const m = Math.floor((total % 3600) / 60);
  const s = total % 60;
  return `${h}h ${m}m ${s}s`;
}

export function getMorningWindowState(hasMorning: boolean, now: Date): CheckinWindowState {
  const todayMorningOpen = new Date(now);
  todayMorningOpen.setHours(MORNING_START_HOUR, 0, 0, 0);
  const todayEveningOpen = new Date(now);
  todayEveningOpen.setHours(EVENING_START_HOUR, 0, 0, 0);

  if (hasMorning) {
    return {
      status: "Done today",
      countdownLabel: "Next morning in",
      countdownMs: nextAt(MORNING_START_HOUR, now).getTime() - now.getTime(),
      canStart: false,
    };
  }
  if (now < todayMorningOpen) {
    return {
      status: "Not open yet",
      countdownLabel: "Opens in",
      countdownMs: todayMorningOpen.getTime() - now.getTime(),
      canStart: false,
    };
  }
  if (now < todayEveningOpen) {
    return {
      status: "Open now",
      countdownLabel: "Closes in",
      countdownMs: todayEveningOpen.getTime() - now.getTime(),
      canStart: true,
    };
  }
  return {
    status: "Window closed",
    countdownLabel: "Opens tomorrow in",
    countdownMs: nextAt(MORNING_START_HOUR, now).getTime() - now.getTime(),
    canStart: false,
  };
}

export function getEveningWindowState(hasMorning: boolean, hasEvening: boolean, now: Date): CheckinWindowState {
  const todayEveningOpen = new Date(now);
  todayEveningOpen.setHours(EVENING_START_HOUR, 0, 0, 0);
  const endOfDay = new Date(now);
  endOfDay.setHours(23, 59, 59, 999);

  if (hasEvening) {
    return {
      status: "Done today",
      countdownLabel: "Next evening in",
      countdownMs: nextAt(EVENING_START_HOUR, now).getTime() - now.getTime(),
      canStart: false,
    };
  }
  if (!hasMorning) {
    return {
      status: "Morning required first",
      countdownLabel: "Morning opens in",
      countdownMs: nextAt(MORNING_START_HOUR, now).getTime() - now.getTime(),
      canStart: false,
    };
  }
  if (now < todayEveningOpen) {
    return {
      status: "Not open yet",
      countdownLabel: "Opens in",
      countdownMs: todayEveningOpen.getTime() - now.getTime(),
      canStart: false,
    };
  }
  return {
    status: "Open now",
    countdownLabel: "Closes in",
    countdownMs: endOfDay.getTime() - now.getTime(),
    canStart: true,
  };
}
