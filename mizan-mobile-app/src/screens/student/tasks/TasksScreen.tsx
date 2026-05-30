import React, { useMemo, useState } from "react";
import {
  Modal,
  Pressable,
  Text,
  TextInput,
  View,
} from "react-native";
import { useNavigation } from "@react-navigation/native";
import {
  CheckCircle2,
  Circle,
  Pencil,
  Plus,
  Search,
  Trash2,
  X,
} from "lucide-react-native";
import { Screen } from "../../../components/screen";
import {
  Badge,
  Button,
  EmptyState,
  ErrorBanner,
  Field,
  LoadingState,
  styles as uiStyles,
} from "../../../components/ui";
import { agentApi, getApiErrorMessage, tasksApi } from "../../../lib/api";
import { pinCommitment } from "../../../lib/agent-commitments";
import type { AgentActionContract, Task } from "../../../lib/types";
import {
  filterBySource,
  filterTasks,
  getSourceMeta,
  isTaskDone,
  taskStats,
  toIsoToday,
  type SourceFilter,
  type TaskFilter,
} from "../../../lib/task-utils";
import { colors, radius, spacing } from "../../../theme";
import { dateLabel } from "../utils";
import { useLoader } from "../hooks/useLoader";
import { CommitmentsStrip } from "../components/CommitmentsStrip";
import type { MainStackParamList } from "../../../navigation/types";
import type { NativeStackNavigationProp } from "@react-navigation/native-stack";

const FILTERS: { id: TaskFilter; label: string }[] = [
  { id: "focus", label: "Focus" },
  { id: "today", label: "Today" },
  { id: "overdue", label: "Overdue" },
  { id: "upcoming", label: "Upcoming" },
  { id: "done", label: "Done" },
  { id: "all", label: "All" },
];

export function TasksScreen() {
  const navigation = useNavigation<NativeStackNavigationProp<MainStackParamList>>();
  const [filter, setFilter] = useState<TaskFilter>("focus");
  const [sourceFilter, setSourceFilter] = useState<SourceFilter>("all");
  const [query, setQuery] = useState("");
  const [showCreate, setShowCreate] = useState(false);
  const [selectMode, setSelectMode] = useState(false);
  const [selectedIds, setSelectedIds] = useState<Set<string>>(new Set());
  const [creating, setCreating] = useState(false);
  const [busyTaskId, setBusyTaskId] = useState<string | null>(null);
  const [busyContractId, setBusyContractId] = useState<string | null>(null);
  const [title, setTitle] = useState("");
  const [description, setDescription] = useState("");
  const [dueDate, setDueDate] = useState(toIsoToday());
  const [editingTaskId, setEditingTaskId] = useState<string | null>(null);
  const [editTitle, setEditTitle] = useState("");
  const [editDescription, setEditDescription] = useState("");
  const [editDueDate, setEditDueDate] = useState("");

  const loader = useLoader<Task[]>(() => tasksApi.list());
  const contractsLoader = useLoader<AgentActionContract[]>(() =>
    agentApi.listContracts({ limit: 20 })
  );

  const today = toIsoToday();
  const tasks = loader.data ?? [];
  const stats = useMemo(() => taskStats(tasks, today), [tasks, today]);

  const visibleTasks = useMemo(() => {
    const bySource = filterBySource(tasks, sourceFilter);
    return filterTasks(bySource, filter, query, today);
  }, [tasks, sourceFilter, filter, query, today]);

  const todayPendingIds = useMemo(
    () => tasks.filter((t) => t.due_date === today && !isTaskDone(t)).map((t) => t.id),
    [tasks, today]
  );

  const toggleSelect = (taskId: string) => {
    setSelectedIds((prev) => {
      const next = new Set(prev);
      if (next.has(taskId)) next.delete(taskId);
      else next.add(taskId);
      return next;
    });
  };

  const create = async () => {
    if (!title.trim()) return;
    setCreating(true);
    try {
      await tasksApi.create({
        title: title.trim(),
        description: description.trim() || undefined,
        due_date: dueDate,
        source: "manual",
      });
      setTitle("");
      setDescription("");
      setDueDate(toIsoToday());
      setShowCreate(false);
      await loader.load();
    } catch (err) {
      loader.setError(getApiErrorMessage(err, "Could not create task."));
    } finally {
      setCreating(false);
    }
  };

  const toggle = async (task: Task) => {
    if (selectMode) {
      toggleSelect(task.id);
      return;
    }
    setBusyTaskId(task.id);
    try {
      await tasksApi.updateStatus(task.id, isTaskDone(task) ? "pending" : "done");
      await loader.load();
    } catch (err) {
      loader.setError(getApiErrorMessage(err, "Could not update this task."));
    } finally {
      setBusyTaskId(null);
    }
  };

  const remove = async (taskId: string) => {
    setBusyTaskId(taskId);
    try {
      await tasksApi.remove(taskId);
      if (editingTaskId === taskId) setEditingTaskId(null);
      await loader.load();
    } catch (err) {
      loader.setError(getApiErrorMessage(err, "Could not delete this task."));
    } finally {
      setBusyTaskId(null);
    }
  };

  const bulkDelete = async () => {
    const ids = [...selectedIds];
    if (!ids.length) return;
    setBusyTaskId("bulk");
    try {
      await Promise.all(ids.map((id) => tasksApi.remove(id)));
      setSelectedIds(new Set());
      setSelectMode(false);
      await loader.load();
    } catch (err) {
      loader.setError(getApiErrorMessage(err, "Could not delete selected tasks."));
    } finally {
      setBusyTaskId(null);
    }
  };

  const bulkCompleteToday = async () => {
    if (!todayPendingIds.length) return;
    setBusyTaskId("bulk");
    try {
      await tasksApi.completeMany(todayPendingIds);
      await loader.load();
    } catch (err) {
      loader.setError(getApiErrorMessage(err, "Could not complete today's tasks."));
    } finally {
      setBusyTaskId(null);
    }
  };

  const acceptContract = async (contract: AgentActionContract) => {
    setBusyContractId(contract.id);
    try {
      const updated = await agentApi.respondContract(contract.id, true);
      await pinCommitment({
        contractId: updated.id,
        taskId: updated.task_id,
        title: updated.contract_text,
        pinnedAt: new Date().toISOString(),
      });
      await contractsLoader.load();
    } catch (err) {
      loader.setError(getApiErrorMessage(err, "Could not accept commitment."));
    } finally {
      setBusyContractId(null);
    }
  };

  const saveEdit = async () => {
    if (!editingTaskId || !editTitle.trim()) return;
    setBusyTaskId(editingTaskId);
    try {
      await tasksApi.update(editingTaskId, {
        title: editTitle.trim(),
        description: editDescription.trim() || undefined,
        due_date: editDueDate,
      });
      setEditingTaskId(null);
      await loader.load();
    } catch (err) {
      loader.setError(getApiErrorMessage(err, "Could not update this task."));
    } finally {
      setBusyTaskId(null);
    }
  };

  const renderTask = (task: Task) => {
    const editing = editingTaskId === task.id;
    const selected = selectedIds.has(task.id);
    const meta = getSourceMeta(task.source);
    const done = isTaskDone(task);

    if (editing) {
      return (
        <View key={task.id} style={taskStyles.editCard}>
          <Field label="Title" value={editTitle} onChangeText={setEditTitle} />
          <Field label="Description" value={editDescription} onChangeText={setEditDescription} />
          <Field label="Due date" value={editDueDate} onChangeText={setEditDueDate} />
          <View style={{ flexDirection: "row", gap: spacing.sm }}>
            <Button variant="ghost" onPress={() => setEditingTaskId(null)} style={{ flex: 1 }}>
              Cancel
            </Button>
            <Button loading={busyTaskId === task.id} onPress={saveEdit} style={{ flex: 1 }}>
              Save
            </Button>
          </View>
        </View>
      );
    }

    return (
      <Pressable
        key={task.id}
        onPress={() => toggle(task)}
        style={({ pressed }) => [
          taskStyles.row,
          selected && taskStyles.rowSelected,
          pressed && { opacity: 0.92 },
        ]}
      >
        <View style={taskStyles.check}>
          {selectMode ? (
            selected ? (
              <CheckCircle2 color={colors.primary} size={22} />
            ) : (
              <Circle color={colors.muted} size={22} />
            )
          ) : done ? (
            <CheckCircle2 color={colors.success} size={22} />
          ) : (
            <Circle color={colors.primary} size={22} />
          )}
        </View>
        <View style={{ flex: 1 }}>
          <Text style={[taskStyles.title, done && taskStyles.titleDone]} numberOfLines={2}>
            {task.title}
          </Text>
          {task.description ? (
            <Text style={uiStyles.muted} numberOfLines={1}>
              {task.description}
            </Text>
          ) : null}
          <View style={taskStyles.meta}>
            <Badge tone={task.due_date < today && !done ? "danger" : "neutral"}>{dateLabel(task.due_date)}</Badge>
            <Badge tone={meta.tone === "ai" ? "primary" : "neutral"}>{meta.label}</Badge>
          </View>
        </View>
        {!selectMode ? (
          <View style={taskStyles.actions}>
            <Pressable
              disabled={busyTaskId === task.id}
              onPress={() => {
                setEditingTaskId(task.id);
                setEditTitle(task.title);
                setEditDescription(task.description ?? "");
                setEditDueDate(task.due_date);
              }}
              hitSlop={8}
            >
              <Pencil color={colors.muted} size={17} />
            </Pressable>
            <Pressable disabled={busyTaskId === task.id} onPress={() => remove(task.id)} hitSlop={8}>
              <Trash2 color={colors.danger} size={17} />
            </Pressable>
          </View>
        ) : null}
      </Pressable>
    );
  };

  if (loader.loading && !loader.data) {
    return (
      <Screen variant="tab">
        <LoadingState label="Loading tasks..." />
      </Screen>
    );
  }

  return (
    <Screen variant="tab" refreshing={loader.loading} onRefresh={() => { void loader.load(); void contractsLoader.load(); }}>
      <View style={taskStyles.topRow}>
        <View style={{ flex: 1 }}>
          <Text style={taskStyles.stats}>
            {stats.todayPending} today · {stats.overdue} overdue · {stats.aiOpen} AI
          </Text>
        </View>
        <Pressable onPress={() => setSelectMode((v) => !v)} style={taskStyles.topBtn}>
          <Text style={taskStyles.topBtnText}>{selectMode ? "Done" : "Select"}</Text>
        </Pressable>
        <Pressable onPress={() => setShowCreate(true)} style={[taskStyles.topBtn, taskStyles.addBtn]}>
          <Plus color={colors.onPrimary} size={18} />
        </Pressable>
      </View>

      <ErrorBanner message={loader.error} onRetry={loader.load} />

      <CommitmentsStrip
        contracts={contractsLoader.data ?? []}
        busyId={busyContractId}
        onAccept={acceptContract}
        onOpen={() => navigation.navigate("AgentContracts")}
      />

      <View style={taskStyles.searchWrap}>
        <Search color={colors.muted} size={18} />
        <TextInput
          value={query}
          onChangeText={setQuery}
          placeholder="Search tasks..."
          placeholderTextColor="rgba(66,71,81,0.5)"
          style={taskStyles.searchInput}
        />
      </View>

      <View style={taskStyles.filters}>
        {FILTERS.map((item) => (
          <Pressable
            key={item.id}
            onPress={() => setFilter(item.id)}
            style={[taskStyles.filterChip, filter === item.id && taskStyles.filterChipActive]}
          >
            <Text style={[taskStyles.filterText, filter === item.id && taskStyles.filterTextActive]}>
              {item.label}
            </Text>
          </Pressable>
        ))}
      </View>

      <View style={taskStyles.sourceRow}>
        {(["all", "manual", "ai"] as SourceFilter[]).map((id) => (
          <Pressable
            key={id}
            onPress={() => setSourceFilter(id)}
            style={[taskStyles.sourceChip, sourceFilter === id && taskStyles.sourceChipActive]}
          >
            <Text style={[taskStyles.sourceText, sourceFilter === id && taskStyles.sourceTextActive]}>
              {id === "all" ? "All sources" : id === "ai" ? "AI" : "Manual"}
            </Text>
          </Pressable>
        ))}
      </View>

      {todayPendingIds.length > 0 && !selectMode ? (
        <Pressable onPress={bulkCompleteToday} style={taskStyles.bulkAction}>
          <Text style={taskStyles.bulkActionText}>Complete all today ({todayPendingIds.length})</Text>
        </Pressable>
      ) : null}

      {selectMode && selectedIds.size > 0 ? (
        <Pressable onPress={bulkDelete} style={[taskStyles.bulkAction, taskStyles.bulkDanger]}>
          <Text style={[taskStyles.bulkActionText, { color: colors.danger }]}>
            Delete selected ({selectedIds.size})
          </Text>
        </Pressable>
      ) : null}

      <View style={taskStyles.list}>
        {visibleTasks.length ? visibleTasks.map(renderTask) : (
          <EmptyState title="No tasks" subtitle="Try another filter or add a task." />
        )}
      </View>

      <Modal visible={showCreate} animationType="slide" transparent onRequestClose={() => setShowCreate(false)}>
        <View style={{ flex: 1, backgroundColor: "rgba(0,0,0,0.4)", justifyContent: "flex-end" }}>
          <View style={taskStyles.modal}>
            <View style={{ flexDirection: "row", justifyContent: "space-between", alignItems: "center" }}>
              <Text style={uiStyles.h2}>New task</Text>
              <Pressable onPress={() => setShowCreate(false)}>
                <X color={colors.muted} size={22} />
              </Pressable>
            </View>
            <Field label="Title" value={title} onChangeText={setTitle} placeholder="Review chapter 3" />
            <Field label="Description" value={description} onChangeText={setDescription} placeholder="Optional" />
            <Field label="Due date" value={dueDate} onChangeText={setDueDate} placeholder="YYYY-MM-DD" />
            <Button loading={creating} disabled={!title.trim()} onPress={create}>
              Add task
            </Button>
          </View>
        </View>
      </Modal>
    </Screen>
  );
}

const taskStyles = {
  topRow: {
    alignItems: "center" as const,
    flexDirection: "row" as const,
    gap: spacing.sm,
    marginBottom: spacing.md,
  },
  stats: {
    color: colors.muted,
    fontSize: 13,
    fontWeight: "600" as const,
  },
  topBtn: {
    backgroundColor: colors.surfaceLow,
    borderRadius: radius.md,
    paddingHorizontal: spacing.sm,
    paddingVertical: spacing.sm,
  },
  topBtnText: {
    color: colors.primary,
    fontSize: 13,
    fontWeight: "700" as const,
  },
  addBtn: {
    alignItems: "center" as const,
    backgroundColor: colors.primary,
    justifyContent: "center" as const,
    paddingHorizontal: spacing.sm + 2,
  },
  searchWrap: {
    alignItems: "center" as const,
    backgroundColor: colors.surface,
    borderColor: "rgba(194,198,211,0.35)",
    borderRadius: radius.lg,
    borderWidth: 1,
    flexDirection: "row" as const,
    gap: spacing.sm,
    marginBottom: spacing.md,
    paddingHorizontal: spacing.md,
    paddingVertical: spacing.sm,
  },
  searchInput: {
    color: colors.text,
    flex: 1,
    fontSize: 15,
    minHeight: 36,
  },
  filters: {
    flexDirection: "row" as const,
    flexWrap: "wrap" as const,
    gap: spacing.sm,
    marginBottom: spacing.sm,
  },
  filterChip: {
    backgroundColor: colors.surface,
    borderColor: "rgba(194,198,211,0.35)",
    borderRadius: 999,
    borderWidth: 1,
    paddingHorizontal: spacing.sm + 2,
    paddingVertical: 6,
  },
  filterChipActive: {
    backgroundColor: colors.primary,
    borderColor: colors.primary,
  },
  filterText: {
    color: colors.muted,
    fontSize: 12,
    fontWeight: "700" as const,
  },
  filterTextActive: {
    color: colors.onPrimary,
  },
  sourceRow: {
    flexDirection: "row" as const,
    gap: spacing.sm,
    marginBottom: spacing.md,
  },
  sourceChip: {
    borderBottomColor: "transparent",
    borderBottomWidth: 2,
    paddingBottom: 4,
    paddingHorizontal: 2,
  },
  sourceChipActive: {
    borderBottomColor: colors.primary,
  },
  sourceText: {
    color: colors.muted,
    fontSize: 12,
    fontWeight: "600" as const,
  },
  sourceTextActive: {
    color: colors.primary,
    fontWeight: "800" as const,
  },
  bulkAction: {
    backgroundColor: colors.primarySoft,
    borderRadius: radius.md,
    marginBottom: spacing.sm,
    paddingHorizontal: spacing.md,
    paddingVertical: spacing.sm,
  },
  bulkDanger: {
    backgroundColor: colors.dangerSoft,
  },
  bulkActionText: {
    color: colors.primary,
    fontSize: 13,
    fontWeight: "700" as const,
    textAlign: "center" as const,
  },
  list: {
    backgroundColor: colors.surface,
    borderColor: "rgba(194,198,211,0.25)",
    borderRadius: radius.lg,
    borderWidth: 1,
    overflow: "hidden" as const,
  },
  row: {
    alignItems: "flex-start" as const,
    borderBottomColor: "rgba(194,198,211,0.2)",
    borderBottomWidth: 1,
    flexDirection: "row" as const,
    gap: spacing.sm,
    paddingHorizontal: spacing.md,
    paddingVertical: spacing.md,
  },
  rowSelected: {
    backgroundColor: colors.primarySoft,
  },
  check: {
    marginTop: 2,
  },
  title: {
    color: colors.text,
    fontSize: 15,
    fontWeight: "700" as const,
    lineHeight: 20,
  },
  titleDone: {
    color: colors.muted,
    textDecorationLine: "line-through" as const,
  },
  meta: {
    flexDirection: "row" as const,
    flexWrap: "wrap" as const,
    gap: spacing.xs,
    marginTop: spacing.sm,
  },
  actions: {
    flexDirection: "row" as const,
    gap: spacing.sm,
    marginTop: 2,
  },
  editCard: {
    backgroundColor: colors.surfaceLow,
    borderBottomColor: "rgba(194,198,211,0.2)",
    borderBottomWidth: 1,
    gap: spacing.sm,
    padding: spacing.md,
  },
  modal: {
    backgroundColor: colors.surface,
    borderTopLeftRadius: 16,
    borderTopRightRadius: 16,
    gap: spacing.md,
    padding: spacing.lg,
  },
};
