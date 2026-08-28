Read AGENTS.md first and follow it strictly.

## Task

This replaces an earlier draft of this prompt — a few requirements changed before it was ever run, and they touch the same mechanisms, so this is the complete, current version. Read all of it before starting.

### 1. Type changes — `src/types/inventory.ts`

Replace `ReportItemChange` and `Report`:

```ts
export type ReportItemSnapshot = {
  quantity: number;
  recordedAt: string; // ISO timestamp
};

/** One item touched in a report: its optional note, and its chronological,
 * append-only quantity history. */
export type ReportItemEntry = {
  itemId: string;
  snapshots: ReportItemSnapshot[];
  note: string; // "" = no note. Independent of quantity.
};

/** One report per person per calendar day. `reporterId` — not `employeeId`
 * — because Admin and Manager can now also own a report (self-reporting via
 * "+Make a report"). */
export type Report = {
  id: string;
  reporterId: string;
  date: string;
  content: string;
  itemEntries: ReportItemEntry[];
  isLocked: boolean;
};
```

### 2. Rework `src/store/reportStore.ts`

**Remove `dailyBaselines`, `getOrCaptureBaseline`, and `baselineKey` entirely.** They're now unnecessary: quantities are only ever written to `inventoryStore` at submit time (see step 4), so `item.currentQuantity` is always the correct "before" value to compare a draft against — no separate baseline-tracking is needed anymore. Update `reset()` to no longer reference `dailyBaselines`.

Rename `getReportForEmployeeAndDate` → `getReportForReporterAndDate`, `getReportsForEmployee` → `getReportsForReporter`. Update `getReportsForItem` to check `itemEntries.some(e => e.itemId === itemId)`.

Replace `submitReport`:

```ts
export type ItemSubmission = {
  itemId: string;
  /** Present only if this item's quantity is being recorded now. */
  newSnapshotQuantity?: number;
  /** Present only if this item's note was added or edited. Can be "" to
   * explicitly clear an existing note. */
  note?: string;
};

submitReport: (
  reporterId: string,
  date: string,
  content: string,
  itemSubmissions: ItemSubmission[],
) => string | null;
```

```ts
submitReport: (reporterId, date, content, itemSubmissions) => {
  if (date !== getTodayIsoDate()) {
    console.warn("[reportStore] Refusing to submit a report for a non-today date:", date);
    return null;
  }

  const existing = get().reports.find(
    (report) => report.reporterId === reporterId && report.date === date,
  );

  if (existing?.isLocked) {
    console.warn("[reportStore] Refusing to modify a locked report:", existing.id);
    return null;
  }

  const now = new Date().toISOString();

  function applySubmissions(entries: ReportItemEntry[]): ReportItemEntry[] {
    const next = entries.map((entry) => ({ ...entry, snapshots: [...entry.snapshots] }));
    for (const submission of itemSubmissions) {
      let entry = next.find((e) => e.itemId === submission.itemId);
      if (!entry) {
        entry = { itemId: submission.itemId, snapshots: [], note: "" };
        next.push(entry);
      }
      if (submission.newSnapshotQuantity !== undefined) {
        entry.snapshots.push({ quantity: submission.newSnapshotQuantity, recordedAt: now });
      }
      if (submission.note !== undefined) {
        entry.note = submission.note;
      }
    }
    return next;
  }

  if (existing) {
    const itemEntries = applySubmissions(existing.itemEntries);
    set((state) => ({
      reports: state.reports.map((report) =>
        report.id === existing.id ? { ...report, content, itemEntries } : report,
      ),
    }));
    return existing.id;
  }

  const id = generateId("report");
  set((state) => ({
    reports: [
      ...state.reports,
      { id, reporterId, date, content, itemEntries: applySubmissions([]), isLocked: false },
    ],
  }));
  return id;
},
```

### 3. New shared draft state — `src/context/DraftReportContext.tsx`

Session-only (no AsyncStorage persistence — losing unsubmitted drafts on a crash/restart is an accepted trade-off, since committing to inventory now only happens at submit time). Provided once, above both the Reports and Settings screens (wrap it around `<Tabs>` in `src/app/(app)/_layout.tsx`), since both need it — Reports writes to it, Settings reads it to decide whether to warn before sign-out.

```ts
type DraftReportContextValue = {
  draftQuantities: Record<string, number>; // itemId -> draft quantity
  draftNotes: Record<string, string>; // itemId -> draft note
  hasUnsavedChanges: boolean;
  setDraftQuantity: (itemId: string, quantity: number) => void;
  setDraftNote: (itemId: string, note: string) => void;
  clearDrafts: () => void;
};
```

`hasUnsavedChanges` is simply `true` whenever either map is non-empty — don't try to net out changes that return to their original value here, that diffing already happens correctly at submit time in step 4; this context only needs to answer "has anything been locally touched since the last submit or clear."

### 4. Generalize the Employee report screen into a shared component

Rename `EmployeeReportsView` → `ReportEntryView` (`src/components/ReportEntryView.tsx`), taking `reporterId: string` and `items: InventoryItem[]` — the caller decides which items (assigned-only for Employee, all items for Admin/Manager self-reporting).

**Steppers are draft-only now — they must not call `updateItem`.**

```ts
const { draftQuantities, draftNotes, setDraftQuantity, setDraftNote, clearDrafts } = useDraftReport();

function getDisplayQuantity(item: InventoryItem): number {
  return draftQuantities[item.id] ?? item.currentQuantity;
}

function handleQuantityChange(item: InventoryItem, nextQuantity: number) {
  setDraftQuantity(item.id, Math.max(0, nextQuantity));
}
```

**Submitting is the one moment both `reportStore` and `inventoryStore` actually get written:**

```ts
function handleSubmit() {
  const itemSubmissions: ItemSubmission[] = [];

  for (const item of items) {
    const draftQuantity = draftQuantities[item.id];
    const quantityChanged = draftQuantity !== undefined && draftQuantity !== item.currentQuantity;

    const draftNote = draftNotes[item.id];
    const existingNote = todaysReport?.itemEntries.find((e) => e.itemId === item.id)?.note ?? "";
    const noteChanged = draftNote !== undefined && draftNote !== existingNote;

    if (!quantityChanged && !noteChanged) continue;

    itemSubmissions.push({
      itemId: item.id,
      ...(quantityChanged ? { newSnapshotQuantity: draftQuantity } : {}),
      ...(noteChanged ? { note: draftNote } : {}),
    });
  }

  const result = submitReport(reporterId, todayIsoDate, dayContent.trim(), itemSubmissions);
  if (result === null) {
    Alert.alert("Report could not be saved", "It looks like the day has changed. Please reopen the app and try again.");
    return;
  }

  // Only now do the actual quantities land in inventoryStore.
  for (const submission of itemSubmissions) {
    if (submission.newSnapshotQuantity !== undefined) {
      updateItem(submission.itemId, { currentQuantity: submission.newSnapshotQuantity });
    }
  }

  clearDrafts();
  setShowConfirmation(true);
}
```

Quantity and note are evaluated independently — an item can be submitted for a note alone, a quantity change alone, or both. Don't conflate them into one combined check.

**Sticky footer:** the day-level note input moves to `ListHeaderComponent` (top of the scrollable list). A compact sticky element renders as a sibling *after* the FlatList (not inside it — give the FlatList `style={{ flex: 1 }}`, let this sibling take its natural height). It shows a brief status line reflecting *pending draft* changes (e.g. from `Object.keys(draftQuantities).length`, not the day's full submitted history) and the Report/Update Report button.

**Per-item card:** show the item's snapshot history when non-empty (compact, e.g. "12 → 14 → 11" with times available via `formatSnapshotTime`, added to `src/lib/reports.ts`), and a collapsed-by-default, tap-to-expand note field — not permanently visible on every card, given lists can run to 200+ items.

### 5. Admin/Manager self-reporting — "+ Make a Report"

In `ManagerReportsView.tsx` (or `reports.tsx`), add a "+ Make a Report" button in the header, alongside the export buttons. Tapping it switches to `<ReportEntryView reporterId={currentSampleUser.id} items={useInventoryStore().items} />` — all items, not filtered to assignment. Provide a clear way back to browsing. Reuse the existing email-bridge `currentSampleUser` resolution for Admin/Manager's own identity too.

### 6. Sign-out warning for unsaved drafts

New component `src/components/UnsavedChangesWarningModal.tsx` — same structural pattern as `ReportSubmittedModal` (custom Modal, RTL styling for Arabic/Urdu), but with **two** buttons: Cancel (stay) and "Sign Out Anyway" (proceed).

- English: "You have unsaved changes that haven't been reported. Signing out now will discard them — your inventory will not be updated. Are you sure you want to sign out?"
- Arabic: "لديك تغييرات غير محفوظة لم يتم الإبلاغ عنها. تسجيل الخروج الآن سيؤدي إلى تجاهلها - لن يتم تحديث المخزون. هل أنت متأكد أنك تريد تسجيل الخروج؟"
- Urdu: "آپ کے پاس غیر محفوظ شدہ تبدیلیاں ہیں جو رپورٹ نہیں کی گئیں۔ ابھی سائن آؤٹ کرنے سے وہ ضائع ہو جائیں گی - آپ کی انوینٹری اپ ڈیٹ نہیں ہوگی۔ کیا آپ واقعی سائن آؤٹ کرنا چاہتے ہیں؟"

In `settings.tsx`, wire the Sign Out button through `useDraftReport()`:

```ts
const { hasUnsavedChanges, clearDrafts } = useDraftReport();

function handleSignOutPress() {
  if (hasUnsavedChanges) {
    setShowUnsavedWarning(true);
    return;
  }
  void signOut();
}

function handleConfirmSignOutAnyway() {
  setShowUnsavedWarning(false);
  clearDrafts();
  void signOut();
}
```

Always call `clearDrafts()` as part of completing sign-out — whether the warning was shown or not — so a different person signing in next on the same device never inherits leftover draft state from the previous session.

### 7. Admin/Manager's "today" list — collapsed preview

In `ManagerReportsView.tsx`'s `EmployeeTodayRow`, when a report exists, show a compact preview of up to 3 touched items inline (name + latest quantity is enough) instead of just a count, with a "+N more" indicator if there are more than 3. The row stays fully tappable to open `ReportDetailModal` for the complete detail, unchanged.

### 8. Display updates — `ReportCard.tsx` / `ReportDetailModal.tsx`

Read `itemEntries` instead of `itemChanges`: full snapshot history per item (not a single pair), plus each item's optional note, alongside the existing day-level content.

## Constraints

- No change to how assignment count is enforced anywhere — there never was one, this stays unenforced/flexible.
- Reuse existing `global.css` utilities and component patterns.
- Strict TypeScript, no `any`.
- Run `npm run lint` and `npm run typecheck` before finishing. Fix all errors.

## Reference

Local-only — no Supabase involvement here. The corrected schema (`supabase-schema-correction-v2.sql`) already matches this model and gets applied once this is fully tested locally.