Read AGENTS.md first and follow it strictly.

**Prerequisite:** 17d must already be complete — this builds directly on `addEmployeeToItem`/`removeEmployeeFromItem`, not the old read-modify-write pattern.

## Task

Commit after each lettered part below, not as one combined diff.

---

### Part A — Bulk unassign

Multi-select currently can only *add* an employee to selected items. Add an Assign/Unassign mode toggle to `BulkAssignModal` — a small segmented control at the top, defaulting to "Assign" so existing behavior is unchanged unless someone actively switches it. The employee list and picker UI stay identical in both modes; only the action and its wording change ("Assign" → "Unassign").

Add `handleBulkUnassign` in `inventory.tsx`, calling `removeEmployeeFromItem` (from 17d) per selected item — same `Promise.all` / partial-failure-handling shape as `handleBulkAssign` already uses.

---

### Part B — Employee filter row (Inventory only)

New filter row, same chip-row pattern as the existing `CategoryFilter`, listing employees via `getAssignableEmployees`. **Build this as single-select for now**, mirroring `CategoryFilter`'s current exact interaction pattern (one selected id, or `null` for "All") — not multi-select. Multi-select conversion for both this and the category filter happens together in a later prompt; building it twice would be wasted work.

### Part C — "Unassigned" filter value

Add an "Unassigned" chip to the same row, alongside "All" and the per-employee chips — one more possible single-select value, matching how `null`/"All" already works today. Selecting it filters to items where `assignedEmployeeIds.length === 0`.

## Constraints

- Don't convert either filter to multi-select yet — later prompt.
- Don't touch alphabetical sort or the NativeWind cleanup — later prompt.
- Strict TypeScript, no `any`.
- Commit after each lettered part.
- Run `npm run lint`, `npm run typecheck`, and `npm run test` after every part.

## Reference

Test: bulk-unassign someone from a mix of items where some don't have them assigned at all — should not error. Confirm the employee filter and "Unassigned" behave exactly like the existing category filter's single-select interaction (tapping a chip replaces the current selection, tapping "All" clears it) — no new interaction pattern should exist here yet.
