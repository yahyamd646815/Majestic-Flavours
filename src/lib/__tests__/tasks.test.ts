/// <reference types="jest" />

import { getTodayIsoDate } from "@/lib/reports";
import {
  dueAtToPickerDate,
  hasEmployeeResponded,
  isTaskFullyCompleted,
  isTaskOverdueForEmployee,
  isTaskPastDue,
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

describe("resolveDueAt", () => {
  it("resolves to end of today (Riyadh) when neither date nor time is picked", () => {
    // Riyadh 23:59 == UTC 20:59 the same calendar day.
    expect(resolveDueAt(null, null)).toBe(`${getTodayIsoDate()}T20:59:00.000Z`);
  });

  it("keeps a picked date's end-of-day when no time is picked", () => {
    const pickedDate = new Date(2026, 6, 12); // 12 Jul 2026, local wall-clock
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
    const pickedDate = new Date(2026, 6, 12);
    const pickedTime = new Date(2000, 0, 1, 9, 15);
    expect(resolveDueAt(pickedDate, pickedTime)).toBe("2026-07-12T06:15:00.000Z");
  });
});

describe("dueAtToPickerDate", () => {
  // These assert the Riyadh wall-clock digits directly rather than just
  // round-tripping, because the test process is pinned to Asia/Riyadh (see
  // jest.globalSetup.js) — under that TZ a naive `new Date(dueAt)` would
  // round-trip too, so a round-trip alone would not prove anything.
  it("exposes the Riyadh wall-clock digits of the stored instant", () => {
    const picker = dueAtToPickerDate("2026-07-12T06:15:00.000Z");
    expect(picker).not.toBeNull();
    expect(picker!.getFullYear()).toBe(2026);
    expect(picker!.getMonth()).toBe(6); // July, 0-indexed
    expect(picker!.getDate()).toBe(12);
    expect(picker!.getHours()).toBe(9); // 06:15 UTC == 09:15 Riyadh
    expect(picker!.getMinutes()).toBe(15);
  });

  it("rolls back to the previous Riyadh day for a late-UTC instant", () => {
    // 22:30 UTC on 11 Jul is already 01:30 on 12 Jul in Riyadh.
    const picker = dueAtToPickerDate("2026-07-11T22:30:00.000Z");
    expect(picker!.getDate()).toBe(12);
    expect(picker!.getHours()).toBe(1);
  });

  it("round-trips an end-of-day due date back through resolveDueAt unchanged", () => {
    const dueAt = "2026-07-12T20:59:00.000Z";
    const picker = dueAtToPickerDate(dueAt);
    expect(resolveDueAt(picker, picker)).toBe(dueAt);
  });

  it("returns null for an unparseable timestamp", () => {
    expect(dueAtToPickerDate("not-a-date")).toBeNull();
  });
});
