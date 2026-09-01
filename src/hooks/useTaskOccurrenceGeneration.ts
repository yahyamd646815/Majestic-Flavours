import { useAuth, useUser } from "@clerk/expo";
import type { SupabaseClient } from "@supabase/supabase-js";
import { useEffect, useMemo, useRef } from "react";

import { useSupabaseClient } from "@/lib/supabase";
import { generateForRule, NO_EXISTING_KEYS } from "@/lib/taskOccurrences";
import { useTaskRecurrenceStore } from "@/store/taskRecurrenceStore";
import { useTaskStore } from "@/store/taskStore";
import { parseRole } from "@/types/role";

/**
 * Which occurrences of each rule already exist, read straight from Supabase
 * rather than from `taskStore`. That is deliberate: this is the check that
 * stops a duplicate being created, so it has to see what the database
 * actually holds right now — including rows another device generated
 * moments ago — not whatever this session happened to cache at start-up.
 */
async function fetchExistingKeysByRule(
  supabase: SupabaseClient,
): Promise<Map<string, Set<string>> | null> {
  const { data, error } = await supabase
    .from("tasks")
    .select("generated_from_recurrence_rule_id, recurrence_occurrence_key")
    .not("generated_from_recurrence_rule_id", "is", null);

  if (error) {
    console.warn("[useTaskOccurrenceGeneration] Could not read existing occurrences:", error);
    return null;
  }

  const keysByRule = new Map<string, Set<string>>();
  for (const row of (data ?? []) as Record<string, unknown>[]) {
    const ruleId = row.generated_from_recurrence_rule_id as string | null;
    const key = row.recurrence_occurrence_key as string | null;
    if (!ruleId || !key) continue;
    const keys = keysByRule.get(ruleId);
    if (keys) keys.add(key);
    else keysByRule.set(ruleId, new Set([key]));
  }
  return keysByRule;
}

/**
 * Creates any recurring-task occurrences that have come due but do not exist
 * yet, once per signed-in session.
 *
 * A rule's FIRST occurrence is not waited for here — it is created outright
 * the moment the rule is (see `generateFirstOccurrence`). By the time this
 * runs it already exists under its real key, so the existing-keys check below
 * skips it exactly as it would any other already-created occurrence; nothing
 * here special-cases it.
 *
 * Generation is client-side by design (AGENTS.md → To-Do List Rules):
 * whichever device opens the app first after an occurrence comes due is the
 * one that creates it — an employee's phone included (for the rules they are
 * on, see `generatableRules` below), which is why
 * `tasks_insert_occurrence_generation` exists as a separate, looser insert
 * policy alongside `tasks_insert_staff`.
 *
 * Keyed on Clerk's `sessionId` via a ref for the same reason as
 * `useReportCleanup`: at most one run per distinct session, however many
 * times the inputs around it happen to change.
 */
export function useTaskOccurrenceGeneration(isSignedIn: boolean) {
  const { sessionId } = useAuth();
  const { user } = useUser();
  const supabase = useSupabaseClient();
  const rules = useTaskRecurrenceStore((state) => state.rules);
  const isLoadingRules = useTaskRecurrenceStore((state) => state.isLoading);
  const fetchTasks = useTaskStore((state) => state.fetchAll);
  const lastRunSessionId = useRef<string | null>(null);

  const role = parseRole(user?.publicMetadata?.role);
  const currentUserClerkId = user?.id;

  /**
   * Only the rules whose existing occurrences this device can actually SEE.
   *
   * `tasks_select_staff` shows an employee only the tasks they are assigned
   * to, so on their device the "what already exists" check is blind to any
   * rule they are not on — it would try to re-create occurrences that already
   * exist, the unique index would reject the insert, and the genuinely-new
   * occurrence in the same batch would be lost with it. Generating only what
   * this device can verify keeps that from ever arising. Nothing goes
   * ungenerated: an occurrence is always assigned to the rule's own
   * assignees, so the people it belongs to generate it, and Admin/Manager see
   * every rule regardless.
   */
  const generatableRules = useMemo(() => {
    if (role === "admin" || role === "manager") return rules;
    if (!currentUserClerkId) return [];
    return rules.filter((rule) => rule.assignedEmployeeIds.includes(currentUserClerkId));
  }, [rules, role, currentUserClerkId]);

  useEffect(() => {
    if (!isSignedIn || !sessionId || isLoadingRules) return;
    // The ref is claimed only once there is genuinely something to run
    // against — otherwise the first render after sign-in, before
    // `useSupabaseSync` has seeded any rules, would burn this session's single
    // run on an empty list.
    if (generatableRules.length === 0) return;
    if (lastRunSessionId.current === sessionId) return;
    lastRunSessionId.current = sessionId;

    void (async () => {
      const keysByRule = await fetchExistingKeysByRule(supabase);
      if (keysByRule === null) return;

      // One "now" for the whole pass, so two rules cannot disagree about
      // whether an occurrence on the boundary is due yet.
      const nowMs = Date.now();
      let created = 0;
      for (const rule of generatableRules) {
        created += await generateForRule(
          supabase,
          rule,
          keysByRule.get(rule.id) ?? NO_EXISTING_KEYS,
          nowMs,
        );
      }

      if (created === 0) return;
      console.log(`[useTaskOccurrenceGeneration] Created ${created} due occurrence(s).`);
      // The task list was already loaded by `useSupabaseSync` before these
      // rows existed, so it needs re-reading for them to show up without a
      // restart.
      await fetchTasks(supabase);
    })();
    // supabase intentionally omitted — its identity is stable per component
    // instance (see useSupabaseClient), and the sessionId ref guard above is
    // what actually governs re-runs.
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [isSignedIn, sessionId, isLoadingRules, generatableRules, fetchTasks]);
}
