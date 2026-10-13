Read AGENTS.md first and follow it strictly.

**Suggested: Opus, high effort.** Extending proven, working infrastructure rather than inventing new architecture — but the schema change (composite key → per-row id) touches every existing piece of the reminder system, so this isn't purely mechanical either.

**Prerequisite:** `v2-supabase-patch-round12.sql` must already be applied.

## Part A — don't offer a reminder on a task that's already completed or already overdue

A task that's completed or already past its due time (for the employee viewing it — reuse `isTaskFullyCompleted` and `isTaskOverdueForEmployee` directly, don't re-derive) has no meaningful reminder to set: a completed task doesn't need one, and an overdue one has already passed the only instant a reminder could fire before. The underlying scheduling logic already correctly refuses to schedule for either case — what's missing is the entry point still inviting someone to try, producing the generic "already passed" message that isn't actually true or helpful in the completed case.

Hide or disable the reminder-setting control entirely in both states, rather than showing it and having it fail after the fact — matches how the rest of this app already avoids presenting actions that can't meaningfully succeed, rather than presenting them and then erroring. Verify `TaskReminderControl`'s current actual structure before changing it.

## Part B — up to 3 reminders per task

An employee can now stack up to 3 independent reminders on a single task they're assigned to (e.g. "1 day before" and "3 hours before" and "30 minutes before"), rather than one reminder that a new choice replaces. Each is now its own row (round12's schema), with its own id — generate this the same way task/other entity ids are already generated elsewhere in this codebase, not a new convention.

**Scheduling:** each of an employee's up to-3 reminders on a task needs its own, independently-scheduled local notification — `taskReminderIdentifier` needs to key off each reminder's own `id` now, not the old `task_id`+`employee_clerk_id` composite, so multiple reminders on the same task correctly coexist instead of overwriting each other's scheduled notification.

**UI:** `TaskReminderControl` needs to show a list of up to 3 existing reminders (each individually removable) plus an "add another" affordance that's only offered while fewer than 3 exist. Adding a 4th is prevented client-side, not by a database constraint — this is a deliberate, stated choice (see round12's own comment) given a stray extra reminder has no integrity or security implication, unlike `task_completions`' RLS-enforced "not already completed" rule, which was protecting a real business invariant.

**Reconciliation, cancellation, and rescheduling** (`taskReminderStore.ts`'s `reconcile`, `rescheduleForTask`, `forgetTask`) all need to correctly handle a task having multiple reminder rows now instead of at most one — verify each of these against the new shape rather than assuming the old single-reminder logic generalizes automatically.

## Constraints

- Don't touch remote push (`v2-03-e2`) or anything about task completion/deletion logic itself — only how the reminder system reacts to those states.
- Strict TypeScript, no `any`.
- Run `npm run lint`, `npm run typecheck`, and `npm run test` — and per the lock-file rule in AGENTS.md, `npm ci` if anything in `package.json` changes (it shouldn't for this prompt, but verify rather than assume).

## Reference

Confirm the reminder control no longer appears (or is clearly disabled) on a completed task and on an overdue one, in place of the old generic error. Set 3 reminders on one task with different offsets and confirm all 3 actually fire independently at their own correct times, and that a 4th attempt is blocked in the UI before it reaches Supabase. Remove one of three and confirm the other two are unaffected — still scheduled, still correct. Close and reopen the app with 3 reminders active and confirm reconciliation leaves exactly 3 scheduled, not fewer or duplicated.
