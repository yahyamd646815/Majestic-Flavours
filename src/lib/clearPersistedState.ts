import { useInventoryStore } from "@/store/inventoryStore";
import { useReportStore } from "@/store/reportStore";

/**
 * Wipes this app's locally persisted Zustand state (inventory filter
 * preference, reports). Called on sign-out so the next person to sign in on
 * this device doesn't see the previous user's cached data, and available for
 * the dev-only "clear storage" testing button.
 *
 * This is a local-device convenience, not real per-user data isolation —
 * that is Supabase + Row Level Security's job (prompt 13). This just clears
 * the shared on-device cache between sessions.
 */
export function clearPersistedState() {
  useInventoryStore.persist.clearStorage();
  useReportStore.persist.clearStorage();
}
