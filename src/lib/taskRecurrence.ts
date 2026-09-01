import { getRiyadhParts, riyadhDateTimeToIso } from "@/lib/reports";
import type {
  RecurrenceDayPattern,
  RecurrenceTimePattern,
  TaskRecurrenceRule,
} from "@/types/tasks";

/**
 * One occurrence that a rule says should already exist.
 *
 * `dueAt` is a real UTC instant, identical in shape to any hand-created
 * task's; `occurrenceKey` is the Riyadh wall-clock identity of the same
 * moment, and is what the unique index on `tasks` uses to stop the occurrence
 * being generated a second time.
 */
export type GeneratedOccurrence = {
  dueAt: string;
  occurrenceKey: string;
};

/** A Riyadh calendar day, with a 1-indexed month so it reads the same way a
 * `YYYY-MM-DD` string does and feeds `riyadhDateTimeToIso` directly. */
type CalendarDate = {
  year: number;
  month: number;
  day: number;
};

/**
 * A hard ceiling on how many day-steps one generation pass will walk, purely
 * so a nonsensical rule can never spin the UI thread. Every pattern advances
 * by at least a day per step, so this is over a decade of daily occurrences —
 * far beyond any real gap between two people opening the app. A rule that
 * somehow hit it would simply generate the rest next session.
 */
const MAX_DAY_STEPS = 4000;

/** Longer than this app will outlive, and nowhere near `Date`'s own range. */
const A_CENTURY_MS = 100 * 365 * 24 * 60 * 60 * 1000;

/**
 * An `upToMs` far enough ahead that generation is bounded only by the rule's
 * own end condition, never by the clock. For the two places where "has this
 * come due yet?" is simply not the question: the first occurrence created at
 * rule-creation time, and the form's live preview.
 */
export function unboundedUpToMs(nowMs: number = Date.now()): number {
  return nowMs + A_CENTURY_MS;
}

function pad2(value: number): string {
  return String(value).padStart(2, "0");
}

function toIsoDate(date: CalendarDate): string {
  return `${date.year}-${pad2(date.month)}-${pad2(date.day)}`;
}

/** The inverse of `toIsoDate`, rejecting anything that is not a real calendar
 * date — a custom date arrives as a plain string from Postgres, so it is
 * parsed rather than trusted. */
function parseIsoDate(text: string): CalendarDate | null {
  const match = /^(\d{4})-(\d{2})-(\d{2})$/.exec(text.trim());
  if (!match) return null;
  const year = Number(match[1]);
  const month = Number(match[2]);
  const day = Number(match[3]);
  if (month < 1 || month > 12) return null;
  if (day < 1 || day > daysInMonth(year, month)) return null;
  return { year, month, day };
}

/**
 * Calendar arithmetic below is done in UTC components deliberately: a
 * `CalendarDate` is a bare set of Riyadh digits, not an instant, and UTC is
 * the only offset that never shifts a day boundary underneath it. The one
 * place Riyadh actually enters is `riyadhDateTimeToIso` / `getRiyadhParts`,
 * both reused from `lib/reports.ts` rather than re-derived here.
 */
function addDays(date: CalendarDate, days: number): CalendarDate {
  const shifted = new Date(Date.UTC(date.year, date.month - 1, date.day + days));
  return {
    year: shifted.getUTCFullYear(),
    month: shifted.getUTCMonth() + 1,
    day: shifted.getUTCDate(),
  };
}

/** 0=Sunday..6=Saturday, the same convention `days_of_week` is stored in. */
function weekdayOf(date: CalendarDate): number {
  return new Date(Date.UTC(date.year, date.month - 1, date.day)).getUTCDay();
}

function daysInMonth(year: number, month: number): number {
  return new Date(Date.UTC(year, month, 0)).getUTCDate();
}

function startOfRiyadhDayMs(date: CalendarDate): number {
  return Date.parse(riyadhDateTimeToIso(date.year, date.month, date.day, 0, 0));
}

function buildOccurrenceKey(date: CalendarDate, hour: number, minute: number): string {
  return `${toIsoDate(date)}T${pad2(hour)}:${pad2(minute)}`;
}

/** Accepts `HH:MM` and tolerates a trailing `:SS`, so a rule written straight
 * into Postgres (where a `time` value renders as `09:00:00`) still parses. */
function parseTimeOfDay(text: string): number | null {
  const match = /^(\d{1,2}):(\d{2})(?::\d{2})?$/.exec(text.trim());
  if (!match) return null;
  const hour = Number(match[1]);
  const minute = Number(match[2]);
  if (hour > 23 || minute > 59) return null;
  return hour * 60 + minute;
}

/**
 * The minutes-past-midnight this rule fires at on every one of its occurring
 * days, ascending — which is what makes the whole occurrence sequence
 * chronological, and so lets the end-condition count be trusted.
 *
 * `interval` is measured from midnight Riyadh, never from the rule's creation
 * time: "every 8 hours" is always 00:00 / 08:00 / 16:00.
 */
function occurrenceMinutes(rule: TaskRecurrenceRule): number[] {
  if (rule.timePattern === "interval") {
    const step = rule.hourInterval;
    // Not enforced by a DB check constraint, so a zero or negative interval
    // has to be rejected here or the loop below would never advance.
    if (step === null || !Number.isInteger(step) || step < 1) return [];
    const minutes: number[] = [];
    for (let hour = 0; hour < 24; hour += step) minutes.push(hour * 60);
    return minutes;
  }

  const parsed = (rule.timesOfDay ?? [])
    .map(parseTimeOfDay)
    .filter((minute): minute is number => minute !== null);
  return [...new Set(parsed)].sort((a, b) => a - b);
}

function normalisedWeekdays(rule: TaskRecurrenceRule): number[] {
  const days = (rule.daysOfWeek ?? []).filter(
    (day) => Number.isInteger(day) && day >= 0 && day <= 6,
  );
  return [...new Set(days)].sort((a, b) => a - b);
}

type DayStep = {
  /** The occurring Riyadh day, or `null` when this step lands on a month that
   * has no such day-of-month (monthly only — see `dayStepAt`). */
  date: CalendarDate | null;
  /** A real date no later than `date`, used only to decide whether the walk
   * has run past the window. A skipped monthly step still has one, so it
   * terminates the loop rather than stalling it. */
  probe: CalendarDate;
};

/**
 * The `index`-th candidate day of the rule's sequence, in ascending order.
 * Returns `null` only when the rule can never produce a day at all.
 *
 * Every pattern is computed from the anchor by index rather than by stepping
 * a running date, so nothing accumulates drift — which matters most for
 * `monthly`, where a month that lacks the anchor's day-of-month is skipped
 * outright rather than clamped backwards. Skipping matches how calendar apps
 * read "monthly on the 31st" (and RFC 5545's `BYMONTHDAY=31`); clamping would
 * silently move the task to a different day of the month.
 */
function dayStepAt(
  rule: TaskRecurrenceRule,
  anchor: CalendarDate,
  weekStart: CalendarDate,
  weekdays: number[],
  index: number,
): DayStep | null {
  if (rule.dayPattern === "daily") {
    const date = addDays(anchor, index * rule.dayInterval);
    return { date, probe: date };
  }

  if (rule.dayPattern === "weekly") {
    if (weekdays.length === 0) return null;
    // Weeks run Sunday-first, matching the 0=Sunday convention `days_of_week`
    // is stored in. Week 0 is the week containing the anchor, so days earlier
    // in that same week are produced but land before `created_at` and are
    // dropped by the start-point check in `generateDueOccurrences`.
    const week = Math.floor(index / weekdays.length);
    const slot = index % weekdays.length;
    const date = addDays(weekStart, week * rule.dayInterval * 7 + weekdays[slot]);
    return { date, probe: date };
  }

  const monthStart = new Date(
    Date.UTC(anchor.year, anchor.month - 1 + index * rule.dayInterval, 1),
  );
  const year = monthStart.getUTCFullYear();
  const month = monthStart.getUTCMonth() + 1;
  const probe: CalendarDate = { year, month, day: 1 };
  if (anchor.day > daysInMonth(year, month)) return { date: null, probe };
  return { date: { year, month, day: anchor.day }, probe };
}

/** A `GeneratedOccurrence` that still carries its instant as a number, so the
 * two halves below can be merged into one chronological sequence without
 * re-parsing every `dueAt`. */
type Candidate = GeneratedOccurrence & { dueAtMs: number };

function candidateAt(date: CalendarDate, minuteOfDay: number): Candidate {
  const hour = Math.floor(minuteOfDay / 60);
  const minute = minuteOfDay % 60;
  const dueAt = riyadhDateTimeToIso(date.year, date.month, date.day, hour, minute);
  return {
    dueAt,
    dueAtMs: Date.parse(dueAt),
    occurrenceKey: buildOccurrenceKey(date, hour, minute),
  };
}

/**
 * Everything the rule's structured pattern produces, ascending, capped at
 * `limit`.
 *
 * `limit` is the cap the merged sequence will be held to. Applying it here
 * too is safe even though custom dates are merged in afterwards:
 * pattern-produced occurrences are all distinct from one another, so at most
 * `limit` of them can survive a cap of `limit` on the merged sequence — and
 * they would be the `limit` earliest, which is exactly what this returns.
 */
function structuredCandidates(
  rule: TaskRecurrenceRule,
  minutes: number[],
  createdAtMs: number,
  upToMs: number,
  limit: number,
): Candidate[] {
  // A 'custom' rule has no structured half at all. `day_interval` and
  // `days_of_week` carry no meaning for it and are deliberately never read
  // (AGENTS.md → To-Do List Rules; round 7's schema change).
  if (rule.dayPattern === "custom") return [];
  if (!Number.isInteger(rule.dayInterval) || rule.dayInterval < 1) return [];

  const created = getRiyadhParts(createdAtMs);
  const anchor: CalendarDate = { year: created.year, month: created.month, day: created.day };
  const weekdays = normalisedWeekdays(rule);
  const weekStart = addDays(anchor, -weekdayOf(anchor));

  const candidates: Candidate[] = [];

  for (let index = 0; index < MAX_DAY_STEPS; index += 1) {
    const step = dayStepAt(rule, anchor, weekStart, weekdays, index);
    if (step === null) break;
    // `probe` is never later than `date`, so both checks are safe to break
    // on: nothing further along the sequence can come back inside the window.
    if (rule.endsOnDate !== null && toIsoDate(step.probe) > rule.endsOnDate) break;
    if (startOfRiyadhDayMs(step.probe) > upToMs) break;

    const date = step.date;
    if (date === null) continue;
    // A monthly step whose probe (the 1st) is still inside the window but
    // whose actual day is past the end date. The next step's probe then ends
    // the walk.
    if (rule.endsOnDate !== null && toIsoDate(date) > rule.endsOnDate) continue;

    for (const minuteOfDay of minutes) {
      const candidate = candidateAt(date, minuteOfDay);
      // Before the rule existed — never produced, so it does not count
      // against `endsAfterOccurrences` either.
      if (candidate.dueAtMs < createdAtMs) continue;
      // The sequence is chronological, so everything left is also in the
      // future: not due yet, and generating it now would be wrong.
      if (candidate.dueAtMs > upToMs) return candidates;
      if (candidates.length >= limit) return candidates;
      candidates.push(candidate);
    }
  }

  return candidates;
}

/**
 * Everything the rule's explicitly picked dates produce, ascending.
 *
 * Uncapped, unlike the structured half: the list is finite and small by
 * construction, and the merged cap in `generateDueOccurrences` trims it. Each
 * picked date gets the rule's own times of day — a custom date replaces the
 * day-selection half of a rule, never the time half.
 */
function customDateCandidates(
  rule: TaskRecurrenceRule,
  minutes: number[],
  createdAtMs: number,
  upToMs: number,
): Candidate[] {
  const candidates: Candidate[] = [];

  for (const isoDate of [...new Set(rule.customDates)].sort()) {
    const date = parseIsoDate(isoDate);
    if (date === null) continue;
    // `endsOnDate` means "the last day that may produce an occurrence" for
    // the whole rule, not just its pattern — a date picked past it is a
    // contradiction, and the preview is where that becomes visible.
    if (rule.endsOnDate !== null && isoDate > rule.endsOnDate) continue;

    for (const minuteOfDay of minutes) {
      const candidate = candidateAt(date, minuteOfDay);
      if (candidate.dueAtMs < createdAtMs) continue;
      if (candidate.dueAtMs > upToMs) continue;
      candidates.push(candidate);
    }
  }

  return candidates;
}

/**
 * Everything this rule says should already exist by `upToMs` but doesn't yet.
 *
 * Not the full future sequence — only occurrences at or before `upToMs`, and
 * only those whose key is not already in `existingOccurrenceKeys`. Keys that
 * ARE already present still count toward `endsAfterOccurrences`, since that
 * limit is a running total across all time, not a per-run one.
 *
 * The sequence starts at `rule.createdAt` (the schema has no separate start
 * date): the first occurrence is the first matching day and time at or after
 * the instant the rule was created, so times earlier on the creation day are
 * never produced and never counted.
 *
 * A rule's days come from its structured pattern, its explicitly picked
 * `customDates`, or both. The two are merged into one chronological sequence
 * before anything is counted or capped, so `endsAfterOccurrences` means the
 * same thing either way, and a date that both halves produce is one
 * occurrence rather than two — they share an `occurrenceKey`, which is the
 * same mechanism that stops a re-run duplicating anything.
 *
 * `limit` stops the walk early without changing what it produces: the result
 * is always a prefix of the full answer, never a different one. It exists for
 * the preview, which recomputes on every keystroke and would otherwise spend
 * real time on a rule that runs hourly for a decade. Generation itself never
 * passes it — an occurrence that is genuinely owed must always come back.
 */
export function generateDueOccurrences(
  rule: TaskRecurrenceRule,
  existingOccurrenceKeys: Set<string>,
  upToMs: number,
  limit: number = Number.POSITIVE_INFINITY,
): GeneratedOccurrence[] {
  const minutes = occurrenceMinutes(rule);
  if (minutes.length === 0) return [];

  const createdAtMs = Date.parse(rule.createdAt);
  if (Number.isNaN(createdAtMs) || createdAtMs > upToMs) return [];

  const maxOccurrences = Math.min(
    rule.endsAfterOccurrences ?? Number.POSITIVE_INFINITY,
    limit,
  );
  const candidates = [
    ...structuredCandidates(rule, minutes, createdAtMs, upToMs, maxOccurrences),
    ...customDateCandidates(rule, minutes, createdAtMs, upToMs),
  ];
  candidates.sort((a, b) => a.dueAtMs - b.dueAtMs);

  const due: GeneratedOccurrence[] = [];
  const produced = new Set<string>();

  for (const candidate of candidates) {
    if (produced.has(candidate.occurrenceKey)) continue;
    if (produced.size >= maxOccurrences) break;
    produced.add(candidate.occurrenceKey);
    if (!existingOccurrenceKeys.has(candidate.occurrenceKey)) {
      due.push({ dueAt: candidate.dueAt, occurrenceKey: candidate.occurrenceKey });
    }
  }

  return due;
}

// ----------------------------------------------------------------------
// Creation-form support
// ----------------------------------------------------------------------

/** The recurrence half of a new rule — everything `RecurrenceFields` collects,
 * with the title/category/description/assignees the plain task form already
 * handles left to the caller. */
export type RecurrenceRuleInput = {
  dayPattern: RecurrenceDayPattern;
  dayInterval: number;
  daysOfWeek: number[] | null;
  timePattern: RecurrenceTimePattern;
  timesOfDay: string[] | null;
  hourInterval: number | null;
  endsOnDate: string | null;
  endsAfterOccurrences: number | null;
  /** Sorted and de-duplicated `YYYY-MM-DD` Riyadh dates; empty when none were
   * picked. Stored in `task_recurrence_custom_dates`, not on the rule row. */
  customDates: string[];
};

export type RecurrenceEndMode = "after" | "onDate";

/**
 * What the form actually holds while it is being filled in. Numeric fields
 * stay raw text so a field can be emptied mid-edit without snapping back to a
 * number; `validateRecurrenceDraft` is the single place they become real
 * values.
 */
export type RecurrenceFormDraft = {
  dayPattern: RecurrenceDayPattern;
  dayIntervalText: string;
  daysOfWeek: number[];
  timePattern: RecurrenceTimePattern;
  /** `"HH:MM"` Riyadh wall-clock strings. */
  timesOfDay: string[];
  hourIntervalText: string;
  endMode: RecurrenceEndMode;
  endsAfterText: string;
  /** `YYYY-MM-DD`, or `null` until a date is picked. */
  endsOnDate: string | null;
  /** `YYYY-MM-DD` dates picked on the calendar. Extra days on top of the
   * pattern for `daily`/`weekly`/`monthly`; the only days there are for
   * `custom`. Kept unsorted here — `validateRecurrenceDraft` normalises it. */
  customDates: string[];
};

export const DEFAULT_RECURRENCE_DRAFT: RecurrenceFormDraft = {
  dayPattern: "daily",
  dayIntervalText: "1",
  daysOfWeek: [],
  timePattern: "fixed",
  timesOfDay: [],
  hourIntervalText: "8",
  endMode: "after",
  endsAfterText: "10",
  endsOnDate: null,
  customDates: [],
};

export type RecurrenceValidationResult =
  | { ok: true; values: RecurrenceRuleInput }
  | { ok: false; message: string };

/** Generous enough never to block a real restaurant schedule, low enough that
 * one rule cannot flood the task list with thousands of rows the first time
 * somebody opens the app. */
const MAX_ENDS_AFTER_OCCURRENCES = 1000;

function parsePositiveInteger(text: string): number | null {
  const trimmed = text.trim();
  if (!/^\d+$/.test(trimmed)) return null;
  const value = Number(trimmed);
  return value >= 1 ? value : null;
}

/**
 * Turns a half-filled form into either a rule the database will accept, or the
 * one message explaining what is missing. Every rejection here mirrors a real
 * SQL check constraint from `v2-supabase-patch-round5.sql`, so a submission
 * that passes cannot fail on the constraints — except `hour_interval`, which
 * has no DB check and is bounded only here and in `occurrenceMinutes`.
 */
export function validateRecurrenceDraft(
  draft: RecurrenceFormDraft,
  todayIsoDate: string,
): RecurrenceValidationResult {
  const customDates = [...new Set(draft.customDates)].sort();

  // `day_interval` is `not null` with a `> 0` check even for 'custom', which
  // has no interval to speak of — so it is set to 1 and, by contract, never
  // read back for that pattern (see `structuredCandidates`).
  let dayInterval = 1;
  let daysOfWeek: number[] | null = null;

  if (draft.dayPattern === "custom") {
    if (customDates.length === 0) {
      return { ok: false, message: "Pick at least one date on the calendar." };
    }
  } else {
    const parsedInterval = parsePositiveInteger(draft.dayIntervalText);
    if (parsedInterval === null) {
      return { ok: false, message: "Enter how often this repeats — a whole number, 1 or more." };
    }
    dayInterval = parsedInterval;

    if (draft.dayPattern === "weekly") {
      daysOfWeek = [...new Set(draft.daysOfWeek.filter((day) => day >= 0 && day <= 6))].sort(
        (a, b) => a - b,
      );
      if (daysOfWeek.length === 0) {
        return { ok: false, message: "Pick at least one day of the week." };
      }
    }
  }

  let timesOfDay: string[] | null = null;
  let hourInterval: number | null = null;
  if (draft.timePattern === "fixed") {
    timesOfDay = [...new Set(draft.timesOfDay)].sort();
    if (timesOfDay.length === 0) {
      return { ok: false, message: "Add at least one time of day." };
    }
  } else {
    hourInterval = parsePositiveInteger(draft.hourIntervalText);
    if (hourInterval === null || hourInterval > 24) {
      return { ok: false, message: "Enter how many hours between times — between 1 and 24." };
    }
  }

  let endsAfterOccurrences: number | null = null;
  let endsOnDate: string | null = null;
  if (draft.endMode === "after") {
    endsAfterOccurrences = parsePositiveInteger(draft.endsAfterText);
    if (endsAfterOccurrences === null || endsAfterOccurrences > MAX_ENDS_AFTER_OCCURRENCES) {
      return {
        ok: false,
        message: `Enter how many times this repeats — between 1 and ${MAX_ENDS_AFTER_OCCURRENCES}.`,
      };
    }
  } else {
    endsOnDate = draft.endsOnDate;
    if (endsOnDate === null) {
      return { ok: false, message: "Pick the date this stops repeating." };
    }
    if (endsOnDate < todayIsoDate) {
      return { ok: false, message: "The end date cannot be in the past." };
    }
  }

  return {
    ok: true,
    values: {
      dayPattern: draft.dayPattern,
      dayInterval,
      daysOfWeek,
      timePattern: draft.timePattern,
      timesOfDay,
      hourInterval,
      endsOnDate,
      endsAfterOccurrences,
      customDates,
    },
  };
}

// ----------------------------------------------------------------------
// Live preview
// ----------------------------------------------------------------------

/** Nothing exists yet for a rule that has not been created, and nothing here
 * writes to it. */
const NO_EXISTING_KEYS = new Set<string>();

/**
 * The rule this draft would become if it were saved right now. Only
 * `createdAt` genuinely matters — a rule's sequence starts at the instant it
 * was created, so anchoring the preview to "now" is what makes it honest
 * about which of today's times have already gone by. The identity fields are
 * placeholders; `generateDueOccurrences` never reads them.
 */
function draftAsRule(values: RecurrenceRuleInput, nowMs: number): TaskRecurrenceRule {
  return {
    id: "preview",
    title: "",
    categoryId: "",
    description: null,
    createdBy: "",
    createdAt: new Date(nowMs).toISOString(),
    assignedEmployeeIds: [],
    ...values,
  };
}

/**
 * How many occurrences the preview computes at most. Deliberately equal to
 * `MAX_ENDS_AFTER_OCCURRENCES`, so a rule that ends after a number of times
 * can never be truncated — only one ending on a far-off date can, and that is
 * the only shape that can run to tens of thousands. Keeps a preview that
 * recomputes on every keystroke to a few milliseconds.
 */
const MAX_PREVIEW_OCCURRENCES = MAX_ENDS_AFTER_OCCURRENCES;

export type RecurrencePreview =
  | { ok: false; message: string }
  | {
      ok: true;
      occurrences: GeneratedOccurrence[];
      /** The rule keeps going past the last occurrence shown — the preview
       * stopped counting, the rule did not. */
      isTruncated: boolean;
    };

/**
 * Exactly which dates and times the draft would produce, for the calendar
 * preview — the same `generateDueOccurrences` that will later create the real
 * occurrences, never a second implementation of the same rules.
 *
 * The horizon is unbounded on purpose: a preview has no notion of "due yet",
 * so what it shows is the rule's whole sequence, stopped only by its own end
 * condition. An incomplete draft comes back as the one message explaining
 * what is still missing, reusing `validateRecurrenceDraft`'s wording so the
 * preview and the submit error can never disagree.
 */
export function buildRecurrencePreview(
  draft: RecurrenceFormDraft,
  todayIsoDate: string,
  nowMs: number,
): RecurrencePreview {
  const validated = validateRecurrenceDraft(draft, todayIsoDate);
  if (!validated.ok) return { ok: false, message: validated.message };

  const occurrences = generateDueOccurrences(
    draftAsRule(validated.values, nowMs),
    NO_EXISTING_KEYS,
    unboundedUpToMs(nowMs),
    MAX_PREVIEW_OCCURRENCES,
  );

  // Nothing was filtered out on the way (the preview starts from an empty set
  // of existing keys), so a full result means the cap is what stopped it.
  return { ok: true, occurrences, isTruncated: occurrences.length >= MAX_PREVIEW_OCCURRENCES };
}

/**
 * The three helpers below convert between a native picker's `Date` and the
 * Riyadh digits the app actually stores. They are deliberately asymmetric —
 * the time picker is read locally, the date picker in UTC — because Android's
 * two pickers really do disagree, and the app is Android-only in practice
 * (`app.config.js` declares no `ios` block, and `@expo/ui`'s web picker
 * renders nothing at all):
 *
 * - **Time** goes through Material3's `TimePickerState`, which `@expo/ui`
 *   seeds from and reads back through a device-default `Calendar`. Its local
 *   hour and minute are exactly what the person tapped.
 * - **Date** goes through Material3's `DatePickerState`, which is UTC-based
 *   throughout: `selectedDateMillis` is *UTC midnight* of the picked day. On a
 *   device west of UTC+0, reading that with local getters lands on the day
 *   before — the bug this convention exists to prevent.
 *
 * (Were iOS ever added, its picker is SwiftUI's, which is device-local in both
 * modes; the date half would need a platform branch here.)
 */

/** `"HH:MM"` from a native time picker's value — its device-local wall-clock
 * digits, stored as Riyadh times, the same convention `resolveDueAt` uses for
 * a task's due time. */
export function pickerTimeToHHMM(picked: Date): string {
  return `${pad2(picked.getHours())}:${pad2(picked.getMinutes())}`;
}

/** `YYYY-MM-DD` from a native date picker's value — its *UTC* calendar digits,
 * stored as the Riyadh date the person picked. */
export function pickerDateToIsoDate(picked: Date): string {
  return `${picked.getUTCFullYear()}-${pad2(picked.getUTCMonth() + 1)}-${pad2(picked.getUTCDate())}`;
}

/** The inverse of `pickerDateToIsoDate`, for seeding a date picker's `value`
 * from a `YYYY-MM-DD` Riyadh date: the picker reads that prop back in the same
 * UTC terms it returns, so the digits have to be put in the same place. */
export function isoDateToPickerDate(isoDate: string): Date {
  const [year, month, day] = isoDate.split("-").map(Number);
  return new Date(Date.UTC(year, month - 1, day));
}
