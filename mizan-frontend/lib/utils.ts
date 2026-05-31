import { clsx, type ClassValue } from "clsx";
import { twMerge } from "tailwind-merge";

export function cn(...inputs: ClassValue[]) {
  return twMerge(clsx(inputs));
}

const BULLET_PREFIX = /^[\d\-*•.)]+\s*/;

export type DailyFocusItem = {
  id: string;
  label: string;
  text: string;
};

function truncateWords(text: string, maxWords = 5): string {
  const words = text.trim().split(/\s+/).filter(Boolean);
  return words.length > maxWords ? words.slice(0, maxWords).join(" ") : text.trim();
}

export type DailyFocusSource = {
  todaySchedule: Array<{ subject: string; start_time: string; end_time: string }>;
  upcomingExams: Array<{ subject: string; exam_date: string }>;
  activeProjects?: Array<{ name: string; due_date: string }>;
  hasMorningCheckin?: boolean;
  hasEveningCheckin?: boolean;
  currentMode?: { mode: string } | null;
  activeGoalsCount?: number;
};

/** Daily focus card: up to 3 short lines from dashboard data. */
export function buildDailyFocusItems(source: DailyFocusSource): DailyFocusItem[] {
  const items: DailyFocusItem[] = [];
  const nextClass = source.todaySchedule[0];

  if (nextClass) {
    items.push({
      id: "class",
      label: "Next class",
      text: truncateWords(
        `${nextClass.subject} ${formatTimeString(nextClass.start_time)}-${formatTimeString(nextClass.end_time)}`
      ),
    });
  } else {
    items.push({
      id: "class",
      label: "Schedule",
      text: "No class scheduled today",
    });
  }

  const nearestExam = source.upcomingExams[0];
  const nearestProject = source.activeProjects
    ?.slice()
    .sort((a, b) => new Date(a.due_date).getTime() - new Date(b.due_date).getTime())[0];

  if (nearestExam) {
    items.push({
      id: "exam",
      label: "Exam",
      text: truncateWords(`${nearestExam.subject} ${formatDateShort(nearestExam.exam_date)}`),
    });
  } else if (nearestProject) {
    items.push({
      id: "project",
      label: "Project",
      text: truncateWords(`${nearestProject.name} ${formatDateShort(nearestProject.due_date)}`),
    });
  } else {
    items.push({
      id: "deadline",
      label: "Deadlines",
      text: "No upcoming exams or projects",
    });
  }

  const morning = source.hasMorningCheckin;
  const evening = source.hasEveningCheckin;
  if (!morning || !evening) {
    const pending =
      !morning && !evening
        ? "Morning and evening rituals pending"
        : !morning
          ? "Morning ritual still pending"
          : "Evening ritual still pending";
    items.push({ id: "ritual", label: "Rituals", text: truncateWords(pending) });
  } else if (source.currentMode) {
    items.push({
      id: "mode",
      label: "Focus mode",
      text: truncateWords(`${modeLabel(source.currentMode.mode)} active now`),
    });
  } else if ((source.activeGoalsCount ?? 0) > 0) {
    items.push({
      id: "goals",
      label: "Goals",
      text: truncateWords(`${source.activeGoalsCount} active goals tracked`),
    });
  } else {
    items.push({
      id: "ritual",
      label: "Rituals",
      text: "Morning and evening complete",
    });
  }

  return items.slice(0, 3);
}

export function computeReadinessScore(input: {
  avgMood?: number;
  checkinProgress: number;
  hasActiveMode: boolean;
  pendingContracts?: number;
}): number {
  const readinessFromMood = input.avgMood ? Math.round(input.avgMood * 20) : 0;
  const pending = input.pendingContracts ?? 0;
  return Math.max(
    35,
    Math.min(
      100,
      Math.round(
        (readinessFromMood > 0 ? readinessFromMood : 55) * 0.6 +
          input.checkinProgress * 0.25 +
          (input.hasActiveMode ? 10 : 0) +
          (pending === 0 ? 5 : 0)
      )
    )
  );
}

/** Daily focus card: up to 3 lines, ~5 words each. */
export function formatDailyPlanBullets(plan: string, maxLines = 3, maxWords = 5): string[] {
  return plan
    .split("\n")
    .map((line) => line.replace(BULLET_PREFIX, "").trim())
    .filter(Boolean)
    .slice(0, maxLines)
    .map((line) => {
      const words = line.split(/\s+/).filter(Boolean);
      return words.length > maxWords ? words.slice(0, maxWords).join(" ") : line;
    });
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

export function formatElapsedSeconds(totalSeconds: number): string {
  const h = Math.floor(totalSeconds / 3600);
  const m = Math.floor((totalSeconds % 3600) / 60);
  const s = totalSeconds % 60;
  return `${h.toString().padStart(2, "0")}:${m.toString().padStart(2, "0")}:${s.toString().padStart(2, "0")}`;
}
