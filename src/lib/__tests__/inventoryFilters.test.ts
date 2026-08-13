// TypeScript 6 does not pull in `@types/*` packages automatically, so the Jest
// globals (`describe`, `it`, `expect`) are referenced explicitly here rather
// than widening the whole project's tsconfig for one test file.
/// <reference types="jest" />

import { UNASSIGNED_EMPLOYEE_FILTER } from "@/components/EmployeeFilter";
import { matchesEmployeeFilter } from "@/lib/inventoryFilters";

function itemWith(assignedEmployeeIds: string[]) {
  return { assignedEmployeeIds };
}

describe("matchesEmployeeFilter", () => {
  it("matches everything when the filter is inactive (empty selection)", () => {
    expect(matchesEmployeeFilter(itemWith([]), new Set())).toBe(true);
    expect(matchesEmployeeFilter(itemWith(["amina"]), new Set())).toBe(true);
  });

  it("matches only zero-assignee items when Unassigned is selected alone", () => {
    const selected = new Set([UNASSIGNED_EMPLOYEE_FILTER]);

    expect(matchesEmployeeFilter(itemWith([]), selected)).toBe(true);
    expect(matchesEmployeeFilter(itemWith(["amina"]), selected)).toBe(false);
  });

  it("matches items assigned to any selected employee when Unassigned is not selected", () => {
    const selected = new Set(["amina"]);

    expect(matchesEmployeeFilter(itemWith(["amina"]), selected)).toBe(true);
    expect(matchesEmployeeFilter(itemWith(["amina", "bilal"]), selected)).toBe(true);
    expect(matchesEmployeeFilter(itemWith(["bilal"]), selected)).toBe(false);
    expect(matchesEmployeeFilter(itemWith([]), selected)).toBe(false);
  });

  it("flips to exclusion when Unassigned is combined with one or more real employees", () => {
    const selected = new Set(["amina", UNASSIGNED_EMPLOYEE_FILTER]);

    // Assigned to the selected employee — excluded now, not included.
    expect(matchesEmployeeFilter(itemWith(["amina"]), selected)).toBe(false);
    // Genuinely zero-assignee — still included, no special-casing needed.
    expect(matchesEmployeeFilter(itemWith([]), selected)).toBe(true);
    // Assigned to a different, unselected employee — this is the case that
    // would have been silently wrong under the old OR/union logic (it was
    // neither Amina's item nor zero-assignee, so it used to be excluded).
    expect(matchesEmployeeFilter(itemWith(["bilal"]), selected)).toBe(true);
  });
});
