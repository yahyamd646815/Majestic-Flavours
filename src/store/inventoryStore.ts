import AsyncStorage from "@react-native-async-storage/async-storage";
import { create } from "zustand";
import { createJSONStorage, persist } from "zustand/middleware";

import { categories as seedCategories } from "@/data/categories";
import { sampleInventory } from "@/data/sampleInventory";
import type { Category, InventoryItem } from "@/types/inventory";

type InventoryState = {
  items: InventoryItem[];
  categories: Category[];
  selectedCategory: string | null;
  setSelectedCategory: (category: string | null) => void;
  getLowStockItems: () => InventoryItem[];
  reset: () => void;
};

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
      reset: () =>
        set({
          items: sampleInventory,
          categories: seedCategories,
          selectedCategory: null,
        }),
    }),
    {
      name: "inventory-storage",
      storage: createJSONStorage(() => AsyncStorage),
      partialize: (state): PersistedInventoryState => ({
        selectedCategory: state.selectedCategory,
      }),
    },
  ),
);