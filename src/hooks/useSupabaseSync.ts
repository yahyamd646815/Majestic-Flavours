import { useUser } from "@clerk/expo";
import { useEffect, useRef } from "react";

import { useSupabaseClient } from "@/lib/supabase";
import { useAppUsersStore } from "@/store/appUsersStore";
import { useInventoryStore } from "@/store/inventoryStore";
import { useReportStore } from "@/store/reportStore";
import { useTaskReminderStore } from "@/store/taskReminderStore";
import { useTaskRecurrenceStore } from "@/store/taskRecurrenceStore";
import { useTaskStore } from "@/store/taskStore";
import { useUnitsStore } from "@/store/unitsStore";

/**
 * Fills every Supabase-backed store from the database once per signed-in
 * session. They all start empty and are pure in-memory caches now, so without
 * this nothing has any data to show.
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
  const fetchTasks = useTaskStore((state) => state.fetchAll);
  const fetchRecurrenceRules = useTaskRecurrenceStore((state) => state.fetchAll);
  // Own rows only — `task_reminders`' RLS scopes select to the signed-in
  // person, so this needs no filter of its own.
  const fetchTaskReminders = useTaskReminderStore((state) => state.fetchAll);
  const fetchAppUsers = useAppUsersStore((state) => state.fetchAll);
  const syncSelf = useAppUsersStore((state) => state.syncSelf);
  const registerPushToken = useAppUsersStore((state) => state.registerPushToken);

  useEffect(() => {
    if (!isSignedIn) return;
    void fetchInventory(supabase);
    void fetchUnits(supabase);
    void fetchReports(supabase);
    void fetchTasks(supabase);
    void fetchRecurrenceRules(supabase);
    void fetchTaskReminders(supabase);
    // supabase is intentionally omitted: its identity is now stable per
    // component instance (see useSupabaseClient), and re-running this effect
    // should be driven only by sign-in state, not by an incidental client
    // reference change.
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [
    isSignedIn,
    fetchInventory,
    fetchUnits,
    fetchReports,
    fetchTasks,
    fetchRecurrenceRules,
    fetchTaskReminders,
  ]);

  // Read as primitives so the effect below is keyed on the values that
  // actually matter — Clerk's `user` object identity changes more often than
  // the name or email on it, and each change would re-run the upsert.
  const clerkUserId = user?.id;
  const name = user?.fullName ?? user?.firstName ?? "Unknown";
  const email = user?.primaryEmailAddress?.emailAddress ?? "";

  // Registered at most once per person per app run, so a remount cannot
  // re-prompt for the permission or rewrite a token that has not changed.
  const pushTokenRegisteredFor = useRef<string | null>(null);

  // Own row first, then the whole directory: `reports.reporter_id` is a
  // foreign key into `app_users`, so this person's row has to exist before
  // any report of theirs can be written. The refetch afterwards picks up
  // everyone else who has signed in, for resolving names on report cards.
  //
  // Push registration hangs off the same chain rather than off `selfSynced`:
  // it is an UPDATE, so it would quietly match zero rows if it ran first, and
  // the flag stays true across a sign-out — which would race exactly when two
  // people share a device.
  //
  // This is also where the notification permission is asked for — at sign-in,
  // deliberately unlike the local reminders in `v2-03-e1`, which ask lazily at
  // the moment someone sets one. There is no equivalent moment here: being
  // handed a task is something somebody else does, on their own device.
  useEffect(() => {
    if (!isSignedIn || !clerkUserId) return;
    void syncSelf(supabase, { clerkUserId, name, email }).then(() => {
      void fetchAppUsers(supabase);
      if (pushTokenRegisteredFor.current === clerkUserId) return;
      pushTokenRegisteredFor.current = clerkUserId;
      void registerPushToken(supabase, clerkUserId);
    });
    // supabase intentionally omitted — see note in the effect above.
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [isSignedIn, clerkUserId, name, email, syncSelf, fetchAppUsers, registerPushToken]);
}
