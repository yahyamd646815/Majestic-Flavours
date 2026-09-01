import type { SupabaseClient } from "@supabase/supabase-js";
import { create } from "zustand";

import { generateId, slugify } from "@/lib/id";
import { hasEmployeeResponded } from "@/lib/tasks";
import { useTaskReminderStore } from "@/store/taskReminderStore";
import { useTaskRecurrenceStore } from "@/store/taskRecurrenceStore";
import type { Task, TaskCategory, TaskCompletionStatus } from "@/types/tasks";

/**
 * Both embeds are plain one-to-many arrays. `task_completions` was keyed on
 * `task_id` alone in round 1, which made it a genuine one-to-one embed;
 * round 2 re-keyed it on `(task_id, employee_clerk_id)`, so PostgREST now
 * returns one row per person who has responded — no single-object shape to
 * defend against any more.
 */
function mapDbTaskToTask(row: Record<string, unknown>): Task {
  const assignmentRows = (row.task_assignments as Record<string, unknown>[] | null) ?? [];
  const completionRows = (row.task_completions as Record<string, unknown>[] | null) ?? [];

  return {
    id: row.id as string,
    categoryId: row.category_id as string,
    title: row.title as string,
    description: (row.description as string | null) ?? null,
    dueAt: row.due_at as string,
    createdBy: row.created_by as string,
    createdAt: row.created_at as string,
    generatedFromRecurrenceRuleId:
      (row.generated_from_recurrence_rule_id as string | null) ?? null,
    assignedEmployeeIds: assignmentRows.map((a) => a.employee_clerk_id as string),
    completions: completionRows.map((c) => ({
      employeeClerkId: c.employee_clerk_id as string,
      status: c.status as TaskCompletionStatus,
      note: (c.note as string | null) ?? null,
      recordedAt: c.recorded_at as string,
    })),
  };
}

const TASK_SELECT = "*, task_assignments(employee_clerk_id), task_completions(*)";

export type NewTaskValues = {
  title: string;
  categoryId: string;
  description: string | null;
  dueAt: string;
  assignedEmployeeIds: string[];
  createdBy: string;
};

/**
 * An in-memory cache of whatever Supabase last returned, same contract as
 * `inventoryStore` — not persisted, re-seeded once per signed-in session by
 * `useSupabaseSync`.
 */
type TaskState = {
  taskCategories: TaskCategory[];
  tasks: Task[];
  isLoading: boolean;
  error: string | null;
  /** Empty set means the filter dimension is inactive — matches every task,
   * not none. Same contract as `inventoryStore`'s `selectedCategoryIds`. */
  selectedCategoryIds: Set<string>;
  toggleCategoryId: (categoryId: string) => void;
  clearCategoryIds: () => void;
  /** Same empty-set-means-inactive contract, and may also contain
   * `UNASSIGNED_EMPLOYEE_FILTER` — see `matchesEmployeeFilter` in
   * `@/lib/inventoryFilters`, reused here unmodified. */
  selectedEmployeeIds: Set<string>;
  toggleEmployeeId: (employeeId: string) => void;
  clearEmployeeIds: () => void;
  fetchAll: (supabase: SupabaseClient) => Promise<void>;
  addCategory: (supabase: SupabaseClient, name: string) => Promise<boolean>;
  isCategoryInUse: (categoryId: string) => boolean;
  deleteCategory: (supabase: SupabaseClient, id: string) => Promise<boolean>;
  /** Requires at least one assignee — enforced here as the last line of
   * defense, though `TaskFormModal` already blocks submission before this is
   * ever called with zero (AGENTS.md: app-level, not a DB constraint). */
  addTask: (supabase: SupabaseClient, values: NewTaskValues) => Promise<boolean>;
  /** Scalar columns only. Assignment changes never travel through here — they
   * go one at a time through `addAssignment`/`removeAssignment`, so an edit
   * can't clobber a chip someone removed from `TaskCard` in the meantime.
   *
   * A changed `dueAt` also moves every reminder this device holds on the task,
   * since a reminder is "N hours before due" rather than a fixed instant. */
  updateTask: (
    supabase: SupabaseClient,
    id: string,
    updates: Partial<Pick<Task, "title" | "categoryId" | "description" | "dueAt">>,
  ) => Promise<boolean>;
  addAssignment: (
    supabase: SupabaseClient,
    taskId: string,
    employeeClerkId: string,
  ) => Promise<boolean>;
  removeAssignment: (
    supabase: SupabaseClient,
    taskId: string,
    employeeClerkId: string,
  ) => Promise<boolean>;
  /** Records the CALLING user's own response, and only on a task they are
   * genuinely assigned to — Admin and Manager included. Mirrors round 2's
   * `task_completions_insert_own` policy client-side so a disallowed attempt
   * fails immediately instead of round-tripping to Supabase first. */
  completeTask: (
    supabase: SupabaseClient,
    taskId: string,
    employeeClerkId: string,
    status: TaskCompletionStatus,
    note: string,
  ) => Promise<boolean>;
  /**
   * Who may actually delete is enforced by `tasks_delete_permission` in SQL
   * (admin: any task; manager: only their own) — this just fires the delete
   * and trusts RLS to reject anything it shouldn't allow. The UI decides
   * separately whether to even offer the option (see `tasks.tsx`).
   *
   * Deleting a generated occurrence also cancels the recurring rule behind
   * it, so the series stops for good. No extra permission check is needed for
   * that step: an occurrence's `createdBy` is copied from its rule's, so
   * anyone `tasks_delete_permission` lets delete the occurrence is someone
   * `task_recurrence_rules_delete_staff` lets delete the rule.
   */
  deleteTask: (supabase: SupabaseClient, id: string) => Promise<boolean>;
};

export const useTaskStore = create<TaskState>()((set, get) => ({
  taskCategories: [],
  tasks: [],
  isLoading: true,
  error: null,
  selectedCategoryIds: new Set(),
  toggleCategoryId: (categoryId) =>
    set((state) => {
      const next = new Set(state.selectedCategoryIds);
      if (next.has(categoryId)) next.delete(categoryId);
      else next.add(categoryId);
      return { selectedCategoryIds: next };
    }),
  clearCategoryIds: () => set({ selectedCategoryIds: new Set() }),
  selectedEmployeeIds: new Set(),
  toggleEmployeeId: (employeeId) =>
    set((state) => {
      const next = new Set(state.selectedEmployeeIds);
      if (next.has(employeeId)) next.delete(employeeId);
      else next.add(employeeId);
      return { selectedEmployeeIds: next };
    }),
  clearEmployeeIds: () => set({ selectedEmployeeIds: new Set() }),

  fetchAll: async (supabase) => {
    set({ isLoading: true, error: null });
    const [categoriesResult, tasksResult] = await Promise.all([
      supabase.from("task_categories").select("*"),
      supabase.from("tasks").select(TASK_SELECT),
    ]);

    if (categoriesResult.error || tasksResult.error) {
      set({
        isLoading: false,
        error: "Could not load tasks. Check your connection and try again.",
      });
      return;
    }

    set({
      taskCategories: (categoriesResult.data ?? []) as TaskCategory[],
      tasks: ((tasksResult.data ?? []) as Record<string, unknown>[]).map(mapDbTaskToTask),
      isLoading: false,
      error: null,
    });
  },

  addCategory: async (supabase, name) => {
    const trimmedName = name.trim();
    if (trimmedName.length === 0) return false;

    const isDuplicate = get().taskCategories.some(
      (category) => category.name.toLowerCase() === trimmedName.toLowerCase(),
    );
    if (isDuplicate) return false;

    const slug = slugify(trimmedName);
    const idTaken = get().taskCategories.some((category) => category.id === slug);
    const id = slug.length === 0 || idTaken ? generateId("task-category") : slug;

    const { data, error } = await supabase
      .from("task_categories")
      .insert({ id, name: trimmedName })
      .select()
      .single();

    if (error || !data) return false;
    set((state) => ({ taskCategories: [...state.taskCategories, data as TaskCategory] }));
    return true;
  },

  // Mirrors `inventoryStore`'s `isCategoryInUse`/`deleteCategory` exactly —
  // a direct id comparison against tasks, no name lookup needed.
  isCategoryInUse: (categoryId) =>
    get().tasks.some((task) => task.categoryId === categoryId),

  deleteCategory: async (supabase, id) => {
    if (get().isCategoryInUse(id)) return false;
    const { error } = await supabase.from("task_categories").delete().eq("id", id);
    if (error) return false;
    set((state) => ({
      taskCategories: state.taskCategories.filter((category) => category.id !== id),
    }));
    return true;
  },

  addTask: async (supabase, values) => {
    if (values.assignedEmployeeIds.length === 0) {
      console.warn("[taskStore] addTask refused: no assignees given.");
      return false;
    }

    const id = generateId("task");
    const { data, error } = await supabase
      .from("tasks")
      .insert({
        id,
        category_id: values.categoryId,
        title: values.title,
        description: values.description,
        due_at: values.dueAt,
        created_by: values.createdBy,
      })
      .select()
      .single();

    if (error || !data) {
      console.warn(`[taskStore] Could not create task ${id}:`, error);
      return false;
    }

    const { error: assignError } = await supabase.from("task_assignments").insert(
      values.assignedEmployeeIds.map((employeeClerkId) => ({
        task_id: id,
        employee_clerk_id: employeeClerkId,
      })),
    );
    // The task row was created but assignment failed — surfaced as an overall
    // failure so the admin sees an error rather than a silently-unassigned
    // task quietly appearing in the list.
    if (assignError) {
      console.warn(`[taskStore] Task ${id} was created but not assigned:`, assignError);
      return false;
    }

    set((state) => ({
      tasks: [
        ...state.tasks,
        {
          id,
          categoryId: data.category_id as string,
          title: data.title as string,
          description: (data.description as string | null) ?? null,
          dueAt: data.due_at as string,
          createdBy: data.created_by as string,
          createdAt: data.created_at as string,
          // Hand-created, so it belongs to no rule. Generated occurrences are
          // never added through here — they go straight to Supabase and are
          // picked up by the next `fetchAll` (see `insertOccurrences`).
          generatedFromRecurrenceRuleId: null,
          assignedEmployeeIds: values.assignedEmployeeIds,
          completions: [],
        },
      ],
    }));
    return true;
  },

  updateTask: async (supabase, id, updates) => {
    const dbUpdates: Record<string, unknown> = {};
    if (updates.title !== undefined) dbUpdates.title = updates.title;
    if (updates.categoryId !== undefined) dbUpdates.category_id = updates.categoryId;
    // `null` is a real value here (the description was cleared), so this
    // checks against `undefined` specifically — a `!== null` guard would make
    // an emptied description silently unsaveable.
    if (updates.description !== undefined) dbUpdates.description = updates.description;
    if (updates.dueAt !== undefined) dbUpdates.due_at = updates.dueAt;
    // Nothing scalar changed (an edit that only moved assignments around) —
    // succeed without a pointless empty UPDATE, which PostgREST rejects.
    if (Object.keys(dbUpdates).length === 0) return true;

    const { data, error } = await supabase
      .from("tasks")
      .update(dbUpdates)
      .eq("id", id)
      .select()
      .single();

    if (error || !data) {
      console.warn(`[taskStore] Could not update task ${id}:`, error);
      return false;
    }

    // Only the scalar columns are merged in: this response deliberately
    // doesn't request the `task_assignments` / `task_completions` embeds, so
    // the cached ones are carried forward rather than blanked out.
    const existing = get().tasks.find((task) => task.id === id);
    const updated: Task | null = existing
      ? {
          ...existing,
          categoryId: data.category_id as string,
          title: data.title as string,
          description: (data.description as string | null) ?? null,
          dueAt: data.due_at as string,
        }
      : null;

    set((state) => ({
      tasks: state.tasks.map((task) => (task.id === id && updated ? updated : task)),
    }));

    // A reminder fires relative to the due time, so moving the due date has
    // to move every reminder on the task with it — otherwise they keep firing
    // against the date they were set on. Only this device's own reminders can
    // be rescheduled here; anyone else's are re-derived on their next session
    // start, since their preference rows are untouched by this edit.
    if (updates.dueAt !== undefined && updated !== null) {
      await useTaskReminderStore.getState().rescheduleForTask(updated);
    }
    return true;
  },

  addAssignment: async (supabase, taskId, employeeClerkId) => {
    // Idempotent on purpose: assigning someone already on the task is a
    // silent no-op rather than a primary-key violation, matching how
    // inventory's `add_employee_to_item` RPC behaves. Bulk assignment (which
    // fires this across many tasks at once, some already assigned) depends on
    // that.
    const { error } = await supabase
      .from("task_assignments")
      .upsert(
        { task_id: taskId, employee_clerk_id: employeeClerkId },
        { onConflict: "task_id,employee_clerk_id", ignoreDuplicates: true },
      );

    if (error) {
      console.warn(
        `[taskStore] Could not assign ${employeeClerkId} to task ${taskId}:`,
        error,
      );
      return false;
    }
    set((state) => ({
      tasks: state.tasks.map((task) =>
        task.id === taskId && !task.assignedEmployeeIds.includes(employeeClerkId)
          ? {
              ...task,
              assignedEmployeeIds: [...task.assignedEmployeeIds, employeeClerkId],
            }
          : task,
      ),
    }));
    return true;
  },

  removeAssignment: async (supabase, taskId, employeeClerkId) => {
    const { error } = await supabase
      .from("task_assignments")
      .delete()
      .eq("task_id", taskId)
      .eq("employee_clerk_id", employeeClerkId);

    if (error) {
      console.warn(
        `[taskStore] Could not unassign ${employeeClerkId} from task ${taskId}:`,
        error,
      );
      return false;
    }
    set((state) => ({
      tasks: state.tasks.map((task) =>
        task.id === taskId
          ? {
              ...task,
              assignedEmployeeIds: task.assignedEmployeeIds.filter(
                (id) => id !== employeeClerkId,
              ),
            }
          : task,
      ),
    }));

    // Nobody should be reminded about a task that is no longer theirs — all of
    // their reminders on it go, not just one, now that a person can hold
    // several. A no-op unless this device actually holds reminders for that
    // exact pair — and since `taskReminderStore` only ever caches the
    // signed-in person's own rows, a match means it is their own assignment
    // being removed, which is the only case this device can clean up anyway.
    const forgotten = await useTaskReminderStore
      .getState()
      .deleteRemindersForTask(supabase, taskId, employeeClerkId);
    if (!forgotten) {
      console.warn(
        `[taskStore] Unassigned ${employeeClerkId} from task ${taskId} but could not delete their reminders on it.`,
      );
    }
    return true;
  },

  completeTask: async (supabase, taskId, employeeClerkId, status, note) => {
    // Every rejection below is logged, not just the Supabase one: three of the
    // four ways this can fail never reach the network at all, so an unlogged
    // `false` from here is indistinguishable from a connection problem — which
    // is exactly the hole that made a real completion failure undiagnosable.
    const trimmedNote = note.trim();
    // The DB's `missed_requires_note` constraint is the real backstop; this
    // mirrors it client-side so a failed insert never reaches the network.
    if (status === "missed" && trimmedNote.length === 0) {
      console.warn(`[taskStore] Completion refused for task ${taskId}: a miss needs a reason.`);
      return false;
    }

    const task = get().tasks.find((candidate) => candidate.id === taskId);
    if (!task) {
      console.warn(`[taskStore] Completion refused: task ${taskId} is not in the store.`);
      return false;
    }
    // Mirrors `task_completions_insert_own`: you may record only your own
    // response, and only on a task you are actually assigned to. RLS is what
    // truly enforces this — the fix for an Admin needing to resolve a task
    // they were never assigned to is deleting it, not an override here.
    if (!task.assignedEmployeeIds.includes(employeeClerkId)) {
      console.warn(
        `[taskStore] Completion refused: ${employeeClerkId} is not assigned to task ${taskId}. Assigned:`,
        task.assignedEmployeeIds,
      );
      return false;
    }
    // `(task_id, employee_clerk_id)` is the primary key, so responding twice
    // is a constraint violation rather than an update.
    if (hasEmployeeResponded(task, employeeClerkId)) {
      console.warn(
        `[taskStore] Completion refused: ${employeeClerkId} has already responded to task ${taskId}.`,
      );
      return false;
    }

    const { data, error } = await supabase
      .from("task_completions")
      .insert({
        task_id: taskId,
        employee_clerk_id: employeeClerkId,
        status,
        note: trimmedNote.length > 0 ? trimmedNote : null,
      })
      .select()
      .single();

    if (error || !data) {
      console.warn(
        `[taskStore] Could not record ${status} for ${employeeClerkId} on task ${taskId}:`,
        error,
      );
      return false;
    }

    set((state) => ({
      tasks: state.tasks.map((existing) =>
        existing.id === taskId
          ? {
              ...existing,
              completions: [
                ...existing.completions,
                {
                  employeeClerkId: data.employee_clerk_id as string,
                  status: data.status as TaskCompletionStatus,
                  note: (data.note as string | null) ?? null,
                  recordedAt: data.recorded_at as string,
                },
              ],
            }
          : existing,
      ),
    }));
    return true;
  },

  deleteTask: async (supabase, id) => {
    // Read before the delete — afterwards the row is gone from the cache and
    // there is nothing left to learn the rule id from.
    const ruleId = get().tasks.find((task) => task.id === id)?.generatedFromRecurrenceRuleId;

    const { error } = await supabase.from("tasks").delete().eq("id", id);
    if (error) return false;
    set((state) => ({ tasks: state.tasks.filter((task) => task.id !== id) }));

    // The task's `task_reminders` rows went with it (`on delete cascade`), so
    // only the device-local scheduled notification is left to cancel —
    // nothing should fire for a task that no longer exists.
    await useTaskReminderStore.getState().forgetTask(id);

    // Deleting one occurrence of a recurring task cancels the whole series:
    // nothing further is ever generated from the rule that produced it. Other
    // occurrences already generated are left completely alone —
    // `tasks.generated_from_recurrence_rule_id` is `on delete set null`, so
    // they simply stop pointing at a rule and otherwise stay exactly as they
    // were. This is on top of `deleteRule`'s own behaviour, not a change to
    // it.
    //
    // Two writes with no transaction between them, deliberately — the same
    // trade-off already accepted for the queued "make task mutations atomic"
    // work. The task really is deleted either way, so a failure on the second
    // step is warned about rather than reported as a failed delete, which
    // would be untrue and would leave the list showing a task that is gone.
    if (ruleId) {
      const cancelled = await useTaskRecurrenceStore.getState().deleteRule(supabase, ruleId);
      if (!cancelled) {
        console.warn(
          `[taskStore] Deleted occurrence ${id} but could not cancel recurrence rule ${ruleId} — it will keep generating.`,
        );
      }
    }

    return true;
  },
}));
