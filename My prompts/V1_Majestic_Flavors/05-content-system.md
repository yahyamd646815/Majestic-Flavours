Read AGENTS.md first and follow it strictly.

## Task

Create the inventory content system using hardcoded TypeScript data, as the typed foundation the app will run on before Supabase is connected. This is data and types only — no UI, no screens, no state management changes.

Add the following files, all under `src/` to match the existing project structure (the `@/` import alias resolves to `src/*`):

**`src/types/inventory.ts`** — define:
- `InventoryItem`: `id`, `name`, `category`, `currentQuantity`, `unit`, `minThreshold`, `assignedEmployeeIds` (array of 2–3 strings), `createdAt`
- `Category`: `id`, `name` (e.g. Dairy, Meat, Vegetables, Dry Goods, Beverages, Cleaning Supplies)
- `Unit`: `id`, `label` (e.g. kg, lbs, liters, count, bags, boxes, bottles, crates)
- `Report`: `id`, `itemId`, `employeeId`, `content`, `date`, `isLocked`
- `AppUser`: `id`, `name`, `email`, `role`

Do **not** define a new role type here. `AppUser.role` must be typed using the existing `Role` type from `src/types/role.ts` (`import type { Role } from "@/types/role"`) — that type is already the app's single source of truth for roles (lowercase `"admin" | "manager" | "employee"`), wired into Clerk's `publicMetadata` and the auth guards built in prompt 04. Introducing a second, separately-defined role union here would create exactly the kind of casing/consistency bug prompt 04 spent a long time debugging.

**`src/data/categories.ts`** — hardcode the default restaurant categories: Dairy, Meat, Vegetables, Dry Goods, Beverages, Cleaning Supplies.

**`src/data/units.ts`** — hardcode the default unit options: kg, lbs, liters, count, bags, boxes, bottles, crates.

**`src/data/sampleUsers.ts`** — create 5–6 sample users: 1 admin, 2 managers, 3 employees. Realistic names and emails. `role` values must be lowercase (`"admin"`, `"manager"`, `"employee"`), matching the `Role` type — not capitalized.

**`src/data/sampleInventory.ts`** — create 10–12 sample inventory items spread across the categories. Each item needs realistic restaurant values for name, category, currentQuantity, unit, and minThreshold. Assign 2 sample employee IDs to each item, and those IDs **must reference actual employee entries from `sampleUsers.ts`** (the ones with `role: "employee"`) rather than arbitrary placeholder strings — later screens will look up assigned employees by ID, and a mismatch would make that lookup silently fail. Build `sampleUsers.ts` first (or in the same pass) so these IDs exist to reference.

## Constraints

- Types and hardcoded data only. No screens, no components, no store changes, no new dependencies.
- All new files live under `src/`, importable via the existing `@/` alias (e.g. `@/types/inventory`, `@/data/sampleInventory`).
- Strict TypeScript, no `any`.
- Keep the data simple and easy to extend later when Supabase replaces it (prompt 13) — this is scaffolding, not final schema.
- Run `npm run lint` and `npm run typecheck` before finishing. Fix all errors.

If anything about existing types or folder conventions is unclear, check the existing `src/types/role.ts` and `src/app/(app)/index.tsx` for the established patterns before inventing new ones.

## Reference

`AppUser.role` reuses `Role` from `src/types/role.ts` (built in prompt 04). Do not duplicate it. Category and unit lists should reflect what's already described in `AGENTS.md`'s Project Overview and Role-Based Access sections.