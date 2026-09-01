import { Modal, ScrollView, StyleSheet, Text, TouchableOpacity, View } from "react-native";

import { colors, radii, spacing } from "@/constants/theme";
import { getCategoryName } from "@/lib/inventoryLabels";
import { formatDueDateTime } from "@/lib/reports";
import { isTaskOverdueForEmployee } from "@/lib/tasks";
import type { Task, TaskCategory } from "@/types/tasks";

type EmployeeRecordDetailModalProps = {
  visible: boolean;
  employeeName: string;
  employeeClerkId: string;
  /** Already filtered to this employee's assignments within the active date
   * filter — this modal does no filtering of its own. */
  tasks: Task[];
  categories: TaskCategory[];
  /** "Now" for each row's Overdue badge, supplied by the Records page's
   * `useNowTick` so it keeps moving while this sheet is open — same reasoning
   * as `TaskCard`'s. */
  nowMs: number;
  onClose: () => void;
};

/** Every one of one employee's tasks within the Records page's current date
 * filter, each showing their own completion/miss record or, if they haven't
 * responded, a pending state. Opened from a row on the Records page. */
export function EmployeeRecordDetailModal({
  visible,
  employeeName,
  employeeClerkId,
  tasks,
  categories,
  nowMs,
  onClose,
}: EmployeeRecordDetailModalProps) {
  const sortedTasks = [...tasks].sort((a, b) => b.dueAt.localeCompare(a.dueAt));

  return (
    <Modal visible={visible} transparent animationType="slide" onRequestClose={onClose}>
      <View style={styles.overlay}>
        <View style={styles.sheet}>
          <ScrollView contentContainerStyle={styles.scrollContent}>
            <Text className="font-inter-bold text-xl text-maroon">{employeeName}</Text>

            <View className="mt-4 gap-3">
              {sortedTasks.length === 0 ? (
                <Text className="font-inter text-sm text-text-secondary">
                  No tasks match this filter.
                </Text>
              ) : (
                sortedTasks.map((task) => (
                  <TaskRecordRow
                    key={task.id}
                    task={task}
                    categories={categories}
                    employeeClerkId={employeeClerkId}
                    nowMs={nowMs}
                  />
                ))
              )}

              <TouchableOpacity
                className="items-center rounded-lg border border-border py-3"
                activeOpacity={0.8}
                onPress={onClose}
              >
                <Text className="font-inter-semibold text-base text-text-primary">Close</Text>
              </TouchableOpacity>
            </View>
          </ScrollView>
        </View>
      </View>
    </Modal>
  );
}

function TaskRecordRow({
  task,
  categories,
  employeeClerkId,
  nowMs,
}: {
  task: Task;
  categories: TaskCategory[];
  employeeClerkId: string;
  nowMs: number;
}) {
  const categoryName = getCategoryName(categories, task.categoryId);
  const overdueForThem = isTaskOverdueForEmployee(task, employeeClerkId, nowMs);
  const completion = task.completions.find((c) => c.employeeClerkId === employeeClerkId);

  return (
    <View className="card gap-3">
      <View className="flex-row items-start justify-between gap-2">
        <View className="flex-1">
          <Text className="font-inter-semibold text-base text-text-primary">{task.title}</Text>
          <Text className="font-inter text-xs text-text-secondary">{categoryName}</Text>
        </View>
        {overdueForThem ? (
          <View className="status-badge status-badge--out-of-stock">
            <Text className="status-badge__text--out-of-stock">Overdue</Text>
          </View>
        ) : null}
      </View>

      <Text className="font-inter text-sm text-text-primary">
        Due {formatDueDateTime(task.dueAt)}
      </Text>

      {completion ? (
        <View className="gap-0.5 rounded-lg bg-cream p-3">
          <Text
            className={
              completion.status === "completed"
                ? "font-inter-semibold text-sm text-in-stock"
                : "font-inter-semibold text-sm text-out-of-stock"
            }
          >
            {completion.status === "completed" ? "Completed" : "Missed"} ·{" "}
            {formatDueDateTime(completion.recordedAt)}
          </Text>
          {completion.note ? (
            <Text className="font-inter text-sm text-text-primary">{completion.note}</Text>
          ) : null}
        </View>
      ) : (
        <Text className="font-inter text-xs text-text-secondary">Pending — no response yet.</Text>
      )}
    </View>
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
    backgroundColor: colors.cream,
    borderTopLeftRadius: radii.lg,
    borderTopRightRadius: radii.lg,
    padding: spacing.lg,
  },
  scrollContent: {
    paddingBottom: spacing.lg,
  },
});
