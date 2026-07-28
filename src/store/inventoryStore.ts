import AsyncStorage from "@react-native-async-storage/async-storage";
import { create } from "zustand";
import { createJSONStorage, persist } from "zustand/middleware";

import { categories as seedCategories } from "@/data/categories";
import { sampleInventory } from "@/data/sampleInventory";
import { generateId, slugify } from "@/lib/id";
import type { Category, InventoryItem } from "@/types/inventory";

type InventoryState = {
  items: InventoryItem[];
  categories: Category[];
  selectedCategory: string | null;
  setSelectedCategory: (category: string | null) => void;
  getLowStockItems: () => InventoryItem[];
  addItem: (item: Omit<InventoryItem, "id" | "createdAt">) => void;
  updateItem: (
    id: string,
    updates: Partial<Omit<InventoryItem, "id" | "createdAt">>,
  ) => boolean;
  deleteItem: (id: string) => boolean;
  addCategory: (name: string) => boolean;
  isCategoryInUse: (id: string) => boolean;
  deleteCategory: (id: string) => boolean;
  reset: () => void;
};

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
      addItem: (item) =>
        set((state) => ({
          items: [
            ...state.items,
            {
              ...item,
              id: generateId("item"),
              createdAt: new Date().toISOString(),
            },
          ],
        })),
      updateItem: (id, updates) => {
        const exists = get().items.some((item) => item.id === id);
        if (!exists) return false;
        set((state) => ({
          items: state.items.map((item) =>
            item.id === id ? { ...item, ...updates } : item,
          ),
        }));
        return true;
      },
      deleteItem: (id) => {
        const exists = get().items.some((item) => item.id === id);
        if (!exists) return false;
        set((state) => ({
          items: state.items.filter((item) => item.id !== id),
        }));
        return true;
      },
      addCategory: (name) => {
        const trimmedName = name.trim();
        if (trimmedName.length === 0) return false;

        const isDuplicate = get().categories.some(
          (category) => category.name.toLowerCase() === trimmedName.toLowerCase(),
        );
        if (isDuplicate) return false;

        const slug = slugify(trimmedName);
        const idTaken = get().categories.some((category) => category.id === slug);
        const id = slug.length === 0 || idTaken ? generateId("category") : slug;

        set((state) => ({
          categories: [...state.categories, { id, name: trimmedName }],
        }));
        return true;
      },
      // Items link to categories by name, not id — item.category stores the
      // display name string (e.g. "Dairy"), so look the category up first.
      isCategoryInUse: (id) => {
        const category = get().categories.find((c) => c.id === id);
        if (!category) return false;
        return get().items.some((item) => item.category === category.name);
      },
      deleteCategory: (id) => {
        if (get().isCategoryInUse(id)) return false;

        const exists = get().categories.some((category) => category.id === id);
        if (!exists) return false;

        set((state) => ({
          categories: state.categories.filter((category) => category.id !== id),
        }));
        return true;
      },
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
    },
  ),
);
