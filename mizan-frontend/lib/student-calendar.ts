import type { Exam, Project, ScheduleEntry } from "@/lib/types";
import { formatDateShort, formatTimeString } from "@/lib/utils";

export type CalendarEventKind = "course" | "exam" | "project";

export type StudentCalendarEvent = {
  id: string;
  kind: CalendarEventKind;
  title: string;
  subtitle?: string;
  /** ISO date YYYY-MM-DD for dated items; week grid uses this for placement */
  date: string;
  /** English weekday name, e.g. Monday — for recurring courses */
  dayOfWeek?: string;
  startTime?: string;
  endTime?: string;
  sortMinutes: number;
};

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
  return date.toLocaleDateString("en-US", { weekday: "long" });
}

function timeToMinutes(time?: string): number {
  if (!time) return 0;
  const [h, m] = time.slice(0, 5).split(":").map(Number);
  return (h || 0) * 60 + (m || 0);
}

function normalizeWeekday(day: string): string {
  const lower = day.trim().toLowerCase();
  return lower.charAt(0).toUpperCase() + lower.slice(1);
}

export function buildWeekCalendarEvents(
  weekStart: Date,
  weeklySchedule: ScheduleEntry[],
  exams: Exam[],
  projects: Project[]
): StudentCalendarEvent[] {
  const events: StudentCalendarEvent[] = [];
  const weekDates: { date: Date; iso: string; weekday: string }[] = [];

  for (let i = 0; i < 7; i++) {
    const date = addDays(weekStart, i);
    weekDates.push({ date, iso: toIsoDate(date), weekday: weekdayNameForDate(date) });
  }

  for (const entry of weeklySchedule) {
    const day = normalizeWeekday(entry.day_of_week);
    const slot = weekDates.find((w) => w.weekday === day);
    if (!slot) continue;
    events.push({
      id: `course-${entry.id}-${slot.iso}`,
      kind: "course",
      title: entry.subject,
      subtitle: `${entry.professor} · Room ${entry.room}`,
      date: slot.iso,
      dayOfWeek: day,
      startTime: entry.start_time,
      endTime: entry.end_time,
      sortMinutes: timeToMinutes(entry.start_time),
    });
  }

  for (const exam of exams) {
    const examDay = exam.exam_date.slice(0, 10);
    if (!weekDates.some((w) => w.iso === examDay)) continue;
    events.push({
      id: `exam-${exam.id}`,
      kind: "exam",
      title: exam.subject,
      subtitle: `Exam · Room ${exam.room}`,
      date: examDay,
      startTime: exam.start_time,
      endTime: exam.end_time,
      sortMinutes: timeToMinutes(exam.start_time),
    });
  }

  for (const project of projects) {
    const dueDay = project.due_date.slice(0, 10);
    if (!weekDates.some((w) => w.iso === dueDay)) continue;
    events.push({
      id: `project-${project.id}`,
      kind: "project",
      title: project.name,
      subtitle: `Project due · ${project.subject}`,
      date: dueDay,
      sortMinutes: 24 * 60,
    });
  }

  events.sort((a, b) => {
    if (a.date !== b.date) return a.date.localeCompare(b.date);
    return a.sortMinutes - b.sortMinutes;
  });

  return events;
}

export function buildUpcomingDatedEvents(
  exams: Exam[],
  projects: Project[],
  fromDate = new Date()
): StudentCalendarEvent[] {
  const fromIso = toIsoDate(fromDate);
  const events: StudentCalendarEvent[] = [];

  for (const exam of exams) {
    const day = exam.exam_date.slice(0, 10);
    if (day < fromIso) continue;
    events.push({
      id: `exam-${exam.id}`,
      kind: "exam",
      title: exam.subject,
      subtitle: `Exam · ${formatDateShort(exam.exam_date)} · Room ${exam.room}`,
      date: day,
      startTime: exam.start_time,
      endTime: exam.end_time,
      sortMinutes: timeToMinutes(exam.start_time),
    });
  }

  for (const project of projects) {
    const day = project.due_date.slice(0, 10);
    if (day < fromIso) continue;
    events.push({
      id: `project-${project.id}`,
      kind: "project",
      title: project.name,
      subtitle: `Due ${formatDateShort(project.due_date)} · ${project.subject}`,
      date: day,
      sortMinutes: 24 * 60,
    });
  }

  events.sort((a, b) => {
    if (a.date !== b.date) return a.date.localeCompare(b.date);
    return a.sortMinutes - b.sortMinutes;
  });

  return events;
}

export function formatEventTime(event: StudentCalendarEvent): string {
  if (event.startTime && event.endTime) {
    return `${formatTimeString(event.startTime)}–${formatTimeString(event.endTime)}`;
  }
  if (event.kind === "project") return "Due date";
  return "";
}

export const CALENDAR_KIND_STYLES: Record<
  CalendarEventKind,
  { label: string; dot: string; card: string }
> = {
  course: {
    label: "Course",
    dot: "bg-primary",
    card: "border-primary/20 bg-primary/5",
  },
  exam: {
    label: "Exam",
    dot: "bg-violet-500",
    card: "border-violet-200/80 bg-violet-50/80",
  },
  project: {
    label: "Project",
    dot: "bg-amber-500",
    card: "border-amber-200/80 bg-amber-50/80",
  },
};
