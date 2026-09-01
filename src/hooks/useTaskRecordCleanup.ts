import { useAuth, useUser } from "@clerk/expo";
import { useEffect, useRef } from "react";

import { getTodayIsoDate, riyadhDateTimeToIso } from "@/lib/reports";
import { useSupabaseClient } from "@/lib/supabase";
import { parseRole } from "@/types/role";

/** 4 months back from "today" (Riyadh-based), as the exact Riyadh midnight
 * instant — `due_at` is a timestamp column, not a plain date, so the cutoff
 * needs to be a real instant rather than a date string. Same reasoning as
 * `useReportCleanup`'s own cutoff: this is routine cleanup, not something
 * that can wrongly reject a legitimate action, so day-level precision is
 * enough. */
function getCutoffInstantIso(): string {
  const today = getTodayIsoDate();
  const [year, month, day] = today.split("-").map(Number);
  const cutoff = new Date(Date.UTC(year, month - 1 - 4, day));
  return riyadhDateTimeToIso(cutoff.getUTCFullYear(), cutoff.getUTCMonth() + 1, cutoff.getUTCDate(), 0, 0);
}

/**
 * Deletes tasks (and, via cascade, their assignments and completions) whose
 * `due_at` is older than 4 months back, once per signed-in admin session —
 * regardless of completion status, matching reports' own cleanup, which is
 * equally blunt about not special-casing anything still unresolved.
 *
 * Silent by design — no loading state, no UI, console logging only. Keyed on
 * Clerk's `sessionId` (via a ref), exactly mirroring `useReportCleanup`'s
 * guard against re-running mid-session.
 *
 * Requires `task_completions_delete_staff` (v2-supabase-patch-round8) — a
 * cascade delete needs RLS permission on every child table it touches, not
 * just the parent.
 */
export function useTaskRecordCleanup(isSignedIn: boolean) {
  const { sessionId } = useAuth();
  const { user } = useUser();
  const supabase = useSupabaseClient();
  const role = parseRole(user?.publicMetadata?.role);
  const lastRunSessionId = useRef<string | null>(null);

  useEffect(() => {
    if (!isSignedIn || role !== "admin" || !sessionId) return;
    if (lastRunSessionId.current === sessionId) return;
    lastRunSessionId.current = sessionId;

    const cutoff = getCutoffInstantIso();
    void supabase
      .from("tasks")
      .delete()
      .lt("due_at", cutoff)
      .select("id")
      .then(({ data, error }) => {
        if (error) {
          console.warn("[useTaskRecordCleanup] Failed to delete old tasks:", error);
          return;
        }
        console.log(
          `[useTaskRecordCleanup] Deleted ${data?.length ?? 0} task(s) older than ${cutoff}.`,
        );
      });
    // supabase intentionally omitted — its identity is stable per component
    // instance (see useSupabaseClient), and the sessionId ref guard above is
    // what actually governs re-runs.
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [sessionId, role, isSignedIn]);
}
