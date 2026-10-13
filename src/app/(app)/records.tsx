import { useUser } from "@clerk/expo";
import { Ionicons } from "@expo/vector-icons";
import { Redirect, useRouter } from "expo-router";
import { useMemo, useState } from "react";
import { FlatList, ScrollView, StyleSheet, Text, TouchableOpacity, View } from "react-native";
import { SafeAreaView } from "react-native-safe-area-context";

import { EmployeeRecordDetailModal } from "@/components/EmployeeRecordDetailModal";
import { colors } from "@/constants/theme";
import { sampleUsers } from "@/data/sampleUsers";
import { ONE_MINUTE_MS, useNowTick } from "@/hooks/useNowTick";
import { getAssignableEmployees } from "@/lib/assignableEmployees";
import type { ReportDateFilter } from "@/lib/reports";
import { REPORT_DATE_FILTER_LABELS, getRiyadhIsoDate, matchesDateFilter } from "@/lib/reports";
import { isTaskResolvedForEmployee } from "@/lib/tasks";
import { useAppUsersStore } from "@/store/appUsersStore";
import { useTaskStore } from "@/store/taskStore";
import { parseRole } from "@/types/role";
import type { Task } from "@/types/tasks";

const DATE_FILTERS: ReportDateFilter[] = ["today", "week", "all"];

type SummaryState = "unassigned" | "not-started" | "in-progress" | "completed";

const SUMMARY_LABELS: Record<SummaryState, string> = {
  unassigned: "Nothing assigned",
  "not-started": "Nothing completed",
  "in-progress": "In progress",
  completed: "All completed",
};

function summarize(tasks: Task[], employeeClerkId: string): SummaryState {
  if (tasks.length === 0) return "unassigned";
  const resolvedCount = tasks.filter((task) =>
    isTaskResolvedForEmployee(task, employeeClerkId),
  ).length;
  if (resolvedCount === 0) return "not-started";
  if (resolvedCount === tasks.length) return "completed";
  return "in-progress";
}

export default function Records() {
  const { user } = useUser();
  const role = parseRole(user?.publicMetadata?.role);
  const router = useRouter();

  const tasks = useTaskStore((state) => state.tasks);
  const taskCategories = useTaskStore((state) => state.taskCategories);
  const appUsers = useAppUsersStore((state) => state.users);

  const [dateFilter, setDateFilter] = useState<ReportDateFilter>("today");
  const [selectedEmployeeId, setSelectedEmployeeId] = useState<string | null>(null);

  const assignableEmployees = useMemo(
    () =>
      getAssignableEmployees(sampleUsers, appUsers).filter(
        (employee): employee is typeof employee & { clerkUserId: string } =>
          employee.clerkUserId !== undefined,
      ),
    [appUsers],
  );

  // One live "now" for the whole screen: it rolls the "Today" filter over at
  // Riyadh midnight without a reload, and drives the detail modal's per-task
  // Overdue badge (which is why it is passed down rather than read there).
  const nowMs = useNowTick(ONE_MINUTE_MS);
  const todayIsoDate = getRiyadhIsoDate(nowMs);

  // Per-employee task set within the active date filter, computed once here
  // and reused for both the summary row and (for whoever is selected) the
  // detail modal.
  const tasksByEmployee = useMemo(() => {
    const map = new Map<string, Task[]>();
    for (const employee of assignableEmployees) {
      map.set(
        employee.clerkUserId,
        tasks.filter(
          (task) =>
            task.assignedEmployeeIds.includes(employee.clerkUserId) &&
            matchesDateFilter(getRiyadhIsoDate(new Date(task.dueAt).getTime()), dateFilter, todayIsoDate),
        ),
      );
    }
    return map;
  }, [assignableEmployees, tasks, dateFilter, todayIsoDate]);

  const selectedEmployee = assignableEmployees.find(
    (employee) => employee.clerkUserId === selectedEmployeeId,
  );

  if (role !== "admin" && role !== "manager") return <Redirect href="/tasks" />;

  return (
    <SafeAreaView style={{ flex: 1, backgroundColor: colors.white }}>
      <View className="flex-1 gap-4 pt-4">
        <View className="flex-row items-center gap-3 px-4">
          <TouchableOpacity
            onPress={() => router.back()}
            accessibilityRole="button"
            accessibilityLabel="Back"
            hitSlop={8}
          >
            <Ionicons name="arrow-back" size={22} color={colors.textPrimary} />
          </TouchableOpacity>
          <Text className="font-inter-bold text-2xl text-maroon">Records</Text>
        </View>

        <ScrollView
          horizontal
          showsHorizontalScrollIndicator={false}
          className="grow-0"
          contentContainerStyle={styles.filterContent}
        >
          {DATE_FILTERS.map((filter) => (
            <TouchableOpacity
              key={filter}
              className={dateFilter === filter ? "chip chip--active" : "chip"}
              activeOpacity={0.8}
              onPress={() => setDateFilter(filter)}
              accessibilityRole="button"
              accessibilityLabel={REPORT_DATE_FILTER_LABELS[filter]}
              accessibilityState={{ selected: dateFilter === filter }}
            >
              <Text
                className={
                  dateFilter === filter ? "chip__text chip__text--active" : "chip__text"
                }
              >
                {REPORT_DATE_FILTER_LABELS[filter]}
              </Text>
            </TouchableOpacity>
          ))}
        </ScrollView>

        <FlatList
          className="flex-1"
          data={assignableEmployees}
          keyExtractor={(employee) => employee.clerkUserId}
          contentContainerStyle={styles.listContent}
          ItemSeparatorComponent={() => <View className="h-3" />}
          ListEmptyComponent={
            <View className="items-center gap-2 py-16">
              <Ionicons name="people-outline" size={40} color={colors.textSecondary} />
              <Text className="font-inter-medium text-sm text-text-secondary">
                No employees to show yet.
              </Text>
            </View>
          }
          renderItem={({ item }) => {
            const employeeTasks = tasksByEmployee.get(item.clerkUserId) ?? [];
            const state = summarize(employeeTasks, item.clerkUserId);
            return (
              <EmployeeRecordRow
                name={item.name}
                state={state}
                onPress={() => setSelectedEmployeeId(item.clerkUserId)}
              />
            );
          }}
        />
      </View>

      <EmployeeRecordDetailModal
        visible={selectedEmployee !== undefined}
        employeeName={selectedEmployee?.name ?? ""}
        employeeClerkId={selectedEmployee?.clerkUserId ?? ""}
        tasks={selectedEmployee ? (tasksByEmployee.get(selectedEmployee.clerkUserId) ?? []) : []}
        categories={taskCategories}
        nowMs={nowMs}
        onClose={() => setSelectedEmployeeId(null)}
      />
    </SafeAreaView>
  );
}

const STATE_BADGE_CLASS: Record<SummaryState, string | null> = {
  unassigned: null,
  "not-started": "status-badge status-badge--out-of-stock",
  "in-progress": "status-badge status-badge--low-stock",
  completed: "status-badge status-badge--in-stock",
};

const STATE_TEXT_CLASS: Record<SummaryState, string> = {
  unassigned: "font-inter text-xs text-text-secondary",
  "not-started": "status-badge__text--out-of-stock",
  "in-progress": "status-badge__text--low-stock",
  completed: "status-badge__text--in-stock",
};

function EmployeeRecordRow({
  name,
  state,
  onPress,
}: {
  name: string;
  state: SummaryState;
  onPress: () => void;
}) {
  const badgeClass = STATE_BADGE_CLASS[state];

  return (
    <TouchableOpacity
      className="card flex-row items-center justify-between gap-2"
      activeOpacity={0.85}
      onPress={onPress}
      accessibilityRole="button"
      accessibilityLabel={`${name}: ${SUMMARY_LABELS[state]}`}
    >
      <View className="flex-1 gap-1">
        <Text className="font-inter-semibold text-base text-text-primary">{name}</Text>
        {badgeClass ? (
          <View className={`${badgeClass} self-start`}>
            <Text className={STATE_TEXT_CLASS[state]}>{SUMMARY_LABELS[state]}</Text>
          </View>
        ) : (
          <Text className={STATE_TEXT_CLASS[state]}>{SUMMARY_LABELS[state]}</Text>
        )}
      </View>
      <Ionicons name="chevron-forward" size={18} color={colors.textSecondary} />
    </TouchableOpacity>
  );
}

const styles = StyleSheet.create({
  filterContent: {
    gap: 8,
    paddingHorizontal: 16,
    alignItems: "center",
  },
  listContent: {
    paddingHorizontal: 16,
    paddingBottom: 32,
  },
});
