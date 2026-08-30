Read AGENTS.md first and follow it strictly.

**First of six bundled prompts for the to-do list feature (v2-03-a through v2-03-f).** This one builds the foundation: categories, one-time tasks, assignment, and completion. Recurrence, the calendar UI, records/auto-delete, notifications, and photo/video are deliberately separate, later prompts — don't reach ahead into any of them.

**Prerequisite:** `supabase-patch-round10.sql` must already be applied. Verify before starting.

## Task

### 1. New tab — Admin/Manager and Employee both get one

A new "Tasks" (or similar — your call, flag your choice) tab in the bottom navigation, alongside what v2-02 already set up. Admin/Manager see all tasks; Employees see only tasks assigned to them, matching the RLS policies already in place.

### 2. Category + task creation — the "+" button

A "+"-only button at the bottom of the screen. Tapping it opens a popup with two options: **create a category** or **create a task**.

- **Creating a task requires an existing category to be selected first.** Without any categories existing yet, task creation isn't reachable at all — this is a hard restriction, not just a UI nudge. Verify this is actually enforced (disabled state or equivalent), not just implied by ordering.
- Task creation requires: title, category, at least one assigned employee (see below), and a due date/time — defaulting to end of day (Riyadh) if the admin doesn't pick one explicitly. Resolve this to a concrete value before writing to `due_at`; don't write null and default at read time.

### 3. Assignment — reuse the existing patterns, don't rebuild them

Task assignment is many-to-many, same premise as inventory item assignment. Reuse `getAssignableEmployees` for the employee picker rather than building a new one.

**Creation requires at least one assignee** (app-level validation — the database allows zero rows, since removal down to zero is a valid later state).

**Removing an assignment down to zero requires a warning; removing one assignee while others remain does not.** English only — confirmed, not an oversight (every other modal in this app is trilingual, but Yahya's confirmed all current admins/managers are English speakers, so this is a deliberate, scoped exception, not a pattern to extend elsewhere).

### 4. Completion and miss-reason

Two terminal states, one per task (not per assignee — any assigned employee completing it closes it for everyone, confirmed):

- **Completed:** a "Complete" button, with an optional note. Any assigned employee can trigger this.
- **Missed (past due):** once a task's `due_at` has passed and it's still open, the completion action changes to require a note — "Submit Reason" instead of a bare complete button. The database enforces this too (`missed_requires_note` constraint) — don't rely on the UI alone.

**Once either terminal state is recorded, the task disappears from every assigned employee's active list.** For Admin/Manager, it should still be visible somewhere reachable (the full records/history view is v2-03-d — for now, just don't hide completed/missed tasks from Admin/Manager's own view of all tasks, even though employees stop seeing them).

**Sort order on the employee's list: overdue tasks first.** A task becomes "overdue" purely by `due_at` having passed with no completion row yet — don't add a separate status field for this, derive it.

### 5. Search, filter, sort — mirror the existing Inventory patterns exactly

- **Search bar** — same fixed-position pattern already used on Inventory/Reports.
- **Category filter** — multi-select, same OR-within/empty-means-inactive semantics as `lib/inventoryFilters.ts`. Task categories, not inventory ones.
- **Employee filter + "Unassigned" filter (Admin/Manager only)** — same asymmetric logic as `matchesEmployeeFilter` (a real employee combined with "Unassigned" means *not assigned to that employee*, not "assigned to nobody"). Reuse or closely mirror that function rather than reimplementing the logic independently.
- **Sort** — two modes: **"Recently added" (default, by `created_at` descending) and "A–Z" (by title)**. "Recently added" is a new sort mode that doesn't exist elsewhere yet — extend the existing `SortToggle` pattern rather than building a separate control.

## Constraints

- Don't build recurrence, the calendar UI, records/auto-delete, notifications, or photo/video — all separate, later prompts in this bundle.
- Don't touch `categories` (inventory's) — `task_categories` is a completely separate table and concept.
- Don't touch the v2-02 navigation restructure — this adds a new tab alongside it, doesn't change it.
- Strict TypeScript, no `any`.
- Run `npm run lint`, `npm run typecheck`, and `npm run test`.

## Reference

Test: try creating a task with zero categories existing — confirm it's genuinely blocked. Create a task assigned to two employees, complete it as one of them, confirm it's gone from both employees' lists. Create a task due in the past (or wait for one to become overdue), confirm the button becomes "Submit Reason" and a note is actually required — try submitting empty and confirm it's rejected both in the UI and if you bypass it directly against Supabase. Confirm an Admin can still see a completed task somewhere even though the employees can't. Test the employee+Unassigned filter combination the same way it was tested for Inventory — a real employee should exclude their tasks, not include only-zero-assignee tasks unioned with theirs.
