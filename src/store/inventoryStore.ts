import AsyncStorage from "@react-native-async-storage/async-storage";
import { create } from "zustand";
import { createJSONStorage, persist } from "zustand/middleware";

import { categories as seedCategories } from "@/data/categories";
import { sampleInventory } from "@/data/sampleInventory";
import type { Category, InventoryItem } from "@/types/inventory";

type InventoryState = {
  /** Seeded from `sampleInventory` on every load — never persisted. */
  items: InventoryItem[];
  /** Seeded from `categories` on every load — never persisted. */
  categories: Category[];
  /** Which category filter tab the user last selected. Persisted. */
  selectedCategory: string | null;
  setSelectedCategory: (category: string | null) => void;
  /** Items at or below their minimum threshold. */
  getLowStockItems: () => InventoryItem[];
};

/** Only the user's filter preference survives a restart — see AGENTS.md. */
type PersistedInventoryState = Pick<InventoryState, "selectedCategory">;

export const useInventoryStore = create<InventoryState>()(
  persist(
    (set, get) => ({
      items: sampleInventory,
      categories: seedCategories,
      selectedCategory: null,
      setSelectedCategory: (category) => set({ selectedCategory: category }),
      getLowStockItems: () =>
        get().items.filter(
          (item) => item.currentQuantity <= item.minThreshold,
        ),
    }),
    {
      name: "inventory-storage",
      storage: createJSONStorage(() => AsyncStorage),
      // Persist ONLY the filter preference. `items` and `categories` are seed
      // data and must always reflect the current source files, not a stale
      // snapshot from a previous session.
      partialize: (state): PersistedInventoryState => ({
        selectedCategory: state.selectedCategory,
      }),
    },
  ),
);
