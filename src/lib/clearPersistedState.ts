import { useReportStore } from "@/store/reportStore";

/**
 * Resets in-memory state AND wipes this app's persisted AsyncStorage keys.
 *
 * This is a development-only testing tool, used solely by DevClearStorageButton
 * (`__DEV__`-gated). It is deliberately NOT called on sign-out: reports are real
 * business data that must survive a sign-out, and per-user data isolation is
 * Supabase + Row Level Security's job, not a local wipe's.
 *
 * `reportStore` is all that is left here. `inventoryStore` and `unitsStore`
 * moved to Supabase in 13b — they no longer persist anything locally, so there
 * is nothing for this to clear. Once `reportStore` migrates in 13c, this whole
 * button needs rethinking: there will be no local state left to wipe, and
 * "clear everything" would have to mean deleting real rows from the database.
 *
 * Deliberately never throws — failures are logged so they're visible during
 * development.
 */
export async function clearPersistedState() {
  useReportStore.getState().reset();

  try {
    await useReportStore.persist.clearStorage();
  } catch (error) {
    console.error("[clearPersistedState] failed to clear report-storage:", error);
  }
}
