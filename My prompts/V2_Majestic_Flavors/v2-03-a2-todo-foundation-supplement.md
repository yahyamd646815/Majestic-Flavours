Read AGENTS.md first and follow it strictly.

**Suggested: Opus, extra-high effort.** Most of this prompt is additive/pattern-following (mirror existing Inventory/Reports components directly), but Part D (per-assignee completion) is genuinely novel — nothing else in this app has "several people independently respond to one shared thing, any one success closes it for all." That part is why this isn't Sonnet.

**Prerequisite:** `v2-supabase-patch-round2.sql` must already be applied. Verify before starting.

Stop after each lettered part and tell Yahya it's ready to commit — don't run git yourself.

---

### Part A — Task editing

`TaskFormModal` is currently create-only. Mirror `ItemFormModal`'s exact pattern: an optional `task?: Task` prop, pre-filling every field (including assignment) when editing, submitting through a new `updateTask` store action instead of `addTask`. The form's title changes to "Edit Task" when editing, same as `ItemFormModal`'s "Edit Item"/"Add Item" split.

Assignment changes made *through the edit form* should diff against the task's original assignment and go through the same insert/delete pattern already used by `removeAssignment` — don't reinvent this, and don't let the edit form's own submission race against `TaskCard`'s existing inline chip-removal.

### Part B — Optional description

`tasks.description` already exists as a column (added in round 1, never wired up anywhere). Add it end-to-end: `Task` type, `TaskFormValues`, `mapDbTaskToTask`, the insert/update payloads, a simple optional multiline input in `TaskFormModal` (mirror `ReportEntryCard`'s note-input pattern), and display in `TaskCard` when present.

### Part C — Mass assign/unassign

Mirror Inventory's selection-mode + `BulkAssignModal` pattern directly for Tasks — a "Select" toggle, multi-select task cards, bulk assign/unassign one person to/from all selected. This was decided during v2-03-a's own scoping but never made it into that prompt — a real miss, not a new idea. Reuse the existing `BulkAssignModal` component if its props generalize cleanly to tasks; otherwise mirror it closely rather than diverging in behavior.

### Part D — Per-assignee completion (the schema-driving change)

**New rule:** when a task is missed, *every* assigned person must submit their own reason — not one reason representing the group. Completion still works the old way: any *one* assignee completing it closes the task for everyone.

1. **Types** — `TaskCompletion` gains `employeeClerkId`, loses the old task-level shape. `Task.completion: TaskCompletion | null` becomes `Task.completions: TaskCompletion[]` — one entry per person who has responded so far, empty if none have.

2. **`lib/tasks.ts`** — replace the old `isTaskOverdue` with something that reflects the new per-person reality:
   ```ts
   export function isTaskFullyCompleted(task: Pick<Task, "completions">): boolean {
     return task.completions.some((c) => c.status === "completed");
   }

   export function hasEmployeeResponded(
     task: Pick<Task, "completions">,
     employeeClerkId: string,
   ): boolean {
     return task.completions.some((c) => c.employeeClerkId === employeeClerkId);
   }

   export function isTaskOverdueForEmployee(
     task: Pick<Task, "dueAt" | "completions">,
     employeeClerkId: string,
     nowMs: number = Date.now(),
   ): boolean {
     if (isTaskFullyCompleted(task)) return false;
     if (hasEmployeeResponded(task, employeeClerkId)) return false;
     return new Date(task.dueAt).getTime() < nowMs;
   }
   ```
   Update `lib/tasks.test.ts` accordingly — the old single-completion test cases need rewriting around the array, plus new cases for "one person completed, task closes for everyone" and "one person hasn't responded while another already has."

3. **`taskStore.ts`** — `mapDbTaskToTask` reads `task_completions` as an array now (it always was, at the DB level — round 1's `extractSingleEmbed` defensiveness is no longer needed for this table specifically, since `(task_id, employee_clerk_id)` is now genuinely one-to-many from `tasks`' side). `completeTask` inserts a row scoped to the calling user only — the RLS policy in round 2 enforces this server-side, but mirror it client-side too so a disallowed attempt fails fast rather than round-tripping to Supabase first.

4. **`tasks.tsx`** — the employee visibility filter changes from `task.completion === null` to `!isTaskFullyCompleted(task) && !hasEmployeeResponded(task, user.id)`. The overdue-first sort partition uses `isTaskOverdueForEmployee` instead of the old `isTaskOverdue`.

5. **`TaskCard.tsx`** — for Admin/Manager, when a task has multiple completion entries, show them as a list — each person's name, status, and note separately, not merged into one block. `canComplete`'s "not assigned to you" case is no longer possible to reach via completion (RLS + the store now prevent it) — the only remaining path for that rare scenario is delete (Part F).

### Part E — Assignable pool for Admin/Manager self-assignment

New requirement, not part of v2-03-a: Admin can assign tasks to employees, themselves, other admins, and managers. Manager can assign to employees and themselves only — not other managers, not admins. (Employee self-assignment is explicitly deferred, not part of this prompt.)

Add a new function in `lib/assignableEmployees.ts` — don't modify `getAssignableEmployees` itself, which stays employee-only and is still correctly used for Inventory assignment:

```ts
export function getAssignableTaskParticipants(
  creatorRole: Role,
  currentUserClerkId: string,
  roster: AppUser[],
  appUsers: SyncedUser[],
): AssignableEmployee[] {
  const bridged = bridgeRosterByEmail(roster, appUsers);
  if (creatorRole === "admin") return bridged;
  if (creatorRole === "manager") {
    return bridged.filter(
      (person) => person.role === "employee" || person.clerkUserId === currentUserClerkId,
    );
  }
  return [];
}
```

Verify `bridgeRosterByEmail`'s actual current export shape before assuming this signature is exactly right. `TaskFormModal` uses this instead of `getAssignableEmployees` for its employee picker.

### Part F — Delete task, two-step confirmation

Reuse `DeleteConfirmModal` directly — the same typed-DELETE component Inventory already uses, not a new one. RLS already enforces the real permission boundary (round 2's `tasks_delete_permission`); the UI only needs to decide when to *show* a delete action at all: Admin sees it on every task, Manager sees it only on tasks they created (`task.createdBy === currentUserClerkId`).

### Part G — "Edit Categories" instead of "Create Category"

The "+" menu's category option changes from a bare create-one-category form to a management view: list every existing `task_category`, each with a delete button, plus a way to add a new one from the same screen. **Check Settings for an existing inventory-category management pattern before building a new one from scratch** — mirror it if one exists rather than diverging in behavior.

Deleting a category currently in use by any task must be blocked, mirroring `inventoryStore`'s `isCategoryInUse`/`deleteCategory` pattern exactly — add the equivalent for `task_categories`.

## Constraints

- Don't build recurrence, the calendar UI, records/auto-delete, notifications, or photo/video — still separate, later prompts.
- Employee self-task-creation is explicitly deferred — don't build toward it beyond what `getAssignableTaskParticipants` already naturally allows (returning `[]` for employees).
- Strict TypeScript, no `any`.
- Run `npm run lint`, `npm run typecheck`, and `npm run test` after every part.

## Reference

Test explicitly: a task assigned to two employees, both miss it — confirm both show up separately on Admin's view with their own distinct reasons, not merged. Same two-employee task, one completes it — confirm it closes for both, including the one who never responded. Admin creates a task assigned to themselves and another admin — confirm both can complete it, a third admin not assigned cannot. Manager tries to delete an admin-created task — confirm it's not even offered as an option. Delete a task category currently in use — confirm it's blocked, matching Inventory's category-deletion behavior exactly.
