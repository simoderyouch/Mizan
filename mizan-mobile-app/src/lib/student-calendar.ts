import type { ScheduleEntry } from "./types";

export const CALENDAR_WEEKDAYS = [
  "Monday",
  "Tuesday",
  "Wednesday",
  "Thursday",
  "Friday",
  "Saturday",
  "Sunday",
] as const;

export function getMondayWeekStart(anchor = new Date()): Date {
  const d = new Date(anchor);
  d.setHours(0, 0, 0, 0);
  const day = d.getDay();
  const offset = day === 0 ? -6 : 1 - day;
  d.setDate(d.getDate() + offset);
  return d;
}

export function addDays(date: Date, days: number): Date {
  const d = new Date(date);
  d.setDate(d.getDate() + days);
  return d;
}

export function toIsoDate(date: Date): string {
  const y = date.getFullYear();
  const m = String(date.getMonth() + 1).padStart(2, "0");
  const day = String(date.getDate()).padStart(2, "0");
  return `${y}-${m}-${day}`;
}

export function weekdayNameForDate(date: Date): string {
  return todayWeekdayName(date);
}

/** Locale-independent English weekday (matches backend). */
export function todayWeekdayName(anchor = new Date()): string {
  const jsDay = anchor.getDay();
  const index = jsDay === 0 ? 6 : jsDay - 1;
  return CALENDAR_WEEKDAYS[index];
}

export function scheduleForWeekDay(schedules: ScheduleEntry[], weekday: string) {
  const normalized = weekday.trim().toLowerCase();
  return schedules
    .filter((s) => s.day_of_week.trim().toLowerCase() === normalized)
    .sort((a, b) => a.start_time.localeCompare(b.start_time));
}

export function formatWeekRange(weekStart: Date) {
  const end = addDays(weekStart, 6);
  const fmt = (d: Date) =>
    d.toLocaleDateString(undefined, { month: "short", day: "numeric" });
  return `${fmt(weekStart)} – ${fmt(end)}`;
}
