import type { SupabaseClient } from "@supabase/supabase-js";
import { create } from "zustand";

import { generateId, slugify } from "@/lib/id";
import { useInventoryStore } from "@/store/inventoryStore";
import type { Unit } from "@/types/inventory";

/** Same in-memory-cache contract as `inventoryStore` — see the note there.
 * The `units` table needs no snake_case translation: `id` / `label` map
 * straight across. */
type UnitsState = {
  units: Unit[];
  isLoading: boolean;
  error: string | null;
  fetchAll: (supabase: SupabaseClient) => Promise<void>;
  addUnit: (supabase: SupabaseClient, label: string) => Promise<boolean>;
  isUnitInUse: (unitId: string) => boolean;
  deleteUnit: (supabase: SupabaseClient, id: string) => Promise<boolean>;
};

export const useUnitsStore = create<UnitsState>()((set, get) => ({
  units: [],
  isLoading: true,
  error: null,

  fetchAll: async (supabase) => {
    set({ isLoading: true, error: null });
    const { data, error } = await supabase.from("units").select("*");

    if (error) {
      set({
        isLoading: false,
        error: "Could not load units. Check your connection and try again.",
      });
      return;
    }

    set({ units: (data ?? []) as Unit[], isLoading: false, error: null });
  },

  addUnit: async (supabase, label) => {
    const trimmedLabel = label.trim();
    if (trimmedLabel.length === 0) return false;

    const isDuplicate = get().units.some(
      (unit) => unit.label.toLowerCase() === trimmedLabel.toLowerCase(),
    );
    if (isDuplicate) return false;

    const slug = slugify(trimmedLabel);
    const idTaken = get().units.some((unit) => unit.id === slug);
    const id = slug.length === 0 || idTaken ? generateId("unit") : slug;

    const { data, error } = await supabase
      .from("units")
      .insert({ id, label: trimmedLabel })
      .select()
      .single();

    if (error || !data) return false;
    set((state) => ({ units: [...state.units, data as Unit] }));
    return true;
  },

  // A direct id comparison now that items carry `unitId`. Still a small
  // cross-store read, as before.
  isUnitInUse: (unitId) =>
    useInventoryStore.getState().items.some((item) => item.unitId === unitId),

  deleteUnit: async (supabase, id) => {
    if (get().isUnitInUse(id)) return false;
    const { error } = await supabase.from("units").delete().eq("id", id);
    if (error) return false;
    set((state) => ({ units: state.units.filter((unit) => unit.id !== id) }));
    return true;
  },
}));
