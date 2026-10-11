import type { SupabaseClient } from "@supabase/supabase-js";
import { create } from "zustand";

import { getExpoPushToken } from "@/lib/notifications";

export type SyncedUser = {
  clerkUserId: string;
  name: string;
  email: string;
};

type AppUsersState = {
  users: SyncedUser[];
  isLoading: boolean;
  error: string | null;
  /** True once THIS session's own `app_users` row is confirmed written —
   * submitting a report before this is true risks a foreign-key violation,
   * since `reports.reporter_id` references `app_users`. */
  selfSynced: boolean;
  fetchAll: (supabase: SupabaseClient) => Promise<void>;
  syncSelf: (
    supabase: SupabaseClient,
    self: { clerkUserId: string; name: string; email: string },
  ) => Promise<void>;
  /** Stores this device's Expo push token on the signed-in person's own
   * `app_users` row, so the `task_assignments` webhook has somewhere to send.
   * Silent no-op when there is no token to store. */
  registerPushToken: (supabase: SupabaseClient, clerkUserId: string) => Promise<void>;
};

export const useAppUsersStore = create<AppUsersState>()((set) => ({
  users: [],
  isLoading: true,
  error: null,
  selfSynced: false,

  fetchAll: async (supabase) => {
    set({ isLoading: true, error: null });
    const { data, error } = await supabase.from("app_users").select("*");

    if (error) {
      set({ isLoading: false, error: "Could not load user directory." });
      return;
    }

    set({
      users: ((data ?? []) as Record<string, unknown>[]).map((row) => ({
        clerkUserId: row.clerk_user_id as string,
        name: row.name as string,
        email: row.email as string,
      })),
      isLoading: false,
      error: null,
    });
  },

  syncSelf: async (supabase, self) => {
    const { error } = await supabase
      .from("app_users")
      .upsert(
        { clerk_user_id: self.clerkUserId, name: self.name, email: self.email },
        { onConflict: "clerk_user_id" },
      );

    if (error) {
      console.warn("[appUsersStore] Failed to sync own user row:", error);
      return;
    }

    set((state) => ({
      users: [
        ...state.users.filter((user) => user.clerkUserId !== self.clerkUserId),
        { clerkUserId: self.clerkUserId, name: self.name, email: self.email },
      ],
      selfSynced: true,
    }));
  },

  registerPushToken: async (supabase, clerkUserId) => {
    const result = await getExpoPushToken();

    // Each of these leaves the column exactly as it was — better than writing
    // a null over a token another of this person's devices registered. They
    // are all ordinary outcomes, but they are not the same outcome, so each
    // one says which it was: a token that never appears in the database is
    // otherwise indistinguishable from a token that was never asked for.
    if (result.status === "unsupported") {
      console.warn("[appUsersStore] No push token: not a native build.");
      return;
    }
    if (result.status === "no-permission") {
      console.warn(
        `[appUsersStore] No push token for ${clerkUserId}: notification permission is "${result.permission}".`,
      );
      return;
    }
    if (result.status === "failed") {
      console.warn(`[appUsersStore] No push token for ${clerkUserId}: ${result.reason}`);
      return;
    }

    // An UPDATE rather than an upsert: `syncSelf` owns creating the row (and
    // its NOT NULL name/email), and this only ever runs once that has
    // happened. Permitted by the "app_users_update_self" policy, which is
    // row-level and places no restriction on which columns are written.
    //
    // Nothing in state changes — no screen reads the token, only the
    // database-side webhook does. The `select` is purely diagnostic: an
    // UPDATE that RLS filters out is not an error, it simply matches nothing,
    // so without counting the rows back a rejected write looks exactly like a
    // successful one.
    const { data, error } = await supabase
      .from("app_users")
      .update({ expo_push_token: result.token })
      .eq("clerk_user_id", clerkUserId)
      .select("clerk_user_id");

    if (error) {
      console.warn("[appUsersStore] Failed to register this device for push:", error);
      return;
    }
    if ((data ?? []).length === 0) {
      console.warn(
        `[appUsersStore] Push token not stored: the update matched no row for ${clerkUserId}. Either their app_users row is missing, or "app_users_update_self" rejected the write.`,
      );
      return;
    }

    console.log(`[appUsersStore] Push token registered for ${clerkUserId}.`);
  },
}));