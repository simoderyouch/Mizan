"use client";

import { FormEvent, useEffect, useMemo, useState } from "react";
import Link from "next/link";
import {
  AlertCircle,
  CalendarCheck,
  CheckCheck,
  ListChecks,
  Plus,
  Search,
  Sparkles,
  Trash2,
  X,
  AlertTriangle,
} from "lucide-react";

import { CommitmentsStrip } from "@/components/agent/commitments-strip";
import { TaskRow } from "@/components/tasks/task-row";
import { pinCommitment } from "@/lib/agent-commitments";
import { agentApi, getApiErrorMessage, tasksApi } from "@/lib/api";
import {
  filterTasks,
  groupTasks,
  isAiTask,
  isDueToday,
  isTaskDone,
  isTaskPending,
  toIsoToday,
  type TaskFilter,
} from "@/lib/task-utils";
import type { AgentActionContract, Task } from "@/lib/types";
import {
  AlertDialog,
  AlertDialogAction,
  AlertDialogCancel,
  AlertDialogContent,
  AlertDialogDescription,
  AlertDialogFooter,
  AlertDialogHeader,
  AlertDialogTitle,
} from "@/components/ui/alert-dialog";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import { Card, CardContent } from "@/components/ui/card";
import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogHeader,
  DialogTitle,
} from "@/components/ui/dialog";
import { Input } from "@/components/ui/input";
import { Skeleton } from "@/components/ui/skeleton";
import { Tabs, TabsContent, TabsList, TabsTrigger } from "@/components/ui/tabs";
import { Textarea } from "@/components/ui/textarea";
import { useToast } from "@/components/ui/use-toast";
import { cn } from "@/lib/utils";

const FILTERS: { id: TaskFilter; label: string }[] = [
  { id: "focus", label: "Focus" },
  { id: "today", label: "Today" },
  { id: "overdue", label: "Overdue" },
  { id: "upcoming", label: "Upcoming" },
  { id: "done", label: "Done" },
  { id: "all", label: "All" },
];

type SourceFilter = "all" | "manual" | "ai";

type DeleteConfirm =
  | { kind: "one"; task: Task }
  | { kind: "many"; tasks: Task[]; label: string }
  | null;

export default function TasksPage() {
  const { toast } = useToast();
  const [tasks, setTasks] = useState<Task[]>([]);
  const [contracts, setContracts] = useState<AgentActionContract[]>([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState("");
  const [filter, setFilter] = useState<TaskFilter>("focus");
  const [sourceFilter, setSourceFilter] = useState<SourceFilter>("all");
  const [query, setQuery] = useState("");
  const [busyTaskId, setBusyTaskId] = useState<string | null>(null);
  const [bulkBusy, setBulkBusy] = useState(false);
  const [selectMode, setSelectMode] = useState(false);
  const [selectedIds, setSelectedIds] = useState<Set<string>>(new Set());
  const [deleteConfirm, setDeleteConfirm] = useState<DeleteConfirm>(null);
  const [addOpen, setAddOpen] = useState(false);
  const [creating, setCreating] = useState(false);
  const [manualTitle, setManualTitle] = useState("");
  const [manualDescription, setManualDescription] = useState("");
  const [manualDueDate, setManualDueDate] = useState(toIsoToday());
  const [editingTaskId, setEditingTaskId] = useState<string | null>(null);
  const [editTitle, setEditTitle] = useState("");
  const [editDescription, setEditDescription] = useState("");
  const [editDueDate, setEditDueDate] = useState("");
  const [highlightTaskId, setHighlightTaskId] = useState<string | null>(null);
  const [contractBusyId, setContractBusyId] = useState<string | null>(null);

  const today = toIsoToday();

  const loadTasks = async (showLoader = true) => {
    try {
      if (showLoader) setLoading(true);
      setError("");
      const [allRes, contractsRes] = await Promise.all([
        tasksApi.list(),
        agentApi.listContracts({ limit: 12 }).catch(() => [] as AgentActionContract[]),
      ]);
      setTasks(allRes);
      setContracts(contractsRes);
    } catch (err) {
      setError(getApiErrorMessage(err, "Could not load your tasks."));
    } finally {
      if (showLoader) setLoading(false);
    }
  };

  useEffect(() => {
    void loadTasks();
  }, []);

  useEffect(() => {
    if (typeof window === "undefined") return;
    const id = new URLSearchParams(window.location.search).get("highlight");
    if (id) setHighlightTaskId(id);
  }, []);

  useEffect(() => {
    if (!highlightTaskId || loading) return;
    const el = document.getElementById(`task-${highlightTaskId}`);
    if (!el) return;
    el.scrollIntoView({ behavior: "smooth", block: "center" });
  }, [highlightTaskId, loading, tasks]);

  const sourceFilteredTasks = useMemo(() => {
    if (sourceFilter === "manual") return tasks.filter((t) => t.source === "manual");
    if (sourceFilter === "ai") return tasks.filter(isAiTask);
    return tasks;
  }, [tasks, sourceFilter]);

  const stats = useMemo(() => {
    const pending = tasks.filter(isTaskPending);
    const todayPending = pending.filter((t) => isDueToday(t, today));
    const overdue = pending.filter((t) => t.due_date < today);
    const doneCount = tasks.filter(isTaskDone).length;
    const aiOpen = tasks.filter((t) => isAiTask(t) && isTaskPending(t)).length;
    return { todayPending: todayPending.length, overdue: overdue.length, doneCount, aiOpen, total: tasks.length };
  }, [tasks, today]);

  const activeContracts = useMemo(
    () => contracts.filter((c) => c.status === "pending" || c.status === "accepted"),
    [contracts]
  );
  const pendingContracts = useMemo(
    () => contracts.filter((c) => c.status === "pending"),
    [contracts]
  );

  const acceptContract = async (contract: AgentActionContract) => {
    try {
      setContractBusyId(contract.id);
      await agentApi.respondContract(contract.id, true);
      pinCommitment({
        contractId: contract.id,
        taskId: contract.task_id,
        title: contract.task_title ?? contract.contract_text,
        pinnedAt: new Date().toISOString(),
      });
      toast({
        title: "Added to your focus",
        description: contract.task_title ?? "Commitment accepted.",
      });
      await loadTasks(false);
    } catch (err) {
      setError(getApiErrorMessage(err, "Could not accept this commitment."));
    } finally {
      setContractBusyId(null);
    }
  };

  const filtered = useMemo(
    () => filterTasks(sourceFilteredTasks, filter, query, today),
    [sourceFilteredTasks, filter, query, today]
  );
  const grouped = useMemo(() => groupTasks(filtered, today), [filtered, today]);

  const doneTasks = useMemo(() => tasks.filter(isTaskDone), [tasks]);

  const exitSelectMode = () => {
    setSelectMode(false);
    setSelectedIds(new Set());
  };

  const toggleSelected = (taskId: string, selected: boolean) => {
    setSelectedIds((prev) => {
      const next = new Set(prev);
      if (selected) next.add(taskId);
      else next.delete(taskId);
      return next;
    });
  };

  const selectAllVisible = () => {
    setSelectedIds(new Set(filtered.map((t) => t.id)));
  };

  const deleteTasksByIds = async (ids: string[]) => {
    if (!ids.length) return;
    setBulkBusy(true);
    setError("");
    try {
      await Promise.all(ids.map((id) => tasksApi.remove(id)));
      if (editingTaskId && ids.includes(editingTaskId)) cancelEdit();
      exitSelectMode();
      await loadTasks(false);
    } catch (err) {
      setError(getApiErrorMessage(err, "Could not delete task(s)."));
    } finally {
      setBulkBusy(false);
      setDeleteConfirm(null);
    }
  };

  const confirmDeleteOne = (task: Task) => {
    setDeleteConfirm({ kind: "one", task });
  };

  const confirmDeleteMany = (toDelete: Task[], label: string) => {
    if (!toDelete.length) return;
    setDeleteConfirm({ kind: "many", tasks: toDelete, label });
  };

  const executeDelete = async () => {
    if (!deleteConfirm) return;
    if (deleteConfirm.kind === "one") {
      await deleteTasksByIds([deleteConfirm.task.id]);
      return;
    }
    await deleteTasksByIds(deleteConfirm.tasks.map((t) => t.id));
  };

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
      await loadTasks(false);
    } catch (err) {
      setError(getApiErrorMessage(err, "Could not update this task."));
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
      await loadTasks(false);
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
        due_date: manualDueDate || today,
        source: "manual",
      });
      setManualTitle("");
      setManualDescription("");
      setManualDueDate(today);
      setAddOpen(false);
      await loadTasks(false);
    } catch (err) {
      setError(getApiErrorMessage(err, "Could not create task."));
    } finally {
      setCreating(false);
    }
  };

  const completeAllToday = async () => {
    const ids = tasks.filter((t) => isTaskPending(t) && isDueToday(t, today)).map((t) => t.id);
    if (!ids.length) return;
    try {
      setBulkBusy(true);
      await tasksApi.completeMany(ids);
      await loadTasks(false);
    } catch (err) {
      setError(getApiErrorMessage(err, "Could not complete today's tasks."));
    } finally {
      setBulkBusy(false);
    }
  };

  const renderTask = (task: Task) => (
    <div key={task.id} id={`task-${task.id}`}>
    <TaskRow
      task={task}
      highlighted={highlightTaskId === task.id}
      today={today}
      busy={busyTaskId === task.id || bulkBusy}
      editing={editingTaskId === task.id}
      selectable={selectMode}
      selected={selectedIds.has(task.id)}
      onSelect={(checked) => toggleSelected(task.id, checked)}
      editTitle={editTitle}
      editDescription={editDescription}
      editDueDate={editDueDate}
      onToggle={(checked) => void toggleTask(task, checked)}
      onEdit={() => (editingTaskId === task.id ? cancelEdit() : startEdit(task))}
      onCancelEdit={cancelEdit}
      onSaveEdit={saveEdit}
      onDelete={() => confirmDeleteOne(task)}
      onEditTitle={setEditTitle}
      onEditDescription={setEditDescription}
      onEditDueDate={setEditDueDate}
    />
    </div>
  );

  const renderSection = (title: string, items: Task[], accent?: "red" | "primary" | "muted") => {
    if (!items.length) return null;
    return (
      <section className="space-y-3">
        <h3
          className={cn(
            "text-xs font-bold uppercase tracking-wider flex items-center gap-2",
            accent === "red" && "text-red-700",
            accent === "primary" && "text-primary",
            accent === "muted" && "text-on-surface-variant"
          )}
        >
          {title}
          <Badge variant="secondary" className="text-[10px] px-1.5 py-0">
            {items.length}
          </Badge>
        </h3>
        <div className="space-y-2">{items.map(renderTask)}</div>
      </section>
    );
  };

  const showGrouped = filter === "focus" || filter === "all";
  if (loading) {
    return (
      <div className="page-enter space-y-6 max-w-5xl mx-auto">
        <Skeleton className="h-10 w-64" />
        <div className="grid grid-cols-2 sm:grid-cols-4 gap-3">
          {[1, 2, 3, 4].map((i) => (
            <Skeleton key={i} className="h-20 rounded-lg" />
          ))}
        </div>
        <Skeleton className="h-64 w-full rounded-lg" />
      </div>
    );
  }

  return (
    <div className="page-enter space-y-6 max-w-5xl mx-auto pb-8">
      <div className="flex flex-col sm:flex-row sm:items-end justify-between gap-4">
        <div>
          <div className="inline-flex items-center gap-2 rounded-full bg-primary/10 px-3 py-1 text-xs font-semibold text-primary mb-2">
            <ListChecks className="h-3.5 w-3.5" />
            Task manager
          </div>
          <h1 className="text-2xl sm:text-3xl md:text-4xl font-bold">Your tasks</h1>
          <p className="text-sm text-on-surface-variant mt-1">
            One place for manual and AI-generated tasks — add, complete, or delete anytime.
          </p>
          {pendingContracts.length > 0 ? (
            <Link
              href="/agent/contracts"
              className="inline-flex items-center gap-1.5 mt-2 text-xs font-semibold text-violet-800 hover:underline"
            >
              {pendingContracts.length} AI commitment{pendingContracts.length === 1 ? "" : "s"} waiting →
            </Link>
          ) : null}
        </div>
        <Button className="gradient-primary text-on-primary shrink-0" onClick={() => setAddOpen(true)}>
          <Plus className="h-4 w-4 mr-2" />
          New task
        </Button>
      </div>

      {error ? (
        <Card className="!rounded-lg">
          <CardContent className="!p-4 flex flex-wrap items-center justify-between gap-3">
            <p className="text-sm text-red-600">{error}</p>
            <Button variant="secondary" size="sm" onClick={() => void loadTasks()}>
              Retry
            </Button>
          </CardContent>
        </Card>
      ) : null}

      <div className="grid grid-cols-2 lg:grid-cols-4 gap-3">
        <StatCard label="Total" value={stats.total} icon={ListChecks} />
        <StatCard label="Due today" value={stats.todayPending} icon={CalendarCheck} />
        <StatCard
          label="Overdue"
          value={stats.overdue}
          icon={AlertCircle}
          highlight={stats.overdue > 0 ? "destructive" : undefined}
        />
        <StatCard label="From AI" value={stats.aiOpen} icon={Sparkles} highlight="primary" />
      </div>

      <CommitmentsStrip
        contracts={contracts}
        busyId={contractBusyId}
        onAccept={(c) => void acceptContract(c)}
      />

      {/* Deletion toolbar */}
      <div className="flex flex-col gap-3 rounded-lg border border-outline-variant/20 bg-surface-container/40 p-3 sm:p-4">
        <div className="flex flex-wrap items-center gap-2">
          {!selectMode ? (
            <>
              <Button
                variant="secondary"
                size="sm"
                onClick={() => {
                  setSelectMode(true);
                  setSelectedIds(new Set());
                }}
              >
                <Trash2 className="h-3.5 w-3.5 mr-1.5" />
                Select to delete
              </Button>
              {doneTasks.length > 0 ? (
                <Button
                  variant="ghost"
                  size="sm"
                  className="text-red-600 hover:text-red-700 hover:bg-red-50"
                  disabled={bulkBusy}
                  onClick={() => confirmDeleteMany(doneTasks, `all ${doneTasks.length} completed tasks`)}
                >
                  Clear completed ({doneTasks.length})
                </Button>
              ) : null}
            </>
          ) : (
            <>
              <Button variant="secondary" size="sm" onClick={selectAllVisible} disabled={!filtered.length}>
                Select all visible
              </Button>
              <Button
                variant="destructive"
                size="sm"
                disabled={bulkBusy || selectedIds.size === 0}
                onClick={() =>
                  confirmDeleteMany(
                    tasks.filter((t) => selectedIds.has(t.id)),
                    `${selectedIds.size} selected task${selectedIds.size === 1 ? "" : "s"}`
                  )
                }
              >
                <Trash2 className="h-3.5 w-3.5 mr-1.5" />
                Delete selected ({selectedIds.size})
              </Button>
              <Button variant="ghost" size="sm" onClick={exitSelectMode}>
                <X className="h-3.5 w-3.5 mr-1" />
                Cancel
              </Button>
            </>
          )}
        </div>
        <div className="flex flex-col sm:flex-row gap-2">
          <div className="relative flex-1">
            <Search className="absolute left-3 top-1/2 -translate-y-1/2 h-4 w-4 text-on-surface-variant" />
            <Input
              value={query}
              onChange={(e) => setQuery(e.target.value)}
              placeholder="Search tasks…"
              className="pl-10"
            />
          </div>
          {stats.todayPending > 0 && !selectMode ? (
            <Button variant="secondary" className="shrink-0" disabled={bulkBusy} onClick={() => void completeAllToday()}>
              {bulkBusy ? "Working…" : `Complete today (${stats.todayPending})`}
            </Button>
          ) : null}
        </div>
        <div className="flex gap-1.5 overflow-x-auto pb-0.5">
          {(
            [
              { id: "all" as const, label: "All sources" },
              { id: "manual" as const, label: "Manual" },
              { id: "ai" as const, label: "AI-generated" },
            ] as const
          ).map((chip) => (
            <button
              key={chip.id}
              type="button"
              onClick={() => setSourceFilter(chip.id)}
              className={cn(
                "shrink-0 rounded-md px-3 py-1 text-xs font-semibold border transition-colors",
                sourceFilter === chip.id
                  ? "bg-primary text-on-primary border-primary"
                  : "bg-surface border-outline-variant/20 text-on-surface-variant"
              )}
            >
              {chip.label}
            </button>
          ))}
        </div>
      </div>

      <Tabs value={filter} onValueChange={(v) => setFilter(v as TaskFilter)}>
        <TabsList className="w-full flex flex-wrap h-auto gap-1 p-1">
          {FILTERS.map((f) => (
            <TabsTrigger key={f.id} value={f.id} className="flex-1 min-w-[4.5rem]">
              {f.label}
            </TabsTrigger>
          ))}
        </TabsList>

        {FILTERS.map((f) => (
          <TabsContent key={f.id} value={f.id} className="mt-5">
            {filtered.length === 0 ? (
              <EmptyState filter={f.id} onAdd={() => setAddOpen(true)} />
            ) : showGrouped && f.id !== "done" ? (
              <div className="space-y-8">
                {renderSection("Overdue", grouped.overdue, "red")}
                {renderSection("Today", grouped.today, "primary")}
                {renderSection("Upcoming", grouped.upcoming, "muted")}
                {f.id === "all" ? (
                  <section className="space-y-3">
                    <div className="flex items-center justify-between gap-2">
                      <h3 className="text-xs font-bold uppercase tracking-wider text-on-surface-variant flex items-center gap-2">
                        Completed
                        <Badge variant="secondary" className="text-[10px] px-1.5 py-0">
                          {grouped.done.length}
                        </Badge>
                      </h3>
                      {grouped.done.length > 0 ? (
                        <Button
                          variant="ghost"
                          size="sm"
                          className="text-red-600 hover:bg-red-50 h-7 text-xs"
                          onClick={() => confirmDeleteMany(grouped.done, `all ${grouped.done.length} completed tasks in view`)}
                        >
                          Delete all shown
                        </Button>
                      ) : null}
                    </div>
                    <div className="space-y-2">{grouped.done.slice(0, 20).map(renderTask)}</div>
                  </section>
                ) : null}
              </div>
            ) : (
              <div className="space-y-2">
                {f.id === "done" && filtered.length > 0 ? (
                  <div className="flex justify-end mb-2">
                    <Button
                      variant="ghost"
                      size="sm"
                      className="text-red-600 hover:bg-red-50"
                      onClick={() => confirmDeleteMany(filtered, `all ${filtered.length} completed tasks`)}
                    >
                      Delete all in Done ({filtered.length})
                    </Button>
                  </div>
                ) : null}
                {filtered.map(renderTask)}
              </div>
            )}
          </TabsContent>
        ))}
      </Tabs>

      <Dialog open={addOpen} onOpenChange={setAddOpen}>
        <DialogContent className="max-w-md rounded-lg">
          <DialogHeader>
            <DialogTitle>Add a task</DialogTitle>
            <DialogDescription className="sr-only">
              Create a manual task with title, optional notes, and due date.
            </DialogDescription>
          </DialogHeader>
          <form onSubmit={createManualTask} className="space-y-3 pt-2">
            <Input
              value={manualTitle}
              onChange={(e) => setManualTitle(e.target.value)}
              placeholder="What needs to get done?"
              required
              autoFocus
            />
            <Textarea
              value={manualDescription}
              onChange={(e) => setManualDescription(e.target.value)}
              placeholder="Notes (optional)"
              className="min-h-[80px] resize-none"
            />
            <Input type="date" value={manualDueDate} onChange={(e) => setManualDueDate(e.target.value)} required />
            <Button type="submit" className="w-full" disabled={creating}>
              {creating ? "Adding…" : "Add task"}
            </Button>
          </form>
        </DialogContent>
      </Dialog>

      <AlertDialog open={!!deleteConfirm} onOpenChange={(open) => !open && setDeleteConfirm(null)}>
        <AlertDialogContent>
          <AlertDialogHeader className="text-left space-y-0">
            <div className="flex items-start gap-3">
              <div
                className="flex h-11 w-11 shrink-0 items-center justify-center rounded-xl bg-red-50 text-red-600"
                aria-hidden
              >
                <Trash2 className="h-5 w-5" />
              </div>
              <div className="min-w-0 pt-0.5">
                <AlertDialogTitle className="text-lg font-bold text-on-surface">
                  {deleteConfirm?.kind === "many"
                    ? `Delete ${deleteConfirm.tasks.length} tasks?`
                    : "Delete this task?"}
                </AlertDialogTitle>
                <AlertDialogDescription className="mt-1 text-on-surface-variant">
                  This action is permanent and cannot be undone.
                </AlertDialogDescription>
              </div>
            </div>
          </AlertDialogHeader>

          {deleteConfirm?.kind === "one" ? (
            <div className="rounded-lg border border-outline-variant/15 bg-surface-container/40 px-3 py-2.5">
              <p className="text-sm font-semibold text-on-surface leading-snug line-clamp-2">
                {deleteConfirm.task.title}
              </p>
              {deleteConfirm.task.description ? (
                <p className="text-xs text-on-surface-variant mt-1 line-clamp-2">{deleteConfirm.task.description}</p>
              ) : null}
            </div>
          ) : deleteConfirm?.kind === "many" ? (
            <div className="rounded-lg border border-amber-200/60 bg-amber-50/50 px-3 py-2.5 flex gap-2.5">
              <AlertTriangle className="h-4 w-4 text-amber-700 shrink-0 mt-0.5" aria-hidden />
              <p className="text-sm text-amber-950/90">
                You are about to delete{" "}
                <span className="font-semibold">{deleteConfirm.label}</span>.
              </p>
            </div>
          ) : null}

          <AlertDialogFooter className="mt-2 gap-2 sm:gap-2">
            <AlertDialogCancel
              disabled={bulkBusy}
              className="rounded-lg border border-outline-variant/15 bg-surface-container hover:bg-surface-container-high"
            >
              Cancel
            </AlertDialogCancel>
            <AlertDialogAction
              disabled={bulkBusy}
              className="rounded-lg bg-red-600 text-white hover:bg-red-700 shadow-sm"
              onClick={(e) => {
                e.preventDefault();
                void executeDelete();
              }}
            >
              {bulkBusy ? "Deleting…" : deleteConfirm?.kind === "many" ? "Delete all" : "Delete task"}
            </AlertDialogAction>
          </AlertDialogFooter>
        </AlertDialogContent>
      </AlertDialog>
    </div>
  );
}

function StatCard({
  label,
  value,
  icon: Icon,
  highlight,
}: {
  label: string;
  value: number;
  icon: typeof ListChecks;
  highlight?: "destructive" | "primary";
}) {
  return (
    <div
      className={cn(
        "sanctuary-card-subtle !p-4 !rounded-lg flex flex-col",
        highlight === "destructive" && value > 0 && "border-red-200/80 bg-red-50/50",
        highlight === "primary" && value > 0 && "border-primary/20 bg-primary/5"
      )}
    >
      <Icon
        className={cn(
          "h-4 w-4 mb-2",
          highlight === "destructive" && value > 0 ? "text-red-600" : "text-primary"
        )}
      />
      <p className="label-sanctuary">{label}</p>
      <p className="text-2xl font-bold mt-0.5">{value}</p>
    </div>
  );
}

function EmptyState({ filter, onAdd }: { filter: TaskFilter; onAdd: () => void }) {
  const messages: Record<TaskFilter, string> = {
    focus: "You're clear for the week. Add a task or complete items from Mizan AI.",
    today: "Nothing scheduled for today.",
    overdue: "No overdue tasks — nice work.",
    upcoming: "No upcoming tasks on the horizon.",
    done: "Completed tasks will show up here.",
    all: "No tasks yet. Add one manually or from Mizan AI chat and check-in.",
  };

  return (
    <div className="rounded-lg border border-dashed border-outline-variant/40 bg-surface-container/40 px-6 py-12 text-center">
      <ListChecks className="h-10 w-10 text-primary/40 mx-auto mb-3" />
      <p className="text-sm text-on-surface-variant max-w-sm mx-auto">{messages[filter]}</p>
      {filter !== "done" && filter !== "overdue" ? (
        <Button variant="secondary" size="sm" className="mt-4" onClick={onAdd}>
          <Plus className="h-4 w-4 mr-1" />
          Add task
        </Button>
      ) : null}
    </div>
  );
}
