/// <reference types="jest" />

import {
  buildRecurrencePreview,
  DEFAULT_RECURRENCE_DRAFT,
  generateDueOccurrences,
  isoDateToPickerDate,
  pickerDateToIsoDate,
  pickerTimeToHHMM,
  validateRecurrenceDraft,
  type RecurrenceFormDraft,
} from "@/lib/taskRecurrence";
import type { TaskRecurrenceRule } from "@/types/tasks";

/** Well past every scenario below, so a test only bounds generation when it
 * is deliberately testing the `upToMs` cut. */
const FAR_FUTURE = Date.parse("2027-06-01T00:00:00.000Z");

function makeRule(overrides: Partial<TaskRecurrenceRule> = {}): TaskRecurrenceRule {
  return {
    id: "rule-1",
    title: "Deep clean the fryer",
    categoryId: "cleaning",
    description: null,
    createdBy: "user_admin",
    dayPattern: "daily",
    dayInterval: 1,
    daysOfWeek: null,
    timePattern: "fixed",
    timesOfDay: ["09:00"],
    hourInterval: null,
    endsOnDate: null,
    endsAfterOccurrences: 10,
    customDates: [],
    // Riyadh 03:00 on 1 Sep 2026 (UTC+3).
    createdAt: "2026-09-01T00:00:00.000Z",
    assignedEmployeeIds: ["user_1"],
    ...overrides,
  };
}

function keysOf(rule: TaskRecurrenceRule, upToMs = FAR_FUTURE, existing = new Set<string>()) {
  return generateDueOccurrences(rule, existing, upToMs).map((o) => o.occurrenceKey);
}

describe("generateDueOccurrences — daily", () => {
  it("steps by dayInterval days, one occurrence per fixed time", () => {
    const rule = makeRule({
      dayPattern: "daily",
      dayInterval: 3,
      timesOfDay: ["07:30"],
      endsAfterOccurrences: 4,
    });

    expect(generateDueOccurrences(rule, new Set(), FAR_FUTURE)).toEqual([
      // Riyadh 07:30 == 04:30 UTC the same day.
      { dueAt: "2026-09-01T04:30:00.000Z", occurrenceKey: "2026-09-01T07:30" },
      { dueAt: "2026-09-04T04:30:00.000Z", occurrenceKey: "2026-09-04T07:30" },
      { dueAt: "2026-09-07T04:30:00.000Z", occurrenceKey: "2026-09-07T07:30" },
      { dueAt: "2026-09-10T04:30:00.000Z", occurrenceKey: "2026-09-10T07:30" },
    ]);
  });

  it("applies every time in timesOfDay to every occurring day, in clock order", () => {
    const rule = makeRule({
      // Deliberately unsorted, and Yahya's own multiple-times-a-day example.
      timesOfDay: ["17:02", "03:34", "13:19"],
      endsAfterOccurrences: 4,
      // Riyadh 00:00 on 1 Sep, so nothing on day one is skipped as too early.
      createdAt: "2026-08-31T21:00:00.000Z",
    });

    expect(keysOf(rule)).toEqual([
      "2026-09-01T03:34",
      "2026-09-01T13:19",
      "2026-09-01T17:02",
      "2026-09-02T03:34",
    ]);
  });
});

describe("generateDueOccurrences — weekly", () => {
  it("lands only on days_of_week, stepping by whole weeks", () => {
    // Every week on Tuesday and Wednesday. 1 Sep 2026 is a Tuesday.
    const rule = makeRule({
      dayPattern: "weekly",
      dayInterval: 1,
      daysOfWeek: [2, 3],
      timesOfDay: ["12:00"],
      endsAfterOccurrences: 4,
      createdAt: "2026-08-31T21:00:00.000Z",
    });

    expect(keysOf(rule)).toEqual([
      "2026-09-01T12:00",
      "2026-09-02T12:00",
      "2026-09-08T12:00",
      "2026-09-09T12:00",
    ]);
  });

  it("reads 'every 2 weeks on Monday' as a 2-week step, not the 2nd Monday of the month", () => {
    // 7 Sep 2026 is a Monday; a 2-week step lands on 21 Sep, then 5 Oct —
    // which the "Nth weekday of the month" reading would never produce.
    const rule = makeRule({
      dayPattern: "weekly",
      dayInterval: 2,
      daysOfWeek: [1],
      timesOfDay: ["09:00"],
      endsAfterOccurrences: 3,
      createdAt: "2026-09-06T21:00:00.000Z", // Riyadh 00:00 on Mon 7 Sep
    });

    expect(keysOf(rule)).toEqual([
      "2026-09-07T09:00",
      "2026-09-21T09:00",
      "2026-10-05T09:00",
    ]);
  });

  it("skips days earlier in the creation week without counting them", () => {
    // Created on Thursday, but Monday is also a chosen day — the Monday of
    // that same week is before the rule existed, so it is neither produced
    // nor counted against endsAfterOccurrences.
    const rule = makeRule({
      dayPattern: "weekly",
      dayInterval: 2,
      daysOfWeek: [1, 4],
      timesOfDay: ["09:00"],
      endsAfterOccurrences: 3,
      createdAt: "2026-09-09T21:00:00.000Z", // Riyadh 00:00 on Thu 10 Sep
    });

    expect(keysOf(rule)).toEqual([
      "2026-09-10T09:00",
      "2026-09-21T09:00",
      "2026-09-24T09:00",
    ]);
  });
});

describe("generateDueOccurrences — monthly", () => {
  it("steps by dayInterval months on the same day-of-month", () => {
    const rule = makeRule({
      dayPattern: "monthly",
      dayInterval: 2,
      timesOfDay: ["10:00"],
      endsAfterOccurrences: 3,
      createdAt: "2026-01-14T21:00:00.000Z", // Riyadh 00:00 on 15 Jan
    });

    expect(generateDueOccurrences(rule, new Set(), FAR_FUTURE)).toEqual([
      { dueAt: "2026-01-15T07:00:00.000Z", occurrenceKey: "2026-01-15T10:00" },
      { dueAt: "2026-03-15T07:00:00.000Z", occurrenceKey: "2026-03-15T10:00" },
      { dueAt: "2026-05-15T07:00:00.000Z", occurrenceKey: "2026-05-15T10:00" },
    ]);
  });

  it("skips months that have no such day-of-month rather than moving the day", () => {
    // Anchored on the 31st: Feb, Apr and Jun are skipped outright — the task
    // never silently lands on the 28th or the 30th instead.
    const rule = makeRule({
      dayPattern: "monthly",
      dayInterval: 1,
      timesOfDay: ["10:00"],
      endsAfterOccurrences: 4,
      createdAt: "2026-01-30T21:00:00.000Z", // Riyadh 00:00 on 31 Jan
    });

    expect(keysOf(rule)).toEqual([
      "2026-01-31T10:00",
      "2026-03-31T10:00",
      "2026-05-31T10:00",
      "2026-07-31T10:00",
    ]);
  });
});

describe("generateDueOccurrences — interval time pattern", () => {
  it("fires every hourInterval hours from midnight Riyadh", () => {
    const rule = makeRule({
      timePattern: "interval",
      timesOfDay: null,
      hourInterval: 6,
      endsAfterOccurrences: 8,
      createdAt: "2026-08-31T21:00:00.000Z", // Riyadh 00:00 on 1 Sep
    });

    expect(generateDueOccurrences(rule, new Set(), FAR_FUTURE)).toEqual([
      // Riyadh midnight is 21:00 UTC the previous day.
      { dueAt: "2026-08-31T21:00:00.000Z", occurrenceKey: "2026-09-01T00:00" },
      { dueAt: "2026-09-01T03:00:00.000Z", occurrenceKey: "2026-09-01T06:00" },
      { dueAt: "2026-09-01T09:00:00.000Z", occurrenceKey: "2026-09-01T12:00" },
      { dueAt: "2026-09-01T15:00:00.000Z", occurrenceKey: "2026-09-01T18:00" },
      { dueAt: "2026-09-01T21:00:00.000Z", occurrenceKey: "2026-09-02T00:00" },
      { dueAt: "2026-09-02T03:00:00.000Z", occurrenceKey: "2026-09-02T06:00" },
      { dueAt: "2026-09-02T09:00:00.000Z", occurrenceKey: "2026-09-02T12:00" },
      { dueAt: "2026-09-02T15:00:00.000Z", occurrenceKey: "2026-09-02T18:00" },
    ]);
  });

  it("anchors to midnight, not to the time the rule was created", () => {
    const rule = makeRule({
      timePattern: "interval",
      timesOfDay: null,
      hourInterval: 6,
      endsAfterOccurrences: 4,
      createdAt: "2026-09-01T00:34:00.000Z", // Riyadh 03:34 on 1 Sep
    });

    // 00:00 that day is before the rule existed, so the first occurrence is
    // 06:00 — never 03:34, 09:34, ... relative to creation.
    expect(keysOf(rule)).toEqual([
      "2026-09-01T06:00",
      "2026-09-01T12:00",
      "2026-09-01T18:00",
      "2026-09-02T00:00",
    ]);
  });

  it("produces a single midnight occurrence per day for a 24-hour interval", () => {
    const rule = makeRule({
      timePattern: "interval",
      timesOfDay: null,
      hourInterval: 24,
      endsAfterOccurrences: 2,
      createdAt: "2026-08-31T21:00:00.000Z",
    });

    expect(keysOf(rule)).toEqual(["2026-09-01T00:00", "2026-09-02T00:00"]);
  });
});

describe("generateDueOccurrences — end conditions", () => {
  it("stops after exactly endsAfterOccurrences occurrences", () => {
    const rule = makeRule({ endsAfterOccurrences: 3 });
    expect(keysOf(rule)).toHaveLength(3);
  });

  it("counts occurrences already generated toward the total, not just new ones", () => {
    const rule = makeRule({ endsAfterOccurrences: 3 });
    const all = keysOf(rule);
    expect(all).toHaveLength(3);

    // Every one of them already exists: the rule is exhausted, so a later run
    // must produce nothing rather than starting the count over.
    expect(keysOf(rule, FAR_FUTURE, new Set(all))).toEqual([]);

    // And with only the first two present, exactly the third is still owed.
    expect(keysOf(rule, FAR_FUTURE, new Set(all.slice(0, 2)))).toEqual([all[2]]);
  });

  it("generates up to and including endsOnDate, then stops", () => {
    const rule = makeRule({
      timesOfDay: ["08:00"],
      endsAfterOccurrences: null,
      endsOnDate: "2026-09-03",
      createdAt: "2026-08-31T21:00:00.000Z",
    });

    expect(keysOf(rule)).toEqual([
      "2026-09-01T08:00",
      "2026-09-02T08:00",
      "2026-09-03T08:00",
    ]);
  });

  it("respects endsOnDate when a monthly step lands past it inside a live month", () => {
    // 1 Mar is still inside the window but 31 Mar is not, and Feb is skipped
    // entirely — so only January's occurrence survives.
    const rule = makeRule({
      dayPattern: "monthly",
      dayInterval: 1,
      timesOfDay: ["10:00"],
      endsAfterOccurrences: null,
      endsOnDate: "2026-03-15",
      createdAt: "2026-01-30T21:00:00.000Z", // Riyadh 00:00 on 31 Jan
    });

    expect(keysOf(rule)).toEqual(["2026-01-31T10:00"]);
  });
});

describe("generateDueOccurrences — the window and already-generated occurrences", () => {
  it("returns nothing for a rule whose first occurrence is still in the future", () => {
    const rule = makeRule({
      timesOfDay: ["09:00"],
      createdAt: "2026-09-01T07:00:00.000Z", // Riyadh 10:00, past today's 09:00
    });

    // "Now" is the moment of creation: tomorrow's 09:00 is not due yet.
    expect(keysOf(rule, Date.parse("2026-09-01T07:00:00.000Z"))).toEqual([]);
  });

  it("includes an occurrence falling exactly on upToMs", () => {
    const rule = makeRule({ timesOfDay: ["09:00"], createdAt: "2026-08-31T21:00:00.000Z" });
    // Riyadh 09:00 on 1 Sep == 06:00 UTC.
    expect(keysOf(rule, Date.parse("2026-09-01T06:00:00.000Z"))).toEqual(["2026-09-01T09:00"]);
  });

  it("omits occurrences already generated but still returns the ones owed", () => {
    const rule = makeRule({
      timesOfDay: ["08:00", "20:00"],
      endsAfterOccurrences: 6,
      createdAt: "2026-08-31T21:00:00.000Z",
    });

    const existing = new Set(["2026-09-01T08:00", "2026-09-01T20:00", "2026-09-02T08:00"]);
    expect(keysOf(rule, FAR_FUTURE, existing)).toEqual([
      "2026-09-02T20:00",
      "2026-09-03T08:00",
      "2026-09-03T20:00",
    ]);
  });

  it("is stable across repeated runs — the same rule never yields a new key", () => {
    const rule = makeRule({ endsAfterOccurrences: 5 });
    const first = generateDueOccurrences(rule, new Set(), FAR_FUTURE);
    const second = generateDueOccurrences(
      rule,
      new Set(first.map((o) => o.occurrenceKey)),
      FAR_FUTURE,
    );
    expect(second).toEqual([]);
  });
});

describe("generateDueOccurrences — the reference scenario", () => {
  // "Every 2 weeks on Monday and Thursday, 09:00 and 15:00, ending after 6."
  // Created Riyadh 08:00 on Monday 7 Sep 2026.
  const rule = makeRule({
    dayPattern: "weekly",
    dayInterval: 2,
    daysOfWeek: [1, 4],
    timesOfDay: ["09:00", "15:00"],
    endsAfterOccurrences: 6,
    createdAt: "2026-09-07T05:00:00.000Z",
  });

  it("lands on the right dates and times and stops at exactly 6", () => {
    expect(generateDueOccurrences(rule, new Set(), FAR_FUTURE)).toEqual([
      { dueAt: "2026-09-07T06:00:00.000Z", occurrenceKey: "2026-09-07T09:00" },
      { dueAt: "2026-09-07T12:00:00.000Z", occurrenceKey: "2026-09-07T15:00" },
      { dueAt: "2026-09-10T06:00:00.000Z", occurrenceKey: "2026-09-10T09:00" },
      { dueAt: "2026-09-10T12:00:00.000Z", occurrenceKey: "2026-09-10T15:00" },
      // The 2-week step skips 14 and 17 Sep entirely.
      { dueAt: "2026-09-21T06:00:00.000Z", occurrenceKey: "2026-09-21T09:00" },
      { dueAt: "2026-09-21T12:00:00.000Z", occurrenceKey: "2026-09-21T15:00" },
    ]);
  });

  it("generates only what is already due, not the whole future sequence", () => {
    // Riyadh 13:00 on 10 Sep — that day's 15:00 has not arrived yet.
    const upTo = Date.parse("2026-09-10T10:00:00.000Z");
    expect(keysOf(rule, upTo)).toEqual([
      "2026-09-07T09:00",
      "2026-09-07T15:00",
      "2026-09-10T09:00",
    ]);
  });

  it("reopening the app does not duplicate anything already generated", () => {
    const upTo = Date.parse("2026-09-10T10:00:00.000Z");
    const firstRun = keysOf(rule, upTo);
    expect(keysOf(rule, upTo, new Set(firstRun))).toEqual([]);
  });
});

describe("generateDueOccurrences — custom dates", () => {
  it("produces exactly the picked dates for a 'custom' rule, across months", () => {
    const rule = makeRule({
      dayPattern: "custom",
      customDates: ["2026-10-03", "2026-09-15"],
      timesOfDay: ["09:00"],
    });

    expect(generateDueOccurrences(rule, new Set(), FAR_FUTURE)).toEqual([
      // Riyadh 09:00 == 06:00 UTC the same day.
      { dueAt: "2026-09-15T06:00:00.000Z", occurrenceKey: "2026-09-15T09:00" },
      { dueAt: "2026-10-03T06:00:00.000Z", occurrenceKey: "2026-10-03T09:00" },
    ]);
  });

  it("never reads dayInterval or daysOfWeek for a 'custom' rule", () => {
    // Both values would stop a structured rule dead — a zero interval returns
    // nothing at all. A 'custom' rule skips that half entirely, so neither is
    // even looked at.
    const rule = makeRule({
      dayPattern: "custom",
      dayInterval: 0,
      daysOfWeek: [3],
      customDates: ["2026-09-15"],
      timesOfDay: ["09:00"],
    });

    expect(keysOf(rule)).toEqual(["2026-09-15T09:00"]);
  });

  it("returns nothing for a 'custom' rule with no dates picked", () => {
    expect(keysOf(makeRule({ dayPattern: "custom", customDates: [] }))).toEqual([]);
  });

  it("merges picked dates into a structured pattern as one chronological run", () => {
    // Every Tuesday from Tue 1 Sep, plus a Friday and a Thursday that the
    // pattern would never land on.
    const rule = makeRule({
      dayPattern: "weekly",
      dayInterval: 1,
      daysOfWeek: [2],
      timesOfDay: ["12:00"],
      endsAfterOccurrences: 5,
      customDates: ["2026-09-04", "2026-09-10"],
      createdAt: "2026-08-31T21:00:00.000Z", // Riyadh 00:00 on Tue 1 Sep
    });

    expect(keysOf(rule)).toEqual([
      "2026-09-01T12:00",
      "2026-09-04T12:00",
      "2026-09-08T12:00",
      "2026-09-10T12:00",
      "2026-09-15T12:00",
    ]);
  });

  it("counts a picked date the pattern already covers once, not twice", () => {
    // 8 Sep is a Tuesday, so the weekly pattern produces it too. Without the
    // key-based merge the cap of 3 would be spent on a duplicate.
    const rule = makeRule({
      dayPattern: "weekly",
      dayInterval: 1,
      daysOfWeek: [2],
      timesOfDay: ["12:00"],
      endsAfterOccurrences: 3,
      customDates: ["2026-09-08"],
      createdAt: "2026-08-31T21:00:00.000Z",
    });

    expect(keysOf(rule)).toEqual([
      "2026-09-01T12:00",
      "2026-09-08T12:00",
      "2026-09-15T12:00",
    ]);
  });

  it("applies every fixed time of day to a picked date", () => {
    const rule = makeRule({
      dayPattern: "custom",
      customDates: ["2026-09-15"],
      timesOfDay: ["20:00", "08:00"],
    });

    expect(keysOf(rule)).toEqual(["2026-09-15T08:00", "2026-09-15T20:00"]);
  });

  it("applies an hour interval to a picked date the same way it does any other day", () => {
    const rule = makeRule({
      dayPattern: "custom",
      customDates: ["2026-09-15"],
      timePattern: "interval",
      timesOfDay: null,
      hourInterval: 12,
    });

    expect(keysOf(rule)).toEqual(["2026-09-15T00:00", "2026-09-15T12:00"]);
  });

  it("skips picked times that fall before the rule existed", () => {
    // The rule is created at Riyadh 03:00 on 1 Sep. On that same picked day,
    // 01:00 is already gone and 09:00 is not.
    const rule = makeRule({
      dayPattern: "custom",
      customDates: ["2026-08-25", "2026-09-01"],
      timesOfDay: ["01:00", "09:00"],
    });

    expect(keysOf(rule)).toEqual(["2026-09-01T09:00"]);
  });

  it("drops a picked date past endsOnDate", () => {
    const rule = makeRule({
      dayPattern: "custom",
      customDates: ["2026-09-15", "2026-10-03"],
      timesOfDay: ["09:00"],
      endsAfterOccurrences: null,
      endsOnDate: "2026-09-30",
    });

    expect(keysOf(rule)).toEqual(["2026-09-15T09:00"]);
  });

  it("does not produce a picked date that is not due yet", () => {
    const rule = makeRule({
      dayPattern: "custom",
      customDates: ["2026-09-15", "2026-10-03"],
      timesOfDay: ["09:00"],
    });

    expect(keysOf(rule, Date.parse("2026-09-20T00:00:00.000Z"))).toEqual(["2026-09-15T09:00"]);
  });

  it("ignores malformed picked dates and keeps the valid ones", () => {
    const rule = makeRule({
      dayPattern: "custom",
      // 30 Feb and month 13 are not real dates; neither is free text.
      customDates: ["2026-09-15", "not-a-date", "2026-02-30", "2026-13-01"],
      timesOfDay: ["09:00"],
    });

    expect(keysOf(rule)).toEqual(["2026-09-15T09:00"]);
  });

  it("de-duplicates a date picked twice", () => {
    const rule = makeRule({
      dayPattern: "custom",
      customDates: ["2026-09-15", "2026-09-15"],
      timesOfDay: ["09:00"],
    });

    expect(keysOf(rule)).toEqual(["2026-09-15T09:00"]);
  });

  it("counts picked dates toward endsAfterOccurrences, already-generated ones included", () => {
    const rule = makeRule({
      dayPattern: "custom",
      customDates: ["2026-09-15", "2026-09-16", "2026-09-17"],
      timesOfDay: ["09:00"],
      endsAfterOccurrences: 2,
    });

    // The cap lands after the 16th, so the 17th is never produced at all.
    expect(keysOf(rule)).toEqual(["2026-09-15T09:00", "2026-09-16T09:00"]);
    // And with the 15th already generated, exactly the 16th is still owed —
    // the count starts from the whole sequence, not from what is missing.
    expect(keysOf(rule, FAR_FUTURE, new Set(["2026-09-15T09:00"]))).toEqual([
      "2026-09-16T09:00",
    ]);
  });

  it("is stable across repeated runs for a combined rule", () => {
    const rule = makeRule({
      dayPattern: "weekly",
      dayInterval: 1,
      daysOfWeek: [2],
      timesOfDay: ["12:00"],
      endsAfterOccurrences: 5,
      customDates: ["2026-09-04", "2026-09-10"],
      createdAt: "2026-08-31T21:00:00.000Z",
    });

    const first = generateDueOccurrences(rule, new Set(), FAR_FUTURE);
    const second = generateDueOccurrences(
      rule,
      new Set(first.map((o) => o.occurrenceKey)),
      FAR_FUTURE,
    );
    expect(second).toEqual([]);
  });
});

describe("generateDueOccurrences — rules that cannot generate", () => {
  it("returns nothing when the rule was created after the window", () => {
    const rule = makeRule({ createdAt: "2026-09-01T00:00:00.000Z" });
    expect(keysOf(rule, Date.parse("2026-08-01T00:00:00.000Z"))).toEqual([]);
  });

  it("returns nothing for an unparseable createdAt", () => {
    expect(keysOf(makeRule({ createdAt: "not-a-timestamp" }))).toEqual([]);
  });

  it("returns nothing for a non-positive dayInterval", () => {
    expect(keysOf(makeRule({ dayInterval: 0 }))).toEqual([]);
  });

  it("returns nothing for a weekly rule with no days of week", () => {
    expect(keysOf(makeRule({ dayPattern: "weekly", daysOfWeek: [] }))).toEqual([]);
  });

  it("returns nothing when no valid time of day survives parsing", () => {
    expect(keysOf(makeRule({ timesOfDay: ["25:00", "nonsense", "12:60"] }))).toEqual([]);
  });

  it("returns nothing for a non-positive hourInterval", () => {
    const rule = makeRule({ timePattern: "interval", timesOfDay: null, hourInterval: 0 });
    expect(keysOf(rule)).toEqual([]);
  });

  it("ignores malformed times but keeps the valid ones", () => {
    const rule = makeRule({
      timesOfDay: ["09:00", "nonsense", "21:00"],
      endsAfterOccurrences: 2,
      createdAt: "2026-08-31T21:00:00.000Z",
    });
    expect(keysOf(rule)).toEqual(["2026-09-01T09:00", "2026-09-01T21:00"]);
  });

  it("de-duplicates repeated times of day", () => {
    const rule = makeRule({
      timesOfDay: ["09:00", "09:00"],
      endsAfterOccurrences: 2,
      createdAt: "2026-08-31T21:00:00.000Z",
    });
    expect(keysOf(rule)).toEqual(["2026-09-01T09:00", "2026-09-02T09:00"]);
  });
});

describe("validateRecurrenceDraft", () => {
  const TODAY = "2026-09-01";

  function draft(overrides: Partial<RecurrenceFormDraft> = {}): RecurrenceFormDraft {
    return { ...DEFAULT_RECURRENCE_DRAFT, timesOfDay: ["09:00"], ...overrides };
  }

  it("accepts a daily fixed-time rule ending after a number of occurrences", () => {
    const result = validateRecurrenceDraft(draft({ dayIntervalText: "3" }), TODAY);
    expect(result).toEqual({
      ok: true,
      values: {
        dayPattern: "daily",
        dayInterval: 3,
        daysOfWeek: null,
        timePattern: "fixed",
        timesOfDay: ["09:00"],
        hourInterval: null,
        endsOnDate: null,
        endsAfterOccurrences: 10,
        customDates: [],
      },
    });
  });

  it("sorts and de-duplicates days of week and times", () => {
    const result = validateRecurrenceDraft(
      draft({
        dayPattern: "weekly",
        daysOfWeek: [4, 1, 4],
        timesOfDay: ["15:00", "09:00", "15:00"],
      }),
      TODAY,
    );
    expect(result).toEqual({
      ok: true,
      values: expect.objectContaining({
        daysOfWeek: [1, 4],
        timesOfDay: ["09:00", "15:00"],
      }),
    });
  });

  it("keeps exactly one end condition set, matching the DB constraint", () => {
    const result = validateRecurrenceDraft(
      draft({ endMode: "onDate", endsOnDate: "2026-12-31" }),
      TODAY,
    );
    expect(result).toEqual({
      ok: true,
      values: expect.objectContaining({
        endsOnDate: "2026-12-31",
        endsAfterOccurrences: null,
      }),
    });
  });

  it("rejects a missing or non-numeric interval", () => {
    expect(validateRecurrenceDraft(draft({ dayIntervalText: "" }), TODAY).ok).toBe(false);
    expect(validateRecurrenceDraft(draft({ dayIntervalText: "0" }), TODAY).ok).toBe(false);
    expect(validateRecurrenceDraft(draft({ dayIntervalText: "1.5" }), TODAY).ok).toBe(false);
  });

  it("rejects a weekly rule with no day selected", () => {
    const result = validateRecurrenceDraft(draft({ dayPattern: "weekly", daysOfWeek: [] }), TODAY);
    expect(result).toEqual({ ok: false, message: "Pick at least one day of the week." });
  });

  it("rejects a fixed-time rule with no times", () => {
    const result = validateRecurrenceDraft(draft({ timesOfDay: [] }), TODAY);
    expect(result).toEqual({ ok: false, message: "Add at least one time of day." });
  });

  it("rejects an hour interval outside 1–24", () => {
    const asInterval = { timePattern: "interval" as const, timesOfDay: [] };
    expect(
      validateRecurrenceDraft(draft({ ...asInterval, hourIntervalText: "0" }), TODAY).ok,
    ).toBe(false);
    expect(
      validateRecurrenceDraft(draft({ ...asInterval, hourIntervalText: "25" }), TODAY).ok,
    ).toBe(false);
    expect(
      validateRecurrenceDraft(draft({ ...asInterval, hourIntervalText: "6" }), TODAY),
    ).toEqual({ ok: true, values: expect.objectContaining({ hourInterval: 6, timesOfDay: null }) });
  });

  it("rejects an occurrence count that is missing or unreasonably large", () => {
    expect(validateRecurrenceDraft(draft({ endsAfterText: "" }), TODAY).ok).toBe(false);
    expect(validateRecurrenceDraft(draft({ endsAfterText: "1001" }), TODAY).ok).toBe(false);
  });

  it("accepts a 'custom' draft, ignoring the structured fields entirely", () => {
    const result = validateRecurrenceDraft(
      draft({
        dayPattern: "custom",
        // Both would be fatal for a structured pattern — an empty interval is
        // rejected outright, and a stray weekday would break the DB's
        // days_of_week-only-weekly constraint if it were carried through.
        dayIntervalText: "",
        daysOfWeek: [3],
        customDates: ["2026-10-03", "2026-09-15", "2026-09-15"],
      }),
      TODAY,
    );

    expect(result).toEqual({
      ok: true,
      values: expect.objectContaining({
        dayPattern: "custom",
        // Meaningless for 'custom', but the column is `not null` with a `> 0`
        // check, so it still has to be a real value.
        dayInterval: 1,
        daysOfWeek: null,
        customDates: ["2026-09-15", "2026-10-03"],
      }),
    });
  });

  it("rejects a 'custom' draft with no dates picked", () => {
    const result = validateRecurrenceDraft(
      draft({ dayPattern: "custom", customDates: [] }),
      TODAY,
    );
    expect(result).toEqual({ ok: false, message: "Pick at least one date on the calendar." });
  });

  it("keeps picked dates alongside a structured pattern rather than replacing it", () => {
    const result = validateRecurrenceDraft(
      draft({ dayPattern: "weekly", daysOfWeek: [1], customDates: ["2026-09-20"] }),
      TODAY,
    );

    expect(result).toEqual({
      ok: true,
      values: expect.objectContaining({
        dayPattern: "weekly",
        daysOfWeek: [1],
        customDates: ["2026-09-20"],
      }),
    });
  });

  it("rejects an end date that is missing or already past", () => {
    expect(
      validateRecurrenceDraft(draft({ endMode: "onDate", endsOnDate: null }), TODAY).ok,
    ).toBe(false);
    expect(
      validateRecurrenceDraft(draft({ endMode: "onDate", endsOnDate: "2026-08-31" }), TODAY).ok,
    ).toBe(false);
    // Today itself is still a valid last day.
    expect(
      validateRecurrenceDraft(draft({ endMode: "onDate", endsOnDate: TODAY }), TODAY).ok,
    ).toBe(true);
  });
});

describe("buildRecurrencePreview", () => {
  // Riyadh 00:00 on Tuesday 1 Sep 2026 — the instant the previewed rule is
  // treated as having been created at.
  const NOW_MS = Date.parse("2026-08-31T21:00:00.000Z");
  const TODAY = "2026-09-01";

  function draft(overrides: Partial<RecurrenceFormDraft> = {}): RecurrenceFormDraft {
    return { ...DEFAULT_RECURRENCE_DRAFT, timesOfDay: ["09:00"], ...overrides };
  }

  function previewKeys(overrides: Partial<RecurrenceFormDraft>): string[] {
    const result = buildRecurrencePreview(draft(overrides), TODAY, NOW_MS);
    if (!result.ok) throw new Error(`Expected a valid draft, got: ${result.message}`);
    return result.occurrences.map((o) => o.occurrenceKey);
  }

  it("reports what an incomplete draft is still missing, in the submit error's own words", () => {
    expect(buildRecurrencePreview(draft({ timesOfDay: [] }), TODAY, NOW_MS)).toEqual({
      ok: false,
      message: "Add at least one time of day.",
    });
  });

  it("shows exactly the picked dates for a custom-only draft spanning two months", () => {
    expect(
      previewKeys({
        dayPattern: "custom",
        customDates: ["2026-10-03", "2026-09-15"],
      }),
    ).toEqual(["2026-09-15T09:00", "2026-10-03T09:00"]);
  });

  it("shows the union of a pattern and its extra dates, with nothing duplicated", () => {
    expect(
      previewKeys({
        dayPattern: "weekly",
        daysOfWeek: [2],
        timesOfDay: ["12:00"],
        endsAfterText: "5",
        // 8 Sep is a Tuesday the pattern already produces; the other two are
        // days it never would.
        customDates: ["2026-09-04", "2026-09-08", "2026-09-10"],
      }),
    ).toEqual([
      "2026-09-01T12:00",
      "2026-09-04T12:00",
      "2026-09-08T12:00",
      "2026-09-10T12:00",
      "2026-09-15T12:00",
    ]);
  });

  it("caps a runaway rule and says so, rather than counting tens of thousands", () => {
    // Hourly for a decade — the heaviest thing the form can express, and the
    // only shape that can exceed the cap at all.
    const result = buildRecurrencePreview(
      draft({
        timePattern: "interval",
        timesOfDay: [],
        hourIntervalText: "1",
        endMode: "onDate",
        endsOnDate: "2036-01-01",
      }),
      TODAY,
      NOW_MS,
    );

    expect(result.ok).toBe(true);
    if (!result.ok) return;
    expect(result.isTruncated).toBe(true);
    expect(result.occurrences).toHaveLength(1000);
    // A prefix of the real answer, never a different one.
    expect(result.occurrences[0].occurrenceKey).toBe("2026-09-01T00:00");
    expect(result.occurrences[1].occurrenceKey).toBe("2026-09-01T01:00");
  });

  it("does not mark an ordinary rule as truncated", () => {
    const result = buildRecurrencePreview(draft({ endsAfterText: "3" }), TODAY, NOW_MS);
    expect(result).toEqual({ ok: true, isTruncated: false, occurrences: expect.any(Array) });
  });

  it("previews the whole sequence, not just the part that has come due", () => {
    // Every one of these is in the future at NOW_MS — a preview has no notion
    // of "due yet", unlike the generation pass.
    expect(previewKeys({ dayIntervalText: "1", endsAfterText: "3" })).toEqual([
      "2026-09-01T09:00",
      "2026-09-02T09:00",
      "2026-09-03T09:00",
    ]);
  });

  it("matches what generateDueOccurrences will actually create for the same rule", () => {
    const overrides = {
      dayPattern: "weekly" as const,
      daysOfWeek: [2],
      timesOfDay: ["12:00"],
      endsAfterText: "5",
      customDates: ["2026-09-04", "2026-09-10"],
    };

    const generated = generateDueOccurrences(
      makeRule({
        dayPattern: "weekly",
        dayInterval: 1,
        daysOfWeek: [2],
        timesOfDay: ["12:00"],
        endsAfterOccurrences: 5,
        customDates: ["2026-09-04", "2026-09-10"],
        createdAt: new Date(NOW_MS).toISOString(),
      }),
      new Set(),
      FAR_FUTURE,
    );

    expect(previewKeys(overrides)).toEqual(generated.map((o) => o.occurrenceKey));
  });
});

describe("picker value formatting", () => {
  // The time picker returns device-local digits and the date picker returns
  // UTC ones, so each is simulated with the matching constructor. See the
  // block comment above `pickerTimeToHHMM` for why they differ.
  it("reads a time picker's local wall-clock digits as the Riyadh time to store", () => {
    expect(pickerTimeToHHMM(new Date(2026, 8, 1, 9, 5))).toBe("09:05");
    expect(pickerTimeToHHMM(new Date(2026, 8, 1, 23, 59))).toBe("23:59");
  });

  it("reads a date picker's UTC calendar digits as the Riyadh date to store", () => {
    expect(pickerDateToIsoDate(new Date(Date.UTC(2026, 0, 5)))).toBe("2026-01-05");
    expect(pickerDateToIsoDate(new Date(Date.UTC(2026, 11, 31)))).toBe("2026-12-31");
  });

  it("ignores the local digits of a date picker's value", () => {
    // The test process runs at Asia/Riyadh, where a UTC-midnight value reads
    // as the same day either way — so only an instant late in the UTC day
    // separates the two readings. Not a shape the picker returns, but it is
    // what pins which getters are used, and reading the local ones is exactly
    // what cost a day on the EDT device.
    expect(pickerDateToIsoDate(new Date("2026-01-04T22:00:00.000Z"))).toBe("2026-01-04");
  });

  it("seeds a date picker with digits it reads back unchanged", () => {
    expect(pickerDateToIsoDate(isoDateToPickerDate("2026-01-05"))).toBe("2026-01-05");
    expect(isoDateToPickerDate("2026-12-31").toISOString()).toBe("2026-12-31T00:00:00.000Z");
  });
});
