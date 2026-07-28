Read AGENTS.md first and follow it strictly.

## Task

Implement the Inventory screen UI at `src/app/(app)/inventory.tsx` (currently a placeholder from prompt 07 — build the real screen there, keeping its existing role guard). Accessible to Admins and Managers only, matching the existing tab visibility rule.

### 1. Category filter chips

A horizontal scrollable row of chips: "All" first, then every category from `useInventoryStore().categories` — **do not hardcode the category list**. Categories are now dynamic (added/removed via Settings, prompt 12) and the filter row must reflect whatever currently exists in the store.

- Selected chip: filled **gold** background (`colors.gold` / the `gold` token), matching every other active-state element in the app so far.
- Unselected chips: muted/outlined.
- Tapping a chip calls `setSelectedCategory` on `inventoryStore` ("All" sets it to `null`).
- Create new `global.css` utilities for this, following the existing `@utility` BEM pattern (see `card`, `status-badge`, `btn-primary` for reference): something like `chip`, `chip--active`, `chip__text`, `chip__text--active`.

### 2. Inventory item list

A scrollable list of item cards, filtered by `selectedCategory` (show all items if `null`). Each card shows:
- Item name and category
- Current quantity and unit (e.g. "12 kg")
- A stock status badge — reuse the existing `status-badge`/`status-badge__text` variants: `--in-stock` (green, already exists in `global.css`, unused until now) for `currentQuantity > minThreshold`, `--low-stock` (amber) for `0 < currentQuantity <= minThreshold`, `--out-of-stock` (red) for `currentQuantity === 0`.
- Assigned employee names as small chips. Extract the name-lookup logic already written for the Dashboard (`getAssignedNames` in `index.tsx`) into a shared helper — e.g. `src/lib/getAssignedNames.ts` — and use it from both screens instead of duplicating it. This is exactly the "reused in multiple places" case AGENTS.md's `components/`/`lib/` guidance calls out.

If no items match the selected filter, show a friendly empty state.

### 3. Edit and Delete — Admin and Manager both see Edit; only Admin sees Delete

Per the updated AGENTS.md, Managers aren't restricted from editing item fields — only from deleting. So:
- **Edit button**: visible to both Admin and Manager. Opens the same Add/Edit form described below, pre-filled with the item's current values, calling `updateItem(id, updates)` on save.
- **Delete button**: visible to Admin only. Triggers the exact two-step confirmation flow from AGENTS.md's Delete Confirmation Rule — first popup "Are you sure you want to delete this?" (Confirm/Cancel), second popup "This action cannot be undone. Type DELETE to confirm." (only proceeds on an exact "DELETE" match). Do not skip or simplify this. Calls `deleteItem(id)` only after both steps pass.

If you believe Manager's edit rights should be narrower (e.g. category-reassignment only, not full field editing), stop and confirm before building — this prompt takes the broader reading since AGENTS.md doesn't explicitly restrict it.

### 4. Add Item — floating action button, bottom right

A floating action button (plus icon, `@expo/vector-icons`) in the bottom-right corner, using `position: "absolute"` positioning (standard NativeWind `absolute bottom-6 right-6` classes are fine) with a platform shadow — shadow syntax differs per platform, so use `StyleSheet`/inline styles for that specific piece per AGENTS.md's Style Exception Rules.

Tapping it opens the Add Item form as a **Modal** (per AGENTS.md's Style Exception Rules — Modal needs inline `visible`/`transparent` handling, not NativeWind className). The form is the same for Admin and Manager (Managers just never see Delete on existing cards — that's a card-level distinction, not a form-level one). Fields:
- Name (required, non-blank)
- Category — picker sourced from `inventoryStore.categories` (not hardcoded)
- Current quantity (required, non-negative number)
- Unit — picker sourced from `useUnitsStore().units` (not the static `@/data/units` file directly — units are mutable now too)
- Minimum threshold (required, non-negative number)
- Assigned employees — a multi-select picker listing users from `sampleUsers` where `role === "employee"`. Nothing in the store enforces a 2–3 count; keep the UI simple (a checklist is fine) and don't over-validate this.

Do simple form-level validation before calling `addItem`/`updateItem` (required name, valid non-negative numbers) — the store methods themselves don't validate, so the form needs to catch obviously-bad input before it gets there.

## Constraints

- Do not change tab navigation, other screens, or any store — this is UI only, wired to the store methods that already exist (`addItem`, `updateItem`, `deleteItem`, `categories`, `useUnitsStore().units`).
- Reuse existing `global.css` utilities (`card`, `status-badge` family) — only add new ones for chips and the FAB, following the same BEM pattern.
- Strict TypeScript, no `any`.
- Run `npm run lint` and `npm run typecheck` before finishing. Fix all errors.

## Reference

Employees still don't see this tab at all (unchanged from prompt 07) — their eventual "add/remove quantity" capability (per the updated AGENTS.md Employee role) is intentionally not addressed here; that's a decision for the prompt 10 rewrite, per prompt 08b's note.