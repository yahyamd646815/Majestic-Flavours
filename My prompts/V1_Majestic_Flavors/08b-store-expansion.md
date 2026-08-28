Read AGENTS.md first and follow it strictly.

## Task

Expand the state layer so prompts 09–12 have real store actions to build against, instead of read-only selectors. This prompt is state/logic only — no new screens, no UI changes beyond the one sign-out simplification described below.

### 1. Shared ID helpers

Create `src/lib/id.ts`:

```ts
/** Timestamp + random suffix — unique enough for local, single-device use. No new dependency. */
export function generateId(prefix: string): string {
  return `${prefix}-${Date.now()}-${Math.floor(Math.random() * 10000)}`;
}

/** Lowercase, hyphenated slug from a human-readable name (e.g. "Dry Goods" -> "dry-goods"). */
export function slugify(text: string): string {
  return text
    .trim()
    .toLowerCase()
    .replace(/[^a-z0-9]+/g, "-")
    .replace(/^-+|-+$/g, "");
}
```

Use `generateId("item")` for new inventory item IDs. Use `slugify(name)` for new category/unit IDs, matching the existing seed convention (`{ id: "dry-goods", name: "Dry Goods" }`).

### 2. Expand `src/store/inventoryStore.ts`

Add these actions, keeping everything already there (`items`, `categories`, `selectedCategory`, `setSelectedCategory`, `getLowStockItems`, `reset`):

- `addItem(item: Omit<InventoryItem, "id" | "createdAt">): void` — generates `id` via `generateId("item")` and `createdAt` via `new Date().toISOString()`, appends to `items`.
- `updateItem(id: string, updates: Partial<Omit<InventoryItem, "id" | "createdAt">>): boolean` — merges `updates` into the matching item (this is how category reassignment and quantity changes both happen — keep it generic, don't special-case any one field). Returns `false` if no item matches `id`, `true` on success.
- `deleteItem(id: string): boolean` — removes the item. Returns `false` if no item matched, `true` if removed.
- `addCategory(name: string): boolean` — trims `name`, rejects blank input, rejects a case-insensitive duplicate against existing category names (return `false`, don't add). Otherwise generates `id` via `slugify(name)`, appends `{ id, name: trimmedName }`, returns `true`.
- `isCategoryInUse(id: string): boolean` — true if any item's `category` field matches that category's `name`. **Important:** items link to categories by `name`, not `id` (existing data shape — `item.category` stores the display name string, e.g. `"Dairy"`, not a category id). Look the category up by `id` first, then compare its `name` against `item.category`.
- `deleteCategory(id: string): boolean` — if `isCategoryInUse(id)` is true, do nothing and return `false`. Otherwise remove it and return `true`.

**Persistence change:** remove the `partialize` option entirely and persist the whole state (matching `reportStore`'s existing pattern, which has no `partialize`). This is a deliberate reversal of the prompt-06 decision to exclude `items`/`categories` from persistence — that was correct when this store was read-only seed data, but now that real add/edit/delete exists, `items` and `categories` are genuine user-generated data and must survive a restart, the same as `reports`.

### 3. Create `src/store/unitsStore.ts`

Mirror the shape and conventions of `inventoryStore.ts`:

```ts
import AsyncStorage from "@react-native-async-storage/async-storage";
import { create } from "zustand";
import { createJSONStorage, persist } from "zustand/middleware";

import { units as seedUnits } from "@/data/units";
import { generateId as _unused, slugify } from "@/lib/id";
import { useInventoryStore } from "@/store/inventoryStore";
import type { Unit } from "@/types/inventory";
```

(Adjust imports as needed — the point is: don't hand-roll a different pattern, reuse `slugify` for new unit IDs.)

- `units: Unit[]` — seeded from `@/data/units`.
- `addUnit(label: string): boolean` — same validation shape as `addCategory`: trim, reject blank, reject case-insensitive duplicate against existing `label`s, otherwise `id: slugify(label)`, `label: trimmedLabel`, returns `true`.
- `isUnitInUse(id: string): boolean` — true if any inventory item's `unit` field matches this unit's `label` (same name-based linkage as categories — items store `unit` as the label string, e.g. `"kg"`). This needs to read `useInventoryStore.getState().items` — a small cross-store read, which is fine and already has precedent (`clearPersistedState.ts` already imports both stores).
- `deleteUnit(id: string): boolean` — if `isUnitInUse(id)` is true, return `false` without deleting. Otherwise remove and return `true`.
- `reset(): void` — resets `units` back to the seed data.
- Persist the whole state (no `partialize` needed — same reasoning as inventoryStore).

### 4. Fix the sign-out data wipe (important — this is a real bug fix, not a style choice)

`src/lib/clearPersistedState.ts` is currently called on every sign-out (added in prompt 06b, to stop test data bleeding between accounts during local testing). Now that `reports`, inventory `items`, and `categories`/`units` represent real, meant-to-persist data — Admins/Managers need to keep seeing submitted reports and inventory edits across sessions — wiping all of it on every sign-out would silently delete real business data every time anyone signs out. That's no longer acceptable.

- **Remove the automatic wipe on sign-out.** In `src/app/(app)/index.tsx` and `src/app/(app)/reports.tsx`, simplify the Sign Out button's `onPress` back to just calling `signOut()` directly — remove the `clearPersistedState()` call and the wrapping async IIFE, since it's no longer needed there:
  ```tsx
  onPress={() => void signOut()}
  ```
- **Keep the manual dev-only reset exactly as it is.** `DevClearStorageButton` still calls `clearPersistedState()`, gated by `__DEV__` — that's still a legitimate "wipe everything back to clean seed state for testing" tool, and update `clearPersistedState.ts` to also reset and clear the new `unitsStore` alongside the existing two, so the dev button wipes all three stores consistently.

## Constraints

- No new screens, no visible UI changes other than the simplified sign-out `onPress` in the two files above.
- Strict TypeScript, no `any`.
- Follow the existing `reportStore`/`inventoryStore` patterns exactly (boolean returns for actions that can meaningfully fail, void/no return where nothing can fail).
- No new dependencies — `generateId`/`slugify` are intentionally hand-rolled to avoid adding a UUID library.
- Run `npm run lint` and `npm run typecheck` before finishing. Fix all errors.

## Reference

This directly unblocks prompts 09–12, which all currently assume mutation actions and persistence that don't exist yet: `addItem`/`updateItem`/`deleteItem`/`addCategory`/`deleteCategory` for prompt 09 (Inventory UI) and part of prompt 12 (Settings → Categories), and `unitsStore` for prompt 12 (Settings → Units).

One thing intentionally left open here: the new AGENTS.md Employee role description includes "add or remove quantity on inventory items," but Employees currently have no screen that could host that control (the Inventory tab is Admin/Manager-only). `updateItem`'s generic `Partial<...>` signature already supports a quantity-only update, so the store side is ready — but *where* that control lives in the UI (a cut-down Inventory view for Employees, or inline in the Reports screen) is a decision for the prompt 09/10 rewrite, not this one.
