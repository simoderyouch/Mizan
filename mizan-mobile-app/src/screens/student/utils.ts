import type { CheckinAnswerPayload, CheckinQuestion } from "../../lib/types";
import { todayIso } from "./constants";

export type CheckinOptionChoice = { value: string; label: string };

/** Normalize LLM/backend options — plain strings or serialized { value, label } objects. */
export function parseCheckinOption(raw: unknown): CheckinOptionChoice {
  if (raw && typeof raw === "object" && !Array.isArray(raw)) {
    const obj = raw as Record<string, unknown>;
    const value = String(obj.value ?? obj.label ?? "").trim();
    const label = String(obj.label ?? obj.value ?? "").trim();
    if (value || label) return { value: value || label, label: label || value };
  }

  const trimmed = String(raw ?? "").trim();
  if (!trimmed) return { value: "", label: "" };

  if (trimmed.startsWith("{")) {
    try {
      const parsed = JSON.parse(trimmed) as Record<string, unknown>;
      const value = String(parsed.value ?? parsed.label ?? "").trim();
      const label = String(parsed.label ?? parsed.value ?? "").trim();
      if (value || label) return { value: value || label, label: label || value };
    } catch {
      // fall through to regex / plain string
    }
  }

  const valueMatch =
    trimmed.match(/['"]value['"]\s*:\s*['"]([^'"]+)['"]/) ??
    trimmed.match(/\bvalue\s*:\s*['"]([^'"]+)['"]/);
  const labelMatch =
    trimmed.match(/['"]label['"]\s*:\s*['"]([^'"]+)['"]/) ??
    trimmed.match(/\blabel\s*:\s*['"]([^'"]+)['"]/);
  if (valueMatch && labelMatch) {
    return { value: valueMatch[1], label: labelMatch[1] };
  }
  if (labelMatch) {
    return { value: labelMatch[1], label: labelMatch[1] };
  }

  return { value: trimmed, label: trimmed };
}

export function normalizeCheckinOptions(
  options?: Array<string | Record<string, unknown>> | null
): CheckinOptionChoice[] {
  return (options ?? []).map(parseCheckinOption).filter((o) => o.value || o.label);
}

export function mapMoodScaleToFive(value: number) {
  const bounded = Math.max(1, Math.min(10, value));
  return Math.max(1, Math.min(5, Math.round(1 + ((bounded - 1) / 9) * 4)));
}

export function parseBooleanAnswer(raw: unknown): boolean | undefined {
  if (typeof raw === "boolean") return raw;
  if (typeof raw === "string") {
    const lower = raw.trim().toLowerCase();
    if (["yes", "true", "1", "oui"].includes(lower)) return true;
    if (["no", "false", "0", "non"].includes(lower)) return false;
  }
  return undefined;
}

export function hasRequiredUnanswered(
  questions: CheckinQuestion[],
  answers: Record<string, string | number | boolean | string[]>
) {
  return questions.some((q) => {
    if (!q.required) return false;
    const value = answers[q.id];
    if (value === undefined || value === null) return true;
    if (typeof value === "string") return value.trim() === "";
    if (Array.isArray(value)) return value.length === 0;
    return false;
  });
}

export function extractMetricFromAnswers(
  questions: CheckinQuestion[],
  answers: Record<string, string | number | boolean | string[]>,
  target: "mood_score" | "sleep_hours" | "plan_completed" | "notes"
): number | boolean | string | undefined {
  for (const q of questions) {
    if (q.target_field !== target) continue;
    const raw = answers[q.id];
    if (raw === undefined || raw === null) continue;
    if (target === "mood_score") {
      if (typeof raw === "number") return mapMoodScaleToFive(raw);
      const parsed = Number(raw);
      if (!Number.isNaN(parsed)) return mapMoodScaleToFive(parsed);
      continue;
    }
    if (target === "sleep_hours") {
      if (typeof raw === "number") return raw;
      const parsed = Number(raw);
      if (!Number.isNaN(parsed)) return parsed;
      continue;
    }
    if (target === "plan_completed") {
      return parseBooleanAnswer(raw);
    }
    return typeof raw === "string" ? raw : String(raw);
  }
  return undefined;
}

export function dateLabel(date: string) {
  return new Date(`${date}T00:00:00`).toLocaleDateString(undefined, {
    day: "numeric",
    month: "short",
  });
}

export function checkinAnswers(answers: Record<string, string | number | boolean | string[]>) {
  return Object.entries(answers).map(([question_id, value]) => ({ question_id, value })) as CheckinAnswerPayload[];
}

export function tasksFromPlan(lines: string[], source: "morning_checkin" | "voice_chat") {
  return lines
    .map((line) => line.replace(/^[-*•\d.)\s]+/, "").trim())
    .filter(Boolean)
    .slice(0, 5)
    .map((title) => ({
      title,
      due_date: todayIso(),
      source,
    }));
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

function formatTimeShort(time: string): string {
  return String(time).slice(0, 5);
}

function formatDateShortLabel(iso: string): string {
  const d = new Date(`${iso}T00:00:00`);
  if (Number.isNaN(d.getTime())) return iso;
  return d.toLocaleDateString(undefined, { day: "numeric", month: "short" });
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
        `${nextClass.subject} ${formatTimeShort(nextClass.start_time)}-${formatTimeShort(nextClass.end_time)}`
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
      text: truncateWords(`${nearestExam.subject} ${formatDateShortLabel(nearestExam.exam_date)}`),
    });
  } else if (nearestProject) {
    items.push({
      id: "project",
      label: "Project",
      text: truncateWords(`${nearestProject.name} ${formatDateShortLabel(nearestProject.due_date)}`),
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
      text: truncateWords(`${source.currentMode.mode} active now`),
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
  moodTrend?: Array<{ mood_score?: number }>;
  checkinProgress: number;
  hasActiveMode: boolean;
}): number {
  const trend = input.moodTrend ?? [];
  const avgMood = trend.length
    ? trend.reduce((acc, point) => acc + (Number(point.mood_score) || 3), 0) / trend.length
    : 0;
  const readinessFromMood = avgMood > 0 ? Math.round(avgMood * 20) : 0;
  return Math.max(
    35,
    Math.min(
      100,
      Math.round(
        (readinessFromMood > 0 ? readinessFromMood : 55) * 0.6 +
          input.checkinProgress * 0.25 +
          (input.hasActiveMode ? 10 : 0)
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

export function getSuggestedVoicePeriod(): "MORNING" | "EVENING" {
  const hour = new Date().getHours();
  return hour >= 20 || hour < 8 ? "EVENING" : "MORNING";
}

const MODE_LABELS: Record<string, string> = {
  REVISION: "Revision",
  EXAMEN: "Exam prep",
  PROJET: "Project",
  REPOS: "Rest",
  SPORT: "Sport",
  COURS: "Class",
};

export function modeLabel(mode: string): string {
  return MODE_LABELS[mode] ?? mode;
}

export function formatModeElapsed(startedAt: string, now: Date): string {
  const ms = Math.max(0, now.getTime() - new Date(startedAt).getTime());
  const totalSec = Math.floor(ms / 1000);
  const h = Math.floor(totalSec / 3600);
  const m = Math.floor((totalSec % 3600) / 60);
  const s = totalSec % 60;
  if (h > 0) return `${h}:${String(m).padStart(2, "0")}:${String(s).padStart(2, "0")}`;
  return `${String(m).padStart(2, "0")}:${String(s).padStart(2, "0")}`;
}
