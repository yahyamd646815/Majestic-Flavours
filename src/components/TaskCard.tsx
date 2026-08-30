import { Ionicons } from "@expo/vector-icons";
import { useState } from "react";
import { Alert, StyleSheet, Text, TextInput, TouchableOpacity, View } from "react-native";

import { colors, fonts, radii, spacing } from "@/constants/theme";
import { getCategoryName } from "@/lib/inventoryLabels";
import { formatDueDateTime } from "@/lib/reports";
import { hasEmployeeResponded, isTaskFullyCompleted, isTaskOverdueForEmployee, isTaskPastDue } from "@/lib/tasks";
import { useAppUsersStore } from "@/store/appUsersStore";
import type { Task, TaskCategory, TaskCompletionStatus } from "@/types/tasks";

type TaskCardProps = {
  task: Task;
  categories: TaskCategory[];
  /** Admin/Manager can remove any assignment and complete/miss any task,
   * regardless of whether they're personally assigned — matches the
   * `task_assignments_write_staff` / `task_completions_insert` RLS policies. */
  canManage: boolean;
  /** Whichever user is signed in right now — an employee can complete a task
   * only if they're actually assigned to it (which, since RLS already scopes
   * their `select` to assigned-only, is every task they can see). */
  currentUserClerkId: string | undefined;
  onRemoveAssignment: (employeeClerkId: string) => void;
  onComplete: (status: TaskCompletionStatus, note: string) => void;
  /** Rendered for Admin/Manager only — opens `TaskFormModal` in edit mode. */
  onEdit: () => void;
  /** Whether the Delete action is offered at all — decided by the caller from
   * the same boundary `tasks_delete_permission` enforces in SQL (admin: any
   * task; manager: only tasks they created), so this component never has to
   * know about roles or `createdBy` itself. */
  canDelete: boolean;
  onDelete: () => void;
  /**
   * Bulk-selection mode. While true the whole card is a selection target and
   * every other action — chip removal, Complete/Submit Reason, Edit — is not
   * rendered at all, so a stray tap can't fire one. Mirrors `InventoryCard`.
   */
  selectionMode?: boolean;
  isSelected?: boolean;
  onToggleSelect?: () => void;
};

export function TaskCard({
  task,
  categories,
  canManage,
  currentUserClerkId,
  onRemoveAssignment,
  onComplete,
  onEdit,
  canDelete,
  onDelete,
  selectionMode = false,
  isSelected = false,
  onToggleSelect,
}: TaskCardProps) {
  const appUsers = useAppUsersStore((state) => state.users);

  const [isActionOpen, setIsActionOpen] = useState(false);
  const [note, setNote] = useState("");
  const [error, setError] = useState<string | null>(null);

  const categoryName = getCategoryName(categories, task.categoryId);
  // Two different questions, deliberately kept apart: the badge is about the
  // task ("past due, nobody has completed it"), the action button is about
  // this viewer ("past due and I still owe my own response").
  const pastDue = isTaskPastDue(task);
  const overdueForMe =
    currentUserClerkId !== undefined && isTaskOverdueForEmployee(task, currentUserClerkId);
  const isOpen = !isTaskFullyCompleted(task);

  // Paired with the id (unlike `getAssignedNames`, which only returns
  // display names) since each chip needs its own id to remove — same
  // "silently drop an id that doesn't resolve" behavior otherwise.
  const assignedPairs = task.assignedEmployeeIds
    .map((employeeClerkId) => ({
      employeeClerkId,
      name: appUsers.find((user) => user.clerkUserId === employeeClerkId)?.name,
    }))
    .filter(
      (pair): pair is { employeeClerkId: string; name: string } => pair.name !== undefined,
    );

  /** Unlike the assignment chips above, a completion is never dropped for an
   * unresolvable id — the submitted response is the whole point of the
   * record, so an unknown author gets labelled rather than hidden. */
  function resolveName(clerkUserId: string): string {
    return appUsers.find((user) => user.clerkUserId === clerkUserId)?.name ?? "Unknown user";
  }

  const canRemoveAssignments = canManage && isOpen && !selectionMode;
  // Strictly your own response, on a task you are genuinely assigned to —
  // Admin and Manager get no override, matching round 2's
  // `task_completions_insert_own` policy. The old "canManage can complete
  // anything" branch is gone: an Admin who needs to resolve a task they were
  // never assigned to deletes it instead.
  const canComplete =
    isOpen &&
    !selectionMode &&
    currentUserClerkId !== undefined &&
    task.assignedEmployeeIds.includes(currentUserClerkId) &&
    !hasEmployeeResponded(task, currentUserClerkId);

  function handleRemoveAssignment(employeeClerkId: string) {
    if (task.assignedEmployeeIds.length === 1) {
      Alert.alert(
        "Remove the last assignee?",
        "This will leave the task unassigned. You can reassign it later.",
        [
          { text: "Cancel", style: "cancel" },
          { text: "Remove", style: "destructive", onPress: () => onRemoveAssignment(employeeClerkId) },
        ],
      );
      return;
    }
    onRemoveAssignment(employeeClerkId);
  }

  function handleConfirmAction() {
    const trimmedNote = note.trim();
    if (overdueForMe && trimmedNote.length === 0) {
      setError("A reason is required for a missed task.");
      return;
    }
    onComplete(overdueForMe ? "missed" : "completed", trimmedNote);
    setIsActionOpen(false);
    setNote("");
    setError(null);
  }

  const body = (
    <>
      <View className="flex-row items-start justify-between gap-2">
        {selectionMode ? (
          <Ionicons
            name={isSelected ? "checkbox" : "square-outline"}
            size={22}
            color={isSelected ? colors.gold : colors.textSecondary}
          />
        ) : null}

        <View className="flex-1">
          <Text className="font-inter-semibold text-base text-text-primary">{task.title}</Text>
          <Text className="font-inter text-xs text-text-secondary">{categoryName}</Text>
        </View>
        {pastDue ? (
          <View className="status-badge status-badge--out-of-stock">
            <Text className="status-badge__text--out-of-stock">Overdue</Text>
          </View>
        ) : null}
      </View>

      {task.description ? (
        <Text className="font-inter text-sm text-text-primary">{task.description}</Text>
      ) : null}

      <Text className="font-inter text-sm text-text-primary">
        Due {formatDueDateTime(task.dueAt)}
      </Text>

      {assignedPairs.length > 0 ? (
        <View className="flex-row flex-wrap gap-2">
          {assignedPairs.map((pair) => (
            <View key={pair.employeeClerkId} className="chip flex-row items-center gap-1">
              <Text className="chip__text">{pair.name}</Text>
              {canRemoveAssignments ? (
                <TouchableOpacity
                  onPress={() => handleRemoveAssignment(pair.employeeClerkId)}
                  accessibilityRole="button"
                  accessibilityLabel={`Remove ${pair.name} from ${task.title}`}
                  hitSlop={6}
                >
                  <Ionicons name="close" size={12} color={colors.textSecondary} />
                </TouchableOpacity>
              ) : null}
            </View>
          ))}
        </View>
      ) : (
        <Text className="font-inter text-xs text-text-secondary">Unassigned</Text>
      )}

      {task.completions.length > 0 ? (
        <View className="gap-3 rounded-lg bg-cream p-3">
          {task.completions.map((completion) => (
            <View key={completion.employeeClerkId} className="gap-0.5">
              <Text
                className={
                  completion.status === "completed"
                    ? "font-inter-semibold text-sm text-in-stock"
                    : "font-inter-semibold text-sm text-out-of-stock"
                }
              >
                {resolveName(completion.employeeClerkId)} —{" "}
                {completion.status === "completed" ? "Completed" : "Missed"}
              </Text>
              {completion.note ? (
                <Text className="font-inter text-sm text-text-primary">{completion.note}</Text>
              ) : null}
            </View>
          ))}
        </View>
      ) : null}

      {canComplete ? (
        <View className="gap-2 border-t border-border pt-3">
          {isActionOpen ? (
            <>
              <TextInput
                value={note}
                onChangeText={setNote}
                placeholder={overdueForMe ? "Reason (required)" : "Note (optional)"}
                placeholderTextColor={colors.textSecondary}
                multiline
                style={styles.noteInput}
              />
              {error ? (
                <Text className="font-inter text-sm text-out-of-stock">{error}</Text>
              ) : null}
              <View className="flex-row gap-3">
                <TouchableOpacity
                  className="flex-1 items-center rounded-lg border border-border py-2"
                  activeOpacity={0.8}
                  onPress={() => {
                    setIsActionOpen(false);
                    setNote("");
                    setError(null);
                  }}
                >
                  <Text className="font-inter-semibold text-sm text-text-primary">Cancel</Text>
                </TouchableOpacity>
                <TouchableOpacity
                  className="btn-primary flex-1"
                  activeOpacity={0.85}
                  onPress={handleConfirmAction}
                >
                  <Text className="btn-primary__text">
                    {overdueForMe ? "Submit Reason" : "Complete"}
                  </Text>
                </TouchableOpacity>
              </View>
            </>
          ) : (
            <TouchableOpacity
              className="btn-primary"
              activeOpacity={0.85}
              onPress={() => setIsActionOpen(true)}
            >
              <Text className="btn-primary__text">
                {overdueForMe ? "Submit Reason" : "Complete"}
              </Text>
            </TouchableOpacity>
          )}
        </View>
      ) : null}

      {canManage && !selectionMode ? (
        <View className="flex-row gap-3 border-t border-border pt-3">
          <TouchableOpacity
            className="flex-1 flex-row items-center justify-center gap-1 rounded-lg border border-border py-2"
            activeOpacity={0.8}
            onPress={onEdit}
            accessibilityRole="button"
            accessibilityLabel={`Edit ${task.title}`}
          >
            <Ionicons name="create-outline" size={16} color={colors.maroon} />
            <Text className="font-inter-semibold text-sm text-maroon">Edit</Text>
          </TouchableOpacity>

          {canDelete ? (
            <TouchableOpacity
              className="flex-1 flex-row items-center justify-center gap-1 rounded-lg border border-out-of-stock py-2"
              activeOpacity={0.8}
              onPress={onDelete}
              accessibilityRole="button"
              accessibilityLabel={`Delete ${task.title}`}
            >
              <Ionicons name="trash-outline" size={16} color={colors.outOfStock} />
              <Text className="font-inter-semibold text-sm text-out-of-stock">Delete</Text>
            </TouchableOpacity>
          ) : null}
        </View>
      ) : null}
    </>
  );

  if (selectionMode) {
    // Both states keep a 2px border so toggling only changes its colour and
    // never shifts the card's layout — same as InventoryCard.
    return (
      <TouchableOpacity
        className={
          isSelected ? "card gap-3 border-2 border-gold" : "card gap-3 border-2 border-transparent"
        }
        activeOpacity={0.85}
        onPress={onToggleSelect}
        accessibilityRole="checkbox"
        accessibilityState={{ checked: isSelected }}
        accessibilityLabel={task.title}
      >
        {body}
      </TouchableOpacity>
    );
  }

  return <View className="card gap-3">{body}</View>;
}

const styles = StyleSheet.create({
  noteInput: {
    minHeight: 64,
    borderWidth: 1,
    borderColor: colors.border,
    borderRadius: radii.md,
    backgroundColor: colors.white,
    paddingHorizontal: spacing.md,
    paddingVertical: spacing.sm,
    fontFamily: fonts.regular,
    fontSize: 14,
    color: colors.textPrimary,
    textAlignVertical: "top",
  },
});
