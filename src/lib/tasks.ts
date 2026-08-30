import { getEndOfDayRiyadhIso, getTodayIsoDate, riyadhDateTimeToIso } from "@/lib/reports";
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
 * Resolves whatever the admin picked in `TaskFormModal`'s optional date/time
 * pickers into a concrete `due_at` ISO timestamp — always a real value, never
 * written as null and defaulted later. Each picker is independent: a picked
 * date without a picked time keeps that date's end-of-day; a picked time
 * without a picked date applies to today; neither picked resolves to end of
 * today. All resolution happens in Riyadh wall-clock terms, matching
 * `getTodayIsoDate`'s reasoning.
 */
export function resolveDueAt(pickedDate: Date | null, pickedTime: Date | null): string {
  if (!pickedDate && !pickedTime) return getEndOfDayRiyadhIso(getTodayIsoDate());

  const [todayYear, todayMonth, todayDay] = getTodayIsoDate().split("-").map(Number);
  const year = pickedDate ? pickedDate.getFullYear() : todayYear;
  const month = pickedDate ? pickedDate.getMonth() + 1 : todayMonth;
  const day = pickedDate ? pickedDate.getDate() : todayDay;
  const hour = pickedTime ? pickedTime.getHours() : 23;
  const minute = pickedTime ? pickedTime.getMinutes() : 59;

  return riyadhDateTimeToIso(year, month, day, hour, minute);
}

/**
 * The inverse of `resolveDueAt`, for pre-filling the edit form's pickers: it
 * returns the `Date` whose *device-local* wall-clock digits are the Riyadh
 * wall-clock digits of `dueAtIso`.
 *
 * Seeding the pickers with a plain `new Date(dueAtIso)` would be wrong —
 * `resolveDueAt` reads them back with `getFullYear()`/`getHours()` and
 * reinterprets those digits as Riyadh time, so on any device not sitting at
 * UTC+3 a task's due time would silently shift every time it was edited and
 * saved, even when nobody touched the pickers.
 */
export function dueAtToPickerDate(dueAtIso: string): Date | null {
  const parsed = new Date(dueAtIso);
  if (Number.isNaN(parsed.getTime())) return null;

  const riyadh = new Date(parsed.getTime() + 3 * 60 * 60 * 1000);
  return new Date(
    riyadh.getUTCFullYear(),
    riyadh.getUTCMonth(),
    riyadh.getUTCDate(),
    riyadh.getUTCHours(),
    riyadh.getUTCMinutes(),
    0,
    0,
  );
}
