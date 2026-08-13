import { UNASSIGNED_EMPLOYEE_FILTER } from "@/components/EmployeeFilter";
import type { InventoryItem } from "@/types/inventory";

/**
 * Implements the Inventory employee filter's asymmetric semantics: real
 * employee ids alone OR together ("show items assigned to any of these"),
 * but combined with the Unassigned sentinel, the meaning flips to exclusion
 * ("show items assigned to none of these") rather than adding zero-assignee
 * items on top. Unassigned alone still means globally unassigned.
 */
export function matchesEmployeeFilter(
  item: Pick<InventoryItem, "assignedEmployeeIds">,
  selectedEmployeeIds: Set<string>,
): boolean {
  if (selectedEmployeeIds.size === 0) return true;

  const hasUnassigned = selectedEmployeeIds.has(UNASSIGNED_EMPLOYEE_FILTER);
  const realIds = [...selectedEmployeeIds].filter((id) => id !== UNASSIGNED_EMPLOYEE_FILTER);

  if (hasUnassigned && realIds.length > 0) {
    return !realIds.some((id) => item.assignedEmployeeIds.includes(id));
  }
  if (hasUnassigned) {
    return item.assignedEmployeeIds.length === 0;
  }
  return realIds.some((id) => item.assignedEmployeeIds.includes(id));
}
