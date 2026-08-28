Read AGENTS.md first and follow it strictly.

## Task

Add multi-select bulk assignment to the Inventory page. Admin and Manager can select several items (or an entire category, or a mix across categories) and assign one employee to all of them at once, in a single action.

**Design decision made up front, worth understanding before implementing:** this does not add a separate "select a category" mode. Selection mode operates on top of the *existing* search/category filter — `filteredItems`, already computed in `inventory.tsx`. A "Select All Visible" action selects whatever the current filter is currently showing. Filter to one category and select-all → that's "assign a whole category." No filter, tap individual cards → that's "assign specific items." One mechanism does both, and it composes: select some items in one category, change the filter, select more in a different category, and assign all of them together in one action. **Selections persist across filter changes** — don't clear the selection set when the filter changes, only when selection mode itself is exited or the assignment completes.

### 1. Selection mode on the Inventory screen

Add a toggle (icon button near the "Inventory" title, or similar — match existing header conventions) that enters/exits selection mode.

**While in selection mode:**
- Tapping a card toggles its selection instead of opening the edit modal. Suppress the existing `onEdit`/delete-trigger behavior entirely while active — don't let a stray tap open `ItemFormModal` or `DeleteConfirmModal`.
- Each `InventoryCard` needs a visual selected/unselected state (checkbox or equivalent — match existing card styling conventions rather than inventing a new visual language).
- Hide the FAB ("+" add item button) — avoid ambiguity with the new bottom action bar.
- A "Select All Visible" / "Deselect All Visible" toggle — label reflects whether every item in the current `filteredItems` is already selected.
- A bottom action bar shows the total selected count (which may be larger than what's currently visible, since selections persist across filter changes) and an "Assign to..." button, disabled when the count is 0. Include a clear way to exit selection mode (X / Cancel) that clears the selection.

### 2. The employee picker for bulk assignment

This is a **single-employee picker** (pick one person to add to every selected item), which is a different interaction shape from `ItemFormModal`'s existing per-item picker (which lets you toggle several employees for one item). Don't try to reuse that component directly — but **do** reuse its underlying data logic exactly: locate how it bridges `sampleUsers` to real synced Clerk accounts via email (the `.trim().toLowerCase()` comparison — see `AGENTS.md`'s note on this) and how it disables/marks entries for people who haven't signed in yet. Mirror that pattern in a new small modal rather than re-deriving it independently — verify the current implementation directly rather than assuming its exact shape, since prompt files in this repo have gone stale against the real code before.

### 3. Applying the assignment

Follow the existing pattern from `ReportEntryView.handleSubmit` — compute the set of updates, then `Promise.all` them, then check for partial failure — rather than adding a new store action or a batched SQL call:

```ts
async function handleBulkAssign(employeeId: string) {
  const targets = items.filter((item) => selectedItemIds.has(item.id));

  const results = await Promise.all(
    targets.map((item) => {
      if (item.assignedEmployeeIds.includes(employeeId)) {
        // Already assigned — additive only, never a no-op failure.
        return true;
      }
      return updateItem(supabase, item.id, {
        assignedEmployeeIds: [...item.assignedEmployeeIds, employeeId],
      });
    }),
  );

  const failedCount = results.filter((succeeded) => !succeeded).length;
  if (failedCount > 0) {
    Alert.alert(
      "Some items could not be updated",
      `${failedCount} of ${targets.length} items failed. Check your connection and try again.`,
    );
    return;
  }

  // success: clear selection, exit selection mode, close the picker modal
}
```

Verify `updateItem`'s exact current signature before wiring this in — the shape above is illustrative, not a guarantee it matches the live function exactly.

## Constraints

- **Additive only.** Never remove an existing assignment as part of this feature — that's out of scope here (bulk unassign, if wanted later, is a separate feature).
- Role gating matches the existing Inventory screen: Admin and Manager both, same as individual item editing already allows — not Admin-only.
- Don't change `DeleteConfirmModal`, the delete flow, or `ItemFormModal`'s own per-item picker — this is additive UI, not a replacement for either.
- Strict TypeScript, no `any`.
- Run `npm run lint`, `npm run typecheck`, and `npm run test` before finishing.

## Reference

Test: select 3 items across two different categories (using the persists-across-filter-changes behavior), assign an employee, confirm all 3 items show the new assignment and any pre-existing assignments on those items are untouched. Test selecting an employee who's already assigned to one of several selected items — confirm no duplicate and no error. Test "Select All Visible" while filtered to a single category, confirm it only grabs that category's items, not the whole inventory.
