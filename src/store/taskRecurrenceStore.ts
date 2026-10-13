import type { SupabaseClient } from "@supabase/supabase-js";
import { create } from "zustand";

import { generateId } from "@/lib/id";
import type { RecurrenceRuleInput } from "@/lib/taskRecurrence";
import type {
  RecurrenceDayPattern,
  RecurrenceTimePattern,
  TaskRecurrenceRule,
} from "@/types/tasks";

/** Same plain one-to-many embeds `taskStore` uses for `task_assignments`. */
function mapDbRuleToRule(row: Record<string, unknown>): TaskRecurrenceRule {
  const assignmentRows =
    (row.task_recurrence_assignments as Record<string, unknown>[] | null) ?? [];
  const customDateRows =
    (row.task_recurrence_custom_dates as Record<string, unknown>[] | null) ?? [];

  return {
    id: row.id as string,
    title: row.title as string,
    categoryId: row.category_id as string,
    description: (row.description as string | null) ?? null,
    createdBy: row.created_by as string,
    dayPattern: row.day_pattern as RecurrenceDayPattern,
    dayInterval: row.day_interval as number,
    daysOfWeek: (row.days_of_week as number[] | null) ?? null,
    timePattern: row.time_pattern as RecurrenceTimePattern,
    timesOfDay: (row.times_of_day as string[] | null) ?? null,
    hourInterval: (row.hour_interval as number | null) ?? null,
    endsOnDate: (row.ends_on_date as string | null) ?? null,
    endsAfterOccurrences: (row.ends_after_occurrences as number | null) ?? null,
    createdAt: row.created_at as string,
    assignedEmployeeIds: assignmentRows.map((a) => a.employee_clerk_id as string),
    // Sorted here rather than relying on row order, so a rule's dates read the
    // same way whether they came from the database or from the form.
    customDates: customDateRows.map((d) => d.occurrence_date as string).sort(),
  };
}

const RULE_SELECT =
  "*, task_recurrence_assignments(employee_clerk_id), task_recurrence_custom_dates(occurrence_date)";

/** The recurrence fields from `RecurrenceFields`, plus the same
 * title/category/description/assignee set a one-time task carries. Mirrors
 * `NewTaskValues` in `taskStore`. */
export type NewRecurrenceRuleValues = RecurrenceRuleInput & {
  title: string;
  categoryId: string;
  description: string | null;
  assignedEmployeeIds: string[];
  createdBy: string;
};

/**
 * An in-memory cache of the recurrence templates, same contract as every
 * other store here — not persisted, re-seeded once per signed-in session by
 * `useSupabaseSync`, and read by `useTaskOccurrenceGeneration` to work out
 * which occurrences are owed.
 *
 * Generated occurrences themselves live in `taskStore` as ordinary tasks;
 * nothing about them is cached here.
 */
type TaskRecurrenceState = {
  rules: TaskRecurrenceRule[];
  isLoading: boolean;
  error: string | null;
  fetchAll: (supabase: SupabaseClient) => Promise<void>;
  /**
   * Requires at least one assignee, matching `addTask` — a template with
   * nobody on it would generate occurrences nobody owes.
   *
   * Returns the created rule rather than a bare boolean: the caller needs it
   * to create the rule's first occurrence straight away (see
   * `generateFirstOccurrence`), and `null` still reads as failure.
   */
  addRule: (
    supabase: SupabaseClient,
    values: NewRecurrenceRuleValues,
  ) => Promise<TaskRecurrenceRule | null>;
  /**
   * Scalar columns only. Assignees and custom dates are deliberately not
   * editable through here yet — both live in their own tables, and there is
   * no rule-management UI to drive either. Changing assignees also has to
   * leave occurrences already generated alone (their assignments were copied
   * forward at generation time, by design). Both arrive with the recurrence
   * management screen, which is why `customDates` is excluded from the update
   * type outright rather than accepted and quietly dropped.
   */
  updateRule: (
    supabase: SupabaseClient,
    id: string,
    updates: Partial<Pick<TaskRecurrenceRule, "title" | "categoryId" | "description">> &
      Partial<Omit<RecurrenceRuleInput, "customDates">>,
  ) => Promise<boolean>;
  /**
   * Occurrences already generated survive this: `tasks` references the rule
   * with `on delete set null`, so past and pending tasks stay exactly where
   * they are and only future generation stops.
   *
   * Also reached from `taskStore`'s `deleteTask`, which cancels a rule
   * outright when one of its generated occurrences is deleted.
   */
  deleteRule: (supabase: SupabaseClient, id: string) => Promise<boolean>;
};

export const useTaskRecurrenceStore = create<TaskRecurrenceState>()((set, get) => ({
  rules: [],
  isLoading: true,
  error: null,

  fetchAll: async (supabase) => {
    set({ isLoading: true, error: null });
    const { data, error } = await supabase.from("task_recurrence_rules").select(RULE_SELECT);

    if (error) {
      set({
        isLoading: false,
        error: "Could not load recurring tasks. Check your connection and try again.",
      });
      return;
    }

    set({
      rules: ((data ?? []) as Record<string, unknown>[]).map(mapDbRuleToRule),
      isLoading: false,
      error: null,
    });
  },

  addRule: async (supabase, values) => {
    if (values.assignedEmployeeIds.length === 0) return null;

    const id = generateId("task-rule");
    const { data, error } = await supabase
      .from("task_recurrence_rules")
      .insert({
        id,
        title: values.title,
        category_id: values.categoryId,
        description: values.description,
        created_by: values.createdBy,
        day_pattern: values.dayPattern,
        day_interval: values.dayInterval,
        days_of_week: values.daysOfWeek,
        time_pattern: values.timePattern,
        times_of_day: values.timesOfDay,
        hour_interval: values.hourInterval,
        ends_on_date: values.endsOnDate,
        ends_after_occurrences: values.endsAfterOccurrences,
      })
      .select()
      .single();

    if (error || !data) return null;

    const { error: assignError } = await supabase.from("task_recurrence_assignments").insert(
      values.assignedEmployeeIds.map((employeeClerkId) => ({
        recurrence_rule_id: id,
        employee_clerk_id: employeeClerkId,
      })),
    );
    // Same reasoning as `addTask`: the template exists but nobody is on it, so
    // this is surfaced as an outright failure rather than letting a rule that
    // would generate unassigned occurrences sit there silently.
    if (assignError) return null;

    // Picked dates live in their own table, so they follow the rule row for
    // the same foreign-key reason the assignments do. Treated as just as
    // essential: for a 'custom' rule they ARE the schedule, and for the other
    // patterns they are days somebody deliberately asked for — a rule missing
    // them is not the rule that was submitted.
    if (values.customDates.length > 0) {
      const { error: datesError } = await supabase.from("task_recurrence_custom_dates").insert(
        values.customDates.map((occurrenceDate) => ({
          recurrence_rule_id: id,
          occurrence_date: occurrenceDate,
        })),
      );
      if (datesError) return null;
    }

    // The insert response carries neither embed, so both are carried over
    // from what was just submitted rather than coming back empty.
    const rule: TaskRecurrenceRule = {
      ...mapDbRuleToRule(data),
      assignedEmployeeIds: values.assignedEmployeeIds,
      customDates: values.customDates,
    };
    set((state) => ({ rules: [...state.rules, rule] }));
    return rule;
  },

  updateRule: async (supabase, id, updates) => {
    const dbUpdates: Record<string, unknown> = {};
    if (updates.title !== undefined) dbUpdates.title = updates.title;
    if (updates.categoryId !== undefined) dbUpdates.category_id = updates.categoryId;
    // `null` is a real value (the description was cleared), so these check
    // against `undefined` specifically — see the same note in `updateTask`.
    if (updates.description !== undefined) dbUpdates.description = updates.description;
    if (updates.dayPattern !== undefined) dbUpdates.day_pattern = updates.dayPattern;
    if (updates.dayInterval !== undefined) dbUpdates.day_interval = updates.dayInterval;
    if (updates.daysOfWeek !== undefined) dbUpdates.days_of_week = updates.daysOfWeek;
    if (updates.timePattern !== undefined) dbUpdates.time_pattern = updates.timePattern;
    if (updates.timesOfDay !== undefined) dbUpdates.times_of_day = updates.timesOfDay;
    if (updates.hourInterval !== undefined) dbUpdates.hour_interval = updates.hourInterval;
    if (updates.endsOnDate !== undefined) dbUpdates.ends_on_date = updates.endsOnDate;
    if (updates.endsAfterOccurrences !== undefined) {
      dbUpdates.ends_after_occurrences = updates.endsAfterOccurrences;
    }
    if (Object.keys(dbUpdates).length === 0) return true;

    const { data, error } = await supabase
      .from("task_recurrence_rules")
      .update(dbUpdates)
      .eq("id", id)
      .select()
      .single();

    if (error || !data) return false;

    // The response deliberately does not request either embed, so the cached
    // assignees and custom dates are carried forward rather than blanked out.
    set((state) => ({
      rules: state.rules.map((rule) =>
        rule.id === id
          ? {
              ...mapDbRuleToRule(data),
              assignedEmployeeIds: rule.assignedEmployeeIds,
              customDates: rule.customDates,
            }
          : rule,
      ),
    }));
    return true;
  },

  deleteRule: async (supabase, id) => {
    // `task_recurrence_assignments` and `task_recurrence_custom_dates` both
    // cascade from the rule, so neither needs a separate delete — and unlike
    // reports, no child table sits outside that cascade.
    const { error } = await supabase.from("task_recurrence_rules").delete().eq("id", id);
    if (error) return false;
    set((state) => ({ rules: state.rules.filter((rule) => rule.id !== id) }));
    return true;
  },
}));
