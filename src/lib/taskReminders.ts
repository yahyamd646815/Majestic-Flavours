import { formatDueDateTime } from "@/lib/reports";
import { isTaskFullyCompleted } from "@/lib/tasks";
import type { ReminderOffsetUnit, Task, TaskReminder } from "@/types/tasks";

const HOUR_MS = 60 * 60 * 1000;
const DAY_MS = 24 * HOUR_MS;

/** Three digits, matching the reminder inputs' `maxLength`. Well beyond any
 * real lead time, and short enough that the offset can never overflow past
 * `Date`'s own range. */
export const MAX_REMINDER_OFFSET_VALUE = 999;

/**
 * How many reminders one person may stack on one task.
 *
 * Enforced here and in the UI only — there is deliberately no database
 * constraint behind it (see the round12 patch's own note). A stray fourth row
 * would cost one extra notification and nothing else: unlike
 * `task_completions`' "not already completed" rule, which protects a real
 * business invariant and so is enforced in RLS, this is a tidiness limit.
 */
export const MAX_REMINDERS_PER_TASK = 3;

/**
 * Prefixes every scheduled notification this feature owns, so a reconciliation
 * pass can tell its own leftovers apart from anything else the app might
 * schedule later and cancel only what it is responsible for.
 */
const IDENTIFIER_PREFIX = "task-reminder:";

/**
 * The OS-level identifier for one reminder — derived from the reminder row's
 * own id, which is what lets several reminders on the same task coexist
 * instead of overwriting each other's scheduled notification. (It was keyed on
 * `task_id` + `employee_clerk_id` while that pair was the primary key; with up
 * to three rows per pair, that string is no longer unique per reminder.)
 *
 * Still fully deterministic, which is the whole mechanism behind "exactly one
 * notification, not two": the id lives in Supabase, so re-deriving reminders
 * next session produces the same identifiers, and scheduling under an
 * identifier that already exists replaces it rather than adding a second.
 */
export function taskReminderIdentifier(reminderId: string): string {
  return `${IDENTIFIER_PREFIX}${reminderId}`;
}

export function isTaskReminderIdentifier(identifier: string): boolean {
  return identifier.startsWith(IDENTIFIER_PREFIX);
}

/** How far ahead of the due time the reminder fires, in milliseconds. */
export function reminderOffsetMs(
  offsetValue: number,
  offsetUnit: ReminderOffsetUnit,
): number {
  return offsetValue * (offsetUnit === "days" ? DAY_MS : HOUR_MS);
}

/**
 * The exact instant a reminder should fire: the task's due time minus the
 * offset. `null` when `dueAtIso` cannot be parsed, so an unreadable timestamp
 * can never become a notification scheduled at `NaN`.
 */
export function reminderTriggerMs(
  dueAtIso: string,
  offsetValue: number,
  offsetUnit: ReminderOffsetUnit,
): number | null {
  const dueMs = Date.parse(dueAtIso);
  if (Number.isNaN(dueMs)) return null;
  return dueMs - reminderOffsetMs(offsetValue, offsetUnit);
}

/** "2 hours" / "1 hour" / "3 days" / "1 day" — the quantity on its own, so
 * callers can compose "… before due" or "Due in …" from the same source. */
export function formatReminderOffset(
  offsetValue: number,
  offsetUnit: ReminderOffsetUnit,
): string {
  const noun = offsetUnit === "days" ? "day" : "hour";
  return `${offsetValue} ${noun}${offsetValue === 1 ? "" : "s"}`;
}

/**
 * Validates what someone typed into the offset field. `null` for anything
 * that is not a whole number from 1 to `MAX_REMINDER_OFFSET_VALUE` — which
 * includes an empty field mid-edit, matching the `offset_value > 0` check
 * constraint rather than letting a zero reach the database.
 */
export function parseReminderOffsetValue(text: string): number | null {
  const trimmed = text.trim();
  if (!/^\d{1,3}$/.test(trimmed)) return null;
  const value = Number(trimmed);
  if (value < 1 || value > MAX_REMINDER_OFFSET_VALUE) return null;
  return value;
}

/**
 * One person's reminders on one task, longest lead time first — the order they
 * will actually fire in.
 *
 * Ordered by lead time rather than by `createdAt` so the list reads as a
 * schedule ("1 day before, then 3 hours before") and does not reshuffle
 * depending on which one was added first.
 */
export function remindersForTask(
  reminders: TaskReminder[],
  taskId: string,
  employeeClerkId: string,
): TaskReminder[] {
  return reminders
    .filter(
      (reminder) =>
        reminder.taskId === taskId && reminder.employeeClerkId === employeeClerkId,
    )
    .sort(
      (a, b) =>
        reminderOffsetMs(b.offsetValue, b.offsetUnit) -
        reminderOffsetMs(a.offsetValue, a.offsetUnit),
    );
}

/**
 * Whether one of these reminders already fires at the same instant as the
 * given offset — compared in milliseconds, so "1 day" and "24 hours" count as
 * the same reminder rather than as two.
 *
 * Only reachable now that several reminders can sit on one task: while a new
 * one replaced the old, an exact duplicate was impossible. Two rows at the
 * same instant would send two identical notifications and burn a slot, so the
 * UI refuses it before saving.
 */
export function hasReminderAtOffset(
  reminders: TaskReminder[],
  offsetValue: number,
  offsetUnit: ReminderOffsetUnit,
): boolean {
  const offset = reminderOffsetMs(offsetValue, offsetUnit);
  return reminders.some(
    (reminder) => reminderOffsetMs(reminder.offsetValue, reminder.offsetUnit) === offset,
  );
}

/** Everything the notification layer needs to schedule one reminder, with no
 * knowledge of tasks, offsets or Riyadh dates left in it. */
export type ReminderSchedule = {
  identifier: string;
  taskId: string;
  title: string;
  body: string;
  triggerMs: number;
};

/**
 * Turns stored reminder *preferences* into the notifications that should
 * actually be pending right now — the single place that decides what gets
 * scheduled, used both by session-start reconciliation and by every
 * individual reschedule.
 *
 * A reminder is dropped, not scheduled, when any of these is true:
 * - its task is not in `tasks` — deleted, or no longer visible to this person
 *   (an employee's `select` is scoped to tasks they are assigned to, so an
 *   assignment removed on somebody else's device shows up here as the task
 *   simply being gone);
 * - this person is no longer assigned to it;
 * - the task is closed — somebody completed it, so it applies to nobody now;
 * - the trigger instant has already passed, including a due date edited to be
 *   sooner than the lead time allows.
 *
 * Reminders belonging to anyone else are dropped too. `task_reminders`' RLS
 * means a client never holds those anyway; the check is here so this function
 * is correct on its own terms rather than on a caller's promise.
 *
 * Several reminders on the same task are ordinary input, not a special case:
 * each is judged on its own and gets its own identifier, so all of them
 * survive together or fall away individually.
 */
export function buildReminderSchedules(
  reminders: TaskReminder[],
  tasks: Task[],
  employeeClerkId: string,
  nowMs: number,
): ReminderSchedule[] {
  const schedules: ReminderSchedule[] = [];

  for (const reminder of reminders) {
    if (reminder.employeeClerkId !== employeeClerkId) continue;

    const task = tasks.find((candidate) => candidate.id === reminder.taskId);
    if (!task) continue;
    if (!task.assignedEmployeeIds.includes(employeeClerkId)) continue;
    if (isTaskFullyCompleted(task)) continue;

    const triggerMs = reminderTriggerMs(
      task.dueAt,
      reminder.offsetValue,
      reminder.offsetUnit,
    );
    if (triggerMs === null || triggerMs <= nowMs) continue;

    schedules.push({
      identifier: taskReminderIdentifier(reminder.id),
      taskId: task.id,
      title: task.title,
      body: `Due in ${formatReminderOffset(reminder.offsetValue, reminder.offsetUnit)} · ${formatDueDateTime(task.dueAt)}`,
      triggerMs,
    });
  }

  return schedules;
}
