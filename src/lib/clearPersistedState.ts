import { useInventoryStore } from "@/store/inventoryStore";
import { useReportStore } from "@/store/reportStore";

/**
 * Resets in-memory state AND wipes this app's persisted AsyncStorage keys,
 * so the next person to sign in on this device doesn't inherit the previous
 * user's cached data — even without closing and reopening the app.
 *
 * This is a local-device convenience, not real per-user data isolation —
 * that is Supabase + Row Level Security's job (prompt 13).
 */
export async function clearPersistedState() {
  useInventoryStore.getState().reset();
  useReportStore.getState().reset();
  await useInventoryStore.persist.clearStorage();
  await useReportStore.persist.clearStorage();
}