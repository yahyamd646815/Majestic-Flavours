Read AGENTS.md first and follow it strictly.

## Task

The Inventory employee filter's "Unassigned" chip currently ORs with real employee selections (Amina + Unassigned → her items *plus* zero-assignee items). That's wrong — when combined with one or more real employees, "Unassigned" should flip to an exclusion: show items assigned to **none** of the selected employees, not items assigned to them plus items assigned to nobody.

**The exact truth table to implement** (`E` = selected real employee ids, `U` = whether the Unassigned sentinel is also selected):

| `E` | `U` | Result |
|---|---|---|
| empty | false | inactive — matches everything |
| empty | true | `assignedEmployeeIds.length === 0` |
| non-empty | false | assigned to *any* of `E` (unchanged — this is "normal multiselect") |
| non-empty | true | assigned to **none** of `E` (this is the fix — flips from OR to exclusion) |

The last row naturally covers a genuinely zero-assignee item too, without a separate branch for it — an empty array can never intersect a non-empty set, so "assigned to none of `E`" is already true for it. Don't special-case that.

### 1. Extract a pure, tested helper — `lib/inventoryFilters.ts`

```ts
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
```

Verify the actual import path for `UNASSIGNED_EMPLOYEE_FILTER` and `InventoryItem` before assuming these are correct.

### 2. Use it in `inventory.tsx`

Replace the inline `matchesEmployee` logic in `filteredItems` with a call to `matchesEmployeeFilter(item, selectedEmployeeIds)`.

### 3. Tests — `lib/__tests__/inventoryFilters.test.ts`

Cover all four rows of the truth table explicitly, plus the specific case that motivated this fix: an item assigned to a *different*, unselected employee (not the one in the filter, and not zero-assignee) should still show when Unassigned + a specific employee are combined — that's the case that would have been silently wrong under the old union logic and is easy to get backwards again without a test pinning it down.

### 4. Fix the now-incorrect doc comments

Both of these currently claim pure OR/union semantics, which is no longer true once a real employee id and the Unassigned sentinel are selected together:

- `EmployeeFilter.tsx` — the `UNASSIGNED_EMPLOYEE_FILTER` constant's doc comment ("composing through the same OR logic as a real id") and the `selectedEmployeeIds` prop doc comment ("OR'd together").
- `inventoryStore.ts` — the `selectedEmployeeIds` field's doc comment (same "OR logic" claim).

Update both to describe the actual asymmetric behavior — point to `matchesEmployeeFilter`'s own doc comment rather than re-explaining the truth table in three places.

## Constraints

- Category filtering and the AND-across-dimensions rule (category AND employee) are unrelated and unaffected — don't touch that logic.
- The Reports page has no "Unassigned" concept (a report always has exactly one reporter) — this change is Inventory-only.
- Strict TypeScript, no `any`.
- Run `npm run lint`, `npm run typecheck`, and `npm run test`.

## Reference

Test by hand too, not just the unit tests: select "Unassigned" + one employee who has *some* items assigned. Confirm their assigned items disappear, zero-assignee items still show, and — the case most likely to be missed — an item assigned to a *different* employee also shows.
