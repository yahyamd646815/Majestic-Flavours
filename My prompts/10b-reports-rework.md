Read AGENTS.md first and follow it strictly.

## Task

This reworks the Report model and both report views from prompt 10. Despite the "10b" name, this is a substantial rewrite, not a small patch — a report is no longer one row per item, it's one row per employee per day, covering every assigned item they touched.

### 1. New `Report` shape — `src/types/inventory.ts`

Replace the existing `Report` type:

```ts
export type ReportItemChange = {
  itemId: string;
  startQuantity: number;
  endQuantity: number;
};

export type Report = {
  id: string;
  employeeId: string;
  date: string; // YYYY-MM-DD
  content: string; // "" is valid — written content is optional
  itemChanges: ReportItemChange[];
  isLocked: boolean;
};
```

This removes the old singular `itemId` field. Nothing in `data/` seeds `Report` (it's runtime-only), so no seed files need changes — but any previously-persisted report data on a test device won't match this shape. Note this for testing (see Reference).

### 2. Rework `src/store/reportStore.ts`

Add a `dailyBaselines` map — a flat `Record<string, number>` keyed by `` `${employeeId}:${date}:${itemId}` ``, storing each item's quantity the first time it's touched on a given day. Persisted as part of this store's existing whole-state persistence (no `partialize` change needed — it already persists everything).

```ts
getOrCaptureBaseline: (employeeId: string, date: string, itemId: string, currentQuantity: number) => number
```
If a baseline already exists for that key, return it unchanged. Otherwise store `currentQuantity` as the baseline and return it. This must be called (from the UI, see below) *before* applying a quantity change, so the very first value captured is the true start-of-day quantity.

Replace `addReport`/`updateReport` with a single upsert action:
```ts
submitReport: (employeeId: string, date: string, content: string, changes: ReportItemChange[]) => string // returns the report id
```
- If a report already exists for `(employeeId, date)`: merge `changes` into its existing `itemChanges` (upsert by `itemId` — replace the entry if present, add it if not), and replace `content` with the newly given value. The caller always passes the *full current* set of changed items each time (not just deltas since last submit), so a plain overwrite-by-id merge is correct — no need to preserve old values here, `startQuantity` is already stable because it comes from `dailyBaselines`.
- If no report exists yet: create one with a fresh id (`generateId("report")`), `isLocked: false`.

Update `getReportsForItem(itemId)` to filter by `itemChanges.some(c => c.itemId === itemId)` instead of the old singular field — same signature, different internal check. `getReportsForEmployee(employeeId)` is unchanged conceptually.

Add:
```ts
getReportForEmployeeAndDate: (employeeId: string, date: string) => Report | undefined
```

Remove `addReport`/`updateReport` — nothing outside the (now-rewritten) Employee view calls them, and `submitReport` replaces both.

### 3. Employee view — `EmployeeReportsView.tsx` / `EmployeeReportCard.tsx`

- List all assigned items as before, each with the quantity stepper.
- **Before** calling `updateItem` on a stepper press, call `getOrCaptureBaseline(employeeId, today, item.id, item.currentQuantity)` — this must run before the quantity actually changes, so it captures the pre-change value.
- **One** text input for the day's optional written report (not per-item), pre-filled from `getReportForEmployeeAndDate(employeeId, today)?.content ?? ""`.
- One button: "Report" if no report exists yet today, "Update Report" if one does.
- On press, compute the changes array: for every assigned item, look up its baseline via `dailyBaselines[`${employeeId}:${today}:${item.id}`]`; if a baseline exists and differs from the item's current quantity, include `{itemId, startQuantity: baseline, endQuantity: currentQuantity}`. Items never touched today, or touched and returned to their original value, are excluded — only net changes are reported. Call `submitReport(employeeId, today, contentInputValue, changes)`, then show the confirmation popup (see below).
- Remove the old per-item Submit/Update button and per-item content field entirely.

### 4. Admin/Manager view — `ManagerReportsView.tsx` / `ReportCard.tsx`

- **"Today" filter:** list every employee (from `sampleUsers` filtered to `role === "employee"`). For each, look up `getReportForEmployeeAndDate(employee.id, today)`. Show "Report still being made" if none exists, or "Report made" if one does. Tapping a made report opens a detail view (a Modal, matching the existing `ItemFormModal`/`DeleteConfirmModal` pattern) showing: employee name, date, each `itemChanges` entry (item name — look up via `inventoryStore.items`, falling back to "Deleted item" as before — category, and the start→end quantity), and the written content (or "No written report" if empty).
- **"This Week" / "All Time" filters:** show the historical `Report` rows directly (each already represents one employee's one day) — no "still being made" framing for past days, since a day that's over either has a report or doesn't.
- Category filter: a report matches if any of its `itemChanges` references an item in that category.
- Employee filter: unchanged, filters by `report.employeeId`.
- Keep the existing lock icon logic (`isReportLocked`), applied at the report level.

### 5. Confirmation popup

A custom Modal (not a native `Alert` — three stacked language blocks read better with real layout control), shown after every successful `submitReport` call (both first submission and later updates). One OK button, closes the modal. Three stacked messages, English first, then Arabic and Urdu each with `style={{ writingDirection: "rtl" }}` (same pattern already used in `SplashScreen.tsx`):

- English: "Thank you for submitting your report. You can change it anytime until the day is over."
- Arabic: "شكراً لتقديم تقريرك. يمكنك تعديله في أي وقت حتى نهاية اليوم."
- Urdu: "آپ کی رپورٹ جمع کرنے کا شکریہ۔ آپ اسے دن ختم ہونے تک کسی بھی وقت تبدیل کر سکتے ہیں۔"

## Constraints

- Do not change how quantity edits reach `inventoryStore` — `updateItem` calls stay exactly as they are; only the baseline-capture step wraps around them.
- Employees still only ever see *today* — no past-report browsing for Employees (unchanged from prompt 10, deliberately deferred).
- Reuse existing `global.css` utilities and component patterns (`card`, `chip`, `status-badge`, Modal styling from `DeleteConfirmModal`/`ItemFormModal`) rather than inventing new ones where these already fit.
- Strict TypeScript, no `any`.
- Run `npm run lint` and `npm run typecheck` before finishing. Fix all errors.

## Reference

Before testing, use the `__DEV__` "Clear Persisted State" button to wipe any reports created under the old per-item shape — Zustand's persist rehydration doesn't migrate old data, and old-shaped rows won't have `itemChanges` or a valid `content` default, which could cause runtime errors when the new UI reads them.
