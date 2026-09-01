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
    const token = await getExpoPushToken();
    // No permission, no push credentials, or the web build — all ordinary.
    // Leaving the column as it is beats writing a null over a token another
    // of this person's devices registered.
    if (!token) return;

    // An UPDATE rather than an upsert: `syncSelf` owns creating the row (and
    // its NOT NULL name/email), and this only ever runs once that has
    // happened. Permitted by the "app_users_update_self" policy, which is
    // row-level and places no restriction on which columns are written.
    //
    // Nothing in state changes — no screen reads the token, only the
    // database-side webhook does.
    const { error } = await supabase
      .from("app_users")
      .update({ expo_push_token: token })
      .eq("clerk_user_id", clerkUserId);

    if (error) {
      console.warn("[appUsersStore] Failed to register this device for push:", error);
    }
  },
}));