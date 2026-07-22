Read AGENTS.md first and follow it strictly.

## Task

Implement the Dashboard screen UI at `src/app/(app)/index.tsx`. This is the first screen Admins and Managers see after signing in. It already exists as a placeholder with Sign Out + the dev clear-storage button — build the real UI around those, and keep the existing employee-redirect guard (`if (role === "employee") return <Redirect href="/reports" />`), the Sign Out button, and `<DevClearStorageButton />` intact.

The Dashboard should show:

### 1. Header
A greeting using the logged-in user's name and the current date.
- Get the user's name from **Clerk**, not from a store: `useUser()` → `user?.firstName` (fall back to `user?.fullName` or a generic "there" if unavailable). There is **no `userStore`** in this project — Clerk is the single source of truth for the current user, same as role (see prompt 06). Do not import or create one.
- Format the current date in a simple, readable way (e.g. "Tuesday, 22 July").

### 2. Summary row — three stat cards
Compute these from `useInventoryStore().items`, and define the three categories as **mutually exclusive** so the counts don't overlap:
- **Total Items** — count of all items.
- **Out of Stock** — count where `currentQuantity === 0`. Shown with the out-of-stock red (`#dc2626` / the `out-of-stock` token).
- **Low Stock** — count where `currentQuantity > 0 && currentQuantity <= minThreshold`. Shown with the low-stock amber (`#d97706` / the `low-stock` token).

Note the existing `getLowStockItems()` selector uses `<=` and therefore includes qty-0 items. For the Dashboard's *stat cards*, treat out-of-stock and low-stock as separate/non-overlapping per the definitions above so the numbers add up cleanly.

### 3. Low Stock Alerts section
Show a card for each item needing attention (both low AND out of stock — i.e. `currentQuantity <= minThreshold`, which is what `getLowStockItems()` already returns). Each card displays:
- Item name and category
- Current quantity and unit
- A colored stock badge: amber for low stock, red for out of stock (`currentQuantity === 0`)
- The names of the assigned employees.
  - The item only stores `assignedEmployeeIds` (e.g. `["user-4", "user-5"]`). To turn these into names, import `sampleUsers` from `@/data/sampleUsers` and map each ID to its `name`. This referential link is intentional (built in prompt 05). `inventoryStore` does not expose users, so import `sampleUsers` directly. If an ID has no match, skip it gracefully rather than showing a raw ID.

### 4. Empty state
If there are no low-stock or out-of-stock items, show a friendly empty state: a checkmark icon (use `@expo/vector-icons`, already installed) and the text "All items are well stocked."

## Styling

- Use the **existing utilities in `src/global.css`** — they already exist from prompt 02 and must be reused for visual consistency: `card`, `section-header` / `section-header__title`, and the `status-badge` family (`status-badge--low-stock`, `status-badge--out-of-stock`, and their matching `__text--*` variants). Do not invent new inline badge/card styles when these exist.
- Brand tokens come from `global.css` / the Tailwind theme (maroon headers, gold accents, cream card surfaces) — do not hardcode hex values in the component; use the token classes.
- Long content should scroll: the screen content lives in a `ScrollView` (use `contentContainerStyle` via `StyleSheet`, per AGENTS.md's Style Exception Rules).
- Keep it clean, card-based, and quick to scan on a phone. Large touch targets, clear spacing.

## Constraints

- Do not change the tab navigation, `_layout.tsx`, or any other screen.
- Preserve the existing `index.tsx` guard, Sign Out button, and `<DevClearStorageButton />`.
- Read the current user and role from Clerk (`useUser()` / `parseRole`), never from a store.
- No new dependencies (`@expo/vector-icons` is already present).
- Strict TypeScript, no `any`.
- Run `npm run lint` and `npm run typecheck` before finishing. Fix all errors.

## Reference

The sample data currently has no item at `currentQuantity: 0`, so the "Out of Stock" count and red badge won't appear during testing until one is set to 0 — that's a data note for testing, not something to change in this prompt. Dish Soap (`item-12`, qty 4) is the only current low-stock item, so expect exactly one alert card by default.