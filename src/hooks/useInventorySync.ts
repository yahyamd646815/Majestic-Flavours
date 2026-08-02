import { useEffect } from "react";

import { useSupabaseClient } from "@/lib/supabase";
import { useInventoryStore } from "@/store/inventoryStore";
import { useUnitsStore } from "@/store/unitsStore";

/**
 * Fills the inventory and units stores from Supabase once per signed-in
 * session. Both stores start empty and are pure in-memory caches now, so
 * without this nothing has any data to show.
 *
 * Called once, from the authenticated layout — screens read the stores and
 * re-run `fetchAll` themselves only on an explicit retry.
 */
export function useInventorySync(isSignedIn: boolean) {
  const supabase = useSupabaseClient();
  const fetchInventory = useInventoryStore((state) => state.fetchAll);
  const fetchUnits = useUnitsStore((state) => state.fetchAll);

  useEffect(() => {
    if (!isSignedIn) return;
    void fetchInventory(supabase);
    void fetchUnits(supabase);
  }, [isSignedIn, supabase, fetchInventory, fetchUnits]);
}
