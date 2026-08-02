Read AGENTS.md first and follow it strictly.

## Task

Migrate `inventoryStore` and `unitsStore` from local seed data to real Supabase reads/writes. This is a large prompt — read all of it before starting. Two things happen together here because they're tightly coupled: the Supabase migration itself, and finally fixing the category/unit linkage to use real IDs instead of display-name strings (flagged as a known simplification back in prompt 05, deferred until the schema existed to support it — it does now).

### 1. Type changes — `src/types/inventory.ts`

```ts
export type InventoryItem = {
  id: string;
  name: string;
  categoryId: string; // was `category: string` (a name) — now a real id
  currentQuantity: number;
  unitId: string; // was `unit: string` (a label) — now a real id
  minThreshold: number;
  assignedEmployeeIds: string[];
  createdAt: string;
};
```
`Category` and `Unit` stay as they are (`{id, name}` / `{id, label}`).

### 2. Rewrite `src/store/inventoryStore.ts`

No `persist` middleware anymore — Supabase is the real source of truth now, so a local AsyncStorage copy would just be a second, driftable copy of the same data. The store becomes a plain in-memory cache of "whatever Supabase last returned," refetched each session.

```ts
import { create } from "zustand";
import type { SupabaseClient } from "@supabase/supabase-js";

import { generateId, slugify } from "@/lib/id";
import type { Category, InventoryItem } from "@/types/inventory";

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
    if (updates.currentQuantity !== undefined) dbUpdates.current_quantity = updates.currentQuantity;
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
    set((state) => ({ categories: state.categories.filter((category) => category.id !== id) }));
    return true;
  },
}));
```

### 3. Rewrite `src/store/unitsStore.ts` — the same pattern, for `units`

Same shape: `units`, `isLoading`, `error`, `fetchAll(supabase)`, `addUnit(supabase, label)`, `isUnitInUse(unitId)` (now a direct `item.unitId === unitId` comparison, same simplification as categories), `deleteUnit(supabase, id)`. No `persist`, no `reset`. Map `label` the same straightforward way (`units` table has no snake_case fields to translate — `id`/`label` match directly).

### 4. New sync hook, called once from `src/app/(app)/_layout.tsx`

```ts
const supabase = useSupabaseClient();
const fetchInventory = useInventoryStore((state) => state.fetchAll);
const fetchUnits = useUnitsStore((state) => state.fetchAll);

useEffect(() => {
  if (!isSignedIn) return;
  void fetchInventory(supabase);
  void fetchUnits(supabase);
}, [isSignedIn, supabase, fetchInventory, fetchUnits]);
```
Place this alongside the existing guard logic and `DraftReportProvider` — after the existing `isLoaded`/`isSignedIn` checks, so it only ever runs for a genuinely signed-in session.

### 5. Shared loading/error UI — `src/components/LoadingState.tsx` and `src/components/ErrorState.tsx`

Small, reusable: `LoadingState` is a centered `ActivityIndicator` with brief text ("Loading inventory..."). `ErrorState` takes `message: string` and `onRetry: () => void`, shows the message and a retry button. Every screen reading `items`/`categories`/`units` (Dashboard, Inventory, Settings) should show `LoadingState` when `isLoading && items.length === 0`, and `ErrorState` when `error` is set — calling `fetchAll(supabase)` again on retry. Each of those screens needs its own `const supabase = useSupabaseClient();` to pass into `fetchAll`/mutations.

### 6. The category/unit ID-linkage fix — update every site that currently uses the old name-based fields

Search for every place reading `.category`/`.unit` off an `InventoryItem`, or comparing against a category/unit **name/label string**, and update to the id-based equivalent. This list is a starting checklist, not exhaustive — search broadly, since a missed site would show wrong or blank category/unit text rather than crash, which is easy to overlook:

- **Display sites** (Dashboard, `InventoryCard.tsx`, `ReportCard.tsx`, `ReportDetailModal.tsx`): replace `item.category` / `item.unit` text with a lookup — `categories.find(c => c.id === item.categoryId)?.name ?? "Unknown category"`, same pattern for units. These components need access to the `categories`/`units` lists now, not just the item.
- **`ItemFormModal.tsx`**: the category and unit pickers should set `categoryId: c.id` / `unitId: u.id`, not the name/label.
- **`CategoryFilter.tsx` / `inventoryStore.selectedCategory`**: rename to `selectedCategoryId` throughout; filter comparisons become `item.categoryId === selectedCategoryId`.
- **`src/app/(app)/inventory.tsx`**: same filter-comparison update, plus its search/category combination logic.
- **`src/lib/reports.ts`**: `reportMatchesCategory` compares `item.categoryId === categoryId` (rename the parameter for clarity too).
- **`ManagerReportsView.tsx` / `ReportFilters.tsx`**: category filter chips and comparisons become id-based.
- **`ReportEntryView.tsx`**: its dynamically-derived category-chip list (previously faking `{id: item.category, name: item.category}` because there was no real id) can now properly resolve real `{id, name}` pairs from `inventoryStore.categories` for whichever items are in scope.

### 7. `DevClearStorageButton` / `clearPersistedState.ts`

Remove `inventoryStore`/`unitsStore` from what this clears — there's no local persisted state left in either store to clear (no `persist`, no `reset`). Leave `reportStore` as the only thing it still touches for now — that migrates in 13c, at which point this button's whole purpose will need revisiting (flagging now, not solving yet).

## Constraints

- Don't touch `reportStore.ts` — that's 13c.
- Old sample data files (`sampleInventory.ts`, `categories.ts`, `units.ts`) become unused by this change — leave them in place for now rather than deleting; that's a cleanup pass once 13c is also done.
- Strict TypeScript, no `any` (the `Record<string, unknown>` casts in the mapping functions above are the deliberate, narrow exception — Supabase's raw row shape genuinely isn't statically known).
- Run `npm run lint` and `npm run typecheck` before finishing. Fix all errors.

## Reference

Test with the one manually-inserted `categories` row already sitting in Supabase from the 13a verification — it should now actually appear in the app's category list and filter chips, proving the fetch path works end to end. Add a couple of real inventory items through the Add Item form afterward to confirm the write path too.
