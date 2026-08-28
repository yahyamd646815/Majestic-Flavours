Read AGENTS.md first and follow it strictly.

## Task

Small, additive UI change — no store or type changes needed. Adds a category filter and search bar to the Employee Reports view, and a search bar to the Admin/Manager Inventory view (`src/app/(app)/inventory.tsx`, from prompt 09).

### 1. New shared component: `src/components/SearchBar.tsx`

A simple, reusable search input — a `TextInput` with a search icon (`@expo/vector-icons`), styled consistently with existing inputs (match `ItemFormModal`'s input `StyleSheet` — same border, radius, colors, font). Props: `value: string`, `onChangeText: (text: string) => void`, `placeholder: string`. Controlled component, no internal state — the parent owns the query string.

### 2. Employee Reports view (`EmployeeReportsView.tsx`)

Add, above the assigned-items list:
- **A search bar** (placeholder e.g. "Search your items") filtering by case-insensitive substring match against `item.name`.
- **Category filter chips**, reusing the existing `CategoryFilter` component from prompt 09 (`src/components/CategoryFilter.tsx`) — same chip look, same "All" option. Important: **use local `useState` for the selected category here, not `inventoryStore.selectedCategory`** — that field belongs to the Admin/Manager Inventory screen, and sharing it would cause the two screens' filters to interfere with each other.
- Derive the chip list from the categories actually represented in this employee's *own* assigned items only (deduplicated), not the full global category list — an employee assigned only to Dairy and Meat shouldn't see four empty category chips.
- Both filters apply together (AND): an item must match both the selected category (or no category selected) and the search text (or empty search) to appear in the list.

### 3. Admin/Manager Inventory view (`src/app/(app)/inventory.tsx`)

Add the same `SearchBar` component above the existing `CategoryFilter` row. Local `useState` for the query (search text doesn't need to persist across sessions, unlike the category filter, which already correctly persists via `inventoryStore.selectedCategory` — leave that behavior unchanged). Filters by case-insensitive substring match against `item.name`, applied together with the existing category filter (AND, same as above).

## Constraints

- No changes to any store, type, or the Report model.
- Reuse `CategoryFilter` and existing input styling — don't create a second, different-looking chip or input component.
- Strict TypeScript, no `any`.
- Run `npm run lint` and `npm run typecheck` before finishing. Fix all errors.
