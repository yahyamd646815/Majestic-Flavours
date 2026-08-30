import { useUser } from "@clerk/expo";
import NativeDateTimePicker from "@expo/ui/community/datetime-picker";
import { useMemo, useState } from "react";
import { Modal, ScrollView, StyleSheet, Text, TextInput, TouchableOpacity, View } from "react-native";

import { colors, fonts, radii, spacing } from "@/constants/theme";
import { sampleUsers } from "@/data/sampleUsers";
import { getAssignableTaskParticipants } from "@/lib/assignableEmployees";
import { dueAtToPickerDate, resolveDueAt } from "@/lib/tasks";
import { useAppUsersStore } from "@/store/appUsersStore";
import { useTaskStore } from "@/store/taskStore";
import { parseRole } from "@/types/role";
import type { Task } from "@/types/tasks";

export type TaskFormValues = {
  title: string;
  categoryId: string;
  /** Trimmed, and collapsed to `null` when the box is left empty — see
   * `Task.description`. */
  description: string | null;
  dueAt: string;
  assignedEmployeeIds: string[];
};

type TaskFormModalProps = {
  visible: boolean;
  /** Present in edit mode — every field is pre-filled from it, exactly as
   * `ItemFormModal` does with its optional `item`. The parent diffs the
   * submitted `assignedEmployeeIds` against the live store task, not against
   * this snapshot. */
  task?: Task;
  onClose: () => void;
  onSubmit: (values: TaskFormValues) => void;
};

/** Creates a task, or edits an existing one when `task` is given. Reached
 * from `TaskAddMenuModal`'s "Create Task" option (itself unreachable without
 * at least one task category existing) and from `TaskCard`'s Edit action.
 * Mirrors `ItemFormModal`'s structure closely: same category-chips /
 * assigned-employee-chips pattern, but the picker pool comes from
 * `getAssignableTaskParticipants` (wider than Inventory's employee-only
 * `getAssignableEmployees`) since Admin/Manager can assign tasks to
 * themselves and, for Admin, other admins/managers too. */
export function TaskFormModal({ visible, task, onClose, onSubmit }: TaskFormModalProps) {
  const { user } = useUser();
  // Falls back to the most restrictive role (empty picker) if this ever opens
  // before the role claim is available — it is otherwise only reachable by a
  // signed-in Admin/Manager per `tasks.tsx`'s `canManage` gate.
  const creatorRole = parseRole(user?.publicMetadata?.role) ?? "employee";
  const currentUserClerkId = user?.id ?? "";

  const taskCategories = useTaskStore((state) => state.taskCategories);
  const appUsers = useAppUsersStore((state) => state.users);
  const appUsersLoading = useAppUsersStore((state) => state.isLoading);

  const assignableEmployees = useMemo(
    () => getAssignableTaskParticipants(creatorRole, currentUserClerkId, sampleUsers, appUsers),
    [creatorRole, currentUserClerkId, appUsers],
  );

  const [title, setTitle] = useState(task?.title ?? "");
  // Held as a plain string while editing; only converted back to `null` at
  // submit time, so clearing an existing description is a real edit.
  const [description, setDescription] = useState(task?.description ?? "");
  const [categoryId, setCategoryId] = useState<string | null>(
    task?.categoryId ?? taskCategories[0]?.id ?? null,
  );
  const [assignedEmployeeIds, setAssignedEmployeeIds] = useState<string[]>(
    task?.assignedEmployeeIds ?? [],
  );
  // Both pickers seed from the same instant when editing, so an untouched
  // save round-trips `dueAt` back to exactly the value it already had.
  const [pickedDate, setPickedDate] = useState<Date | null>(() =>
    task ? dueAtToPickerDate(task.dueAt) : null,
  );
  const [pickedTime, setPickedTime] = useState<Date | null>(() =>
    task ? dueAtToPickerDate(task.dueAt) : null,
  );
  const [isDatePickerOpen, setIsDatePickerOpen] = useState(false);
  const [isTimePickerOpen, setIsTimePickerOpen] = useState(false);
  const [error, setError] = useState<string | null>(null);

  function toggleEmployee(id: string) {
    setAssignedEmployeeIds((current) =>
      current.includes(id) ? current.filter((existing) => existing !== id) : [...current, id],
    );
  }

  function handleSubmit() {
    if (appUsersLoading) {
      setError("Still loading employee data — please wait a moment and try again.");
      return;
    }

    const trimmedTitle = title.trim();
    if (trimmedTitle.length === 0) {
      setError("Enter a task title.");
      return;
    }
    if (!categoryId) {
      setError("Select a category.");
      return;
    }
    // Requiring at least one assignee is app-level validation, not a DB
    // constraint — the database allows zero rows since removal down to zero
    // is a valid later state (AGENTS.md). Editing keeps the same rule: the
    // deliberate path down to zero assignees is TaskCard's chip removal,
    // which warns before removing the last one.
    if (assignedEmployeeIds.length === 0) {
      setError("Select at least one employee.");
      return;
    }

    // Unlike `ItemFormModal`, ids are NOT filtered against the currently
    // assignable pool here. Task assignments were never seeded with
    // placeholder ids, so there is nothing to purge — and once the pool
    // narrows by role, filtering would silently unassign people the current
    // editor simply isn't allowed to assign (a Manager editing an
    // Admin-created task, say).
    const trimmedDescription = description.trim();

    onSubmit({
      title: trimmedTitle,
      categoryId,
      description: trimmedDescription.length > 0 ? trimmedDescription : null,
      dueAt: resolveDueAt(pickedDate, pickedTime),
      assignedEmployeeIds,
    });
  }

  const dueDateLabel = pickedDate
    ? pickedDate.toLocaleDateString("en-GB", { day: "numeric", month: "short", year: "numeric" })
    : "Pick Date";
  const dueTimeLabel = pickedTime
    ? pickedTime.toLocaleTimeString("en-GB", { hour: "2-digit", minute: "2-digit" })
    : "Pick Time";

  return (
    <Modal visible={visible} transparent animationType="slide" onRequestClose={onClose}>
      <View style={styles.overlay}>
        <View style={styles.sheet}>
          <ScrollView
            contentContainerStyle={styles.scrollContent}
            keyboardShouldPersistTaps="handled"
          >
            <Text className="font-inter-bold text-xl text-maroon">
              {task ? "Edit Task" : "Create Task"}
            </Text>

            <View className="mt-4 gap-4">
              <View className="gap-1">
                <Text className="font-inter-medium text-sm text-text-primary">Title</Text>
                <TextInput
                  value={title}
                  onChangeText={setTitle}
                  placeholder="e.g. Deep clean the fryer"
                  placeholderTextColor={colors.textSecondary}
                  style={styles.input}
                />
              </View>

              <View className="gap-1">
                <Text className="font-inter-medium text-sm text-text-primary">
                  Description (optional)
                </Text>
                <TextInput
                  value={description}
                  onChangeText={setDescription}
                  placeholder="Any extra detail staff need to do this properly"
                  placeholderTextColor={colors.textSecondary}
                  multiline
                  style={styles.descriptionInput}
                />
              </View>

              <View className="gap-1">
                <Text className="font-inter-medium text-sm text-text-primary">Category</Text>
                <View className="flex-row flex-wrap gap-2">
                  {taskCategories.map((c) => {
                    const isActive = categoryId === c.id;
                    return (
                      <TouchableOpacity
                        key={c.id}
                        className={isActive ? "chip chip--active" : "chip"}
                        activeOpacity={0.8}
                        onPress={() => setCategoryId(c.id)}
                      >
                        <Text className={isActive ? "chip__text chip__text--active" : "chip__text"}>
                          {c.name}
                        </Text>
                      </TouchableOpacity>
                    );
                  })}
                </View>
              </View>

              <View className="gap-1">
                <Text className="font-inter-medium text-sm text-text-primary">Due</Text>
                {task ? null : (
                  <Text className="font-inter text-xs text-text-secondary">
                    Leave blank to default to the end of today.
                  </Text>
                )}
                <View className="flex-row gap-3">
                  <TouchableOpacity
                    className="flex-1 items-center rounded-lg border border-border py-3"
                    activeOpacity={0.8}
                    onPress={() => {
                      setIsTimePickerOpen(false);
                      setIsDatePickerOpen((open) => !open);
                    }}
                  >
                    <Text className="font-inter-semibold text-sm text-text-primary">
                      {dueDateLabel}
                    </Text>
                  </TouchableOpacity>
                  <TouchableOpacity
                    className="flex-1 items-center rounded-lg border border-border py-3"
                    activeOpacity={0.8}
                    onPress={() => {
                      setIsDatePickerOpen(false);
                      setIsTimePickerOpen((open) => !open);
                    }}
                  >
                    <Text className="font-inter-semibold text-sm text-text-primary">
                      {dueTimeLabel}
                    </Text>
                  </TouchableOpacity>
                </View>

                {isDatePickerOpen ? (
                  <NativeDateTimePicker
                    mode="date"
                    value={pickedDate ?? new Date()}
                    onValueChange={(_, date) => {
                      setPickedDate(date);
                      setIsDatePickerOpen(false);
                    }}
                    onDismiss={() => setIsDatePickerOpen(false)}
                  />
                ) : null}
                {isTimePickerOpen ? (
                  <NativeDateTimePicker
                    mode="time"
                    value={pickedTime ?? new Date()}
                    onValueChange={(_, date) => {
                      setPickedTime(date);
                      setIsTimePickerOpen(false);
                    }}
                    onDismiss={() => setIsTimePickerOpen(false)}
                  />
                ) : null}
              </View>

              <View className="gap-1">
                <Text className="font-inter-medium text-sm text-text-primary">
                  Assigned Employees
                </Text>
                <View className="flex-row flex-wrap gap-2">
                  {assignableEmployees.map((employee) => {
                    const isDisabled = employee.clerkUserId === undefined;
                    const isActive =
                      !isDisabled && assignedEmployeeIds.includes(employee.clerkUserId!);
                    return (
                      <TouchableOpacity
                        key={employee.id}
                        className={
                          isActive ? "chip chip--active" : isDisabled ? "chip opacity-50" : "chip"
                        }
                        activeOpacity={isDisabled ? 1 : 0.8}
                        disabled={isDisabled}
                        onPress={() => toggleEmployee(employee.clerkUserId!)}
                      >
                        <Text className={isActive ? "chip__text chip__text--active" : "chip__text"}>
                          {employee.name}
                          {isDisabled ? " (Hasn't signed in yet)" : ""}
                        </Text>
                      </TouchableOpacity>
                    );
                  })}
                </View>
              </View>

              {error ? <Text className="font-inter text-sm text-out-of-stock">{error}</Text> : null}

              <View className="flex-row gap-3">
                <TouchableOpacity
                  className="flex-1 items-center rounded-lg border border-border py-3"
                  activeOpacity={0.8}
                  onPress={onClose}
                >
                  <Text className="font-inter-semibold text-base text-text-primary">Cancel</Text>
                </TouchableOpacity>
                <TouchableOpacity
                  className="btn-primary flex-1"
                  activeOpacity={0.85}
                  disabled={appUsersLoading}
                  onPress={handleSubmit}
                >
                  <Text className="btn-primary__text">Save</Text>
                </TouchableOpacity>
              </View>
            </View>
          </ScrollView>
        </View>
      </View>
    </Modal>
  );
}

const styles = StyleSheet.create({
  overlay: {
    flex: 1,
    justifyContent: "flex-end",
    backgroundColor: "rgba(0,0,0,0.5)",
  },
  sheet: {
    maxHeight: "85%",
    backgroundColor: colors.white,
    borderTopLeftRadius: radii.lg,
    borderTopRightRadius: radii.lg,
    padding: spacing.lg,
  },
  scrollContent: {
    paddingBottom: spacing.lg,
  },
  input: {
    height: 48,
    borderWidth: 1,
    borderColor: colors.border,
    borderRadius: radii.md,
    backgroundColor: colors.white,
    paddingHorizontal: spacing.md,
    fontFamily: fonts.regular,
    fontSize: 16,
    color: colors.textPrimary,
  },
  // Same multiline treatment as ReportEntryCard's note input — a fixed-height
  // `input` would clip a description as soon as it wrapped.
  descriptionInput: {
    minHeight: 64,
    borderWidth: 1,
    borderColor: colors.border,
    borderRadius: radii.md,
    backgroundColor: colors.white,
    paddingHorizontal: spacing.md,
    paddingVertical: spacing.sm,
    fontFamily: fonts.regular,
    fontSize: 16,
    color: colors.textPrimary,
    textAlignVertical: "top",
  },
});
