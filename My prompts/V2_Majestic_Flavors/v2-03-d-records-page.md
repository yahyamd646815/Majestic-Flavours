Read AGENTS.md first and follow it strictly.

**Suggested: Sonnet, high effort.** Mostly pattern-following — `useReportCleanup`'s own shape for the cleanup hook, `ReportDateFilter` for the date filter — with one genuinely new piece: the per-employee four-state summary logic. Not the same class of novelty as recurrence generation, so Opus isn't warranted here.

**Prerequisite:** `v2-supabase-patch-round8.sql` must already be applied — without it, the cleanup this prompt adds will silently fail to remove `task_completions` rows even when the parent `tasks` row deletes successfully. Verify before starting.

This is a genuinely separate page from the Tasks screen itself, not a mode within it — a historical view of completion activity, organized by employee rather than by task.

## Part A — the Records button and page

A new button, top-right of the Tasks screen, **Admin/Manager only** (employees never see it — this reflects nothing about their own history yet; that's explicitly deferred, not part of this prompt). Opens a new screen, not a modal — this has its own filter and its own drill-down, and deserves its own navigable place rather than living inside another screen's chrome.

### Date filter

Today / This Week / All Time — reuse `ReportDateFilter` and `matchesDateFilter` from `lib/reports.ts` directly, don't reimplement the three-way logic. Applied against each task's `dueAt`, converted to its Riyadh calendar date the same way everything else in this codebase does that conversion (via `getRiyadhParts`) — not a new date-handling approach.

**Important scope note:** this is a different filter set from what's planned for `v2-03-e`'s reminder feature (which will add a fourth "This Month" option specifically for that use case). This page uses exactly the three options Reports already has — don't add a fourth here.

### The employee list — four states, derived, not stored

For each employee (reuse the existing roster/`assignableEmployees` pattern for who to list), show their name and a status summary beneath it, computed from *only the tasks assigned to them that fall within the current date filter*:

- **"Nothing assigned"** — zero tasks in the filtered set.
- **"Nothing completed"** — they have tasks in the filtered set, but haven't responded to any of them (reuse `hasEmployeeResponded`).
- **"In progress"** — some responded to, some not.
- **"All completed"** — every task in the filtered set is resolved for this person, meaning for each one either `isTaskFullyCompleted` is true (someone else closed it) or `hasEmployeeResponded` is true for this specific person. This is the same condition that already removes a task from their *active* list on the main Tasks screen — reuse both functions directly rather than re-deriving the logic here (AGENTS.md → To-Do List Rules: never re-derive this inline).

Compute this from the already-loaded `tasks` array in `taskStore` — no new fetch needed, this is client-side aggregation over data that's already there.

## Part B — the detail view

Tapping an employee opens a modal listing every one of their tasks within the current filter, each showing:

- Whether it's currently overdue for them (`isTaskOverdueForEmployee`) — live-derived, same as everywhere else, not a historical snapshot of overdue status at some past moment.
- Their own completion/miss record if they've submitted one — status, note, and the `recordedAt` timestamp of when they hit Complete or gave their reason. Reuse `TaskCard`'s existing per-completion display pattern rather than inventing new markup for the same information.
- A task they haven't yet responded to shows as still pending, with no completion details to show.

## Part C — 4-month cleanup

A new hook, `useTaskRecordCleanup` or similar — mirror `useReportCleanup` closely: Admin-only, silent (console logging only, no UI), runs once per signed-in session (keyed on Clerk's `sessionId` via a ref, exactly matching that hook's existing guard pattern). Deletes `tasks` rows where `due_at` is older than 4 months back from today (Riyadh), regardless of completion status — matching reports' own cleanup, which is equally blunt about not special-casing anything still technically unresolved.

Called once from the authenticated layout, alongside the other per-session hooks already there.

**Explicitly not in scope:** any photo/video retention logic. That's a separate, shorter retention window tied to a feature that doesn't exist yet (`v2-03-f`) — this prompt only handles the text/record data's 4-month window, matching what reports already do.

## Constraints

- Don't touch anything about task creation, assignment, completion submission, deletion, or recurrence generation — this prompt only adds a new read-oriented view and a cleanup hook on top of existing data.
- Don't add search, category filter, or employee filter to the Records page — it's organized by employee row already; those wouldn't map onto this view the way they do the main Tasks screen.
- Employee-facing history is explicitly deferred — don't build toward it beyond what naturally falls out of this (e.g., don't gate the underlying data query in a way that would make adding it later awkward, but don't build any employee-facing UI for it either).
- Strict TypeScript, no `any`.
- Run `npm run lint`, `npm run typecheck`, and `npm run test`.

## Reference

Test as Admin: with a mix of employees in different states (one with nothing assigned, one with a fully-resolved set, one partially done, one untouched), confirm all four summary states show correctly for the Today filter, and confirm switching to This Week or All Time changes which tasks count toward each summary. Tap into an employee's detail view and confirm a completed task, a missed task with its reason, and a still-pending task all display correctly and distinctly. Confirm a Manager can also reach this page. Confirm an Employee never sees the Records button at all.
