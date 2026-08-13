import { ScrollView, StyleSheet, Text, TouchableOpacity } from "react-native";

import type { AssignableEmployee } from "@/lib/assignableEmployees";

type EmployeeFilterProps = {
  employees: AssignableEmployee[];
  /** `null` means "All". Otherwise a Clerk user id, matched against
   * `item.assignedEmployeeIds`. */
  selectedEmployeeId: string | null;
  onSelect: (employeeId: string | null) => void;
};

/** Same single-select chip-row pattern as `CategoryFilter`: tapping a chip
 * replaces the current selection, tapping "All" clears it.
 *
 * Only employees who have actually signed in (and so have a real Clerk id)
 * are listed — `assignedEmployeeIds` can never contain anyone else, so a chip
 * for them could never match an item. */
export function EmployeeFilter({ employees, selectedEmployeeId, onSelect }: EmployeeFilterProps) {
  const isAllActive = selectedEmployeeId === null;
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
        onPress={() => onSelect(null)}
      >
        <Text className={isAllActive ? "chip__text chip__text--active" : "chip__text"}>All</Text>
      </TouchableOpacity>

      {filterableEmployees.map((employee) => {
        const isActive = selectedEmployeeId === employee.clerkUserId;
        return (
          <TouchableOpacity
            key={employee.id}
            className={isActive ? "chip chip--active" : "chip"}
            activeOpacity={0.8}
            onPress={() => onSelect(employee.clerkUserId)}
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
