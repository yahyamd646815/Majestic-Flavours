/// <reference types="jest" />

import {
  MAX_REMINDER_OFFSET_VALUE,
  MAX_REMINDERS_PER_TASK,
  buildReminderSchedules,
  formatReminderOffset,
  hasReminderAtOffset,
  isTaskReminderIdentifier,
  parseReminderOffsetValue,
  reminderOffsetMs,
  reminderTriggerMs,
  remindersForTask,
  taskReminderIdentifier,
} from "@/lib/taskReminders";
import type { Task, TaskCompletion, TaskReminder } from "@/types/tasks";

const HOUR_MS = 60 * 60 * 1000;
const DAY_MS = 24 * HOUR_MS;

const DUE = "2026-07-12T12:00:00.000Z";
const DUE_MS = Date.parse(DUE);

const ME = "user_me";
const SOMEONE_ELSE = "user_other";

function task(overrides: Partial<Task> = {}): Task {
  return {
    id: "task-1",
    categoryId: "prep",
    title: "Deep clean the fryer",
    description: null,
    dueAt: DUE,
    createdBy: "user_admin",
    createdAt: "2026-07-01T00:00:00.000Z",
    generatedFromRecurrenceRuleId: null,
    assignedEmployeeIds: [ME],
    completions: [],
    ...overrides,
  };
}

function reminder(overrides: Partial<TaskReminder> = {}): TaskReminder {
  return {
    id: "reminder-1",
    taskId: "task-1",
    employeeClerkId: ME,
    offsetValue: 2,
    offsetUnit: "hours",
    createdAt: "2026-07-01T00:00:00.000Z",
    ...overrides,
  };
}

function completion(employeeClerkId: string, status: TaskCompletion["status"]): TaskCompletion {
  return { employeeClerkId, status, note: null, recordedAt: "2026-07-11T00:00:00.000Z" };
}

describe("taskReminderIdentifier", () => {
  it("is derived only from the reminder's id, so it is the same every session", () => {
    expect(taskReminderIdentifier("reminder-1")).toBe(taskReminderIdentifier("reminder-1"));
  });

  it("differs per reminder, so several on one task cannot overwrite each other", () => {
    expect(taskReminderIdentifier("reminder-1")).not.toBe(taskReminderIdentifier("reminder-2"));
  });

  it("is recognisable as this feature's own, and other identifiers are not", () => {
    expect(isTaskReminderIdentifier(taskReminderIdentifier("reminder-1"))).toBe(true);
    expect(isTaskReminderIdentifier("some-other-notification")).toBe(false);
  });
});

describe("remindersForTask", () => {
  const mine = [
    reminder({ id: "r-hours", offsetValue: 3, offsetUnit: "hours" }),
    reminder({ id: "r-days", offsetValue: 1, offsetUnit: "days" }),
    reminder({ id: "r-short", offsetValue: 1, offsetUnit: "hours" }),
  ];

  it("returns the longest lead time first, whatever order they were added in", () => {
    expect(remindersForTask(mine, "task-1", ME).map((r) => r.id)).toEqual([
      "r-days",
      "r-hours",
      "r-short",
    ]);
  });

  it("keeps every reminder on the task, up to the limit", () => {
    expect(remindersForTask(mine, "task-1", ME)).toHaveLength(MAX_REMINDERS_PER_TASK);
  });

  it("excludes other tasks and other people", () => {
    const mixed = [
      reminder({ id: "r-1" }),
      reminder({ id: "r-2", taskId: "task-2" }),
      reminder({ id: "r-3", employeeClerkId: SOMEONE_ELSE }),
    ];
    expect(remindersForTask(mixed, "task-1", ME).map((r) => r.id)).toEqual(["r-1"]);
  });

  it("does not reorder the array it was given", () => {
    const original = [...mine];
    remindersForTask(mine, "task-1", ME);
    expect(mine).toEqual(original);
  });

  it("is empty when none have been set", () => {
    expect(remindersForTask([], "task-1", ME)).toEqual([]);
  });
});

describe("hasReminderAtOffset", () => {
  const existing = [reminder({ id: "r-1", offsetValue: 2, offsetUnit: "hours" })];

  it("recognises the same offset", () => {
    expect(hasReminderAtOffset(existing, 2, "hours")).toBe(true);
  });

  it("recognises the same instant expressed in the other unit", () => {
    expect(hasReminderAtOffset([reminder({ offsetValue: 1, offsetUnit: "days" })], 24, "hours")).toBe(
      true,
    );
  });

  it("allows a different lead time", () => {
    expect(hasReminderAtOffset(existing, 3, "hours")).toBe(false);
    expect(hasReminderAtOffset(existing, 2, "days")).toBe(false);
  });

  it("allows anything at all when none are set", () => {
    expect(hasReminderAtOffset([], 2, "hours")).toBe(false);
  });
});

describe("reminderOffsetMs", () => {
  it("counts hours", () => {
    expect(reminderOffsetMs(3, "hours")).toBe(3 * HOUR_MS);
  });

  it("counts days", () => {
    expect(reminderOffsetMs(3, "days")).toBe(3 * DAY_MS);
  });
});

describe("reminderTriggerMs", () => {
  it("fires the offset ahead of the due time", () => {
    expect(reminderTriggerMs(DUE, 2, "hours")).toBe(DUE_MS - 2 * HOUR_MS);
    expect(reminderTriggerMs(DUE, 2, "days")).toBe(DUE_MS - 2 * DAY_MS);
  });

  it("is null for a due time that cannot be parsed, rather than NaN", () => {
    expect(reminderTriggerMs("not a timestamp", 2, "hours")).toBeNull();
  });
});

describe("formatReminderOffset", () => {
  it("singularises one", () => {
    expect(formatReminderOffset(1, "hours")).toBe("1 hour");
    expect(formatReminderOffset(1, "days")).toBe("1 day");
  });

  it("pluralises everything else", () => {
    expect(formatReminderOffset(2, "hours")).toBe("2 hours");
    expect(formatReminderOffset(30, "days")).toBe("30 days");
  });
});

describe("parseReminderOffsetValue", () => {
  it("accepts a whole number in range, ignoring surrounding space", () => {
    expect(parseReminderOffsetValue("1")).toBe(1);
    expect(parseReminderOffsetValue(" 12 ")).toBe(12);
    expect(parseReminderOffsetValue(String(MAX_REMINDER_OFFSET_VALUE))).toBe(
      MAX_REMINDER_OFFSET_VALUE,
    );
  });

  it("rejects zero, matching the offset_value > 0 constraint", () => {
    expect(parseReminderOffsetValue("0")).toBeNull();
  });

  it("rejects an empty or half-typed field", () => {
    expect(parseReminderOffsetValue("")).toBeNull();
    expect(parseReminderOffsetValue("   ")).toBeNull();
  });

  it("rejects anything that is not a plain positive integer", () => {
    expect(parseReminderOffsetValue("1.5")).toBeNull();
    expect(parseReminderOffsetValue("-2")).toBeNull();
    expect(parseReminderOffsetValue("2h")).toBeNull();
    expect(parseReminderOffsetValue("1000")).toBeNull();
  });
});

describe("buildReminderSchedules", () => {
  // Well before the trigger instant, so everything below is scheduled unless
  // the case under test is what stops it.
  const NOW = Date.parse("2026-07-01T00:00:00.000Z");

  it("schedules a reminder at the due time minus its offset", () => {
    const schedules = buildReminderSchedules([reminder()], [task()], ME, NOW);

    expect(schedules).toHaveLength(1);
    expect(schedules[0].identifier).toBe(taskReminderIdentifier("reminder-1"));
    expect(schedules[0].taskId).toBe("task-1");
    expect(schedules[0].title).toBe("Deep clean the fryer");
    expect(schedules[0].triggerMs).toBe(DUE_MS - 2 * HOUR_MS);
    expect(schedules[0].body).toContain("Due in 2 hours");
  });

  it("drops a reminder whose task is not present at all", () => {
    expect(buildReminderSchedules([reminder({ taskId: "task-gone" })], [task()], ME, NOW)).toEqual(
      [],
    );
  });

  it("drops a reminder on a task this person is no longer assigned to", () => {
    const unassigned = task({ assignedEmployeeIds: [SOMEONE_ELSE] });
    expect(buildReminderSchedules([reminder()], [unassigned], ME, NOW)).toEqual([]);
  });

  it("drops a reminder on a task somebody has already completed", () => {
    const closed = task({ completions: [completion(SOMEONE_ELSE, "completed")] });
    expect(buildReminderSchedules([reminder()], [closed], ME, NOW)).toEqual([]);
  });

  it("still schedules when this person has only submitted a miss reason", () => {
    // A miss closes nothing — the task stays open for everyone else, so the
    // reminder is still about something real.
    const missed = task({ completions: [completion(ME, "missed")] });
    expect(buildReminderSchedules([reminder()], [missed], ME, NOW)).toHaveLength(1);
  });

  it("drops a trigger instant that has already passed", () => {
    const justAfterTrigger = DUE_MS - 2 * HOUR_MS + 1;
    expect(buildReminderSchedules([reminder()], [task()], ME, justAfterTrigger)).toEqual([]);
  });

  it("drops a trigger instant landing exactly on now, rather than firing immediately", () => {
    const exactlyAtTrigger = DUE_MS - 2 * HOUR_MS;
    expect(buildReminderSchedules([reminder()], [task()], ME, exactlyAtTrigger)).toEqual([]);
  });

  it("drops a reminder whose lead time reaches back past now after a due date edit", () => {
    // The due date was moved to an hour from now, but the reminder asks for
    // two days of warning — there is no longer a moment to fire at.
    const soon = task({ dueAt: new Date(NOW + HOUR_MS).toISOString() });
    expect(
      buildReminderSchedules([reminder({ offsetValue: 2, offsetUnit: "days" })], [soon], ME, NOW),
    ).toEqual([]);
  });

  it("reschedules against the new due time when one is edited later", () => {
    const moved = task({ dueAt: "2026-08-20T09:00:00.000Z" });
    const [schedule] = buildReminderSchedules([reminder()], [moved], ME, NOW);
    expect(schedule.triggerMs).toBe(Date.parse("2026-08-20T09:00:00.000Z") - 2 * HOUR_MS);
  });

  it("drops a reminder belonging to somebody else", () => {
    const theirs = reminder({ employeeClerkId: SOMEONE_ELSE });
    const shared = task({ assignedEmployeeIds: [ME, SOMEONE_ELSE] });
    expect(buildReminderSchedules([theirs], [shared], ME, NOW)).toEqual([]);
  });

  it("handles several reminders across several tasks at once", () => {
    const reminders = [
      reminder({ id: "r-1", taskId: "task-1", offsetValue: 1, offsetUnit: "hours" }),
      reminder({ id: "r-2", taskId: "task-2", offsetValue: 1, offsetUnit: "days" }),
      reminder({ id: "r-3", taskId: "task-gone" }),
    ];
    const tasks = [task({ id: "task-1" }), task({ id: "task-2" })];

    const schedules = buildReminderSchedules(reminders, tasks, ME, NOW);
    expect(schedules.map((schedule) => schedule.taskId)).toEqual(["task-1", "task-2"]);
    expect(schedules[0].triggerMs).toBe(DUE_MS - HOUR_MS);
    expect(schedules[1].triggerMs).toBe(DUE_MS - DAY_MS);
  });

  it("gives each one its own identifier, so scheduling them cannot collide", () => {
    const reminders = [
      reminder({ id: "r-1", taskId: "task-1" }),
      reminder({ id: "r-2", taskId: "task-2" }),
    ];
    const tasks = [task({ id: "task-1" }), task({ id: "task-2" })];

    const identifiers = buildReminderSchedules(reminders, tasks, ME, NOW).map(
      (schedule) => schedule.identifier,
    );
    expect(new Set(identifiers).size).toBe(2);
  });

  it("schedules all three reminders on one task independently, at their own times", () => {
    const reminders = [
      reminder({ id: "r-day", offsetValue: 1, offsetUnit: "days" }),
      reminder({ id: "r-3h", offsetValue: 3, offsetUnit: "hours" }),
      reminder({ id: "r-1h", offsetValue: 1, offsetUnit: "hours" }),
    ];

    const schedules = buildReminderSchedules(reminders, [task()], ME, NOW);
    expect(schedules.map((schedule) => schedule.triggerMs)).toEqual([
      DUE_MS - DAY_MS,
      DUE_MS - 3 * HOUR_MS,
      DUE_MS - HOUR_MS,
    ]);
    // Distinct identifiers on the same task is the whole point of keying on
    // the reminder's own id: under the old task+person key these three would
    // have replaced each other down to one scheduled notification.
    expect(new Set(schedules.map((schedule) => schedule.identifier)).size).toBe(
      MAX_REMINDERS_PER_TASK,
    );
  });

  it("drops only the reminders on one task whose lead time has passed, keeping the rest", () => {
    // Two hours before due, with the task due in three: the day-ahead reminder
    // is long gone, the one-hour-ahead one has not come round yet.
    const now = DUE_MS - 3 * HOUR_MS;
    const reminders = [
      reminder({ id: "r-day", offsetValue: 1, offsetUnit: "days" }),
      reminder({ id: "r-1h", offsetValue: 1, offsetUnit: "hours" }),
    ];

    const schedules = buildReminderSchedules(reminders, [task()], ME, now);
    expect(schedules).toHaveLength(1);
    expect(schedules[0].identifier).toBe(taskReminderIdentifier("r-1h"));
  });
});
