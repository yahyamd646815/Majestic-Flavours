import type { SupabaseClient } from "@supabase/supabase-js";
import { create } from "zustand";

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
}));