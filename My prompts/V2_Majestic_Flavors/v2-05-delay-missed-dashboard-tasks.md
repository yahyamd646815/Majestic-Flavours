Read AGENTS.md first and follow it strictly.

**Suggested model/effort, per part (the parts halt between each, so they're rated separately):**
- **Part A (Delay): Sonnet, extra-high.** Pattern-following, but it has to mirror a server-side rule in TypeScript, reschedule reminders, and not disturb recurrence — several interacting pieces.
- **Part B (missed-task window): Sonnet, high.** One pure function with real edge cases, applied in one place.
- **Part C (Dashboard sections): Sonnet, high.** Mirrors the existing `CollapsibleSection` pattern and reuses A and B.

**Stop after each part and tell Yahya it's ready to commit — don't run git yourself.** Wait for an explicit go-ahead before starting the next part. Part C depends on both A and B, so don't skip ahead.

**Prerequisite:** `v2-supabase-patch-delay-task.sql` must already be applied (adds `tasks.original_due_at` / `delayed_at` / `delayed_by`, the `internal.delayed_due_at` function, and the `public.delay_task` RPC). Before starting, confirm those exist by checking that the new fields round-trip from Supabase — if the RPC or columns are missing, stop and say so rather than working around it.

This is one request from Yahya's dad, split into three parts because they land as separate commits. Each part's rules are written out below; don't assume anything from a sibling part except where stated.

Throughout: verify the current names, props, and behavior of everything referenced (`TaskCard`, the Tasks screen's visible-list logic, `taskStore`, `CollapsibleSection`, `useNowTick`, the Dashboard screen) in the actual repo before relying on this description of them. Where this prompt says "the existing X," it is describing X from memory.

---

## Part A — Delay a task

**What it is.** An assignee who already knows a task will be late can press **Delay** (beside Complete) instead of letting it go overdue. Dad's example: a waiter is assigned to put lemon slices on the tables, but the kitchen hasn't cut the lemons yet, so he can't finish.

**The rule (Riyadh time, fixed UTC+3 — use `getRiyadhParts`, never the device's timezone):**
- Task due **before 20:00** → new due time is **23:59 that same day**.
- Task due **at or after 20:00** → new due time is **10:00 the next day**.

**This rule lives in SQL and is authoritative.** The new due time is computed by `internal.delayed_due_at` inside the `public.delay_task` RPC; the client never sends a time. Do not write the new `due_at` from the client, and do not call `updateTask` for this.

**Who can delay, and when** — every condition must hold:
- the person is assigned to the task (any role, including Admin/Manager if they're assigned);
- the task is not already completed by anyone;
- the task is not yet overdue (due time still in the future);
- the task has not already been delayed (one delay per task).

The RPC enforces all four. Mirror them client-side to fail fast and to decide whether to show the button.

**Everyone assigned is affected** — the due time is a property of the task, not of one person, so delaying moves it for all assignees.

### Steps

1. **Types and mapping.** Add `originalDueAt`, `delayedAt`, `delayedBy` (all nullable) to the `Task` type and to whatever maps database rows to `Task`. Check that the existing edit flow (`updateTask`) doesn't overwrite or null these fields — editing a task must leave delay information untouched.

2. **Pure logic in `lib/tasks.ts`, with tests:**
   - `canDelayTask(task, employeeClerkId, nowMs)` — the four conditions above.
   - `getDelayedDueAt(dueAtIso)` — a TypeScript mirror of the SQL rule, used only to show the person what they're about to get. Its tests must include exactly these cases, which the SQL file's verification queries also use (Riyadh is UTC+3):

     | Current due (UTC) | Riyadh wall time | Expected new due (UTC) |
     | --- | --- | --- |
     | 2026-09-20T11:00Z | 14:00 | 2026-09-20T20:59Z (23:59 same day) |
     | 2026-09-20T16:59Z | 19:59 | 2026-09-20T20:59Z |
     | 2026-09-20T17:00Z | 20:00 | 2026-09-21T07:00Z (10:00 next day) |
     | 2026-09-20T20:59Z | 23:59 | 2026-09-21T07:00Z |
     | 2026-09-20T21:30Z | 00:30 on the 21st | 2026-09-21T20:59Z |

   - Verify the app's own end-of-day value (`getEndOfDayRiyadhIso`, and the `23:59` default in `resolveDueAt`). The SQL uses exactly 23:59:00. If the app's end-of-day is anything different (e.g. includes seconds or milliseconds), **stop and tell Yahya** rather than silently making the two disagree.

3. **Store action.** `delayTask(taskId)` in `taskStore`, calling `supabase.rpc("delay_task", { target_task_id: taskId })`.
   - On success: update the cached task from the returned row, **then reschedule that task's reminders through the existing path** (`rescheduleForTask` in the reminder store). AGENTS.md → Notification Rules: any change to `due_at` must go through the reminder-rescheduling path. A reminder set for "1 hour before" must move with the task.
   - On failure: `console.warn` the real error object (matching the logging already in this store), and return a result the UI can use. The RPC's error messages start with `delay_task:` — map the known ones (`not assigned`, `already delayed`, `already completed`, `already overdue`, `task not found`, `not signed in`) to short friendly messages and fall back to a generic one for anything else.

4. **UI on `TaskCard`.**
   - A **Delay** button beside Complete, shown only when `canDelayTask` is true for the signed-in person. Large touch target, consistent with the existing buttons.
   - Tapping it shows a confirmation naming the exact result, e.g. "Move this task to 11:59 PM today?" / "…to 10:00 AM tomorrow?", computed with `getDelayedDueAt`. Confirm / Cancel — a plain confirmation, not the typed-DELETE flow (nothing is destroyed). One delay per task makes this irreversible, which is why it asks first.
   - After a delay, the card shows a **Delayed** badge and an "Originally due …" line, visible to everyone who can see the task.
   - Disable the button while the request is in flight so it can't be double-tapped.

5. **Recurrence.** Verify that delaying a recurring task's occurrence moves only that occurrence, and that occurrence generation can't then re-create it or its neighbours. Occurrence keys should come from the rule's schedule, not from the task's current `due_at` — confirm that by reading `useTaskOccurrenceGeneration` and `taskOccurrences`, and say what you found in the summary. If delaying could cause a duplicate or a missing occurrence, stop and flag it.

### Constraints (Part A)
- No new libraries. No changes to completion logic, deletion logic, or the recurrence generator itself.
- Strict TypeScript, no `any`. Run `npm run lint`, `npm run typecheck`, `npm run test`.

### Reference (Part A)
Delay a task due at 14:00 → it should now be due 23:59 today. Delay one due at 21:00 → 10:00 tomorrow. Confirm the Delay button is gone after delaying, on a completed task, and on an overdue task. Set a reminder on a task, delay it, and confirm the reminder now fires relative to the new time. Sign in as a second assignee on the same task and confirm they see the new due time and the Delayed badge. Try delaying a recurring occurrence and confirm the next occurrence is unaffected.

**Stop here. Tell Yahya Part A is ready to commit.**

---

## Part B — Missed tasks drop off the Tasks page after 2 days

**What it is.** A *missed* task is one that's past its due time and not completed by anyone. Today these stay on the Tasks page forever. The new rule:

- **An assignee's own Tasks page:** a missed task with no reason from them stays visible for **48 hours after its due time**, then drops off. If they give a reason, it drops off immediately (the existing behavior — verify it).
- **Anyone viewing a task they're not assigned to** (Admin/Manager looking at other people's tasks, including other admins'): a missed task drops off after the same 48 hours, **or as soon as every assignee has given a reason**, whichever comes first.
- Dropping off the Tasks page **hides it, it does not delete anything.** The task and its completion records stay in the database and stay visible in the Records page as missed (with or without a reason). Verify Records reads the task store directly and isn't filtered through whatever you change here.

### Steps

1. **Pure logic in `lib/tasks.ts`, with tests.** Reuse `isTaskFullyCompleted` and `hasEmployeeResponded` — don't re-derive them (AGENTS.md → To-Do List Rules).
   - `MISSED_VISIBILITY_WINDOW_MS` = 48 hours, as a named constant.
   - `isMissedTask(task, nowMs)` — due time has passed and the task is not fully completed.
   - `isMissedTaskHiddenForViewer(task, viewerClerkId, nowMs)`:
     - not a missed task → `false` (never hide pending or completed tasks);
     - more than 48 hours past due → `true` (strictly greater: exactly 48h is still visible);
     - **no assignees at all → only the 48-hour rule applies.** (Careful: "every assignee has responded" is vacuously true for an empty set, which would hide an unassigned missed task the instant it became overdue. Test this explicitly.)
     - viewer is an assignee → `true` if they've responded;
     - viewer is not an assignee → `true` if every assignee has responded.
   - The 48 hours is measured from the task's current `dueAt`. (A delay can only happen before a task is overdue, so a delayed task simply has a later due time.)
   - Tests must cover: pending task; completed task; missed with no response inside 48h; missed past 48h; exactly 48h; assignee who responded; non-assignee with all / some / none responded; unassigned missed task; a delayed task that later went overdue.

2. **Apply it in one place** — the Tasks screen's existing visible-list logic — for all three roles. Read how that logic currently filters before changing it, and extend it rather than adding a parallel filter. Make sure the screen re-evaluates over time using the existing `useNowTick`, so a task disappears on its own without a reload.

3. **Interactions to check, not assume:** the due-date time filter, the search, the category/employee filters, the overdue-first sort, and multi-select (a hidden task must not remain selected or be acted on by a bulk action).

### Constraints (Part B)
- Don't delete or modify any data. Don't touch Records' own filtering, the Dashboard, or the Delay feature.
- Strict TypeScript, no `any`. Run `npm run lint`, `npm run typecheck`, `npm run test`.

### Reference (Part B)
Create a task due a minute from now with two assignees, leave it overdue with no reasons, and confirm it stays visible; for a faster check, temporarily point a test at a task whose due time is 47h59m vs 48h01m ago. Have one assignee give a reason and confirm it vanishes from *their* page but stays on the other assignee's and on an Admin's. Have the second give a reason and confirm it vanishes from the Admin's page too. Confirm all of it still shows in Records. Confirm an unassigned missed task does not disappear instantly.

**Stop here. Tell Yahya Part B is ready to commit.**

---

## Part C — Today's tasks on the Dashboard (Admin and Manager)

**What it is.** Below the stock sections on the Dashboard, a "Today's Tasks" area with three collapsible sections — **Upcoming**, **Delayed**, **Missed** — each using the existing `CollapsibleSection`, collapsed by default, with a count in its title.

**Placement:** below the Out of Stock / Low Stock sections, so the category filter at the top of the Dashboard still sits directly above what it affects. **The category filter does not apply to tasks.**

**Who sees it:** Admin and Manager only. Verify who can currently reach the Dashboard; if Employees can, they must not see these sections.

### Bucket rules (Riyadh time — use `getRiyadhIsoDate` and `getRiyadhParts`)

A task is a *candidate for today* if its `dueAt` falls on today's Riyadh date, **or** it was delayed and its `originalDueAt` falls on today's Riyadh date. (The second clause keeps a task visible tomorrow morning if it was delayed from today to 10:00 tomorrow.)

Candidates that are fully completed are excluded. Each remaining candidate goes in exactly one bucket, checked in this order:

1. **Missed** — its due time has passed, and `isMissedTaskHiddenForViewer` (from Part B) is `false` for the viewer. A task that's missed *and* previously delayed goes here, not under Delayed.
2. **Delayed** — it has `delayedAt` and its due time hasn't passed.
3. **Upcoming** — everything else (due time still ahead, never delayed).

A candidate that Part B hides (all assignees gave reasons, or older than 48h) appears in no bucket.

### Steps

1. **Pure function with tests:** `getTodayTaskBuckets(tasks, viewerClerkId, nowMs)` returning `{ upcoming, delayed, missed }`. Put it in `lib/tasks.ts`. Test: a task due today (each bucket); a task delayed from today to tomorrow 10:00, viewed today and viewed tomorrow after it's overdue; a completed task; a task due tomorrow (excluded); a task due yesterday (excluded); a missed task with all reasons given (excluded); an unassigned missed task.
2. **UI.** Each row shows the task title, assignee names (reuse the existing name-resolution helper), and due time. Delayed rows add "was HH:MM"; missed rows are otherwise the same. Rows are read-only for now — no navigation, no actions.
3. **Live updates.** Use `useNowTick` so a task moves Upcoming → Missed on its own without a reload.
4. Friendly empty state per section, matching the stock sections.

### Constraints (Part C)
- Read from the already-loaded task store; no new fetches. Don't touch the stock sections' behavior beyond placing these below them.
- Strict TypeScript, no `any`. Run `npm run lint`, `npm run typecheck`, `npm run test`.

### Reference (Part C)
Create three tasks due today — one a few hours out, one delayed, one already overdue — and confirm one lands in each section. Wait for the upcoming one to pass and confirm it moves to Missed on its own. Complete a task and confirm it leaves the Dashboard. Confirm an Employee account doesn't see the sections. Confirm the category filter changes the stock sections and leaves the task sections alone.

**Stop here. Tell Yahya Part C is ready to commit.**

---

## Prerequisites to verify (list these in your final summary)
- `v2-supabase-patch-delay-task.sql` applied: the three `tasks` columns, `internal.delayed_due_at`, `public.delay_task`.
- No other external prerequisites for this prompt. If you find one, say so.

End your final summary with the **Files changed** list required by AGENTS.md, separately for each part.
