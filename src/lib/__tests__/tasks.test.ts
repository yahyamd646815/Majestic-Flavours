/// <reference types="jest" />

import { formatReportDate, getEndOfDayRiyadhIso, getTodayIsoDate } from "@/lib/reports";
import {
  DELAY_FALLBACK_MESSAGE,
  MISSED_VISIBILITY_WINDOW_MS,
  canDelayTask,
  dueAtRiyadhIsoDate,
  dueAtToDatePickerValue,
  dueAtToTimePickerValue,
  formatDelayTargetLabel,
  getDelayErrorMessage,
  getDelayedDueAt,
  hasEmployeeResponded,
  isMissedTask,
  isMissedTaskHiddenForViewer,
  isTaskFullyCompleted,
  isTaskOverdueForEmployee,
  isTaskPastDue,
  isTaskResolvedForEmployee,
  matchesTaskDateFilter,
  resolveDueAt,
} from "@/lib/tasks";
import type { TaskCompletion } from "@/types/tasks";

const DUE = "2026-01-01T00:00:00.000Z";
const BEFORE_DUE = Date.parse("2025-12-31T00:00:00.000Z");
const AFTER_DUE = Date.parse("2026-01-02T00:00:00.000Z");

function completion(
  employeeClerkId: string,
  status: TaskCompletion["status"],
  note: string | null = null,
): TaskCompletion {
  return { employeeClerkId, status, note, recordedAt: "2026-01-02T00:00:00.000Z" };
}

describe("isTaskFullyCompleted", () => {
  it("is false when nobody has responded", () => {
    expect(isTaskFullyCompleted({ completions: [] })).toBe(false);
  });

  it("is true as soon as any one assignee completes it", () => {
    const task = { completions: [completion("user_1", "completed")] };
    expect(isTaskFullyCompleted(task)).toBe(true);
  });

  it("is false when every response so far is a miss", () => {
    const task = {
      completions: [
        completion("user_1", "missed", "Short-staffed"),
        completion("user_2", "missed", "Fryer was down"),
      ],
    };
    expect(isTaskFullyCompleted(task)).toBe(false);
  });

  it("closes for everyone when one person completes and another missed", () => {
    const task = {
      completions: [completion("user_1", "missed", "Ran out of time"), completion("user_2", "completed")],
    };
    expect(isTaskFullyCompleted(task)).toBe(true);
  });
});

describe("hasEmployeeResponded", () => {
  it("is false for someone who has not responded yet", () => {
    const task = { completions: [completion("user_1", "completed")] };
    expect(hasEmployeeResponded(task, "user_2")).toBe(false);
  });

  it("is true for a completion, and for a miss reason alike", () => {
    const task = {
      completions: [completion("user_1", "completed"), completion("user_2", "missed", "Sick")],
    };
    expect(hasEmployeeResponded(task, "user_1")).toBe(true);
    expect(hasEmployeeResponded(task, "user_2")).toBe(true);
  });

  it("does not treat one person's response as standing in for another's", () => {
    // The heart of the per-assignee rule: user_2 still owes their own reason.
    const task = { completions: [completion("user_1", "missed", "Ran out of time")] };
    expect(hasEmployeeResponded(task, "user_1")).toBe(true);
    expect(hasEmployeeResponded(task, "user_2")).toBe(false);
  });
});

describe("isTaskPastDue", () => {
  it("is false before the due date", () => {
    expect(isTaskPastDue({ dueAt: DUE, completions: [] }, BEFORE_DUE)).toBe(false);
  });

  it("is true after the due date while nobody has completed it", () => {
    expect(isTaskPastDue({ dueAt: DUE, completions: [] }, AFTER_DUE)).toBe(true);
  });

  it("stays true when everyone has only missed it", () => {
    const task = {
      dueAt: DUE,
      completions: [completion("user_1", "missed", "Short-staffed")],
    };
    expect(isTaskPastDue(task, AFTER_DUE)).toBe(true);
  });

  it("is false once completed, however late", () => {
    const task = { dueAt: DUE, completions: [completion("user_1", "completed")] };
    expect(isTaskPastDue(task, AFTER_DUE)).toBe(false);
  });
});

describe("isTaskOverdueForEmployee", () => {
  it("is false before the due date", () => {
    const task = { dueAt: DUE, completions: [] };
    expect(isTaskOverdueForEmployee(task, "user_1", BEFORE_DUE)).toBe(false);
  });

  it("is true past due for someone who has not responded", () => {
    const task = { dueAt: DUE, completions: [] };
    expect(isTaskOverdueForEmployee(task, "user_1", AFTER_DUE)).toBe(true);
  });

  it("is false for the person who already responded, true for the one who has not", () => {
    const task = {
      dueAt: DUE,
      completions: [completion("user_1", "missed", "Ran out of time")],
    };
    expect(isTaskOverdueForEmployee(task, "user_1", AFTER_DUE)).toBe(false);
    expect(isTaskOverdueForEmployee(task, "user_2", AFTER_DUE)).toBe(true);
  });

  it("clears for everyone once any one assignee completes it", () => {
    const task = { dueAt: DUE, completions: [completion("user_1", "completed")] };
    expect(isTaskOverdueForEmployee(task, "user_1", AFTER_DUE)).toBe(false);
    // user_2 never responded and never has to — one completion closes it.
    expect(isTaskOverdueForEmployee(task, "user_2", AFTER_DUE)).toBe(false);
  });
});

describe("isTaskResolvedForEmployee", () => {
  it("is false when the task is open and this person has not responded", () => {
    const task = { completions: [] };
    expect(isTaskResolvedForEmployee(task, "user_1")).toBe(false);
  });

  it("is true when this person has already responded, completed or missed alike", () => {
    const task = { completions: [completion("user_1", "missed", "Ran out of time")] };
    expect(isTaskResolvedForEmployee(task, "user_1")).toBe(true);
  });

  it("is true for someone who never responded once anyone else closes the task", () => {
    const task = { completions: [completion("user_1", "completed")] };
    expect(isTaskResolvedForEmployee(task, "user_2")).toBe(true);
  });

  it("is false for someone still owed a response on an open task, even if another already missed it", () => {
    const task = { completions: [completion("user_1", "missed", "Short-staffed")] };
    expect(isTaskResolvedForEmployee(task, "user_2")).toBe(false);
  });
});

describe("resolveDueAt", () => {
  // A picked DATE is built with `Date.UTC` and a picked TIME with the local
  // constructor, deliberately: that is exactly how Android's two pickers hand
  // their values back (Material3's `DatePickerState.selectedDateMillis` is UTC
  // midnight of the picked day; `TimePickerState` goes through a
  // device-default `Calendar`). Simulating both with the local constructor
  // would be asserting a contract the date picker does not actually honour.
  it("resolves to end of today (Riyadh) when neither date nor time is picked", () => {
    // Riyadh 23:59 == UTC 20:59 the same calendar day.
    expect(resolveDueAt(null, null)).toBe(`${getTodayIsoDate()}T20:59:00.000Z`);
  });

  it("keeps a picked date's end-of-day when no time is picked", () => {
    const pickedDate = new Date(Date.UTC(2026, 6, 12)); // 12 Jul 2026, as the picker returns it
    const result = resolveDueAt(pickedDate, null);
    expect(result).toBe("2026-07-12T20:59:00.000Z");
  });

  it("applies a picked time to today's Riyadh date when no date is picked", () => {
    const pickedTime = new Date(2000, 0, 1, 14, 30);
    const result = resolveDueAt(null, pickedTime);
    // Riyadh 14:30 == UTC 11:30 the same calendar day.
    expect(result).toBe(`${getTodayIsoDate()}T11:30:00.000Z`);
  });

  it("combines both a picked date and a picked time", () => {
    const pickedDate = new Date(Date.UTC(2026, 6, 12));
    const pickedTime = new Date(2000, 0, 1, 9, 15);
    expect(resolveDueAt(pickedDate, pickedTime)).toBe("2026-07-12T06:15:00.000Z");
  });

  it("reads the date's UTC digits, not its local ones", () => {
    // The test process runs at Asia/Riyadh, where a UTC-midnight value reads
    // as the same day under either set of getters — so only an instant late
    // in the UTC day can tell the two readings apart. The picker never
    // returns this shape (it always returns UTC midnight), but on the EDT
    // device the same divergence ran the other way and cost a whole day, so
    // which getters are used is worth pinning directly.
    const pickedDate = new Date("2026-07-11T22:00:00.000Z"); // 01:00 on 12 Jul locally
    expect(resolveDueAt(pickedDate, null)).toBe("2026-07-11T20:59:00.000Z");
  });
});

describe("dueAtToDatePickerValue", () => {
  // These assert the digits directly rather than just round-tripping, because
  // the test process is pinned to Asia/Riyadh (see jest.globalSetup.js) —
  // under that TZ several wrong constructions would round-trip too, so a
  // round-trip alone would not prove anything.
  it("exposes the Riyadh calendar date in the UTC digits the picker reads", () => {
    const picker = dueAtToDatePickerValue("2026-07-12T06:15:00.000Z");
    expect(picker).not.toBeNull();
    expect(picker!.getUTCFullYear()).toBe(2026);
    expect(picker!.getUTCMonth()).toBe(6); // July, 0-indexed
    expect(picker!.getUTCDate()).toBe(12);
    expect(picker!.toISOString()).toBe("2026-07-12T00:00:00.000Z");
  });

  it("rolls forward to the next Riyadh day for a late-UTC instant", () => {
    // 22:30 UTC on 11 Jul is already 01:30 on 12 Jul in Riyadh.
    const picker = dueAtToDatePickerValue("2026-07-11T22:30:00.000Z");
    expect(picker!.getUTCDate()).toBe(12);
  });

  it("returns null for an unparseable timestamp", () => {
    expect(dueAtToDatePickerValue("not-a-date")).toBeNull();
  });
});

describe("dueAtToTimePickerValue", () => {
  it("exposes the Riyadh wall-clock time in the local digits the picker reads", () => {
    const picker = dueAtToTimePickerValue("2026-07-12T06:15:00.000Z");
    expect(picker).not.toBeNull();
    expect(picker!.getHours()).toBe(9); // 06:15 UTC == 09:15 Riyadh
    expect(picker!.getMinutes()).toBe(15);
  });

  it("carries the Riyadh day a late-UTC instant belongs to", () => {
    const picker = dueAtToTimePickerValue("2026-07-11T22:30:00.000Z");
    expect(picker!.getDate()).toBe(12);
    expect(picker!.getHours()).toBe(1);
  });

  it("returns null for an unparseable timestamp", () => {
    expect(dueAtToTimePickerValue("not-a-date")).toBeNull();
  });
});

describe("editing a task without touching either picker", () => {
  // The guarantee that matters most: the seeded values feed straight back
  // into `resolveDueAt` on save, so `dueAt` must come out byte-identical.
  it.each([
    "2026-07-12T20:59:00.000Z", // end of a Riyadh day
    "2026-07-12T06:15:00.000Z", // mid-morning Riyadh
    "2026-07-11T22:30:00.000Z", // late UTC, already the next Riyadh day
    "2026-07-11T21:00:00.000Z", // exactly Riyadh midnight
  ])("round-trips %s unchanged", (dueAt) => {
    const pickedDate = dueAtToDatePickerValue(dueAt);
    const pickedTime = dueAtToTimePickerValue(dueAt);
    expect(resolveDueAt(pickedDate, pickedTime)).toBe(dueAt);
  });
});

describe("dueAtRiyadhIsoDate", () => {
  it("buckets a due time into the Riyadh day it falls on, not the UTC one", () => {
    // 22:30 UTC is already 01:30 the next day in Riyadh.
    expect(dueAtRiyadhIsoDate("2026-07-11T22:30:00.000Z")).toBe("2026-07-12");
    expect(dueAtRiyadhIsoDate("2026-07-12T06:15:00.000Z")).toBe("2026-07-12");
  });
});

describe("matchesTaskDateFilter", () => {
  // Mid-month on purpose: "This Month" has to reach both backwards to the 1st
  // and forwards to the 31st from here.
  const TODAY = "2026-07-15";

  it("matches everything under All Time", () => {
    expect(matchesTaskDateFilter("2020-01-01", "all", TODAY)).toBe(true);
    expect(matchesTaskDateFilter("2099-12-31", "all", TODAY)).toBe(true);
  });

  it("matches only today under Today", () => {
    expect(matchesTaskDateFilter(TODAY, "today", TODAY)).toBe(true);
    expect(matchesTaskDateFilter("2026-07-16", "today", TODAY)).toBe(false);
    expect(matchesTaskDateFilter("2026-07-14", "today", TODAY)).toBe(false);
  });

  it("keeps This Week meaning exactly what it means on Reports — the last 7 days", () => {
    expect(matchesTaskDateFilter("2026-07-09", "week", TODAY)).toBe(true);
    expect(matchesTaskDateFilter("2026-07-08", "week", TODAY)).toBe(false);
  });

  describe("This Month", () => {
    it("covers the whole current calendar month, first day through last", () => {
      expect(matchesTaskDateFilter("2026-07-01", "month", TODAY)).toBe(true);
      expect(matchesTaskDateFilter("2026-07-31", "month", TODAY)).toBe(true);
    });

    it("reaches a task due weeks later in the same month — the point of the filter", () => {
      expect(matchesTaskDateFilter("2026-07-29", "month", TODAY)).toBe(true);
    });

    it("excludes the neighbouring months, however close the day is", () => {
      expect(matchesTaskDateFilter("2026-06-30", "month", TODAY)).toBe(false);
      expect(matchesTaskDateFilter("2026-08-01", "month", TODAY)).toBe(false);
    });

    it("is a calendar month rather than a rolling window, so it is not anchored to today", () => {
      // The same date matches from either end of the month.
      expect(matchesTaskDateFilter("2026-07-28", "month", "2026-07-01")).toBe(true);
      expect(matchesTaskDateFilter("2026-07-02", "month", "2026-07-31")).toBe(true);
    });

    it("does not confuse the same month in a different year", () => {
      expect(matchesTaskDateFilter("2025-07-15", "month", TODAY)).toBe(false);
    });

    it("handles a December today without spilling into the next January", () => {
      expect(matchesTaskDateFilter("2026-12-31", "month", "2026-12-05")).toBe(true);
      expect(matchesTaskDateFilter("2027-01-01", "month", "2026-12-05")).toBe(false);
    });
  });
});

describe("canDelayTask", () => {
  const ME = "user_me";
  const NOW = Date.parse("2026-09-20T08:00:00.000Z");
  const LATER = "2026-09-20T11:00:00.000Z";

  function delayable(
    overrides: Partial<Parameters<typeof canDelayTask>[0]> = {},
  ): Parameters<typeof canDelayTask>[0] {
    return {
      dueAt: LATER,
      completions: [],
      assignedEmployeeIds: [ME],
      delayedAt: null,
      ...overrides,
    };
  }

  it("is true for an assignee on an open, not-yet-due, never-delayed task", () => {
    expect(canDelayTask(delayable(), ME, NOW)).toBe(true);
  });

  it("is false for someone who is not assigned, whatever their role", () => {
    expect(canDelayTask(delayable(), "user_other", NOW)).toBe(false);
    expect(canDelayTask(delayable({ assignedEmployeeIds: [] }), ME, NOW)).toBe(false);
  });

  it("is false once anyone has completed it", () => {
    const task = delayable({ completions: [completion("user_other", "completed")] });
    expect(canDelayTask(task, ME, NOW)).toBe(false);
  });

  it("is false once it has already been delayed — one delay per task", () => {
    expect(canDelayTask(delayable({ delayedAt: "2026-09-19T08:00:00.000Z" }), ME, NOW)).toBe(
      false,
    );
  });

  it("is false once overdue", () => {
    expect(canDelayTask(delayable(), ME, Date.parse("2026-09-20T12:00:00.000Z"))).toBe(false);
  });

  it("treats a task due this exact instant as overdue, like the RPC's due_at <= now()", () => {
    expect(canDelayTask(delayable(), ME, Date.parse(LATER))).toBe(false);
    expect(canDelayTask(delayable(), ME, Date.parse(LATER) - 1)).toBe(true);
  });

  it("is false for an unparseable due time", () => {
    expect(canDelayTask(delayable({ dueAt: "not-a-date" }), ME, NOW)).toBe(false);
  });
});

describe("getDelayedDueAt", () => {
  // Riyadh is UTC+3. These five cases are the same ones the SQL patch's own
  // verification queries use, so the TypeScript mirror and `internal.delayed_due_at`
  // are held to identical answers.
  it.each([
    ["14:00 Riyadh → 23:59 the same day", "2026-09-20T11:00:00.000Z", "2026-09-20T20:59:00.000Z"],
    ["19:59 Riyadh → 23:59 the same day", "2026-09-20T16:59:00.000Z", "2026-09-20T20:59:00.000Z"],
    ["20:00 Riyadh → 10:00 the next day", "2026-09-20T17:00:00.000Z", "2026-09-21T07:00:00.000Z"],
    ["23:59 Riyadh → 10:00 the next day", "2026-09-20T20:59:00.000Z", "2026-09-21T07:00:00.000Z"],
    [
      "00:30 Riyadh on the 21st → 23:59 on the 21st",
      "2026-09-20T21:30:00.000Z",
      "2026-09-21T20:59:00.000Z",
    ],
  ])("%s", (_label, dueAt, expected) => {
    expect(getDelayedDueAt(dueAt)).toBe(expected);
  });

  it("treats 19:59:59 as still before the 20:00 cutoff, like SQL's time < '20:00'", () => {
    expect(getDelayedDueAt("2026-09-20T16:59:59.000Z")).toBe("2026-09-20T20:59:00.000Z");
  });

  it("rolls the 'next day' over a month end", () => {
    // 20:30 Riyadh on 30 Sep → 10:00 on 1 Oct.
    expect(getDelayedDueAt("2026-09-30T17:30:00.000Z")).toBe("2026-10-01T07:00:00.000Z");
  });

  it("rolls the 'next day' over a year end", () => {
    expect(getDelayedDueAt("2026-12-31T18:00:00.000Z")).toBe("2027-01-01T07:00:00.000Z");
  });

  it("always lands strictly after the current due time", () => {
    for (let hour = 0; hour < 24; hour += 1) {
      const dueAt = new Date(Date.UTC(2026, 8, 20, hour, 0, 0)).toISOString();
      const delayed = getDelayedDueAt(dueAt);
      expect(delayed).not.toBeNull();
      expect(Date.parse(delayed!)).toBeGreaterThan(Date.parse(dueAt));
    }
  });

  it("returns null for an unparseable timestamp", () => {
    expect(getDelayedDueAt("not-a-date")).toBeNull();
  });

  it("agrees with the app's own end of day, which is exactly 23:59:00.000 like the SQL", () => {
    // If `getEndOfDayRiyadhIso` ever grew seconds or milliseconds, the SQL's
    // flat 23:59:00 would silently disagree with it.
    expect(getEndOfDayRiyadhIso("2026-09-20")).toBe("2026-09-20T20:59:00.000Z");
    expect(getDelayedDueAt("2026-09-20T11:00:00.000Z")).toBe(getEndOfDayRiyadhIso("2026-09-20"));
  });
});

describe("formatDelayTargetLabel", () => {
  // Riyadh noon on 20 Sep 2026.
  const NOW = Date.parse("2026-09-20T09:00:00.000Z");

  it("says 'today' for 23:59 on Riyadh's current date", () => {
    expect(formatDelayTargetLabel("2026-09-20T20:59:00.000Z", NOW)).toBe("11:59 PM today");
  });

  it("says 'tomorrow' for 10:00 on the next Riyadh date", () => {
    expect(formatDelayTargetLabel("2026-09-21T07:00:00.000Z", NOW)).toBe("10:00 AM tomorrow");
  });

  it("names the date when the task is due further out than tomorrow", () => {
    // The date half is `formatReportDate`'s, whose month abbreviation depends
    // on the runtime's `en-GB` data ("Sep" vs "Sept") — so it is derived, not
    // hardcoded.
    expect(formatDelayTargetLabel("2026-09-25T20:59:00.000Z", NOW)).toBe(
      `11:59 PM on ${formatReportDate("2026-09-25")}`,
    );
  });

  it("measures 'today' by Riyadh's date, not UTC's", () => {
    // 00:30 Riyadh on the 21st is still the 20th in UTC.
    const justAfterRiyadhMidnight = Date.parse("2026-09-20T21:30:00.000Z");
    expect(formatDelayTargetLabel("2026-09-21T20:59:00.000Z", justAfterRiyadhMidnight)).toBe(
      "11:59 PM today",
    );
  });
});

describe("getDelayErrorMessage", () => {
  it.each([
    ["delay_task: not assigned", "You are not assigned to this task."],
    ["delay_task: already delayed", "This task has already been delayed once."],
    ["delay_task: already completed", "This task is already completed."],
    ["delay_task: already overdue", "This task is already overdue, so it can't be delayed."],
    ["delay_task: task not found", "This task no longer exists."],
    ["delay_task: not signed in", "You are signed out. Sign in and try again."],
  ])("maps %s to friendly text", (raw, expected) => {
    expect(getDelayErrorMessage(raw)).toBe(expected);
  });

  it("falls back to the generic message for anything unrecognised", () => {
    expect(getDelayErrorMessage("delay_task: something new")).toBe(DELAY_FALLBACK_MESSAGE);
    expect(getDelayErrorMessage("TypeError: Network request failed")).toBe(DELAY_FALLBACK_MESSAGE);
    expect(getDelayErrorMessage("not assigned")).toBe(DELAY_FALLBACK_MESSAGE);
    expect(getDelayErrorMessage(undefined)).toBe(DELAY_FALLBACK_MESSAGE);
    expect(getDelayErrorMessage("")).toBe(DELAY_FALLBACK_MESSAGE);
  });
});

describe("isMissedTask", () => {
  it("is false before the due time", () => {
    expect(isMissedTask({ dueAt: DUE, completions: [] }, BEFORE_DUE)).toBe(false);
  });

  it("is true past the due time while nobody has completed it", () => {
    expect(isMissedTask({ dueAt: DUE, completions: [] }, AFTER_DUE)).toBe(true);
  });

  it("is false once completed, however late", () => {
    const task = { dueAt: DUE, completions: [completion("user_1", "completed")] };
    expect(isMissedTask(task, AFTER_DUE)).toBe(false);
  });
});

describe("isMissedTaskHiddenForViewer", () => {
  const HOUR_MS = 60 * 60 * 1000;
  const DUE_MS = Date.parse(DUE);
  const A = "user_a";
  const B = "user_b";
  const ADMIN = "user_admin";

  function missable(
    overrides: Partial<Parameters<typeof isMissedTaskHiddenForViewer>[0]> = {},
  ): Parameters<typeof isMissedTaskHiddenForViewer>[0] {
    return { dueAt: DUE, completions: [], assignedEmployeeIds: [A, B], ...overrides };
  }

  it("never hides a task that is not yet due", () => {
    expect(MISSED_VISIBILITY_WINDOW_MS).toBe(48 * HOUR_MS);
    expect(isMissedTaskHiddenForViewer(missable(), A, BEFORE_DUE)).toBe(false);
    expect(isMissedTaskHiddenForViewer(missable(), ADMIN, BEFORE_DUE)).toBe(false);
  });

  it("never hides a completed task, even one far past 48 hours", () => {
    const task = missable({ completions: [completion(A, "completed")] });
    const farLater = DUE_MS + 30 * 24 * HOUR_MS;
    expect(isMissedTaskHiddenForViewer(task, A, farLater)).toBe(false);
    expect(isMissedTaskHiddenForViewer(task, ADMIN, farLater)).toBe(false);
  });

  it("keeps a missed task nobody has responded to visible inside the 48 hours", () => {
    const now = DUE_MS + 47 * HOUR_MS + 59 * 60 * 1000;
    expect(isMissedTaskHiddenForViewer(missable(), A, now)).toBe(false);
    expect(isMissedTaskHiddenForViewer(missable(), ADMIN, now)).toBe(false);
  });

  it("hides a missed task for everyone once it is past 48 hours", () => {
    const now = DUE_MS + 48 * HOUR_MS + 60 * 1000;
    expect(isMissedTaskHiddenForViewer(missable(), A, now)).toBe(true);
    expect(isMissedTaskHiddenForViewer(missable(), ADMIN, now)).toBe(true);
  });

  it("still shows it at exactly 48 hours — the cut-off is strictly greater", () => {
    const now = DUE_MS + 48 * HOUR_MS;
    expect(isMissedTaskHiddenForViewer(missable(), A, now)).toBe(false);
    expect(isMissedTaskHiddenForViewer(missable(), A, now + 1)).toBe(true);
  });

  it("hides it for an assignee as soon as they give a reason, but not for the other assignee", () => {
    const task = missable({ completions: [completion(A, "missed", "Short-staffed")] });
    expect(isMissedTaskHiddenForViewer(task, A, AFTER_DUE)).toBe(true);
    expect(isMissedTaskHiddenForViewer(task, B, AFTER_DUE)).toBe(false);
  });

  describe("for a viewer who is not assigned", () => {
    it("keeps it while no assignee has responded", () => {
      expect(isMissedTaskHiddenForViewer(missable(), ADMIN, AFTER_DUE)).toBe(false);
    });

    it("keeps it while only some assignees have responded", () => {
      const task = missable({ completions: [completion(A, "missed", "Short-staffed")] });
      expect(isMissedTaskHiddenForViewer(task, ADMIN, AFTER_DUE)).toBe(false);
    });

    it("hides it once every assignee has responded", () => {
      const task = missable({
        completions: [completion(A, "missed", "Short-staffed"), completion(B, "missed", "Sick")],
      });
      expect(isMissedTaskHiddenForViewer(task, ADMIN, AFTER_DUE)).toBe(true);
    });

    it("is not satisfied by a response from someone who is not an assignee", () => {
      const task = missable({ completions: [completion("user_stranger", "missed", "Hello")] });
      expect(isMissedTaskHiddenForViewer(task, ADMIN, AFTER_DUE)).toBe(false);
    });
  });

  describe("with no assignees", () => {
    it("is not hidden the instant it goes overdue — 'every assignee responded' is vacuous", () => {
      const task = missable({ assignedEmployeeIds: [] });
      expect(isMissedTaskHiddenForViewer(task, ADMIN, DUE_MS + 1)).toBe(false);
      expect(isMissedTaskHiddenForViewer(task, ADMIN, AFTER_DUE)).toBe(false);
    });

    it("still drops off once past 48 hours", () => {
      const task = missable({ assignedEmployeeIds: [] });
      expect(isMissedTaskHiddenForViewer(task, ADMIN, DUE_MS + 48 * HOUR_MS + 1)).toBe(true);
    });
  });

  it("measures 48 hours from the delayed due time, not the original one", () => {
    // Due 2026-01-01 at 10:00 Riyadh, delayed (before it went overdue) to the
    // end of that day; the 48 hours run from the new, later `dueAt`.
    const task = missable({ dueAt: "2026-01-01T20:59:00.000Z" });
    const newDueMs = Date.parse(task.dueAt);
    expect(isMissedTaskHiddenForViewer(task, A, newDueMs + 47 * HOUR_MS)).toBe(false);
    expect(isMissedTaskHiddenForViewer(task, A, newDueMs + 49 * HOUR_MS)).toBe(true);
  });
});
