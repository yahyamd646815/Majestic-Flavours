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
  /**
   * The recurrence rule this occurrence was generated from, or `null` for a
   * genuinely one-time task. Already `null` for occurrences whose rule has
   * since been deleted — the column is `on delete set null`, so a generated
   * task outlives its template.
   *
   * Deleting a task that still points at a rule cancels that rule outright
   * (see `deleteTask`): no further occurrences are ever generated from it.
   */
  generatedFromRecurrenceRuleId: string | null;
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

export type ReminderOffsetUnit = "hours" | "days";

/**
 * One person's personal reminder on one task — "remind me N hours/days before
 * it's due". Each reminder is its own row with its own `id`, so a person can
 * stack several different lead times on the same task (up to
 * `MAX_REMINDERS_PER_TASK`, enforced client-side only — see
 * `lib/taskReminders.ts`). Adding one never replaces another; removing one
 * leaves the rest untouched.
 *
 * Purely personal: `task_reminders`' RLS policies scope every operation to
 * `employee_clerk_id = current_clerk_user_id()`, so a client only ever sees
 * its own rows — nobody else's reminder is visible to Admin or Manager, and
 * none of them are operationally relevant to anyone but their owner.
 *
 * This is the *preference*, and it is the source of truth. The OS-level
 * scheduled notification derived from it is device-local and ephemeral, and
 * is re-derived from these rows on every session start — see
 * `useTaskReminderSync`.
 *
 * Deliberately per-occurrence for a recurring task, not per rule: a generated
 * occurrence is an ordinary, independent task once created, and nothing here
 * carries a reminder forward to the next one.
 */
export type TaskReminder = {
  /** This reminder's own identity, and the thing its scheduled notification
   * is keyed on — generated client-side by `generateId` like every other
   * entity id in this app, since the column is `text primary key` with no
   * database default. */
  id: string;
  taskId: string;
  employeeClerkId: string;
  /** Always > 0 (`offset_value > 0` check constraint). */
  offsetValue: number;
  offsetUnit: ReminderOffsetUnit;
  createdAt: string;
};

/**
 * Which days a rule recurs on.
 * - `daily` — every `dayInterval` days.
 * - `weekly` — the weekdays in `daysOfWeek`, every `dayInterval` weeks. This
 *   is the confirmed reading of "every 3rd Friday": every 3 weeks on Friday,
 *   NOT "the 3rd Friday of the month".
 * - `monthly` — every `dayInterval` months, on the same day-of-month.
 * - `custom` — no structured pattern at all: the rule's days are exactly its
 *   `customDates` and nothing else. `dayInterval` still carries a value
 *   (the column is `not null` with a `> 0` check) but is meaningless here and
 *   is never read — see `generateDueOccurrences`.
 *
 * The first three may ALSO carry `customDates`, added on top of the pattern.
 * Only `custom` makes them the whole story.
 */
export type RecurrenceDayPattern = "daily" | "weekly" | "monthly" | "custom";

/**
 * What time(s) of day a rule fires on each occurring day.
 * - `fixed` — every entry in `timesOfDay`, so several times a day is a
 *   first-class case rather than an edge case.
 * - `interval` — every `hourInterval` hours, always anchored to midnight
 *   Riyadh (so "every 8 hours" is 00:00/08:00/16:00 no matter when the rule
 *   was created).
 */
export type RecurrenceTimePattern = "fixed" | "interval";

/**
 * A recurring task template. Deliberately NOT a hidden row in `tasks` — its
 * own title, category, description and assignees live here, so every screen
 * that queries `tasks` stays unchanged and never has to exclude a template
 * (AGENTS.md → To-Do List Rules).
 *
 * Each actual occurrence is an ordinary `tasks` row generated from this by
 * `generateDueOccurrences` in `lib/taskRecurrence.ts`.
 *
 * Field nullability mirrors the SQL check constraints exactly: `daysOfWeek`
 * is set only for `weekly`; exactly one of `timesOfDay`/`hourInterval` is set,
 * matching `timePattern`; and exactly one of the two end conditions is
 * non-null, never both and never neither.
 */
export type TaskRecurrenceRule = {
  id: string;
  title: string;
  categoryId: string;
  description: string | null;
  createdBy: string;
  dayPattern: RecurrenceDayPattern;
  dayInterval: number;
  /** 0=Sunday..6=Saturday, matching `Date.prototype.getDay()`. */
  daysOfWeek: number[] | null;
  /**
   * Explicitly picked Riyadh calendar dates (`YYYY-MM-DD`), from
   * `task_recurrence_custom_dates`. Empty when none were picked.
   *
   * Additive for `daily`/`weekly`/`monthly` — the rule produces the union of
   * the pattern's days and these — and the only source of days for `custom`.
   * They carry no time of their own: `timePattern` applies to a picked date
   * exactly as it does to a pattern-produced one.
   */
  customDates: string[];
  /** `"HH:MM"` Riyadh wall-clock strings. */
  timesOfDay: string[] | null;
  timePattern: RecurrenceTimePattern;
  hourInterval: number | null;
  /** Riyadh calendar date `YYYY-MM-DD` — the last day that may produce an
   * occurrence, inclusive. */
  endsOnDate: string | null;
  /** Total occurrences across all time, not per generation run. */
  endsAfterOccurrences: number | null;
  /** Also the rule's start point: the first occurrence is the first matching
   * day and time at or after this instant. The schema has no separate start
   * date field. */
  createdAt: string;
  /** Copied into each generated occurrence's own `task_assignments` at
   * generation time, never read live afterwards — an occurrence that already
   * came due should not change who owed it just because the template's
   * assignee list was edited later. */
  assignedEmployeeIds: string[];
};
