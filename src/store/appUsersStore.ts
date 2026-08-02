import type { SupabaseClient } from "@supabase/supabase-js";
import { create } from "zustand";

/** One row of `app_users` — the Clerk directory mirrored into Supabase so the
 * app can show a real name next to a real Clerk id. Role deliberately lives
 * only in Clerk (see AGENTS.md), so it is not part of this shape. */
export type SyncedUser = {
  clerkUserId: string;
  name: string;
  email: string;
};

/** Same in-memory-cache contract as `inventoryStore` — see the note there. */
type AppUsersState = {
  users: SyncedUser[];
  isLoading: boolean;
  error: string | null;
  fetchAll: (supabase: SupabaseClient) => Promise<void>;
  /** Upserts the current signed-in user's own row — call once per sign-in
   * so `app_users` grows organically as real people actually use the app. */
  syncSelf: (
    supabase: SupabaseClient,
    self: { clerkUserId: string; name: string; email: string },
  ) => Promise<void>;
};

export const useAppUsersStore = create<AppUsersState>()((set) => ({
  users: [],
  isLoading: true,
  error: null,

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

    // Reflect it locally too, without waiting for a full refetch.
    set((state) => ({
      users: [
        ...state.users.filter((user) => user.clerkUserId !== self.clerkUserId),
        { clerkUserId: self.clerkUserId, name: self.name, email: self.email },
      ],
    }));
  },
}));
