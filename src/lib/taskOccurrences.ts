import type { SupabaseClient } from "@supabase/supabase-js";

import { generateId } from "@/lib/id";
import {
  generateDueOccurrences,
  unboundedUpToMs,
  type GeneratedOccurrence,
} from "@/lib/taskRecurrence";
import type { TaskRecurrenceRule } from "@/types/tasks";

/** Shared and never written to — `generateDueOccurrences` only reads it. */
export const NO_EXISTING_KEYS = new Set<string>();

/**
 * Writes occurrences of one rule as ordinary `tasks` rows, plus their
 * copied-forward assignments. Returns how many task rows were created.
 *
 * One rule per call rather than one batch across all rules: if another device
 * created the same occurrence a moment earlier, the unique index rejects this
 * insert, and keeping it per rule stops that from taking every other rule's
 * occurrences down with it. Nothing is lost either way — whatever fails here
 * is simply still missing next session, and gets generated then.
 */
export async function insertOccurrences(
  supabase: SupabaseClient,
  rule: TaskRecurrenceRule,
  occurrences: GeneratedOccurrence[],
): Promise<number> {
  if (occurrences.length === 0) return 0;

  // `generateId` is timestamp + random, so a batch created inside the same
  // millisecond could in principle collide with itself and fail the whole
  // insert. Uniqueness within the batch is cheap to guarantee outright.
  const usedIds = new Set<string>();
  const taskRows = occurrences.map((occurrence) => {
    let id = generateId("task");
    while (usedIds.has(id)) id = generateId("task");
    usedIds.add(id);

    return {
      id,
      category_id: rule.categoryId,
      title: rule.title,
      description: rule.description,
      due_at: occurrence.dueAt,
      created_by: rule.createdBy,
      generated_from_recurrence_rule_id: rule.id,
      recurrence_occurrence_key: occurrence.occurrenceKey,
    };
  });

  const { error } = await supabase.from("tasks").insert(taskRows);
  if (error) {
    console.warn(`[taskOccurrences] Could not create occurrences for rule ${rule.id}:`, error);
    return 0;
  }

  // Assignments have to follow the insert — they reference the task by
  // foreign key, so there is no way to write them first. If this fails, the
  // occurrences exist unassigned and will not be regenerated (their keys are
  // taken), so it is logged loudly rather than swallowed.
  const assignmentRows = taskRows.flatMap((task) =>
    rule.assignedEmployeeIds.map((employeeClerkId) => ({
      task_id: task.id,
      employee_clerk_id: employeeClerkId,
    })),
  );
  if (assignmentRows.length > 0) {
    const { error: assignError } = await supabase.from("task_assignments").insert(assignmentRows);
    if (assignError) {
      console.warn(
        `[taskOccurrences] Occurrences for rule ${rule.id} were created but not assigned:`,
        assignError,
      );
    }
  }

  return taskRows.length;
}

/**
 * Creates one rule's occurrences that have come due by `nowMs` but do not
 * exist yet. Returns how many were created.
 */
export async function generateForRule(
  supabase: SupabaseClient,
  rule: TaskRecurrenceRule,
  existingKeys: Set<string>,
  nowMs: number,
): Promise<number> {
  return insertOccurrences(supabase, rule, generateDueOccurrences(rule, existingKeys, nowMs));
}

/**
 * Creates a brand-new rule's very first occurrence straight away, instead of
 * leaving it invisible until its own due time arrives. Returns whether one
 * was actually created.
 *
 * Only the first: every occurrence after it still arrives through the normal
 * lazy, due-time-triggered pass in `useTaskOccurrenceGeneration`. That pass
 * needs no special case for this one — by the time it next runs, the
 * occurrence genuinely exists under its real `occurrence_key`, so its own
 * "already exists" check skips it like any other.
 *
 * Nothing about being early changes what the occurrence is: it is an ordinary
 * task with a real future `due_at`, so it reads as pending now and becomes
 * Overdue through the existing badge once that time passes, unchanged.
 *
 * The horizon is unbounded because "is it due yet?" is exactly the question
 * this is answering NO to — the first occurrence is wanted precisely because
 * it has not come due. `generateDueOccurrences` returns chronologically, so
 * the first element is the earliest the rule will ever produce.
 */
export async function generateFirstOccurrence(
  supabase: SupabaseClient,
  rule: TaskRecurrenceRule,
  nowMs: number = Date.now(),
): Promise<boolean> {
  const [first] = generateDueOccurrences(rule, NO_EXISTING_KEYS, unboundedUpToMs(nowMs));
  if (first === undefined) return false;
  return (await insertOccurrences(supabase, rule, [first])) > 0;
}
