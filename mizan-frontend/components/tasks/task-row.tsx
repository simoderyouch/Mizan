"use client";

import { FormEvent } from "react";
import { CheckCircle2, Loader2, Pencil, Trash2 } from "lucide-react";

import { TaskSourceBadge } from "@/components/tasks/task-source-badge";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Textarea } from "@/components/ui/textarea";
import { cn } from "@/lib/utils";
import { formatTaskDate, isOverdue, isTaskDone } from "@/lib/task-utils";
import type { Task } from "@/lib/types";

type TaskRowProps = {
  task: Task;
  today: string;
  busy: boolean;
  editing: boolean;
  selectable?: boolean;
  selected?: boolean;
  onSelect?: (selected: boolean) => void;
  editTitle: string;
  editDescription: string;
  editDueDate: string;
  onToggle: (checked: boolean) => void;
  onEdit: () => void;
  onCancelEdit: () => void;
  onSaveEdit: (e: FormEvent) => void;
  onDelete: () => void;
  onEditTitle: (v: string) => void;
  onEditDescription: (v: string) => void;
  onEditDueDate: (v: string) => void;
  highlighted?: boolean;
};

export function TaskRow({
  task,
  today,
  busy,
  editing,
  selectable = false,
  selected = false,
  onSelect,
  editTitle,
  editDescription,
  editDueDate,
  onToggle,
  onEdit,
  onCancelEdit,
  onSaveEdit,
  onDelete,
  onEditTitle,
  onEditDescription,
  onEditDueDate,
  highlighted = false,
}: TaskRowProps) {
  const done = isTaskDone(task);
  const overdue = isOverdue(task, today);

  return (
    <div
      className={cn(
        "group rounded-lg border px-3 py-3 sm:px-4 transition-all",
        highlighted && "ring-2 ring-primary/50 border-primary/40",
        selected && "ring-2 ring-primary/40 border-primary/30",
        done
          ? "border-outline-variant/20 bg-surface-container/50"
          : overdue
            ? "border-red-200/80 bg-red-50/40 shadow-sm"
            : "border-outline-variant/15 bg-surface-container-lowest hover:border-primary/25 hover:shadow-sm",
        editing && "ring-2 ring-primary/30"
      )}
    >
      <div className="flex items-start gap-3">
        {selectable ? (
          <input
            type="checkbox"
            checked={selected}
            onChange={(e) => onSelect?.(e.target.checked)}
            className="mt-1.5 h-4 w-4 shrink-0 accent-primary"
            aria-label={`Select ${task.title}`}
          />
        ) : (
          <button
            type="button"
            onClick={() => onToggle(!done)}
            disabled={busy}
            aria-label={done ? "Mark incomplete" : "Mark complete"}
            className={cn(
              "mt-0.5 flex h-6 w-6 shrink-0 items-center justify-center rounded-full border-2 transition-all",
              done
                ? "border-primary bg-primary text-on-primary"
                : "border-primary/40 hover:bg-primary/10",
              busy && "opacity-50"
            )}
          >
            {busy ? (
              <Loader2 className="h-3.5 w-3.5 animate-spin" />
            ) : done ? (
              <CheckCircle2 className="h-4 w-4" />
            ) : null}
          </button>
        )}

        <div className="min-w-0 flex-1">
          <p
            className={cn(
              "font-semibold text-[15px] leading-snug",
              done ? "text-on-surface-variant line-through" : "text-on-surface"
            )}
          >
            {task.title}
          </p>
          {task.description ? (
            <p className="text-sm text-on-surface-variant mt-1 line-clamp-2">{task.description}</p>
          ) : null}
          <div className="mt-2 flex flex-wrap items-center gap-2">
            <span className={cn("text-xs font-medium", overdue ? "text-red-700" : "text-on-surface-variant")}>
              {overdue ? "Overdue · " : ""}
              {formatTaskDate(task.due_date)}
            </span>
            {task.source !== "manual" ? <TaskSourceBadge source={task.source} /> : null}
            {task.status === "in_progress" ? (
              <span className="text-[10px] font-bold uppercase tracking-wide text-primary">In progress</span>
            ) : null}
          </div>
        </div>

        <div className="flex shrink-0 items-center gap-0.5">
          {!selectable ? (
            <Button type="button" variant="ghost" size="icon" className="h-8 w-8" onClick={onEdit} disabled={busy}>
              <Pencil className="h-4 w-4" />
            </Button>
          ) : null}
          <Button
            type="button"
            variant="ghost"
            size="icon"
            className="h-8 w-8 text-red-600 hover:bg-red-50 hover:text-red-700"
            onClick={onDelete}
            disabled={busy}
            aria-label="Delete task"
          >
            <Trash2 className="h-4 w-4" />
          </Button>
        </div>
      </div>

      {editing ? (
        <form onSubmit={onSaveEdit} className="mt-4 space-y-3 border-t border-outline-variant/20 pt-4">
          <Input value={editTitle} onChange={(e) => onEditTitle(e.target.value)} placeholder="Title" required />
          <Textarea
            value={editDescription}
            onChange={(e) => onEditDescription(e.target.value)}
            placeholder="Description (optional)"
            className="min-h-[72px] resize-none"
          />
          <Input type="date" value={editDueDate} onChange={(e) => onEditDueDate(e.target.value)} required />
          <div className="flex gap-2">
            <Button type="submit" size="sm" disabled={busy}>
              {busy ? "Saving…" : "Save"}
            </Button>
            <Button type="button" variant="ghost" size="sm" onClick={onCancelEdit}>
              Cancel
            </Button>
          </div>
        </form>
      ) : null}
    </div>
  );
}
