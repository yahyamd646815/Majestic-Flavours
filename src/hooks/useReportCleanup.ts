import { useAuth, useUser } from "@clerk/expo";
import { useEffect, useRef } from "react";

import { getTodayIsoDate } from "@/lib/reports";
import { useSupabaseClient } from "@/lib/supabase";
import { parseRole } from "@/types/role";

/** 4 months back from "today" (Riyadh-based, matching the rest of the app's
 * date handling) — this doesn't need day-level precision the way report
 * submission timing does, since it's routine cleanup, not something that
 * can wrongly reject a legitimate action. */
function getCutoffIsoDate(): string {
  const today = getTodayIsoDate();
  const [year, month, day] = today.split("-").map(Number);
  const cutoff = new Date(Date.UTC(year, month - 1 - 4, day));
  const cutoffMonth = String(cutoff.getUTCMonth() + 1).padStart(2, "0");
  const cutoffDay = String(cutoff.getUTCDate()).padStart(2, "0");
  return `${cutoff.getUTCFullYear()}-${cutoffMonth}-${cutoffDay}`;
}

/**
 * Deletes reports older than 4 months, once per signed-in admin session.
 * Silent by design — no loading state, no UI, console logging only.
 *
 * Keyed on Clerk's `sessionId` (via a ref), not just `isSignedIn`/`role` —
 * those two alone could re-run cleanup a second time if an admin's role
 * flickers off and back on mid-session (e.g. a role correction elsewhere
 * while this session is still open), and wouldn't catch a switch to a
 * different already-authenticated admin session if one ever happened
 * without an intervening sign-out. The ref guarantees at most one run per
 * distinct sessionId, regardless of how many times role or isSignedIn
 * happen to toggle around it.
 */
export function useReportCleanup(isSignedIn: boolean) {
  const { sessionId } = useAuth();
  const { user } = useUser();
  const supabase = useSupabaseClient();
  const role = parseRole(user?.publicMetadata?.role);
  const lastRunSessionId = useRef<string | null>(null);

  useEffect(() => {
    if (!isSignedIn || role !== "admin" || !sessionId) return;
    if (lastRunSessionId.current === sessionId) return;
    lastRunSessionId.current = sessionId;

    const cutoff = getCutoffIsoDate();
    void supabase
      .from("reports")
      .delete()
      .lt("date", cutoff)
      .select("id")
      .then(({ data, error }) => {
        if (error) {
          console.warn("[useReportCleanup] Failed to delete old reports:", error);
          return;
        }
        console.log(
          `[useReportCleanup] Deleted ${data?.length ?? 0} report(s) older than ${cutoff}.`,
        );
      });
    // supabase intentionally omitted — its identity is now stable per
    // component instance (see useSupabaseClient), and the sessionId ref
    // guard above is what actually governs re-runs.
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [sessionId, role, isSignedIn]);
}
