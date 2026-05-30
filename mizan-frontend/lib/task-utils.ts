import type { Task } from "@/lib/types";

export const toIsoToday = () => new Date().toISOString().slice(0, 10);

export const isTaskDone = (task: Task) => task.status === "done";

export const isTaskPending = (task: Task) =>
  task.status === "pending" || task.status === "in_progress";

export const formatTaskDate = (date: string) =>
  new Date(`${date}T00:00:00`).toLocaleDateString(undefined, {
    weekday: "short",
    month: "short",
    day: "numeric",
  });

export const isOverdue = (task: Task, today = toIsoToday()) =>
  isTaskPending(task) && task.due_date < today;

export const isDueToday = (task: Task, today = toIsoToday()) => task.due_date === today;

export const sourceMeta: Record<
  string,
  { label: string; tone: "default" | "ai" | "ritual" | "agent" }
> = {
  manual: { label: "Manual", tone: "default" },
  chat: { label: "Mizan AI", tone: "ai" },
  voice_chat: { label: "Voice AI", tone: "ai" },
  morning_checkin: { label: "Morning ritual", tone: "ritual" },
  agent: { label: "Agent action", tone: "agent" },
};

export function getSourceMeta(source: string) {
  return sourceMeta[source] ?? { label: source.replace(/_/g, " "), tone: "default" as const };
}

export const AI_TASK_SOURCES = ["chat", "voice_chat", "morning_checkin", "agent"] as const;

export type AiTaskSource = (typeof AI_TASK_SOURCES)[number];

export function isAiTask(task: Task) {
  return task.source !== "manual";
}

export function isManualTask(task: Task) {
  return task.source === "manual";
}

export type TaskFilter = "focus" | "today" | "overdue" | "upcoming" | "done" | "all";

export function groupAiTasksBySource(tasks: Task[]) {
  const groups: Record<string, Task[]> = {};
  for (const task of tasks.filter(isAiTask)) {
    const key = task.source in sourceMeta ? task.source : "other";
    if (!groups[key]) groups[key] = [];
    groups[key].push(task);
  }
  for (const list of Object.values(groups)) {
    list.sort((a, b) => a.due_date.localeCompare(b.due_date));
  }
  return groups;
}

function addDays(iso: string, days: number) {
  const d = new Date(`${iso}T12:00:00`);
  d.setDate(d.getDate() + days);
  return d.toISOString().slice(0, 10);
}

export function groupTasks(tasks: Task[], today = toIsoToday()) {
  const overdue: Task[] = [];
  const todayList: Task[] = [];
  const upcoming: Task[] = [];
  const done: Task[] = [];

  for (const task of tasks) {
    if (isTaskDone(task)) {
      done.push(task);
      continue;
    }
    if (isOverdue(task, today)) {
      overdue.push(task);
      continue;
    }
    if (isDueToday(task, today)) {
      todayList.push(task);
      continue;
    }
    upcoming.push(task);
  }

  const byDue = (a: Task, b: Task) => a.due_date.localeCompare(b.due_date);
  overdue.sort(byDue);
  todayList.sort(byDue);
  upcoming.sort(byDue);
  done.sort((a, b) => (b.completed_at ?? b.updated_at).localeCompare(a.completed_at ?? a.updated_at));

  return { overdue, today: todayList, upcoming, done };
}

export function filterTasks(tasks: Task[], filter: TaskFilter, query: string, today = toIsoToday()) {
  const q = query.trim().toLowerCase();
  const matchesQuery = (task: Task) =>
    !q ||
    task.title.toLowerCase().includes(q) ||
    (task.description?.toLowerCase().includes(q) ?? false);

  let base = tasks.filter(matchesQuery);

  switch (filter) {
    case "today":
      base = base.filter((t) => isDueToday(t, today));
      break;
    case "overdue":
      base = base.filter((t) => isOverdue(t, today));
      break;
    case "upcoming":
      base = base.filter((t) => isTaskPending(t) && t.due_date > today);
      break;
    case "done":
      base = base.filter(isTaskDone);
      break;
    case "focus":
      base = base.filter(
        (t) =>
          !isTaskDone(t) &&
          (isOverdue(t, today) || isDueToday(t, today) || t.due_date <= addDays(today, 7))
      );
      break;
    case "all":
    default:
      break;
  }

  return base;
}
