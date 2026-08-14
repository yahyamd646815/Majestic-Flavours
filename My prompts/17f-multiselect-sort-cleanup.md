Read AGENTS.md first and follow it strictly.

**Prerequisite:** 17e must already be complete — this converts the category filter and the employee/Unassigned filter (both currently single-select, per 17e) into multi-select together, in one pass.

## Task

Commit after each lettered part below, not as one combined diff.

---

### Part A — Multi-select filters: Inventory

Convert category and employee filtering from single-select to multi-select, with these semantics:

- **Within one filter type, OR.** Selecting both "Meat" and "Dairy" shows items in either.
- **Across filter types, AND.** A category selection plus an employee selection shows only items satisfying both.
- **An empty selection set means that filter dimension is inactive — matches everything, not nothing.** This is the trap to get right: `selectedIds.size === 0 ? true : selectedIds.has(x)` is the correct shape. `selectedIds.has(x)` alone, without the empty-set check, is wrong — it would silently hide every item the moment this ships, since nothing is selected by default.
- **"All" clears that filter type's selection set entirely** and is shown as active exactly when the set is empty.

**"Unassigned" (from 17e) becomes one more possible member of the employee selection set**, not special-cased — it composes through the exact same OR-within-dimension logic as a real employee id. Selecting "Amina" and "Unassigned" together should show her items plus anything with zero assignees; this should fall out of the general logic above, not need its own branch.

`selectedCategoryId` currently lives in `inventoryStore`, not local component state — verify this before changing it, and convert it there (`selectedCategoryIds: Set<string>` with a toggle action) rather than moving it to local state. Apply the same placement decision to the employee-filter state for consistency.

`CategoryFilter`'s prop contract changes from `selectedCategoryId: string | null` / `onSelect` to a multi-select shape (`selectedCategoryIds: Set<string>` / `onToggle`) — update its callers accordingly, including the employee filter row from 17e if it shares this component.

Update the empty-results message to something short and generic rather than category-specific, since multiple filter types can now combine to produce zero results — e.g. "No items match these filters — try a different combination."

### Part B — Multi-select filters: Reports

Same semantics as Part A (including the empty-set-means-inactive rule), applied to `ManagerReportsView`'s **category** and **reporter** filters — **not** the date filter, which stays single-select. Date ranges have inherent subsumption ("This Week" already includes "Today") that doesn't compose the same way categories or people do.

This is local `useState` in `ManagerReportsView`, not store state — verify before changing. Affects both `historicalReports`'s filtering and `todayRows`'s filtering (the roster-based "today" view) — both currently filter by a single value, both need the same treatment so they stay consistent with each other.

`ReportFilters`'s prop contract changes the same way `CategoryFilter`'s does in Part A.

Update the empty-results message the same way as Part A.

---

### Part C — Alphabetical sort

Add a sort-mode toggle to both screens, defaulting to existing behavior unless the user switches it:
- **Inventory:** default (existing/natural order) vs. alphabetical by item name.
- **Reports:** default (existing date-descending order) vs. alphabetical by **reporter name** — not date, since that's the only alphabetizable field on a report.

Build as a simple two-state toggle, structured so a third "by status" mode (once the ping feature ships) is a small addition later, not a redesign.

---

### Part D — NativeWind cleanup (from CodeRabbit)

Per AGENTS.md's styling rules, static non-dynamic styles should be NativeWind classes, not `StyleSheet`:
- `BulkAssignModal.tsx`: `overlay` (`bg-black/50`), `sheet` (rounded corners, max-height, padding), `scrollContent`, and the conditional disabled-opacity styles.
- `inventory.tsx`: the two conditional disabled-opacity styles, and remove the `disabled` `StyleSheet` entry once nothing references it.

Leave `fabShadow` alone — shadows are a documented `StyleSheet` exception in AGENTS.md.

## Constraints

- Don't touch the status-ping feature — status-based sort/filter stays deferred until it exists.
- Strict TypeScript, no `any`.
- Commit after each lettered part.
- Run `npm run lint`, `npm run typecheck`, and `npm run test` after every part.

## Reference

Test explicitly: select Meat + Dairy together (shows both, not neither). Add an employee filter on top (narrows to the intersection — try a combination producing zero results and confirm the new empty-state message). Select "Unassigned" alongside a specific employee (shows their items plus zero-assignee items). With *no* filters selected at all, confirm every item still shows — this is the empty-set-means-inactive case, and it's the easiest one to get backwards. Toggle alphabetical sort on both screens; confirm Reports sorts by reporter name, not date.
