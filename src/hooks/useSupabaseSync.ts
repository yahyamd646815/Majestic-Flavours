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
    void fetchInventory(supabase);
    void fetchUnits(supabase);
    void fetchReports(supabase);
  }, [isSignedIn, supabase, fetchInventory, fetchUnits, fetchReports]);

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
  }, [isSignedIn, clerkUserId, name, email, supabase, syncSelf, fetchAppUsers]);
}
