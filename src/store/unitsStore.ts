import AsyncStorage from "@react-native-async-storage/async-storage";
import { create } from "zustand";
import { createJSONStorage, persist } from "zustand/middleware";

import { units as seedUnits } from "@/data/units";
import { slugify } from "@/lib/id";
import { useInventoryStore } from "@/store/inventoryStore";
import type { Unit } from "@/types/inventory";

type UnitsState = {
  units: Unit[];
  addUnit: (label: string) => boolean;
  isUnitInUse: (id: string) => boolean;
  deleteUnit: (id: string) => boolean;
  reset: () => void;
};

export const useUnitsStore = create<UnitsState>()(
  persist(
    (set, get) => ({
      units: seedUnits,
      addUnit: (label) => {
        const trimmedLabel = label.trim();
        if (trimmedLabel.length === 0) return false;

        const isDuplicate = get().units.some(
          (unit) => unit.label.toLowerCase() === trimmedLabel.toLowerCase(),
        );
        if (isDuplicate) return false;

        set((state) => ({
          units: [
            ...state.units,
            { id: slugify(trimmedLabel), label: trimmedLabel },
          ],
        }));
        return true;
      },
      // Items link to units by label, not id — item.unit stores the label
      // string (e.g. "kg"), so look the unit up first.
      isUnitInUse: (id) => {
        const unit = get().units.find((u) => u.id === id);
        if (!unit) return false;
        return useInventoryStore
          .getState()
          .items.some((item) => item.unit === unit.label);
      },
      deleteUnit: (id) => {
        if (get().isUnitInUse(id)) return false;

        const exists = get().units.some((unit) => unit.id === id);
        if (!exists) return false;

        set((state) => ({
          units: state.units.filter((unit) => unit.id !== id),
        }));
        return true;
      },
      reset: () => set({ units: seedUnits }),
    }),
    {
      name: "units-storage",
      storage: createJSONStorage(() => AsyncStorage),
    },
  ),
);
