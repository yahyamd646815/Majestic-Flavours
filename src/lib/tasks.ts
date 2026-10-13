import {
  formatReportDate,
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

// ----------------------------------------------------------------------
// Delay
// ----------------------------------------------------------------------

const ONE_DAY_MS = 24 * 60 * 60 * 1000;

/** A task due at or after this Riyadh hour is pushed to the next morning
 * instead of to the end of its own day. Mirrors `internal.delayed_due_at`. */
const DELAY_NEXT_DAY_FROM_HOUR = 20;

/**
 * Whether this person may press Delay on this task right now. The client-side
 * mirror of the four checks inside the `delay_task` RPC, which is what
 * actually enforces them — this exists to hide the button and fail fast, not
 * to be trusted:
 * - they are assigned to the task (any role);
 * - nobody has completed it;
 * - it has not already been delayed (one delay per task);
 * - its due time is still in the future.
 *
 * "Still in the future" is strictly `dueAt > now`, because the RPC rejects
 * `due_at <= now()` — a task due this exact instant is already overdue to it.
 * `nowMs` is required, not defaulted: it must come from the screen's
 * `useNowTick` or the button would never disappear on its own.
 */
export function canDelayTask(
  task: Pick<Task, "dueAt" | "completions" | "assignedEmployeeIds" | "delayedAt">,
  employeeClerkId: string,
  nowMs: number,
): boolean {
  if (!task.assignedEmployeeIds.includes(employeeClerkId)) return false;
  if (isTaskFullyCompleted(task)) return false;
  if (task.delayedAt !== null) return false;
  const dueMs = Date.parse(task.dueAt);
  return !Number.isNaN(dueMs) && dueMs > nowMs;
}

/**
 * The due time a delay would produce — a TypeScript mirror of the SQL rule in
 * `internal.delayed_due_at`, used ONLY to tell the person what they are about
 * to get. The real new time is computed by the `delay_task` RPC and the client
 * never sends one.
 *
 * Riyadh wall-clock, fixed UTC+3:
 * - due before 20:00 → 23:59 the same day;
 * - due at or after 20:00 → 10:00 the next day.
 *
 * The same-day case goes through `getEndOfDayRiyadhIso` so the app's own
 * end-of-day (exactly 23:59:00.000, also what `resolveDueAt` defaults to) and
 * the SQL's 23:59:00 cannot drift apart. Only the hour is compared against the
 * cutoff, which agrees with SQL's `time < '20:00'` at every second.
 *
 * `null` when `dueAtIso` cannot be parsed.
 */
export function getDelayedDueAt(dueAtIso: string): string | null {
  const riyadh = dueAtRiyadhParts(dueAtIso);
  if (riyadh === null) return null;
  if (riyadh.hour < DELAY_NEXT_DAY_FROM_HOUR) {
    return getEndOfDayRiyadhIso(dueAtRiyadhIsoDate(dueAtIso));
  }
  // `day + 1` past the end of a month is fine — the underlying `Date.UTC`
  // rolls it into the next month.
  return riyadhDateTimeToIso(riyadh.year, riyadh.month, riyadh.day + 1, 10, 0);
}

/** "11:59 PM" / "10:00 AM" — 12-hour, matching how the delay confirmation is
 * worded to staff. */
function formatClock12h(hour: number, minute: number): string {
  const period = hour >= 12 ? "PM" : "AM";
  const hour12 = hour % 12 === 0 ? 12 : hour % 12;
  return `${hour12}:${String(minute).padStart(2, "0")} ${period}`;
}

/**
 * The new due time as the delay confirmation words it: "11:59 PM today",
 * "10:00 AM tomorrow", or — when the task is due further out than that and the
 * delay stays on its own day — "11:59 PM on 22 Sep 2026". "Today" and
 * "tomorrow" are Riyadh's, relative to `nowMs`, not to the task's old due date.
 */
export function formatDelayTargetLabel(newDueAtIso: string, nowMs: number): string {
  const riyadh = dueAtRiyadhParts(newDueAtIso);
  if (riyadh === null) return newDueAtIso;

  const time = formatClock12h(riyadh.hour, riyadh.minute);
  const dayIso = dueAtRiyadhIsoDate(newDueAtIso);
  if (dayIso === getRiyadhIsoDate(nowMs)) return `${time} today`;
  if (dayIso === getRiyadhIsoDate(nowMs + ONE_DAY_MS)) return `${time} tomorrow`;
  return `${time} on ${formatReportDate(dayIso)}`;
}

/** What the RPC's `delay_task: <reason>` errors say to a person, keyed by the
 * reason text the SQL raises. */
type DelayErrorEntry = readonly [reason: string, message: string];

const DELAY_ERROR_MESSAGES: readonly DelayErrorEntry[] = [
  ["not assigned", "You are not assigned to this task."],
  ["already delayed", "This task has already been delayed once."],
  ["already completed", "This task is already completed."],
  ["already overdue", "This task is already overdue, so it can't be delayed."],
  ["task not found", "This task no longer exists."],
  ["not signed in", "You are signed out. Sign in and try again."],
];

/** Anything the RPC did not recognise — a dropped connection included. */
export const DELAY_FALLBACK_MESSAGE =
  "The task was not delayed. Check your connection and try again.";

/** Maps the raw error message from the `delay_task` RPC to short, friendly
 * text. Matches on the `delay_task: ` prefix plus the known reason, so an
 * unrelated error that happens to contain similar words falls through to the
 * generic message. */
export function getDelayErrorMessage(rawMessage: string | null | undefined): string {
  if (!rawMessage) return DELAY_FALLBACK_MESSAGE;
  const known = DELAY_ERROR_MESSAGES.find(([reason]) =>
    rawMessage.includes(`delay_task: ${reason}`),
  );
  return known ? known[1] : DELAY_FALLBACK_MESSAGE;
}

// ----------------------------------------------------------------------
// Missed tasks
// ----------------------------------------------------------------------

/** How long a missed task stays on the Tasks page after its due time. */
export const MISSED_VISIBILITY_WINDOW_MS = 48 * 60 * 60 * 1000;

/** Past its due time and not completed by anyone — the same condition as the
 * Overdue badge, named for what it means once the due time is well behind it. */
export function isMissedTask(
  task: Pick<Task, "dueAt" | "completions">,
  nowMs: number,
): boolean {
  return isTaskPastDue(task, nowMs);
}

/**
 * Whether the Tasks page should stop listing this task for this viewer. Only
 * ever hides a *missed* task — pending and completed tasks are never hidden
 * here. Hiding is display-only: nothing is deleted, and Records still shows it.
 *
 * A missed task is hidden when either:
 * - it is more than 48 hours past its current `dueAt` (strictly — exactly 48h
 *   is still listed). A delay only happens before a task is overdue, so a
 *   delayed task is simply measured from its later due time; or
 * - the viewer owes nothing more, which depends on who they are:
 *   an assignee is done once they have responded themselves; anyone else is
 *   done once *every* assignee has.
 *
 * A task with no assignees has nobody who could respond, so only the 48-hour
 * rule applies — "every assignee has responded" is vacuously true for an empty
 * list and must not hide it the instant it goes overdue.
 */
export function isMissedTaskHiddenForViewer(
  task: Pick<Task, "dueAt" | "completions" | "assignedEmployeeIds">,
  viewerClerkId: string,
  nowMs: number,
): boolean {
  if (!isMissedTask(task, nowMs)) return false;
  if (nowMs - Date.parse(task.dueAt) > MISSED_VISIBILITY_WINDOW_MS) return true;

  const assignees = task.assignedEmployeeIds;
  if (assignees.length === 0) return false;
  if (assignees.includes(viewerClerkId)) return hasEmployeeResponded(task, viewerClerkId);
  return assignees.every((assigneeId) => hasEmployeeResponded(task, assigneeId));
}

/**
 * Whether a *completed* task has outlived the Riyadh day it was completed on.
 * The Admin/Manager Tasks page keeps a completed task listed until the end of
 * that day so it can be checked, then drops it. "The day" is the Riyadh date of
 * the Complete press (`recordedAt`), not the task's due date — so a task
 * completed early is already past its day. Display-only; Records still shows it.
 *
 * Fails visible: an unparseable `recordedAt` returns false.
 */
export function isCompletedTaskPastItsDay(
  task: Pick<Task, "completions">,
  nowMs: number,
): boolean {
  if (!isTaskFullyCompleted(task)) return false;
  const completed = task.completions.find((c) => c.status === "completed");
  if (!completed) return false;
  const completedMs = Date.parse(completed.recordedAt);
  if (Number.isNaN(completedMs)) return false;
  return getRiyadhIsoDate(completedMs) < getRiyadhIsoDate(nowMs);
}

// ----------------------------------------------------------------------
// Dashboard — today's tasks
// ----------------------------------------------------------------------

export type TodayTaskBuckets = {
  upcoming: Task[];
  delayed: Task[];
  missed: Task[];
};

/**
 * Splits today's unfinished tasks into the Dashboard's three sections.
 *
 * A task is a candidate for "today" when its `dueAt` falls on today's Riyadh
 * date, or it was delayed and its `originalDueAt` does — the second clause
 * keeps a task visible tomorrow morning if it was delayed from today to 10:00
 * tomorrow. Completed tasks are excluded. Each remaining candidate lands in
 * exactly one bucket, checked in this order:
 * 1. Missed — past due and still listed for this viewer (a task that is
 *    missed *and* was delayed goes here, not under Delayed);
 * 2. Delayed — delayed, and its due time has not passed;
 * 3. Upcoming — everything else.
 *
 * A past-due candidate that `isMissedTaskHiddenForViewer` hides (every
 * assignee gave a reason, or older than 48h) appears in no bucket, so the
 * Dashboard and the Tasks page never disagree. Each bucket is sorted by its
 * current due time, soonest first.
 */
export function getTodayTaskBuckets(
  tasks: Task[],
  viewerClerkId: string,
  nowMs: number,
): TodayTaskBuckets {
  const todayIsoDate = getRiyadhIsoDate(nowMs);
  const buckets: TodayTaskBuckets = { upcoming: [], delayed: [], missed: [] };

  for (const task of tasks) {
    if (isTaskFullyCompleted(task)) continue;

    const isDueToday = dueAtRiyadhIsoDate(task.dueAt) === todayIsoDate;
    const wasDueToday =
      task.delayedAt !== null &&
      task.originalDueAt !== null &&
      dueAtRiyadhIsoDate(task.originalDueAt) === todayIsoDate;
    if (!isDueToday && !wasDueToday) continue;

    if (isMissedTask(task, nowMs)) {
      if (!isMissedTaskHiddenForViewer(task, viewerClerkId, nowMs)) buckets.missed.push(task);
    } else if (task.delayedAt !== null) {
      buckets.delayed.push(task);
    } else {
      buckets.upcoming.push(task);
    }
  }

  const byDueAt = (a: Task, b: Task) => Date.parse(a.dueAt) - Date.parse(b.dueAt);
  buckets.upcoming.sort(byDueAt);
  buckets.delayed.sort(byDueAt);
  buckets.missed.sort(byDueAt);
  return buckets;
}
