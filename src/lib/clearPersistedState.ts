import { useInventoryStore } from "@/store/inventoryStore";
import { useReportStore } from "@/store/reportStore";
import { useUnitsStore } from "@/store/unitsStore";

/**
 * Resets in-memory state AND wipes this app's persisted AsyncStorage keys,
 * returning every store to clean seed state.
 *
 * This is a development-only testing tool, used solely by DevClearStorageButton
 * (`__DEV__`-gated). It is deliberately NOT called on sign-out: inventory items,
 * categories, units and reports are real business data that must survive a
 * sign-out, and per-user data isolation is Supabase + Row Level Security's job
 * (prompt 13), not a local wipe's.
 *
 * Deliberately never throws — a store that fails to clear should not stop the
 * others from clearing. Failures are logged so they're visible during
 * development.
 */
export async function clearPersistedState() {
  useInventoryStore.getState().reset();
  useReportStore.getState().reset();
  useUnitsStore.getState().reset();

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

  try {
    await useUnitsStore.persist.clearStorage();
  } catch (error) {
    console.error("[clearPersistedState] failed to clear units-storage:", error);
  }
}
