import type { SupabaseClient } from "@supabase/supabase-js";
import { create } from "zustand";

import { generateId, slugify } from "@/lib/id";
import type { Category, InventoryItem } from "@/types/inventory";

/** Supabase returns snake_case rows whose shape isn't statically known, so the
 * raw row is typed loosely here and narrowed in one place. */
function mapDbItemToItem(row: Record<string, unknown>): InventoryItem {
  return {
    id: row.id as string,
    name: row.name as string,
    categoryId: row.category_id as string,
    currentQuantity: row.current_quantity as number,
    unitId: row.unit_id as string,
    minThreshold: row.min_threshold as number,
    assignedEmployeeIds: (row.assigned_employee_ids as string[]) ?? [],
    createdAt: row.created_at as string,
  };
}

/**
 * An in-memory cache of whatever Supabase last returned — not a second source
 * of truth. Deliberately not persisted: the database is authoritative now, and
 * an AsyncStorage copy would only drift away from it. `fetchAll` re-seeds this
 * once per signed-in session (see `useInventorySync`).
 */
type InventoryState = {
  items: InventoryItem[];
  categories: Category[];
  isLoading: boolean;
  error: string | null;
  selectedCategoryId: string | null;
  setSelectedCategoryId: (categoryId: string | null) => void;
  getLowStockItems: () => InventoryItem[];
  fetchAll: (supabase: SupabaseClient) => Promise<void>;
  addItem: (
    supabase: SupabaseClient,
    item: Omit<InventoryItem, "id" | "createdAt">,
  ) => Promise<boolean>;
  updateItem: (
    supabase: SupabaseClient,
    id: string,
    updates: Partial<Omit<InventoryItem, "id" | "createdAt">>,
  ) => Promise<boolean>;
  deleteItem: (supabase: SupabaseClient, id: string) => Promise<boolean>;
  addCategory: (supabase: SupabaseClient, name: string) => Promise<boolean>;
  isCategoryInUse: (categoryId: string) => boolean;
  deleteCategory: (supabase: SupabaseClient, id: string) => Promise<boolean>;
};

export const useInventoryStore = create<InventoryState>()((set, get) => ({
  items: [],
  categories: [],
  isLoading: true,
  error: null,
  selectedCategoryId: null,
  setSelectedCategoryId: (categoryId) => set({ selectedCategoryId: categoryId }),
  getLowStockItems: () =>
    get().items.filter((item) => item.currentQuantity <= item.minThreshold),

  fetchAll: async (supabase) => {
    set({ isLoading: true, error: null });
    const [itemsResult, categoriesResult] = await Promise.all([
      supabase.from("inventory_items").select("*"),
      supabase.from("categories").select("*"),
    ]);

    if (itemsResult.error || categoriesResult.error) {
      set({
        isLoading: false,
        error: "Could not load inventory. Check your connection and try again.",
      });
      return;
    }

    set({
      items: (itemsResult.data ?? []).map(mapDbItemToItem),
      categories: categoriesResult.data ?? [],
      isLoading: false,
      error: null,
    });
  },

  // Every mutation below updates local state from what Supabase actually
  // returned (via `.select().single()` after the write), not from the input
  // that was sent — the server, not a client guess, is the source of truth
  // for things like `createdAt`.
  addItem: async (supabase, item) => {
    const id = generateId("item");
    const { data, error } = await supabase
      .from("inventory_items")
      .insert({
        id,
        name: item.name,
        category_id: item.categoryId,
        current_quantity: item.currentQuantity,
        unit_id: item.unitId,
        min_threshold: item.minThreshold,
        assigned_employee_ids: item.assignedEmployeeIds,
      })
      .select()
      .single();

    if (error || !data) return false;
    set((state) => ({ items: [...state.items, mapDbItemToItem(data)] }));
    return true;
  },

  updateItem: async (supabase, id, updates) => {
    const dbUpdates: Record<string, unknown> = {};
    if (updates.name !== undefined) dbUpdates.name = updates.name;
    if (updates.categoryId !== undefined) dbUpdates.category_id = updates.categoryId;
    if (updates.currentQuantity !== undefined)
      dbUpdates.current_quantity = updates.currentQuantity;
    if (updates.unitId !== undefined) dbUpdates.unit_id = updates.unitId;
    if (updates.minThreshold !== undefined) dbUpdates.min_threshold = updates.minThreshold;
    if (updates.assignedEmployeeIds !== undefined)
      dbUpdates.assigned_employee_ids = updates.assignedEmployeeIds;

    const { data, error } = await supabase
      .from("inventory_items")
      .update(dbUpdates)
      .eq("id", id)
      .select()
      .single();

    if (error || !data) return false;
    set((state) => ({
      items: state.items.map((existing) =>
        existing.id === id ? mapDbItemToItem(data) : existing,
      ),
    }));
    return true;
  },

  deleteItem: async (supabase, id) => {
    const { error } = await supabase.from("inventory_items").delete().eq("id", id);
    if (error) return false;
    set((state) => ({ items: state.items.filter((item) => item.id !== id) }));
    return true;
  },

  addCategory: async (supabase, name) => {
    const trimmedName = name.trim();
    if (trimmedName.length === 0) return false;

    const isDuplicate = get().categories.some(
      (category) => category.name.toLowerCase() === trimmedName.toLowerCase(),
    );
    if (isDuplicate) return false;

    const slug = slugify(trimmedName);
    const idTaken = get().categories.some((category) => category.id === slug);
    const id = slug.length === 0 || idTaken ? generateId("category") : slug;

    const { data, error } = await supabase
      .from("categories")
      .insert({ id, name: trimmedName })
      .select()
      .single();

    if (error || !data) return false;
    set((state) => ({ categories: [...state.categories, data as Category] }));
    return true;
  },

  // Simpler than before — a direct id comparison, no name lookup needed.
  isCategoryInUse: (categoryId) =>
    get().items.some((item) => item.categoryId === categoryId),

  deleteCategory: async (supabase, id) => {
    if (get().isCategoryInUse(id)) return false;
    const { error } = await supabase.from("categories").delete().eq("id", id);
    if (error) return false;
    set((state) => ({
      categories: state.categories.filter((category) => category.id !== id),
    }));
    return true;
  },
}));
