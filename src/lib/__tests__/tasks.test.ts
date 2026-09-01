/// <reference types="jest" />

import { getTodayIsoDate } from "@/lib/reports";
import {
  dueAtRiyadhIsoDate,
  dueAtToDatePickerValue,
  dueAtToTimePickerValue,
  hasEmployeeResponded,
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
