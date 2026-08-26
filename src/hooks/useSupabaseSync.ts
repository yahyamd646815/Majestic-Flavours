import { useUser } from "@clerk/expo";
import { useEffect } from "react";

import { useSupabaseClient } from "@/lib/supabase";
import { useAppUsersStore } from "@/store/appUsersStore";
import { useInventoryStore } from "@/store/inventoryStore";
import { useReportStore } from "@/store/reportStore";
import { useUnitsStore } from "@/store/unitsStore";

/**
 * Fills every Supabase-backed store from the database once per signed-in
 * session. All four stores start empty and are pure in-memory caches now, so
 * without this nothing has any data to show.
 *
 * Called once, from the authenticated layout — screens read the stores and
 * re-run `fetchAll` themselves only on an explicit retry.
 */
export function useSupabaseSync(isSignedIn: boolean) {
  const supabase = useSupabaseClient();
  const { user } = useUser();

  const fetchInventory = useInventoryStore((state) => state.fetchAll);
  const fetchUnits = useUnitsStore((state) => state.fetchAll);
  const fetchReports = useReportStore((state) => state.fetchAll);
  const fetchAppUsers = useAppUsersStore((state) => state.fetchAll);
  const syncSelf = useAppUsersStore((state) => state.syncSelf);

  useEffect(() => {
    if (!isSignedIn) return;
    // TEMPORARY-START: confirms this effect fires once per session, not
    // repeatedly. Safe to delete once Yahya confirms exactly one log line
    // over 2-3 minutes of real use.
    console.log("[useSupabaseSync] fetch effect fired");
    // TEMPORARY-END
    void fetchInventory(supabase);
    void fetchUnits(supabase);
    void fetchReports(supabase);
    // supabase is intentionally omitted: its identity is now stable per
    // component instance (see useSupabaseClient), and re-running this effect
    // should be driven only by sign-in state, not by an incidental client
    // reference change.
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [isSignedIn, fetchInventory, fetchUnits, fetchReports]);

  // Read as primitives so the effect below is keyed on the values that
  // actually matter — Clerk's `user` object identity changes more often than
  // the name or email on it, and each change would re-run the upsert.
  const clerkUserId = user?.id;
  const name = user?.fullName ?? user?.firstName ?? "Unknown";
  const email = user?.primaryEmailAddress?.emailAddress ?? "";

  // Own row first, then the whole directory: `reports.reporter_id` is a
  // foreign key into `app_users`, so this person's row has to exist before
  // any report of theirs can be written. The refetch afterwards picks up
  // everyone else who has signed in, for resolving names on report cards.
  useEffect(() => {
    if (!isSignedIn || !clerkUserId) return;
    void syncSelf(supabase, { clerkUserId, name, email }).then(() =>
      fetchAppUsers(supabase),
    );
    // supabase intentionally omitted — see note in the effect above.
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [isSignedIn, clerkUserId, name, email, syncSelf, fetchAppUsers]);
}
