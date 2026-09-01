import { useUser } from "@clerk/expo";
import { Ionicons } from "@expo/vector-icons";
import { useRouter } from "expo-router";
import { useMemo, useState } from "react";
import {
  Alert,
  FlatList,
  ScrollView,
  StyleSheet,
  Text,
  TouchableOpacity,
  View,
} from "react-native";
import { SafeAreaView } from "react-native-safe-area-context";

import { BulkAssignModal } from "@/components/BulkAssignModal";
import { CategoryFilter } from "@/components/CategoryFilter";
import { DeleteConfirmModal } from "@/components/DeleteConfirmModal";
import { EmployeeFilter } from "@/components/EmployeeFilter";
import { ErrorState } from "@/components/ErrorState";
import { LoadingState } from "@/components/LoadingState";
import { SearchBar } from "@/components/SearchBar";
import { SortToggle } from "@/components/SortToggle";
import { TaskAddMenuModal } from "@/components/TaskAddMenuModal";
import { TaskCard } from "@/components/TaskCard";
import { TaskCategoryManagerModal } from "@/components/TaskCategoryManagerModal";
import { TaskFormModal, type TaskFormSubmission } from "@/components/TaskFormModal";
import { colors } from "@/constants/theme";
import { sampleUsers } from "@/data/sampleUsers";
import { ONE_MINUTE_MS, useNowTick } from "@/hooks/useNowTick";
import { getAssignableEmployees } from "@/lib/assignableEmployees";
import { matchesEmployeeFilter } from "@/lib/inventoryFilters";
import { getRiyadhIsoDate } from "@/lib/reports";
import { useSupabaseClient } from "@/lib/supabase";
import {
  TASK_DATE_FILTER_LABELS,
  dueAtRiyadhIsoDate,
  hasEmployeeResponded,
  isTaskFullyCompleted,
  isTaskOverdueForEmployee,
  matchesTaskDateFilter,
  type TaskDateFilter,
} from "@/lib/tasks";
import { generateFirstOccurrence } from "@/lib/taskOccurrences";
import { MAX_REMINDERS_PER_TASK, remindersForTask } from "@/lib/taskReminders";
import { ensureNotificationPermission } from "@/lib/notifications";
import { useAppUsersStore } from "@/store/appUsersStore";
import { useTaskReminderStore } from "@/store/taskReminderStore";
import { useTaskRecurrenceStore } from "@/store/taskRecurrenceStore";
import { useTaskStore } from "@/store/taskStore";
import { parseRole } from "@/types/role";
import type { ReminderOffsetUnit, Task, TaskCompletionStatus, TaskReminder } from "@/types/tasks";

const DATE_FILTERS: TaskDateFilter[] = ["today", "week", "month", "all"];

/** Shared empty array for the signed-out-mid-render case, so that branch does
 * not hand `TaskCard` a fresh `[]` on every render. */
const EMPTY_REMINDERS: TaskReminder[] = [];

type TaskSortMode = "recent" | "alphabetical";

export default function Tasks() {
  const { user } = useUser();
  const role = parseRole(user?.publicMetadata?.role);
  const canManage = role === "admin" || role === "manager";
  const currentUserClerkId = user?.id;
  const router = useRouter();

  // Overdue is derived from `dueAt` against "now", so without something moving
  // "now" a task that crosses its due time while this screen sits open keeps
  // rendering as not-overdue until an unrelated event happens to re-render it.
  // Threaded explicitly into every overdue check below and into each TaskCard.
  const nowMs = useNowTick(ONE_MINUTE_MS);

  const supabase = useSupabaseClient();
  const taskCategories = useTaskStore((state) => state.taskCategories);
  const tasks = useTaskStore((state) => state.tasks);
  const isLoading = useTaskStore((state) => state.isLoading);
  const error = useTaskStore((state) => state.error);
  const fetchAll = useTaskStore((state) => state.fetchAll);
  const selectedCategoryIds = useTaskStore((state) => state.selectedCategoryIds);
  const toggleCategoryId = useTaskStore((state) => state.toggleCategoryId);
  const clearCategoryIds = useTaskStore((state) => state.clearCategoryIds);
  const selectedEmployeeIds = useTaskStore((state) => state.selectedEmployeeIds);
  const toggleEmployeeId = useTaskStore((state) => state.toggleEmployeeId);
  const clearEmployeeIds = useTaskStore((state) => state.clearEmployeeIds);
  const addCategory = useTaskStore((state) => state.addCategory);
  const isCategoryInUse = useTaskStore((state) => state.isCategoryInUse);
  const deleteCategory = useTaskStore((state) => state.deleteCategory);
  const addTask = useTaskStore((state) => state.addTask);
  const updateTask = useTaskStore((state) => state.updateTask);
  const addAssignment = useTaskStore((state) => state.addAssignment);
  const removeAssignment = useTaskStore((state) => state.removeAssignment);
  const completeTask = useTaskStore((state) => state.completeTask);
  const deleteTask = useTaskStore((state) => state.deleteTask);
  const addRecurrenceRule = useTaskRecurrenceStore((state) => state.addRule);

  // Own reminders only — `task_reminders`' RLS never returns anyone else's,
  // so rows found by task id are by definition the signed-in person's.
  const reminders = useTaskReminderStore((state) => state.reminders);
  const addReminder = useTaskReminderStore((state) => state.addReminder);
  const deleteReminder = useTaskReminderStore((state) => state.deleteReminder);

  const appUsers = useAppUsersStore((state) => state.users);
  const assignableEmployees = useMemo(
    () => getAssignableEmployees(sampleUsers, appUsers),
    [appUsers],
  );

  const [searchQuery, setSearchQuery] = useState("");
  const [sortMode, setSortMode] = useState<TaskSortMode>("recent");
  // "All Time" by default so the list opens showing exactly what it always
  // has. The narrower options are what somebody reaches for deliberately —
  // and "This Month" is the one that makes a task due weeks out reachable at
  // all, which is the only way to set a reminder on it.
  const [dateFilter, setDateFilter] = useState<TaskDateFilter>("all");

  const [isAddMenuOpen, setIsAddMenuOpen] = useState(false);
  const [isCategoryManagerOpen, setIsCategoryManagerOpen] = useState(false);
  const [isTaskFormOpen, setIsTaskFormOpen] = useState(false);
  const [deleteTarget, setDeleteTarget] = useState<Task | null>(null);
  // Only the id is held, never a copy of the task — `editTask` below is then
  // always resolved from the live store. That is what keeps a chip removed
  // via TaskCard from being silently re-added by a save that diffed against a
  // stale snapshot captured when the form opened.
  const [editTaskId, setEditTaskId] = useState<string | null>(null);
  // Bumped on every open so TaskFormModal/TaskCategoryManagerModal remount
  // (via their `key`) and their fields reset from scratch instead of carrying
  // over the previous session, mirroring ItemFormModal's `formSession`.
  const [taskFormSession, setTaskFormSession] = useState(0);
  const [categoryManagerSession, setCategoryManagerSession] = useState(0);

  // Bulk assignment, mirroring Inventory's. `selectedTaskIds` deliberately
  // survives search/category/employee filter changes — that is what lets one
  // action cover tasks from several categories: filter, select, re-filter,
  // select more, assign once. It is cleared only when selection mode is left
  // or an assignment completes.
  const [isSelectionMode, setIsSelectionMode] = useState(false);
  const [selectedTaskIds, setSelectedTaskIds] = useState<Set<string>>(new Set());
  const [isAssignOpen, setIsAssignOpen] = useState(false);
  const [isAssigning, setIsAssigning] = useState(false);
  // Bumped on every open so BulkAssignModal remounts and forgets the person
  // picked last time, mirroring how `taskFormSession` resets TaskFormModal.
  const [assignSession, setAssignSession] = useState(0);

  const editTask = useMemo(
    () => (editTaskId === null ? null : (tasks.find((task) => task.id === editTaskId) ?? null)),
    [tasks, editTaskId],
  );

  // Riyadh's today, re-read from the same live "now" the overdue checks use,
  // so the "Today" option rolls over at Riyadh midnight without a reload.
  const todayIsoDate = getRiyadhIsoDate(nowMs);

  const filteredTasks = useMemo(() => {
    const query = searchQuery.trim().toLowerCase();
    return tasks.filter((task) => {
      const matchesCategory =
        selectedCategoryIds.size === 0 || selectedCategoryIds.has(task.categoryId);
      const matchesQuery = query.length === 0 || task.title.toLowerCase().includes(query);
      // Reused directly from `@/lib/inventoryFilters` — `Task` carries the
      // same `assignedEmployeeIds: string[]` shape the function is written
      // against, so no task-specific wrapper is needed. A no-op for
      // employees, since only Admin/Manager ever populate this set.
      const matchesEmployee = matchesEmployeeFilter(task, selectedEmployeeIds);
      const matchesDue = matchesTaskDateFilter(
        dueAtRiyadhIsoDate(task.dueAt),
        dateFilter,
        todayIsoDate,
      );
      return matchesCategory && matchesQuery && matchesEmployee && matchesDue;
    });
  }, [tasks, selectedCategoryIds, searchQuery, selectedEmployeeIds, dateFilter, todayIsoDate]);

  // An employee's list drops a task once someone completed it (closed for
  // everyone) or once they themselves have responded — someone else's miss
  // reason does NOT clear it from their list, since each assignee owes their
  // own. RLS still returns those rows, so this is a client-side cut, not a
  // query change. Admin/Manager keep seeing everything.
  const visibleTasks = useMemo(() => {
    if (canManage) return filteredTasks;
    if (!currentUserClerkId) return [];
    return filteredTasks.filter(
      (task) =>
        !isTaskFullyCompleted(task) && !hasEmployeeResponded(task, currentUserClerkId),
    );
  }, [filteredTasks, canManage, currentUserClerkId]);

  const sortedTasks = useMemo(() => {
    const compare = (a: Task, b: Task) =>
      sortMode === "alphabetical" ? a.title.localeCompare(b.title) : b.createdAt.localeCompare(a.createdAt);

    if (canManage || !currentUserClerkId) return [...visibleTasks].sort(compare);

    // Employee list only: tasks this person is personally late on come first
    // (derived from `dueAt`, never stored), each partition sorted by the
    // chosen mode.
    const overdue = visibleTasks.filter((task) =>
      isTaskOverdueForEmployee(task, currentUserClerkId, nowMs),
    );
    const notOverdue = visibleTasks.filter(
      (task) => !isTaskOverdueForEmployee(task, currentUserClerkId, nowMs),
    );
    return [...overdue.sort(compare), ...notOverdue.sort(compare)];
  }, [visibleTasks, sortMode, canManage, currentUserClerkId, nowMs]);

  const selectedCount = selectedTaskIds.size;
  const allVisibleSelected =
    sortedTasks.length > 0 && sortedTasks.every((task) => selectedTaskIds.has(task.id));

  function exitSelectionMode() {
    setIsSelectionMode(false);
    setSelectedTaskIds(new Set());
    setIsAssignOpen(false);
  }

  function toggleTaskSelected(taskId: string) {
    setSelectedTaskIds((current) => {
      const next = new Set(current);
      if (next.has(taskId)) next.delete(taskId);
      else next.add(taskId);
      return next;
    });
  }

  /** Operates on the currently-listed tasks only — selections outside the
   * active filters are left exactly as they are. */
  function toggleSelectAllVisible() {
    setSelectedTaskIds((current) => {
      const next = new Set(current);
      for (const task of sortedTasks) {
        if (allVisibleSelected) next.delete(task.id);
        else next.add(task.id);
      }
      return next;
    });
  }

  async function handleBulkAssign(employeeClerkId: string) {
    if (isAssigning) return;
    setIsAssigning(true);
    try {
      const targetIds = [...selectedTaskIds];

      // `addAssignment` upserts with ignoreDuplicates, so tasks this person is
      // already on need no client-side short-circuit.
      const results = await Promise.all(
        targetIds.map((taskId) => addAssignment(supabase, taskId, employeeClerkId)),
      );

      const failedCount = results.filter((succeeded) => !succeeded).length;
      if (failedCount > 0) {
        Alert.alert(
          "Some tasks could not be updated",
          `${failedCount} of ${targetIds.length} tasks failed. Check your connection and try again.`,
        );
        return;
      }

      exitSelectionMode();
    } finally {
      setIsAssigning(false);
    }
  }

  async function handleBulkUnassign(employeeClerkId: string) {
    if (isAssigning) return;
    setIsAssigning(true);
    try {
      const targetIds = [...selectedTaskIds];

      // A delete that matches no row is a no-op rather than an error, so
      // tasks this person was never on are left untouched.
      const results = await Promise.all(
        targetIds.map((taskId) => removeAssignment(supabase, taskId, employeeClerkId)),
      );

      const failedCount = results.filter((succeeded) => !succeeded).length;
      if (failedCount > 0) {
        Alert.alert(
          "Some tasks could not be updated",
          `${failedCount} of ${targetIds.length} tasks failed. Check your connection and try again.`,
        );
        return;
      }

      exitSelectionMode();
    } finally {
      setIsAssigning(false);
    }
  }

  // Mirrors Settings' inventory-category delete flow exactly (see
  // `settings.tsx`'s `performDeleteCategory`/`handleDeleteCategory`).
  async function performDeleteTaskCategory(id: string) {
    const succeeded = await deleteCategory(supabase, id);
    if (!succeeded) {
      Alert.alert(
        "Could not delete category",
        "The category was not deleted. Check your connection and try again.",
      );
    }
  }

  function handleDeleteTaskCategory(id: string) {
    if (isCategoryInUse(id)) {
      Alert.alert(
        "Category in use",
        "Some tasks are still assigned to this category. Remove them first.",
      );
      return;
    }
    Alert.alert("Delete this category?", undefined, [
      { text: "Cancel", style: "cancel" },
      { text: "Delete", style: "destructive", onPress: () => void performDeleteTaskCategory(id) },
    ]);
  }

  async function handleSubmitTask(submission: TaskFormSubmission) {
    if (!user?.id) return;

    // A recurring submission is a template, not a task: it creates no row in
    // `tasks` itself. Its FIRST occurrence is then created immediately, so a
    // new recurring task is visible right away rather than only once its due
    // time arrives; every occurrence after it still arrives lazily through
    // `useTaskOccurrenceGeneration`.
    if (submission.mode === "recurring") {
      const rule = await addRecurrenceRule(supabase, {
        ...submission.values,
        createdBy: user.id,
      });
      if (rule === null) {
        Alert.alert(
          "Could not create recurring task",
          "The recurring task was not created. Check your connection and try again.",
        );
        return;
      }

      // Not fatal if this fails: the rule itself is saved, and the same
      // occurrence gets picked up by the next session's generation pass once
      // it is genuinely due. The confirmation below says which happened
      // rather than promising something that did not.
      const createdFirst = await generateFirstOccurrence(supabase, rule);
      // The list was loaded before that row existed, so it needs re-reading
      // for the new task to show up without a restart.
      if (createdFirst) await fetchAll(supabase);

      closeTaskForm();
      Alert.alert(
        "Recurring task created",
        createdFirst
          ? "The first task is in the list now. The rest appear automatically as each due time arrives."
          : "Each task will appear in the list automatically when its due time arrives.",
      );
      return;
    }

    const values = submission.values;

    if (editTask) {
      // Assignments are diffed against the task as it stands in the store
      // right now and sent through the same one-at-a-time insert/delete pair
      // TaskCard's chip removal already uses — never a full-array overwrite.
      const { assignedEmployeeIds, ...rest } = values;
      const originalEmployeeIds = editTask.assignedEmployeeIds;
      const addedEmployeeIds = assignedEmployeeIds.filter(
        (id) => !originalEmployeeIds.includes(id),
      );
      const removedEmployeeIds = originalEmployeeIds.filter(
        (id) => !assignedEmployeeIds.includes(id),
      );

      const results = await Promise.all([
        updateTask(supabase, editTask.id, rest),
        ...addedEmployeeIds.map((id) => addAssignment(supabase, editTask.id, id)),
        ...removedEmployeeIds.map((id) => removeAssignment(supabase, editTask.id, id)),
      ]);

      if (!results.every(Boolean)) {
        Alert.alert(
          "Could not save changes",
          "The task was not saved. Check your connection and try again.",
        );
        return;
      }
      closeTaskForm();
      return;
    }

    const succeeded = await addTask(supabase, { ...values, createdBy: user.id });
    if (!succeeded) {
      Alert.alert(
        "Could not create task",
        "The task was not created. Check your connection and try again.",
      );
      return;
    }
    closeTaskForm();
  }

  async function handleRemoveAssignment(taskId: string, employeeClerkId: string) {
    const succeeded = await removeAssignment(supabase, taskId, employeeClerkId);
    if (!succeeded) {
      Alert.alert("Could not update assignment", "Check your connection and try again.");
    }
  }

  async function handleComplete(taskId: string, status: TaskCompletionStatus, note: string) {
    if (!currentUserClerkId) return;
    // Always the signed-in person's own response — there is no path for
    // recording someone else's (see `completeTask`).
    const succeeded = await completeTask(supabase, taskId, currentUserClerkId, status, note);
    if (!succeeded) {
      Alert.alert(
        "Could not save",
        "The task update was not saved. Check your connection and try again.",
      );
    }
  }

  async function handleAddReminder(
    task: Task,
    offsetValue: number,
    offsetUnit: ReminderOffsetUnit,
  ) {
    if (!currentUserClerkId) return;

    // Asked for here rather than on sign-in: this is the first moment the
    // permission has a reason attached, and staff who never set a reminder
    // are never prompted at all.
    const isPermitted = await ensureNotificationPermission();

    const result = await addReminder(
      supabase,
      task,
      currentUserClerkId,
      offsetValue,
      offsetUnit,
    );
    // The control stops offering "add another" at the limit, so this is the
    // store's own backstop rather than a path anyone reaches by tapping.
    if (result.outcome === "limit-reached") {
      Alert.alert(
        "Too many reminders",
        `You can have up to ${MAX_REMINDERS_PER_TASK} reminders on one task. Remove one first.`,
      );
      return;
    }
    if (result.outcome === "failed") {
      Alert.alert(
        "Could not save reminder",
        "The reminder was not saved. Check your connection and try again.",
      );
      return;
    }
    // Saved but silent — the two ways that happens are worth saying out loud,
    // because an unreported one is a reminder somebody is counting on that
    // never arrives.
    if (!isPermitted) {
      Alert.alert(
        "Reminder saved, but notifications are off",
        "Turn on notifications for Majestic Flavours in your phone's settings and it will start working.",
      );
      return;
    }
    if (!result.wasScheduled) {
      Alert.alert(
        "Reminder saved, but it will not be sent",
        "That reminder time has already passed. Set a shorter one to be reminded before this task is due.",
      );
    }
  }

  /** One reminder, by its own id — the task's others are untouched. */
  async function handleRemoveReminder(reminderId: string) {
    const succeeded = await deleteReminder(supabase, reminderId);
    if (!succeeded) {
      Alert.alert(
        "Could not remove reminder",
        "The reminder was not removed. Check your connection and try again.",
      );
    }
  }

  // Mirrors `tasks_delete_permission` in SQL: admin can delete any task,
  // manager only their own, employee never — so the UI never offers an
  // action the database would reject anyway.
  function canDeleteTask(task: Task): boolean {
    if (role === "admin") return true;
    if (role === "manager") return task.createdBy === currentUserClerkId;
    return false;
  }

  // Reached only after DeleteConfirmModal's two-step confirmation passes.
  async function handleDelete(task: Task) {
    const succeeded = await deleteTask(supabase, task.id);
    if (!succeeded) {
      Alert.alert(
        "Could not delete task",
        "The task was not deleted. Check your connection and try again.",
      );
    }
  }

  function closeTaskForm() {
    setIsTaskFormOpen(false);
    setEditTaskId(null);
  }

  function openCreateTaskForm() {
    setEditTaskId(null);
    setIsTaskFormOpen(true);
    setTaskFormSession((session) => session + 1);
  }

  function openEditTaskForm(taskId: string) {
    setIsTaskFormOpen(false);
    setEditTaskId(taskId);
    setTaskFormSession((session) => session + 1);
  }

  const isEmptyAndLoading = isLoading && tasks.length === 0;
  const isReady = error === null && !isEmptyAndLoading;

  return (
    <SafeAreaView style={{ flex: 1, backgroundColor: colors.white }}>
      <View className="flex-1 gap-4 pt-4">
        <View className="flex-row items-center justify-between gap-3 px-4">
          <Text className="font-inter-bold text-2xl text-maroon">Tasks</Text>

          {isReady && canManage ? (
            <View className="flex-row items-center gap-2">
              {!isSelectionMode ? (
                <TouchableOpacity
                  className="flex-row items-center gap-1 rounded-lg border border-border px-3 py-2"
                  activeOpacity={0.85}
                  onPress={() => router.push("/records")}
                  accessibilityRole="button"
                  accessibilityLabel="View records"
                >
                  <Ionicons name="time-outline" size={16} color={colors.maroon} />
                  <Text className="font-inter-semibold text-xs text-maroon">Records</Text>
                </TouchableOpacity>
              ) : null}

              <TouchableOpacity
                className={
                  isSelectionMode
                    ? "flex-row items-center gap-1 rounded-lg bg-gold px-3 py-2"
                    : "flex-row items-center gap-1 rounded-lg border border-border px-3 py-2"
                }
                activeOpacity={0.85}
                onPress={() => (isSelectionMode ? exitSelectionMode() : setIsSelectionMode(true))}
                accessibilityRole="button"
                accessibilityLabel={isSelectionMode ? "Exit selection mode" : "Select tasks"}
              >
                <Ionicons
                  name={isSelectionMode ? "close" : "checkbox-outline"}
                  size={16}
                  color={isSelectionMode ? colors.textPrimary : colors.maroon}
                />
                <Text
                  className={
                    isSelectionMode
                      ? "font-inter-semibold text-xs text-text-primary"
                      : "font-inter-semibold text-xs text-maroon"
                  }
                >
                  {isSelectionMode ? "Done" : "Select"}
                </Text>
              </TouchableOpacity>
            </View>
          ) : null}
        </View>

        {error !== null ? (
          <ErrorState message={error} onRetry={() => void fetchAll(supabase)} />
        ) : isEmptyAndLoading ? (
          <LoadingState />
        ) : (
          <>
            <View className="px-4">
              <SearchBar
                value={searchQuery}
                onChangeText={setSearchQuery}
                placeholder="Search tasks"
              />
            </View>

            <CategoryFilter
              categories={taskCategories}
              selectedCategoryIds={selectedCategoryIds}
              onToggle={toggleCategoryId}
              onClear={clearCategoryIds}
            />

            {canManage ? (
              <EmployeeFilter
                employees={assignableEmployees}
                selectedEmployeeIds={selectedEmployeeIds}
                onToggle={toggleEmployeeId}
                onClear={clearEmployeeIds}
              />
            ) : null}

            {/* Labelled like `SortToggle`, but the chips scroll like
                `CategoryFilter`'s — four options plus a large system font size
                would otherwise run off a narrow phone. */}
            <View className="grow-0 gap-1.5">
              <Text className="px-4 font-inter-medium text-xs text-text-secondary">Due</Text>
              <ScrollView
                horizontal
                showsHorizontalScrollIndicator={false}
                className="grow-0"
                contentContainerStyle={styles.filterContent}
              >
                {DATE_FILTERS.map((filter) => {
                  const isActive = dateFilter === filter;
                  return (
                    <TouchableOpacity
                      key={filter}
                      className={isActive ? "chip chip--active" : "chip"}
                      activeOpacity={0.8}
                      onPress={() => setDateFilter(filter)}
                      accessibilityRole="button"
                      accessibilityLabel={`Due ${TASK_DATE_FILTER_LABELS[filter]}`}
                      accessibilityState={{ selected: isActive }}
                    >
                      <Text
                        className={isActive ? "chip__text chip__text--active" : "chip__text"}
                      >
                        {TASK_DATE_FILTER_LABELS[filter]}
                      </Text>
                    </TouchableOpacity>
                  );
                })}
              </ScrollView>
            </View>

            <SortToggle
              label="Sort"
              options={[
                { value: "recent", label: "Recently Added" },
                { value: "alphabetical", label: "A–Z" },
              ]}
              value={sortMode}
              onChange={setSortMode}
            />

            <FlatList
              className="flex-1"
              data={sortedTasks}
              keyExtractor={(task) => task.id}
              contentContainerStyle={styles.listContent}
              ItemSeparatorComponent={() => <View className="h-3" />}
              ListEmptyComponent={
                <View className="items-center gap-2 py-16">
                  <Ionicons name="checkbox-outline" size={40} color={colors.textSecondary} />
                  <Text className="font-inter-medium text-sm text-text-secondary">
                    No tasks match these filters — try a different combination.
                  </Text>
                </View>
              }
              renderItem={({ item }) => (
                <TaskCard
                  task={item}
                  categories={taskCategories}
                  canManage={canManage}
                  currentUserClerkId={currentUserClerkId}
                  nowMs={nowMs}
                  reminders={
                    currentUserClerkId === undefined
                      ? EMPTY_REMINDERS
                      : remindersForTask(reminders, item.id, currentUserClerkId)
                  }
                  onAddReminder={(offsetValue, offsetUnit) =>
                    void handleAddReminder(item, offsetValue, offsetUnit)
                  }
                  onRemoveReminder={(reminderId) => void handleRemoveReminder(reminderId)}
                  onRemoveAssignment={(employeeClerkId) =>
                    void handleRemoveAssignment(item.id, employeeClerkId)
                  }
                  onComplete={(status, note) => void handleComplete(item.id, status, note)}
                  onEdit={() => openEditTaskForm(item.id)}
                  canDelete={canDeleteTask(item)}
                  onDelete={() => setDeleteTarget(item)}
                  selectionMode={isSelectionMode}
                  isSelected={selectedTaskIds.has(item.id)}
                  onToggleSelect={() => toggleTaskSelected(item.id)}
                />
              )}
            />
          </>
        )}
      </View>

      {isReady && isSelectionMode ? (
        <View className="gap-3 border-t border-border bg-white px-4 py-3">
          <View className="flex-row items-center justify-between gap-3">
            <Text className="font-inter-medium text-sm text-text-primary">
              {selectedCount} task{selectedCount === 1 ? "" : "s"} selected
            </Text>

            <TouchableOpacity
              className={sortedTasks.length === 0 ? "chip opacity-50" : "chip"}
              activeOpacity={0.8}
              disabled={sortedTasks.length === 0}
              onPress={toggleSelectAllVisible}
            >
              <Text className="chip__text">
                {allVisibleSelected ? "Deselect All Visible" : "Select All Visible"}
              </Text>
            </TouchableOpacity>
          </View>

          <View className="flex-row gap-3">
            <TouchableOpacity
              className="flex-1 items-center rounded-lg border border-border py-3"
              activeOpacity={0.8}
              onPress={exitSelectionMode}
            >
              <Text className="font-inter-semibold text-base text-text-primary">Cancel</Text>
            </TouchableOpacity>

            <TouchableOpacity
              className={selectedCount === 0 ? "btn-primary flex-1 opacity-50" : "btn-primary flex-1"}
              activeOpacity={selectedCount === 0 ? 1 : 0.85}
              disabled={selectedCount === 0}
              onPress={() => {
                setAssignSession((session) => session + 1);
                setIsAssignOpen(true);
              }}
            >
              <Text className="btn-primary__text">Assign to...</Text>
            </TouchableOpacity>
          </View>
        </View>
      ) : null}

      {isReady && canManage && !isSelectionMode ? (
        <TouchableOpacity
          className="fab"
          style={styles.fabShadow}
          activeOpacity={0.85}
          onPress={() => setIsAddMenuOpen(true)}
          accessibilityRole="button"
          accessibilityLabel="Add category or task"
        >
          <Ionicons name="add" size={28} color={colors.textPrimary} />
        </TouchableOpacity>
      ) : null}

      <TaskAddMenuModal
        visible={isAddMenuOpen}
        hasCategories={taskCategories.length > 0}
        onClose={() => setIsAddMenuOpen(false)}
        onManageCategories={() => {
          setIsAddMenuOpen(false);
          setCategoryManagerSession((session) => session + 1);
          setIsCategoryManagerOpen(true);
        }}
        onCreateTask={() => {
          setIsAddMenuOpen(false);
          openCreateTaskForm();
        }}
      />

      <TaskCategoryManagerModal
        key={`category-manager-${categoryManagerSession}`}
        visible={isCategoryManagerOpen}
        categories={taskCategories}
        onClose={() => setIsCategoryManagerOpen(false)}
        onAdd={(name) => addCategory(supabase, name)}
        onDelete={handleDeleteTaskCategory}
      />

      <TaskFormModal
        key={`task-form-${taskFormSession}`}
        visible={isTaskFormOpen || editTask !== null}
        task={editTask ?? undefined}
        onClose={closeTaskForm}
        onSubmit={(submission) => void handleSubmitTask(submission)}
      />

      <BulkAssignModal
        key={`assign-${assignSession}`}
        visible={isAssignOpen}
        selectedCount={selectedCount}
        targetNoun="task"
        employees={assignableEmployees}
        isAssigning={isAssigning}
        onClose={() => setIsAssignOpen(false)}
        onAssign={(clerkUserId) => void handleBulkAssign(clerkUserId)}
        onUnassign={(clerkUserId) => void handleBulkUnassign(clerkUserId)}
      />

      <DeleteConfirmModal
        visible={deleteTarget !== null}
        onCancel={() => setDeleteTarget(null)}
        onConfirm={() => {
          if (deleteTarget) void handleDelete(deleteTarget);
          setDeleteTarget(null);
        }}
        warningMessage={
          deleteTarget?.generatedFromRecurrenceRuleId != null
            ? "This will also cancel the entire recurring series — no further occurrences will be created. This action cannot be undone."
            : undefined
        }
      />
    </SafeAreaView>
  );
}

const styles = StyleSheet.create({
  // Same chip-row treatment as `CategoryFilter`'s own content container.
  filterContent: {
    gap: 8,
    paddingHorizontal: 16,
    alignItems: "center",
  },
  listContent: {
    paddingHorizontal: 16,
    paddingBottom: 96,
  },
  fabShadow: {
    shadowColor: "#000",
    shadowOffset: { width: 0, height: 4 },
    shadowOpacity: 0.25,
    shadowRadius: 6,
    elevation: 6,
  },
});
