import { ScrollView, StyleSheet, Text, TouchableOpacity } from "react-native";

import type { AssignableEmployee } from "@/lib/assignableEmployees";

/** Sentinel filter value for "items with no assigned employees" — just one
 * more ordinary member of `selectedEmployeeIds`, composing through the same
 * OR logic as a real Clerk user id (no special-casing needed). */
export const UNASSIGNED_EMPLOYEE_FILTER = "unassigned";

type EmployeeFilterProps = {
  employees: AssignableEmployee[];
  /** Empty set means "All" — matches every item, not none. Otherwise one or
   * more Clerk user ids (plus optionally `UNASSIGNED_EMPLOYEE_FILTER`), OR'd
   * together against `item.assignedEmployeeIds`. */
  selectedEmployeeIds: Set<string>;
  onToggle: (employeeId: string) => void;
  onClear: () => void;
};

/** Same multi-select chip-row pattern as `CategoryFilter`: tapping a chip
 * toggles it in/out of the selection, tapping "All" clears the whole set.
 *
 * Only employees who have actually signed in (and so have a real Clerk id)
 * are listed — `assignedEmployeeIds` can never contain anyone else, so a chip
 * for them could never match an item. */
export function EmployeeFilter({
  employees,
  selectedEmployeeIds,
  onToggle,
  onClear,
}: EmployeeFilterProps) {
  const isAllActive = selectedEmployeeIds.size === 0;
  const isUnassignedActive = selectedEmployeeIds.has(UNASSIGNED_EMPLOYEE_FILTER);
  const filterableEmployees = employees.filter(
    (employee): employee is AssignableEmployee & { clerkUserId: string } =>
      employee.clerkUserId !== undefined,
  );

  return (
    <ScrollView
      horizontal
      showsHorizontalScrollIndicator={false}
      style={styles.scrollView}
      contentContainerStyle={styles.content}
    >
      <TouchableOpacity
        className={isAllActive ? "chip chip--active" : "chip"}
        activeOpacity={0.8}
        onPress={onClear}
      >
        <Text className={isAllActive ? "chip__text chip__text--active" : "chip__text"}>All</Text>
      </TouchableOpacity>

      <TouchableOpacity
        className={isUnassignedActive ? "chip chip--active" : "chip"}
        activeOpacity={0.8}
        onPress={() => onToggle(UNASSIGNED_EMPLOYEE_FILTER)}
      >
        <Text className={isUnassignedActive ? "chip__text chip__text--active" : "chip__text"}>
          Unassigned
        </Text>
      </TouchableOpacity>

      {filterableEmployees.map((employee) => {
        const isActive = selectedEmployeeIds.has(employee.clerkUserId);
        return (
          <TouchableOpacity
            key={employee.id}
            className={isActive ? "chip chip--active" : "chip"}
            activeOpacity={0.8}
            onPress={() => onToggle(employee.clerkUserId)}
          >
            <Text className={isActive ? "chip__text chip__text--active" : "chip__text"}>
              {employee.name}
            </Text>
          </TouchableOpacity>
        );
      })}
    </ScrollView>
  );
}

const styles = StyleSheet.create({
  scrollView: {
    flexGrow: 0,
  },
  content: {
    gap: 8,
    paddingHorizontal: 16,
    alignItems: "center",
  },
});
