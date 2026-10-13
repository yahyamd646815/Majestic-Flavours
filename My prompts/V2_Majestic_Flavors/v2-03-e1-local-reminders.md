Read AGENTS.md first and follow it strictly.

**Suggested: Opus, extra-high effort.** The first native notification module in this project, genuinely novel scheduling/reconciliation logic, and real stakes if it gets it wrong (a missed reminder is a silent failure nobody notices until it matters).

**Prerequisite:** `v2-supabase-patch-round10.sql` must already be applied.

**This requires a full EAS rebuild of both profiles — `expo-notifications` is a native module, OTA cannot deliver it.** Do not rebuild yet: `v2-03-e2` (remote push, a separate upcoming prompt) needs the same native module, and doing both before rebuilding once is the point — rebuilding twice for the same underlying dependency would be wasted effort.

This prompt is local-only: reminders scheduled and fired entirely on-device, no server involved. Remote push ("you were just assigned a task") is `v2-03-e2`'s job, not this one.

## Part A — expo-notifications setup

Install `expo-notifications`, add the plugin config to `app.config.js`, and request notification permission — reasonable to do this once per session on sign-in, or lazily the first time someone tries to set a reminder, your call on which reads more naturally in this codebase. Confirm the plugin config lands correctly on Android (this project has no `ios` block, so Android is the only real target here, matching what `v2-03-d3` already established about the picker code).

## Part B — the reminder data model and UI

An employee can set one reminder on any task they're assigned to: "N hours before due" or "N days before due" — a single choice per task, not stacked reminders (matches the schema's `(task_id, employee_clerk_id)` primary key). Setting a new one replaces the old.

**Where this lives:** a new control on `TaskCard`, visible only to the signed-in employee viewing a task they're personally assigned to — not Admin/Manager, since this is a purely personal preference with no operational relevance to them. A small number input plus an hours/days toggle, matching `RecurrenceFields`' own established number-input-plus-unit-label pattern rather than inventing new UI conventions.

**Recurring tasks — a deliberate scope decision, not an oversight:** a reminder is per-occurrence (per `task_id`), matching the existing principle that a generated occurrence is an ordinary, independent task once created — nothing here tries to make a reminder preference persist across a recurring rule's future occurrences. This matches the use case as actually described (a significant, often one-time task worth a personal reminder), not high-frequency recurring ones, where re-setting a reminder daily would be genuinely impractical — flag this explicitly if it turns out to matter, but don't build toward automatic persistence across occurrences now.

## Part C — scheduling, and keeping it correct as things change

The reminder *preference* (offset value/unit) is the source of truth in Supabase and survives app restarts and reinstalls. The actual OS-level scheduled notification is device-local and ephemeral — it has to be re-derived, not assumed to already exist, every time the app starts.

**Reconcile on every signed-in session start**, mirroring the same pattern `useTaskOccurrenceGeneration` and the cleanup hooks already use: for every `task_reminders` row belonging to the current user, compute the trigger instant (`task.dueAt` minus the offset), and if it's still in the future, schedule a local notification for it — using a stable, deterministic identifier (e.g. derived from `task_id` + `employee_clerk_id`) so re-scheduling on a later session start replaces rather than duplicates it. If the trigger instant has already passed, don't schedule anything for it.

**This needs to stay correct as the underlying task changes, not just at creation:**
- Editing a task's due date must reschedule any reminder against it to the new, correct trigger instant.
- Deleting a task, or removing this employee's own assignment from it, must cancel the notification — nobody should get reminded about something that no longer applies to them.
- Deleting a reminder itself must cancel its notification outright.

Decide the cleanest place for this reconciliation to live given the codebase's actual current structure — verify how `tasks`/`task_reminders` data flows through the stores right now before assuming a specific hook shape, the same way every other prompt this session has insisted on checking actual current file contents rather than assuming.

## Part D — the time filter

A new filter on the Tasks screen: Today / This Week / This Month / All Time — a genuinely separate type from `ReportDateFilter`, not an extension of it (Reports' own filter stays exactly three options, unchanged). This exists specifically so an employee can find and set a reminder on a task due weeks or months out, not just what's currently visible under the existing default view.

"This Month" is new logic, not present anywhere in this codebase yet: the current Riyadh calendar month, first day through last, regardless of where today falls within it — deliberately calendar-based rather than a rolling window, since the point is finding what's coming up in the current month, not a backward-looking review window the way Reports' "This Week" is.

## Constraints

- Don't touch anything about remote push, push token registration, or Edge Functions — that's `v2-03-e2`, not this prompt.
- Don't touch recurrence generation, the calendar UI, deletion, or completion logic.
- Strict TypeScript, no `any`.
- Run `npm run lint`, `npm run typecheck`, and `npm run test`.

## Reference

Set a reminder on a task due a few minutes out, leave the app open, and confirm the local notification actually fires at the right time. Set a reminder, then edit that task's due date, and confirm the reminder now fires against the *new* time, not the old one. Set a reminder, then delete the task, and confirm nothing fires. Close and reopen the app after setting a reminder and confirm exactly one notification fires at the right time — not zero, not two. Confirm the time filter's four options narrow the Tasks list correctly, especially "This Month" against a task due later in the current calendar month.
