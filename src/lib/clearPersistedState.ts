import { useInventoryStore } from "@/store/inventoryStore";
import { useReportStore } from "@/store/reportStore";

/**
 * Resets in-memory state AND wipes this app's persisted AsyncStorage keys,
 * so the next person to sign in on this device doesn't inherit the previous
 * user's cached data — even without closing and reopening the app.
 *
 * This is a local-device convenience, not real per-user data isolation —
 * that is Supabase + Row Level Security's job (prompt 13).
 *
 * Deliberately never throws: sign-out must always be able to proceed even if
 * clearing the local cache fails. A stale cache is a much smaller problem
 * than a user being stuck unable to sign out. Failures are logged so they're
 * visible during development.
 */
export async function clearPersistedState() {
  useInventoryStore.getState().reset();
  useReportStore.getState().reset();

  try {
    await useInventoryStore.persist.clearStorage();
  } catch (error) {
    console.error("[clearPersistedState] failed to clear inventory-storage:", error);
  }

  try {
    await useReportStore.persist.clearStorage();
  } catch (error) {
    console.error("[clearPersistedState] failed to clear report-storage:", error);
  }
}