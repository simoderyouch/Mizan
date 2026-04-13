"use client";

import { FormEvent, useEffect, useMemo, useState } from "react";
import { CheckCircle2, Circle, Clock3, ListChecks, Pencil, Plus, Trash2 } from "lucide-react";
import { getApiErrorMessage, tasksApi } from "@/lib/api";
import type { Task } from "@/lib/types";
import { Card, CardContent } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Badge } from "@/components/ui/badge";

const toIsoToday = () => new Date().toISOString().slice(0, 10);
const isDone = (task: Task) => task.status === "done";
const isPending = (task: Task) => task.status === "pending" || task.status === "in_progress";

const formatTaskDate = (date: string) =>
  new Date(`${date}T00:00:00`).toLocaleDateString(undefined, {
    month: "short",
    day: "numeric",
  });

export default function TasksPage() {
  const [todayTasks, setTodayTasks] = useState<Task[]>([]);
  const [allTasks, setAllTasks] = useState<Task[]>([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState("");
  const [busyTaskId, setBusyTaskId] = useState<string | null>(null);
  const [creating, setCreating] = useState(false);
  const [manualTitle, setManualTitle] = useState("");
  const [manualDescription, setManualDescription] = useState("");
  const [manualDueDate, setManualDueDate] = useState(toIsoToday());
  const [editingTaskId, setEditingTaskId] = useState<string | null>(null);
  const [editTitle, setEditTitle] = useState("");
  const [editDescription, setEditDescription] = useState("");
  const [editDueDate, setEditDueDate] = useState("");

  const loadTasks = async (options?: { showLoader?: boolean }) => {
    const showLoader = options?.showLoader ?? true;
    try {
      if (showLoader) setLoading(true);
      setError("");
      const today = toIsoToday();
      const [todayRes, allRes] = await Promise.all([tasksApi.list({ due_date: today }), tasksApi.list()]);
      setTodayTasks(todayRes);
      setAllTasks(allRes);
    } catch (err) {
      setError(getApiErrorMessage(err, "Could not load your tasks."));
    } finally {
      if (showLoader) setLoading(false);
    }
  };

  useEffect(() => {
    void loadTasks();
  }, []);

  const today = toIsoToday();
  const unfinishedTasks = useMemo(() => allTasks.filter((task) => isPending(task) && task.due_date !== today), [allTasks, today]);
  const todayRemaining = useMemo(() => todayTasks.filter(isPending).length, [todayTasks]);
  const overdueCount = useMemo(() => unfinishedTasks.filter((task) => task.due_date < today).length, [unfinishedTasks, today]);

  const startEdit = (task: Task) => {
    setEditingTaskId(task.id);
    setEditTitle(task.title);
    setEditDescription(task.description ?? "");
    setEditDueDate(task.due_date);
  };

  const cancelEdit = () => {
    setEditingTaskId(null);
    setEditTitle("");
    setEditDescription("");
    setEditDueDate("");
  };

  const toggleTask = async (task: Task, checked: boolean) => {
    try {
      setBusyTaskId(task.id);
      await tasksApi.updateStatus(task.id, checked ? "done" : "pending");
      await loadTasks({ showLoader: false });
    } catch (err) {
      setError(getApiErrorMessage(err, "Could not update this task."));
    } finally {
      setBusyTaskId(null);
    }
  };

  const removeTask = async (taskId: string) => {
    try {
      setBusyTaskId(taskId);
      await tasksApi.remove(taskId);
      if (editingTaskId === taskId) cancelEdit();
      await loadTasks({ showLoader: false });
    } catch (err) {
      setError(getApiErrorMessage(err, "Could not delete this task."));
    } finally {
      setBusyTaskId(null);
    }
  };

  const saveEdit = async (e: FormEvent) => {
    e.preventDefault();
    if (!editingTaskId) return;
    try {
      setBusyTaskId(editingTaskId);
      await tasksApi.update(editingTaskId, {
        title: editTitle,
        description: editDescription,
        due_date: editDueDate,
      });
      cancelEdit();
      await loadTasks({ showLoader: false });
    } catch (err) {
      setError(getApiErrorMessage(err, "Could not update this task."));
    } finally {
      setBusyTaskId(null);
    }
  };

  const createManualTask = async (e: FormEvent) => {
    e.preventDefault();
    if (!manualTitle.trim()) return;
    try {
      setCreating(true);
      await tasksApi.create({
        title: manualTitle.trim(),
        description: manualDescription.trim() || undefined,
        due_date: manualDueDate || toIsoToday(),
        source: "manual",
      });
      setManualTitle("");
      setManualDescription("");
      setManualDueDate(toIsoToday());
      await loadTasks({ showLoader: false });
    } catch (err) {
      setError(getApiErrorMessage(err, "Could not create task."));
    } finally {
      setCreating(false);
    }
  };

  if (loading) return <div className="text-sm text-on-surface-variant">Loading tasks...</div>;

  const renderTaskItem = (task: Task) => {
    const overdue = isPending(task) && task.due_date < today;
    const editing = editingTaskId === task.id;
    const isTaskDone = isDone(task);

    return (
      <div
        key={task.id}
        className={`rounded-lg border p-4 transition-all duration-300 ${
          isTaskDone ? "bg-surface-container border-outline-variant" : "bg-surface border-primary/20 shadow-sm"
        } ${editing ? "ring-2 ring-primary" : ""}`}
      >
        <div className="flex items-start gap-4">
          <button
            onClick={() => void toggleTask(task, !isTaskDone)}
            disabled={busyTaskId === task.id}
            className={`mt-1 h-5 w-5 rounded-full flex-shrink-0 flex items-center justify-center border-2 transition-all ${
              isTaskDone ? "bg-primary border-primary" : "border-primary/50 hover:bg-primary/10"
            }`}
          >
            {isTaskDone && <CheckCircle2 className="h-4 w-4 text-on-primary" />}
          </button>
          <div className="min-w-0 flex-1">
            <p className={`font-medium transition-colors ${isTaskDone ? "text-on-surface-variant line-through" : "text-on-surface"}`}>{task.title}</p>
            {task.description && <p className="text-sm text-on-surface-variant mt-1 line-clamp-2">{task.description}</p>}
            <div className="mt-2 flex items-center gap-2">
              <Badge variant={overdue ? "destructive" : "secondary"} className="text-xs">
                <Clock3 className="h-3 w-3 mr-1" />
                {formatTaskDate(task.due_date)}
              </Badge>
              {task.source !== "manual" && (
                <Badge variant="outline" className="text-xs capitalize">
                  {task.source.replace("_", " ")}
                </Badge>
              )}
            </div>
          </div>
          <div className="flex items-center gap-1">
            <Button variant="ghost" size="icon" className="h-8 w-8" onClick={() => (editing ? cancelEdit() : startEdit(task))}>
              <Pencil className="h-4 w-4" />
            </Button>
            <Button variant="ghost" size="icon" className="h-8 w-8 text-red-500 hover:text-red-600" onClick={() => void removeTask(task.id)}>
              <Trash2 className="h-4 w-4" />
            </Button>
          </div>
        </div>

        {editing && (
          <form onSubmit={saveEdit} className="mt-4 space-y-3 pt-4 border-t border-outline-variant">
            <input
              value={editTitle}
              onChange={(e) => setEditTitle(e.target.value)}
              className="h-10 w-full px-3 rounded-md border border-outline-variant bg-surface-container text-sm"
              placeholder="Task title"
              required
            />
            <textarea
              value={editDescription}
              onChange={(e) => setEditDescription(e.target.value)}
              className="h-20 w-full p-3 rounded-md border border-outline-variant bg-surface-container text-sm resize-none"
              placeholder="Description (optional)"
            />
            <input
              type="date"
              value={editDueDate}
              onChange={(e) => setEditDueDate(e.target.value)}
              className="h-10 w-full px-3 rounded-md border border-outline-variant bg-surface-container text-sm"
              required
            />
            <div className="flex gap-2">
              <Button type="submit" size="sm" disabled={busyTaskId === task.id}>
                {busyTaskId === task.id ? "Saving..." : "Save Changes"}
              </Button>
              <Button type="button" variant="ghost" size="sm" onClick={cancelEdit}>
                Cancel
              </Button>
            </div>
          </form>
        )}
      </div>
    );
  };

  return (
    <div className="page-enter space-y-8 max-w-6xl mx-auto px-1">
      <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-4">
        <h1 className="text-2xl sm:text-3xl md:text-4xl font-bold">My Tasks</h1>
        <div className="flex items-center gap-3">
          <Badge variant="secondary" className="px-3 py-1 text-sm">
            {todayRemaining} remaining
          </Badge>
          {overdueCount > 0 && (
            <Badge variant="destructive" className="px-3 py-1 text-sm">
               {overdueCount} overdue
            </Badge>
          )}
        </div>
      </div>

      {error && (
        <div className="bg-red-100/50 dark:bg-red-900/20 rounded-2xl p-4 shadow-sm border border-red-200/60 dark:border-red-500/30 flex items-center justify-between gap-3">
          <p className="text-sm text-red-800 dark:text-red-200">{error}</p>
          <Button variant="ghost" size="sm" onClick={() => void loadTasks()}>
              Retry
          </Button>
        </div>
      )}

      <div className="grid grid-cols-1 lg:grid-cols-3 gap-8">
        <div className="lg:col-span-1 space-y-6">
          <div className="p-6 bg-surface-container/40 rounded-2xl border border-outline-variant">
            <h2 className="font-bold text-lg flex items-center mb-4">
              <Plus className="h-5 w-5 mr-2 text-primary" />
              Add task
            </h2>
            <form onSubmit={createManualTask} className="space-y-3">
              <input
                value={manualTitle}
                onChange={(e) => setManualTitle(e.target.value)}
                className="h-10 w-full px-3 rounded-md border border-outline-variant bg-surface text-sm"
                placeholder="Task title"
                required
              />
              <textarea
                value={manualDescription}
                onChange={(e) => setManualDescription(e.target.value)}
                className="h-20 w-full p-3 rounded-md border border-outline-variant bg-surface text-sm resize-none"
                placeholder="Description (optional)"
              />
              <input
                type="date"
                value={manualDueDate}
                onChange={(e) => setManualDueDate(e.target.value)}
                className="h-10 w-full px-3 rounded-md border border-outline-variant bg-surface text-sm"
                required
              />
              <Button type="submit" disabled={creating} className="w-full">
                {creating ? "Adding..." : "Add task"}
              </Button>
            </form>
          </div>
        </div>

        <div className="lg:col-span-2 space-y-8">
          <div>
            <h2 className="font-bold text-lg flex items-center mb-4">
              <ListChecks className="h-5 w-5 mr-2 text-primary" />
              Today&apos;s tasks
            </h2>
            {todayTasks.length === 0 ? (
               <p className="text-sm text-on-surface-variant p-4 bg-surface-container rounded-2xl border border-dashed">No tasks for today.</p>
            ) : (
              <div className="space-y-4">{todayTasks.map(renderTaskItem)}</div>
            )}
          </div>

          <div>
            <h2 className="font-bold text-lg flex items-center mb-4">
              <Clock3 className="h-5 w-5 mr-2 text-primary" />
              Incomplete tasks
            </h2>
            {unfinishedTasks.length === 0 ? (
               <p className="text-sm text-on-surface-variant p-4 bg-surface-container rounded-2xl border border-dashed">All tasks are up to date!</p>
            ) : (
              <div className="space-y-4">{unfinishedTasks.map(renderTaskItem)}</div>
            )}
          </div>
        </div>
      </div>
    </div>
  );
}
