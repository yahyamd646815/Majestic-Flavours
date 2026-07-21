Read AGENTS.md first and follow it strictly.

## Task

Integrate global app state using Zustand, with AsyncStorage persistence where it genuinely makes sense. This is state wiring only — preserve the existing UI exactly, no visible UI changes except the debug button described below.

Create the following stores in `src/store/`:

**`src/store/inventoryStore.ts`**
- `items`: `InventoryItem[]`, initialized from `sampleInventory` (from `@/data/sampleInventory`) — **not persisted**. This is seed data; it should always reflect the current contents of `sampleInventory.ts` on every app load, not a stale AsyncStorage snapshot from a previous session.
- `categories`: `Category[]`, initialized from `categories` (`@/data/categories`) — **not persisted**, same reasoning.
- `selectedCategory`: `string | null` — **persisted** with AsyncStorage. This is a genuine UI preference (which filter tab the user last had selected), safe and useful to remember across sessions.
- `setSelectedCategory(category: string | null)`: updates the filter.
- `getLowStockItems()`: returns items where `currentQuantity <= minThreshold`.

**`src/store/reportStore.ts`**
- `reports`: `Report[]` — **persisted** with AsyncStorage. Unlike inventory items, reports have no other source (no seed file) — this is real user-generated data and must survive app restarts.
- `addReport(report: Report)`: adds a new report.
- `updateReport(id: string, content: string)`: updates an existing report's content, but only if `isLocked` is `false`. No-op (or return a clear failure indication) if the report is locked.
- `getReportsForItem(itemId: string)`: returns all reports for a given item.
- `getReportsForEmployee(employeeId: string)`: returns all reports submitted by a given employee.

Do **not** create a `userStore`. The current user and their role are already available anywhere in the app via Clerk's `useUser()`/`useAuth()` hooks (established in prompt 04, `src/types/role.ts`'s `parseRole`). Adding a second, separately-persisted copy of "who's signed in" would risk it drifting out of sync with Clerk's actual session state — the single source of truth for identity and role must stay Clerk, not a Zustand store.

Use the existing types from `@/types/inventory` (built in prompt 05) for all of the above — do not redefine `InventoryItem`, `Category`, or `Report`.

## Constraints

- Install `zustand` and `@react-native-async-storage/async-storage` (both already named in `AGENTS.md`'s approved Tech Stack — no separate permission needed for these two specifically).
- Use Zustand's `persist` middleware for the two persisted fields described above. **Do not use the `devtools` middleware.** It relies on `import.meta`, which isn't supported by React Native's JS engine without an additional Babel polyfill this project doesn't have configured — it is unnecessary for two small local stores and would only add a class of bug not worth taking on right now.
- Each store that uses `persist` needs its own storage key (e.g. `"inventory-storage"`, `"report-storage"`) and must use `createJSONStorage(() => AsyncStorage)` from `zustand/middleware`.
- For `inventoryStore`, only persist `selectedCategory` via the `persist` middleware's `partialize` option — `items` and `categories` must NOT be included in the persisted subset, per the reasoning above.
- Add a debug button that clears persisted state for testing, gated behind `if (__DEV__)` so it can never appear in a production build. Place it on both `src/app/(app)/index.tsx` (Dashboard) and `src/app/(app)/reports.tsx` (Reports) placeholder screens, since each is the "home" screen for a different role. It should call each relevant store's own `.persist.clearStorage()` method (Zustand's built-in mechanism) rather than a blanket `AsyncStorage.clear()`, so it only clears this app's own persisted keys and doesn't touch anything else that might use AsyncStorage.
- Strict TypeScript, no `any`.
- Run `npm run lint` and `npm run typecheck` before finishing. Fix all errors.

## Reference

If you hit a crash on reload mentioning `import.meta` or an "unstable transform" Babel error, it means `devtools` middleware (or something else requiring it) got added despite the constraint above — remove it rather than adding a Babel config workaround.