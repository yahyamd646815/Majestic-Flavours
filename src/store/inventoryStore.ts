import type { SupabaseClient } from "@supabase/supabase-js";
import { create } from "zustand";

import { generateId, slugify } from "@/lib/id";
import { getEffectiveStatus, type StockStatus } from "@/lib/stockStatus";
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
    statusOverride: (row.status_override as StockStatus | null) ?? null,
    createdAt: row.created_at as string,
  };
}

/**
 * An in-memory cache of whatever Supabase last returned — not a second source
 * of truth. Deliberately not persisted: the database is authoritative now, and
 * an AsyncStorage copy would only drift away from it. `fetchAll` re-seeds this
 * once per signed-in session (see `useSupabaseSync`).
 */
type InventoryState = {
  items: InventoryItem[];
  categories: Category[];
  isLoading: boolean;
  error: string | null;
  /** Empty set means the filter dimension is inactive — matches every item,
   * not none. See `toggleCategoryId`/`toggleEmployeeId`. */
  selectedCategoryIds: Set<string>;
  toggleCategoryId: (categoryId: string) => void;
  clearCategoryIds: () => void;
  /** Same empty-set-means-inactive contract as `selectedCategoryIds`. May
   * also contain `UNASSIGNED_EMPLOYEE_FILTER` (see `EmployeeFilter`) as an
   * ordinary member, but matching is not a plain OR once it's mixed with a
   * real id — see `matchesEmployeeFilter` in `@/lib/inventoryFilters`. */
  selectedEmployeeIds: Set<string>;
  toggleEmployeeId: (employeeId: string) => void;
  clearEmployeeIds: () => void;
  getLowStockItems: () => InventoryItem[];
  fetchAll: (supabase: SupabaseClient) => Promise<void>;
  /** `statusOverride` is excluded for the same reason `assignedEmployeeIds`
   * is excluded from `updateItem`: nothing outside a report ping may set it.
   * A new row simply gets `NULL` from the database. */
  addItem: (
    supabase: SupabaseClient,
    item: Omit<InventoryItem, "id" | "createdAt" | "statusOverride">,
  ) => Promise<boolean>;
  updateItem: (
    supabase: SupabaseClient,
    id: string,
    updates: Partial<Omit<InventoryItem, "id" | "createdAt" | "assignedEmployeeIds">>,
  ) => Promise<boolean>;
  deleteItem: (supabase: SupabaseClient, id: string) => Promise<boolean>;
  addEmployeeToItem: (
    supabase: SupabaseClient,
    itemId: string,
    employeeId: string,
  ) => Promise<boolean>;
  removeEmployeeFromItem: (
    supabase: SupabaseClient,
    itemId: string,
    employeeId: string,
  ) => Promise<boolean>;
  addCategory: (supabase: SupabaseClient, name: string) => Promise<boolean>;
  isCategoryInUse: (categoryId: string) => boolean;
  deleteCategory: (supabase: SupabaseClient, id: string) => Promise<boolean>;
};

export const useInventoryStore = create<InventoryState>()((set, get) => ({
  items: [],
  categories: [],
  isLoading: true,
  error: null,
  selectedCategoryIds: new Set(),
  toggleCategoryId: (categoryId) =>
    set((state) => {
      const next = new Set(state.selectedCategoryIds);
      if (next.has(categoryId)) next.delete(categoryId);
      else next.add(categoryId);
      return { selectedCategoryIds: next };
    }),
  clearCategoryIds: () => set({ selectedCategoryIds: new Set() }),
  selectedEmployeeIds: new Set(),
  toggleEmployeeId: (employeeId) =>
    set((state) => {
      const next = new Set(state.selectedEmployeeIds);
      if (next.has(employeeId)) next.delete(employeeId);
      else next.add(employeeId);
      return { selectedEmployeeIds: next };
    }),
  clearEmployeeIds: () => set({ selectedEmployeeIds: new Set() }),
  getLowStockItems: () =>
    get().items.filter((item) => getEffectiveStatus(item) !== "in_stock"),

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

    // A quantity change clears a manual override — UNLESS this same call is
    // also explicitly setting a new one, in which case the explicit value
    // wins. Folding both into one `status_override` decision (rather than
    // writing the clear and the ping as two sequential updates) is what makes
    // a same-submission "changed the quantity AND pinged a status" survive:
    // as two writes, whichever landed second would silently win. This
    // composes correctly for all three real cases — quantity-only clears it,
    // ping-only sets it without touching quantity, and a combined
    // quantity+ping update keeps the pinged value.
    const effectiveStatusOverride =
      updates.currentQuantity !== undefined && updates.statusOverride === undefined
        ? null
        : updates.statusOverride;
    if (effectiveStatusOverride !== undefined)
      dbUpdates.status_override = effectiveStatusOverride;

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

  // These two go through atomic RPCs rather than a client-computed full-array
  // overwrite (see supabase-rpc-employee-assignment-v2.sql) — the database
  // reads and writes assigned_employee_ids in the same statement, so two
  // concurrent callers can't silently drop each other's change. The RPCs
  // return the updated row via RETURNING *, so local state is synced from
  // what the database actually wrote rather than an optimistic guess.
  addEmployeeToItem: async (supabase, itemId, employeeId) => {
    const { data, error } = await supabase.rpc("add_employee_to_item", {
      p_item_id: itemId,
      p_employee_id: employeeId,
    });
    // A row-returning RPC comes back as an array. Empty means RLS or a
    // missing id silently matched nothing — treat that as failure too, not
    // just an explicit error, since the write genuinely didn't happen.
    if (error || !data || data.length === 0) return false;

    const updatedItem = mapDbItemToItem(data[0]);
    set((state) => ({
      items: state.items.map((item) => (item.id === itemId ? updatedItem : item)),
    }));
    return true;
  },

  removeEmployeeFromItem: async (supabase, itemId, employeeId) => {
    const { data, error } = await supabase.rpc("remove_employee_from_item", {
      p_item_id: itemId,
      p_employee_id: employeeId,
    });
    if (error || !data || data.length === 0) return false;

    const updatedItem = mapDbItemToItem(data[0]);
    set((state) => ({
      items: state.items.map((item) => (item.id === itemId ? updatedItem : item)),
    }));
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
