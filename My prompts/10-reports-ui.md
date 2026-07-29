Read AGENTS.md first and follow it strictly.

## Task

Implement the Reports screen at `src/app/(app)/reports.tsx` (currently a placeholder — build the real screen there, keeping its existing Sign Out button and `<DevClearStorageButton />`). Accessible to all roles, behaving differently per role.

### 0. Resolving the current user against `sampleUsers` (do this first — everything else depends on it)

There is no real link yet between a signed-in Clerk account and the placeholder `sampleUsers` data. Bridge them by **email**:

```ts
const { user } = useUser();
const currentEmail = user?.primaryEmailAddress?.emailAddress;
const currentSampleUser = sampleUsers.find((u) => u.email === currentEmail);
```

Use `currentSampleUser?.id` wherever an employee's `sampleUsers`-style ID is needed (matching against `assignedEmployeeIds`, `report.employeeId`, etc.). If `currentSampleUser` is `undefined` (the signed-in Clerk account's email doesn't match any `sampleUsers` entry), show a simple message like "No matching employee profile found for this account" instead of crashing or silently showing nothing — this is expected to happen during testing until Clerk test accounts and `sampleUsers.ts` emails are aligned.

### 1. Employee view

- Show only items where `currentSampleUser.id` appears in `assignedEmployeeIds` (from `useInventoryStore().items`).
- For each assigned item, show a card with:
  - Item name, category, current quantity/unit
  - A quantity **stepper** (+/− buttons, not a raw text field — matches AGENTS.md's "large touch targets" guidance for staff using this on the floor) that calls `updateItem(itemId, { currentQuantity: newValue })` from `inventoryStore`. Don't allow it to go below 0.
  - A text input for that item's report content, for **today's date**.
- **One report per item per day:** look up whether a report already exists for `(itemId, currentSampleUser.id, today)` via `getReportsForItem`/`getReportsForEmployee` filtered to today's date. If one exists, pre-fill the input with its content and Submit calls `updateReport(id, content)`. If not, Submit calls `addReport({...})` with a freshly generated id, today's date, and `isLocked: false`.
- **Lock state is computed, not just read from `isLocked`.** Nothing currently flips `isLocked` to `true` automatically at midnight (that's prompt 15). So treat a report as locked for UI purposes if `report.isLocked || report.date !== todayIsoDate`. When locked: show the content read-only with a lock icon, hide the input and Submit button.

### 2. Admin / Manager view

- Filter bar with three filters:
  - **Date** — simple quick-filter chips: Today / This Week / All Time (no date-picker library — none is installed, and this avoids a new-dependency question).
  - **Employee** — picker sourced from `sampleUsers.filter(u => u.role === "employee")`.
  - **Category** — picker sourced from `inventoryStore.categories`.
- A scrollable list of all reports matching the active filters. Each card shows:
  - Date
  - Employee name — look up via `sampleUsers` by `report.employeeId`
  - Item name and category — look up via `inventoryStore.items` by `report.itemId`. **If the item was deleted** (prompt 09 makes this possible now), show a graceful fallback like "Deleted item" instead of blank/crashing.
  - Report content
  - A lock icon if the report is locked (same computed-lock logic as above: `report.isLocked || report.date !== todayIsoDate`)
- Two buttons top-right: **Export PDF** and **Export XLSX**. For now, both just call `Alert.alert("Coming soon", "Export will be available in a future update.")` — reuse `Alert`, already used in `DeleteConfirmModal`, rather than introducing a toast library.

### 3. Empty states

Friendly empty state if no reports match the current filters (Admin/Manager view), and if an Employee has no assigned items at all.

## Styling

Reuse existing `global.css` utilities (`card`, `chip`/`chip--active` for the filter chips, `status-badge` family if useful for report status). Only add new utilities if something genuinely doesn't exist yet, following the same BEM pattern.

## Constraints

- Do not change tab navigation or any other screen.
- Do not modify `reportStore.ts` or `inventoryStore.ts` — this prompt only calls existing methods (`addReport`, `updateReport`, `getReportsForItem`, `getReportsForEmployee`, `updateItem`).
- Read the current user from Clerk (`useUser()`), never from a store.
- Strict TypeScript, no `any`.
- Run `npm run lint` and `npm run typecheck` before finishing. Fix all errors.

## Reference

Before testing the Employee view, confirm at least one Clerk test account's email matches an entry in `src/data/sampleUsers.ts` (or add your own test email there) — otherwise `currentSampleUser` will be `undefined` for every test account and you'll only see the fallback message, not a real bug.