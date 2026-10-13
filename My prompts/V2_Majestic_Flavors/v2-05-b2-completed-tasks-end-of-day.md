Read AGENTS.md first and follow it strictly.

**Suggested: Sonnet, medium effort.** One pure function plus wiring into a hide-set that already exists. Follow-up to `v2-05` Part B, found while testing it.

**Prerequisite:** `v2-05` Part B is committed. This extends the exact logic Part B added, so don't start it on top of uncommitted Part B work. No SQL and no external prerequisites.

Throughout: verify the current names and shapes (`hiddenMissedTaskIds` and its consumers in the Tasks screen, `TaskCompletion.recordedAt`, `getRiyadhIsoDate`) in the actual repo before relying on this description of them.

## The rule (Yahya's decision)

On the **Admin and Manager** Tasks page, a **completed** task stays listed until the **end of the Riyadh day on which it was completed**, so it can be checked, and then drops off. After that it's visible only in Records.

- "The day it was completed" is the Riyadh date of the `recordedAt` of the completion whose status is `completed` — the moment someone pressed Complete, **not** the task's due date.
- A task completed early (for example yesterday, for something due today) is therefore already past its day and doesn't show.
- **Employees are unchanged.** Their list already drops a task as soon as it's completed. Confirm that's still true after your change.
- Hiding is display-only. Nothing is deleted or modified, and Records and the Dashboard are untouched (the Dashboard's task sections already exclude completed tasks).

## Steps

1. **Pure logic in `lib/tasks.ts`, with tests.** `isCompletedTaskPastItsDay(task, nowMs)`:
   - `false` if the task isn't fully completed (reuse `isTaskFullyCompleted`; don't re-derive it).
   - Find the completion with status `completed`; take its `recordedAt`.
   - `false` if `recordedAt` can't be parsed. Failing visible is the safe direction.
   - `true` if the Riyadh date of `recordedAt` is earlier than the Riyadh date of `nowMs`. Use `getRiyadhIsoDate`; never the device's timezone.
   - Tests must include these exact cases (Riyadh is UTC+3):

     | Completed (UTC) | Now (UTC) | Hidden? |
     | --- | --- | --- |
     | 2026-09-20T07:00:00Z (10:00 Riyadh) | 2026-09-20T20:59:59Z (23:59:59 Riyadh) | no |
     | 2026-09-20T07:00:00Z | 2026-09-20T21:00:00Z (00:00 next day) | yes |
     | 2026-09-20T20:59:59Z (23:59:59 Riyadh) | 2026-09-20T21:00:00Z (one second later) | yes |
     | completed several days ago | any later time | yes |

     Also test: a task that isn't completed (including one with only a missed-reason response) returns `false`; an unparseable `recordedAt` returns `false`.

2. **Wire it into the Tasks screen's existing hide-set,** the one Part B built (`hiddenMissedTaskIds`). Extend that set rather than adding a parallel filter, and rename it to something accurate (for example `hiddenTaskIds`) so the list filter **and** the bulk-selection logic keep agreeing on exactly the same set of hidden tasks. Apply the completed rule **only when the viewer is Admin or Manager.** It must re-evaluate from the existing `useNowTick`, so completed tasks drop off by themselves within about a minute of Riyadh midnight, with no reload.

3. **Interactions to check, not assume:** the due-date, category and employee filters, search and sort; multi-select (a task that drops off must not stay selected or be acted on by a bulk action); the employee view.

4. **Docs.** Add this paragraph to AGENTS.md under **To-Do List Rules**:

   > **Tasks page visibility (display-only — nothing is ever deleted; Records shows everything).** A *missed* task (past due, nobody completed it) drops off a person's Tasks page after 48 hours, or sooner once they've responded — for someone not assigned, once every assignee has (`isMissedTaskHiddenForViewer`). For Admin/Manager, a *completed* task stays listed until the end of the Riyadh day it was completed, then drops off (`isCompletedTaskPastItsDay`); employees' lists already drop a task once it's completed. Both rules feed one hidden-id set on the Tasks screen so the list and bulk selection can never disagree.

## Constraints

- Don't change Part A (Delay), the missed-task rule itself, Records, or the Dashboard.
- Strict TypeScript, no `any`. Run `npm run lint`, `npm run typecheck`, `npm run test`.

## Reference

As Admin, complete a task and confirm it stays on your Tasks page. A completed task from a previous day should not show. To test the midnight drop-off without waiting, check a task completed yesterday, or temporarily move the clock in a test. Confirm an employee's list is unchanged, that the task still appears in Records, and that selecting a task and then letting it drop off doesn't leave it selected.

## Prerequisites to verify (list in your summary)
- None expected. State any you discover.

End your summary with the **Files changed** list required by AGENTS.md.

**Stop here and tell Yahya it's ready to commit.**
