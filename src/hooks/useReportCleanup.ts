import { useUser } from "@clerk/expo";
import { useEffect } from "react";

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
 * Silent by design — no loading state, no UI, console logging only. Only
 * ever runs for an admin: both because deletion is scoped that way in RLS
 * (see round7), and so a non-admin session doesn't attempt a request that
 * would just be rejected every time.
 */
export function useReportCleanup(isSignedIn: boolean) {
  const { user } = useUser();
  const supabase = useSupabaseClient();
  const role = parseRole(user?.publicMetadata?.role);

  useEffect(() => {
    if (!isSignedIn || role !== "admin") return;

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
    // Deliberately runs once per signed-in admin session, not on every
    // screen visit — `isSignedIn`/`role` are the only real dependencies.
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [isSignedIn, role]);
}
