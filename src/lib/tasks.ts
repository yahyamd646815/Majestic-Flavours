import {
  getEndOfDayRiyadhIso,
  getRiyadhIsoDate,
  getRiyadhParts,
  getTodayIsoDate,
  matchesDateFilter,
  riyadhDateTimeToIso,
} from "@/lib/reports";
import type { Task } from "@/types/tasks";

/**
 * Closed for everyone. Completion is the only thing that closes a task, and
 * one person's is enough — the other assignees never have to respond. A task
 * where every assignee submitted a *miss* reason is deliberately NOT closed
 * by this: nothing in the current model ever marks a task terminally missed.
 */
export function isTaskFullyCompleted(task: Pick<Task, "completions">): boolean {
  return task.completions.some((c) => c.status === "completed");
}

/** Whether this specific person has already had their say — completed it, or
 * submitted their own miss reason. Their response is theirs alone; someone
 * else's does not stand in for it. */
export function hasEmployeeResponded(
  task: Pick<Task, "completions">,
  employeeClerkId: string,
): boolean {
  return task.completions.some((c) => c.employeeClerkId === employeeClerkId);
}

/**
 * Task-level "past due and still unresolved" — what the Overdue badge means
 * on the Admin/Manager list, where the question is about the task itself
 * rather than any one viewer's obligation to it.
 *
 * Overdue is derived, never stored (AGENTS.md: "don't add a separate status
 * field for this").
 */
export function isTaskPastDue(
  task: Pick<Task, "dueAt" | "completions">,
  nowMs: number = Date.now(),
): boolean {
  if (isTaskFullyCompleted(task)) return false;
  return new Date(task.dueAt).getTime() < nowMs;
}

/**
 * Overdue *for one person specifically*: the task is past due, nobody has
 * completed it, and this person still owes their own response. Someone else
 * having already submitted a miss reason does not let them off.
 */
export function isTaskOverdueForEmployee(
  task: Pick<Task, "dueAt" | "completions">,
  employeeClerkId: string,
  nowMs: number = Date.now(),
): boolean {
  if (hasEmployeeResponded(task, employeeClerkId)) return false;
  return isTaskPastDue(task, nowMs);
}

/**
 * Whether this task needs nothing further from this person: either someone
 * else already closed it, or they've already submitted their own response.
 * The same condition that already drops a task from an employee's active
 * list on the main Tasks screen — reused directly by the Records page's
 * per-employee summary rather than re-derived there.
 */
export function isTaskResolvedForEmployee(
  task: Pick<Task, "completions">,
  employeeClerkId: string,
): boolean {
  return isTaskFullyCompleted(task) || hasEmployeeResponded(task, employeeClerkId);
}

/**
 * The Tasks screen's own due-date filter. A separate type from
 * `ReportDateFilter` on purpose, not an extension of it: Reports has exactly
 * three options and stays that way, while this one adds "This Month" so
 * somebody can reach a task due weeks out — which is the only way to set a
 * reminder on one.
 */
export type TaskDateFilter = "today" | "week" | "month" | "all";

export const TASK_DATE_FILTER_LABELS: Record<TaskDateFilter, string> = {
  today: "Today",
  week: "This Week",
  month: "This Month",
  all: "All Time",
};

/**
 * Whether a Riyadh calendar date (`YYYY-MM-DD`) falls inside the filter.
 *
 * `"month"` is the only genuinely new rule here: the *current Riyadh calendar
 * month*, first day through last, regardless of where today falls in it — a
 * calendar month rather than a rolling window, because the point is finding
 * what is coming up, not reviewing what just happened. Both arguments are
 * already Riyadh dates, so comparing their `YYYY-MM` prefix is exactly that
 * month with no arithmetic at all.
 *
 * Every other option delegates to `matchesDateFilter` rather than restating
 * it, so "Today" and "This Week" keep meaning app-wide precisely what they
 * already mean on Reports and Records — including "This Week" being the last
 * 7 days, today included.
 */
export function matchesTaskDateFilter(
  isoDate: string,
  filter: TaskDateFilter,
  todayIsoDate: string,
): boolean {
  if (filter === "month") return isoDate.slice(0, 7) === todayIsoDate.slice(0, 7);
  return matchesDateFilter(isoDate, filter, todayIsoDate);
}

/** A task's `due_at` as its Riyadh calendar date, which is the form
 * `matchesTaskDateFilter` compares — the same conversion `records.tsx`
 * already does, named once so both filters agree. */
export function dueAtRiyadhIsoDate(dueAtIso: string): string {
  return getRiyadhIsoDate(new Date(dueAtIso).getTime());
}

/**
 * Resolves whatever the admin picked in `TaskFormModal`'s optional date/time
 * pickers into a concrete `due_at` ISO timestamp — always a real value, never
 * written as null and defaulted later. Each picker is independent: a picked
 * date without a picked time keeps that date's end-of-day; a picked time
 * without a picked date applies to today; neither picked resolves to end of
 * today. All resolution happens in Riyadh wall-clock terms, matching
 * `getTodayIsoDate`'s reasoning.
 *
 * The two pickers are read *asymmetrically* — UTC getters for the date, local
 * getters for the time — because Android's two native pickers genuinely
 * disagree about which digits of the `Date` they hand back carry the answer.
 * See `pickerDateToIsoDate` / `pickerTimeToHHMM` in `lib/taskRecurrence.ts`,
 * where that split is documented in full; every date/time picker in the app
 * follows the same convention.
 */
export function resolveDueAt(pickedDate: Date | null, pickedTime: Date | null): string {
  if (!pickedDate && !pickedTime) return getEndOfDayRiyadhIso(getTodayIsoDate());

  const [todayYear, todayMonth, todayDay] = getTodayIsoDate().split("-").map(Number);
  const year = pickedDate ? pickedDate.getUTCFullYear() : todayYear;
  const month = pickedDate ? pickedDate.getUTCMonth() + 1 : todayMonth;
  const day = pickedDate ? pickedDate.getUTCDate() : todayDay;
  const hour = pickedTime ? pickedTime.getHours() : 23;
  const minute = pickedTime ? pickedTime.getMinutes() : 59;

  return riyadhDateTimeToIso(year, month, day, hour, minute);
}

/** The Riyadh wall-clock digits of a stored `due_at`, or `null` when it cannot
 * be parsed — the shared first half of both seeding functions below. */
function dueAtRiyadhParts(dueAtIso: string): ReturnType<typeof getRiyadhParts> | null {
  const parsedMs = Date.parse(dueAtIso);
  if (Number.isNaN(parsedMs)) return null;
  return getRiyadhParts(parsedMs);
}

/**
 * The inverse of `resolveDueAt`'s date half, for pre-filling the edit form's
 * date picker: a `Date` whose *UTC* digits are the Riyadh calendar date of
 * `dueAtIso`.
 *
 * UTC rather than local because that is how the date picker reads its own
 * `value` back: Android hands `initialSelectedDateMillis` straight to
 * Material3's `DatePickerState`, which is UTC-based, and returns
 * `selectedDateMillis` — UTC midnight of the picked day — the same way. Seeding
 * with local digits (or with a plain `new Date(dueAtIso)`) would preselect the
 * wrong day on any device not at UTC+3, and an untouched save would then write
 * that wrong day back.
 */
export function dueAtToDatePickerValue(dueAtIso: string): Date | null {
  const riyadh = dueAtRiyadhParts(dueAtIso);
  if (riyadh === null) return null;
  return new Date(Date.UTC(riyadh.year, riyadh.month - 1, riyadh.day));
}

/**
 * The inverse of `resolveDueAt`'s time half: a `Date` whose *device-local*
 * digits are the Riyadh wall-clock time of `dueAtIso`.
 *
 * Local rather than UTC — the opposite of the date picker above — because the
 * time picker seeds from and returns local digits on both platforms (Android
 * builds its `TimePickerState` from a device-default `Calendar`). Its date
 * components are never read back; they are filled in only so the value reads
 * as the same moment the date picker is showing.
 */
export function dueAtToTimePickerValue(dueAtIso: string): Date | null {
  const riyadh = dueAtRiyadhParts(dueAtIso);
  if (riyadh === null) return null;
  return new Date(riyadh.year, riyadh.month - 1, riyadh.day, riyadh.hour, riyadh.minute, 0, 0);
}
