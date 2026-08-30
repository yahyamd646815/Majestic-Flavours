/** Same shape as inventory's `Category` (`@/types/inventory`) — deliberately
 * so, so `CategoryFilter` and `getCategoryName` can be reused unmodified for
 * task categories via structural typing, without a task-specific fork. */
export type TaskCategory = {
  id: string;
  name: string;
};

export type TaskCompletionStatus = "completed" | "missed";

/**
 * One person's own response to a task — keyed on `(task_id,
 * employee_clerk_id)` in the database, so a task carries one of these per
 * assignee who has responded, never a single record standing for the group.
 *
 * `note` is `null` for an optional, unfilled Complete note; always a
 * non-empty string for `missed` (enforced by the `missed_requires_note` DB
 * constraint).
 */
export type TaskCompletion = {
  employeeClerkId: string;
  status: TaskCompletionStatus;
  note: string | null;
  recordedAt: string; // ISO timestamp
};

export type Task = {
  id: string;
  categoryId: string;
  title: string;
  /** Optional free text. `null` — not `""` — is the stored "no description"
   * value, matching `TaskCompletion.note` above; the form trims and collapses
   * an empty box to `null` so the column never holds a mix of both. */
  description: string | null;
  dueAt: string; // ISO timestamp — always concrete, never resolved at read time
  createdBy: string;
  createdAt: string;
  assignedEmployeeIds: string[];
  /**
   * One entry per person who has responded so far; empty until anyone has.
   * The two rules are asymmetric: any single `completed` entry closes the
   * task for everyone, but a miss needs every assignee's own reason
   * individually.
   *
   * Always read this through `isTaskFullyCompleted` / `hasEmployeeResponded`
   * / `isTaskOverdueForEmployee` / `isTaskPastDue` in `lib/tasks.ts` — never
   * re-derive it inline (AGENTS.md → To-Do List Rules).
   */
  completions: TaskCompletion[];
};
