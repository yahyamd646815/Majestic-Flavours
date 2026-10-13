import type { SupabaseClient } from "@supabase/supabase-js";
import { create } from "zustand";

import { generateId } from "@/lib/id";
import {
  cancelReminderNotification,
  cancelStaleReminderNotifications,
  hasNotificationPermission,
  scheduleReminderNotification,
} from "@/lib/notifications";
import {
  MAX_REMINDERS_PER_TASK,
  buildReminderSchedules,
  remindersForTask,
  taskReminderIdentifier,
} from "@/lib/taskReminders";
import type { ReminderOffsetUnit, Task, TaskReminder } from "@/types/tasks";

function mapDbReminderToReminder(row: Record<string, unknown>): TaskReminder {
  return {
    id: row.id as string,
    taskId: row.task_id as string,
    employeeClerkId: row.employee_clerk_id as string,
    offsetValue: row.offset_value as number,
    offsetUnit: row.offset_unit as ReminderOffsetUnit,
    createdAt: row.created_at as string,
  };
}

/**
 * What happened when somebody tried to add a reminder. A union rather than a
 * pair of booleans because the three failures need three different things
 * said to the person: only `"failed"` is worth suggesting they check their
 * connection over.
 */
export type AddReminderResult =
  | { outcome: "saved"; wasScheduled: boolean }
  | { outcome: "limit-reached" }
  | { outcome: "failed" };

/**
 * The signed-in person's own task reminders, plus every side effect on the
 * device's scheduled notifications.
 *
 * Two layers with different lifetimes, deliberately kept together so nothing
 * can change one without the other:
 * - the *preference* (`task_reminders` rows) is the source of truth, lives in
 *   Supabase, and survives restarts and reinstalls;
 * - the OS-level scheduled notification is device-local and ephemeral, and is
 *   re-derived from those rows on every session start (`useTaskReminderSync`)
 *   rather than assumed to still exist.
 *
 * Each reminder is its own row with its own id, and one person may hold up to
 * `MAX_REMINDERS_PER_TASK` of them on a single task — so every operation here
 * works on a *set* of reminders for a task, never on "the" reminder.
 *
 * Everything cached here is the current user's own: `task_reminders`' RLS
 * scopes select, insert, update and delete to
 * `employee_clerk_id = current_clerk_user_id()`, so this store never holds
 * anyone else's row and no filter is needed on the query.
 *
 * Same in-memory contract as every other store — not persisted, re-seeded
 * once per signed-in session by `useSupabaseSync`.
 */
type TaskReminderState = {
  reminders: TaskReminder[];
  isLoading: boolean;
  error: string | null;
  fetchAll: (supabase: SupabaseClient) => Promise<void>;
  /** This person's reminders on this task, longest lead time first. Empty when
   * they have not set any. */
  getReminders: (taskId: string, employeeClerkId: string) => TaskReminder[];
  /**
   * Saves one more reminder and schedules it straight away, so a reminder set
   * on a task due in a few minutes fires in this same session rather than
   * waiting for the next reconciliation pass.
   *
   * Adds — it never replaces. An existing reminder on the same task is left
   * exactly as it is, scheduled notification included.
   *
   * `"saved"` carries `wasScheduled` separately because scheduling can
   * legitimately do nothing on top of a saved preference — the permission was
   * refused, or the trigger instant has already passed.
   */
  addReminder: (
    supabase: SupabaseClient,
    task: Task,
    employeeClerkId: string,
    offsetValue: number,
    offsetUnit: ReminderOffsetUnit,
  ) => Promise<AddReminderResult>;
  /** Deletes one reminder by its own id and cancels only its notification —
   * the other reminders on the same task keep theirs. Succeeds trivially when
   * the id is not cached, so a double tap cannot fail. */
  deleteReminder: (supabase: SupabaseClient, reminderId: string) => Promise<boolean>;
  /** Deletes *every* reminder this person holds on one task, cancelling each
   * notification. Called from the assignment-removal path, where the task has
   * stopped being theirs entirely — safe to call unconditionally, including
   * when they had none. */
  deleteRemindersForTask: (
    supabase: SupabaseClient,
    taskId: string,
    employeeClerkId: string,
  ) => Promise<boolean>;
  /** A task row is gone, so its `task_reminders` rows went with it via the
   * `on delete cascade` — only the local notifications and cache entries are
   * left to clear. Called from `taskStore`'s `deleteTask`. */
  forgetTask: (taskId: string) => Promise<void>;
  /**
   * Re-derives every reminder this person holds on one task against the task
   * as it now stands — used when its due date is edited, which moves every
   * trigger instant at once. Cancels rather than reschedules the individual
   * reminders that no longer apply (see `buildReminderSchedules`), which with
   * several lead times on one task is a genuinely per-reminder decision: a
   * due date pulled forward can put "1 day before" in the past while "3 hours
   * before" is still ahead.
   *
   * Takes no Clerk id: every row cached here is the signed-in person's own,
   * so a cached reminder on this task IS theirs. That is what lets
   * `taskStore` call this without knowing who is signed in.
   */
  rescheduleForTask: (task: Task) => Promise<void>;
  /**
   * Re-derives every scheduled reminder from scratch, once per session.
   * Schedules what should be pending, cancels what should not, and returns
   * how many are now scheduled.
   *
   * Callers must not run this against a failed or half-finished load: an
   * empty `tasks` list is indistinguishable here from "every task was
   * deleted", and would cancel every real reminder on the device. See the
   * guards in `useTaskReminderSync`.
   */
  reconcile: (tasks: Task[], employeeClerkId: string, nowMs: number) => Promise<number>;
};

export const useTaskReminderStore = create<TaskReminderState>()((set, get) => ({
  reminders: [],
  isLoading: true,
  error: null,

  fetchAll: async (supabase) => {
    set({ isLoading: true, error: null });
    const { data, error } = await supabase.from("task_reminders").select("*");

    if (error) {
      set({
        isLoading: false,
        error: "Could not load reminders. Check your connection and try again.",
      });
      return;
    }

    set({
      reminders: ((data ?? []) as Record<string, unknown>[]).map(mapDbReminderToReminder),
      isLoading: false,
      error: null,
    });
  },

  getReminders: (taskId, employeeClerkId) =>
    remindersForTask(get().reminders, taskId, employeeClerkId),

  addReminder: async (supabase, task, employeeClerkId, offsetValue, offsetUnit) => {
    // The limit lives in the UI, which stops offering "add another" at three.
    // Repeated here so the rule holds even if some future caller forgets it —
    // there is no database constraint standing behind it.
    if (get().getReminders(task.id, employeeClerkId).length >= MAX_REMINDERS_PER_TASK) {
      return { outcome: "limit-reached" };
    }

    const { data, error } = await supabase
      .from("task_reminders")
      .insert({
        // Generated here because the column is `text primary key` with no
        // default — same as every other entity id in this app.
        id: generateId("reminder"),
        task_id: task.id,
        employee_clerk_id: employeeClerkId,
        offset_value: offsetValue,
        offset_unit: offsetUnit,
      })
      .select()
      .single();

    if (error || !data) {
      console.warn(
        `[taskReminderStore] Could not save a reminder on task ${task.id}:`,
        error,
      );
      return { outcome: "failed" };
    }

    const reminder = mapDbReminderToReminder(data);
    set((state) => ({ reminders: [...state.reminders, reminder] }));

    // The same derivation reconciliation uses, on a list of one — so a
    // reminder set now and the same reminder re-derived next session can
    // never disagree about when it fires.
    const [schedule] = buildReminderSchedules(
      [reminder],
      [task],
      employeeClerkId,
      Date.now(),
    );
    if (schedule === undefined) return { outcome: "saved", wasScheduled: false };

    const wasScheduled = await scheduleReminderNotification(schedule);
    return { outcome: "saved", wasScheduled };
  },

  deleteReminder: async (supabase, reminderId) => {
    if (!get().reminders.some((reminder) => reminder.id === reminderId)) return true;

    const { error } = await supabase.from("task_reminders").delete().eq("id", reminderId);

    if (error) {
      console.warn(`[taskReminderStore] Could not delete reminder ${reminderId}:`, error);
      return false;
    }

    set((state) => ({
      reminders: state.reminders.filter((reminder) => reminder.id !== reminderId),
    }));
    await cancelReminderNotification(taskReminderIdentifier(reminderId));
    return true;
  },

  deleteRemindersForTask: async (supabase, taskId, employeeClerkId) => {
    const doomed = get().getReminders(taskId, employeeClerkId);
    if (doomed.length === 0) return true;

    const { error } = await supabase
      .from("task_reminders")
      .delete()
      .eq("task_id", taskId)
      .eq("employee_clerk_id", employeeClerkId);

    if (error) {
      console.warn(
        `[taskReminderStore] Could not delete the reminders on task ${taskId}:`,
        error,
      );
      return false;
    }

    const doomedIds = new Set(doomed.map((reminder) => reminder.id));
    set((state) => ({
      reminders: state.reminders.filter((reminder) => !doomedIds.has(reminder.id)),
    }));
    for (const reminder of doomed) {
      await cancelReminderNotification(taskReminderIdentifier(reminder.id));
    }
    return true;
  },

  forgetTask: async (taskId) => {
    const doomed = get().reminders.filter((reminder) => reminder.taskId === taskId);
    if (doomed.length === 0) return;

    set((state) => ({
      reminders: state.reminders.filter((reminder) => reminder.taskId !== taskId),
    }));
    for (const reminder of doomed) {
      await cancelReminderNotification(taskReminderIdentifier(reminder.id));
    }
  },

  rescheduleForTask: async (task) => {
    const mine = get().reminders.filter((existing) => existing.taskId === task.id);

    for (const reminder of mine) {
      const [schedule] = buildReminderSchedules(
        [reminder],
        [task],
        reminder.employeeClerkId,
        Date.now(),
      );
      // No schedule means this particular reminder stopped applying — the new
      // due date is already inside its lead time, or the task closed.
      // Cancelling is the correct outcome, not a failure, and it says nothing
      // about the task's other reminders.
      if (schedule === undefined) {
        await cancelReminderNotification(taskReminderIdentifier(reminder.id));
        continue;
      }
      await scheduleReminderNotification(schedule);
    }
  },

  reconcile: async (tasks, employeeClerkId, nowMs) => {
    // Every reminder row is judged individually and carries its own
    // identifier, so three reminders on one task come back as three schedules
    // here and end the session as three pending notifications.
    const schedules = buildReminderSchedules(
      get().reminders,
      tasks,
      employeeClerkId,
      nowMs,
    );

    // Nothing can be scheduled without permission, and asking for it here
    // would put a dialog in front of someone who only opened the app. It is
    // requested when a reminder is actually set instead.
    if (!(await hasNotificationPermission())) {
      if (schedules.length > 0) {
        console.warn(
          `[taskReminderStore] ${schedules.length} reminder(s) cannot be scheduled — notifications are not permitted on this device.`,
        );
      }
      return 0;
    }

    await cancelStaleReminderNotifications(
      new Set(schedules.map((schedule) => schedule.identifier)),
    );
    for (const schedule of schedules) {
      await scheduleReminderNotification(schedule);
    }
    return schedules.length;
  },
}));
