import { clsx, type ClassValue } from "clsx";
import { twMerge } from "tailwind-merge";

export function cn(...inputs: ClassValue[]) {
  return twMerge(clsx(inputs));
}

/* ── Date / Time Formatters ── */
const EN_MONTHS = [
  "january", "february", "march", "april", "may", "june",
  "july", "august", "september", "october", "november", "december",
];

const EN_DAYS = [
  "sunday", "monday", "tuesday", "wednesday", "thursday", "friday", "saturday",
];

export function formatDate(iso: string): string {
  const d = new Date(iso);
  return `${d.getDate()} ${EN_MONTHS[d.getMonth()]} ${d.getFullYear()}`;
}

export function formatDateShort(iso: string): string {
  const d = new Date(iso);
  return `${d.getDate()} ${EN_MONTHS[d.getMonth()].slice(0, 3)}.`;
}

export function formatTime(iso: string): string {
  const d = new Date(iso);
  return d.toLocaleTimeString("en-US", { hour: "2-digit", minute: "2-digit" });
}

export function formatTimeString(time: string): string {
  return time.slice(0, 5);
}

export function getDayName(iso: string): string {
  const d = new Date(iso);
  return EN_DAYS[d.getDay()];
}

export function getGreeting(): string {
  const h = new Date().getHours();
  if (h < 12) return "Good morning";
  if (h < 18) return "Good afternoon";
  return "Good evening";
}

/* ── Mood Helpers ── */
const MOOD_LABELS: Record<number, string> = {
  1: "Very low",
  2: "Low",
  3: "Neutral",
  4: "Good",
  5: "Excellent",
};

const MOOD_EMOJIS: Record<number, string> = {
  1: "😔",
  2: "😕",
  3: "😐",
  4: "🙂",
  5: "😊",
};

export function moodLabel(score: number): string {
  return MOOD_LABELS[score] ?? "Unknown";
}

export function moodEmoji(score: number): string {
  return MOOD_EMOJIS[score] ?? "❓";
}

/* ── Mode Helpers ── */
const MODE_LABELS: Record<string, string> = {
  REVISION: "Revision",
  EXAMEN: "Exam",
  PROJET: "Project",
  REPOS: "Rest",
  SPORT: "Sport",
  COURS: "Class",
};

export function modeLabel(mode: string): string {
  return MODE_LABELS[mode] ?? mode;
}

export function formatMinutes(minutes: number): string {
  const h = Math.floor(minutes / 60);
  const m = minutes % 60;
  if (h === 0) return `${m}min`;
  if (m === 0) return `${h}h`;
  return `${h}h${m.toString().padStart(2, "0")}`;
}
