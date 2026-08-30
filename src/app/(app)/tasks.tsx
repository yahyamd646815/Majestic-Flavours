import { useUser } from "@clerk/expo";
import { Ionicons } from "@expo/vector-icons";
import { useMemo, useState } from "react";
import { Alert, FlatList, StyleSheet, Text, TouchableOpacity, View } from "react-native";
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
import { TaskFormModal, type TaskFormValues } from "@/components/TaskFormModal";
import { colors } from "@/constants/theme";
import { sampleUsers } from "@/data/sampleUsers";
import { getAssignableEmployees } from "@/lib/assignableEmployees";
import { matchesEmployeeFilter } from "@/lib/inventoryFilters";
import { useSupabaseClient } from "@/lib/supabase";
import {
  hasEmployeeResponded,
  isTaskFullyCompleted,
  isTaskOverdueForEmployee,
} from "@/lib/tasks";
import { useAppUsersStore } from "@/store/appUsersStore";
import { useTaskStore } from "@/store/taskStore";
import { parseRole } from "@/types/role";
import type { Task, TaskCompletionStatus } from "@/types/tasks";

type TaskSortMode = "recent" | "alphabetical";

export default function Tasks() {
  const { user } = useUser();
  const role = parseRole(user?.publicMetadata?.role);
  const canManage = role === "admin" || role === "manager";
  const currentUserClerkId = user?.id;

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

  const appUsers = useAppUsersStore((state) => state.users);
  const assignableEmployees = useMemo(
    () => getAssignableEmployees(sampleUsers, appUsers),
    [appUsers],
  );

  const [searchQuery, setSearchQuery] = useState("");
  const [sortMode, setSortMode] = useState<TaskSortMode>("recent");

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
      return matchesCategory && matchesQuery && matchesEmployee;
    });
  }, [tasks, selectedCategoryIds, searchQuery, selectedEmployeeIds]);

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
      isTaskOverdueForEmployee(task, currentUserClerkId),
    );
    const notOverdue = visibleTasks.filter(
      (task) => !isTaskOverdueForEmployee(task, currentUserClerkId),
    );
    return [...overdue.sort(compare), ...notOverdue.sort(compare)];
  }, [visibleTasks, sortMode, canManage, currentUserClerkId]);

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

  async function handleSubmitTask(values: TaskFormValues) {
    if (!user?.id) return;

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
        onSubmit={(values) => void handleSubmitTask(values)}
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
      />
    </SafeAreaView>
  );
}

const styles = StyleSheet.create({
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
