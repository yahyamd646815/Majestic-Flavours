Read AGENTS.md first and follow it strictly.

## Task

Migrate `reportStore` to Supabase. This is the last of the three store migrations (13a connection, 13b inventory/units, this one) — read all of it before starting, several pieces are precisely specified because this exact feature area has had subtle correctness bugs before (10b's merge-vs-replace issue, and a very similar note-preservation trap exists here too — see step 3).

**Scope boundary, explicit:** this prompt fixes report *ownership* (whose report is this) to use real Clerk ids, because that's required for any Supabase write to succeed at all under RLS. It does **not** fix item *assignment* (`assignedEmployeeIds` still holds placeholder ids) — that's 13d. Do not touch `ItemFormModal`'s employee picker or `inventory_items.assigned_employee_ids` in this prompt.

### 1. New minimal store — `src/store/appUsersStore.ts`

A small, read-mostly store for resolving real names for real Clerk ids (report cards need to show "Fatima Malik," not a raw `user_3Gb...` string).

```ts
import { create } from "zustand";
import type { SupabaseClient } from "@supabase/supabase-js";

export type SyncedUser = {
  clerkUserId: string;
  name: string;
  email: string;
};

type AppUsersState = {
  users: SyncedUser[];
  isLoading: boolean;
  error: string | null;
  fetchAll: (supabase: SupabaseClient) => Promise<void>;
  /** Upserts the current signed-in user's own row — call once per sign-in
   * so `app_users` grows organically as real people actually use the app. */
  syncSelf: (
    supabase: SupabaseClient,
    self: { clerkUserId: string; name: string; email: string },
  ) => Promise<void>;
};

export const useAppUsersStore = create<AppUsersState>()((set, get) => ({
  users: [],
  isLoading: true,
  error: null,

  fetchAll: async (supabase) => {
    set({ isLoading: true, error: null });
    const { data, error } = await supabase.from("app_users").select("*");
    if (error) {
      set({ isLoading: false, error: "Could not load user directory." });
      return;
    }
    set({
      users: (data ?? []).map((row) => ({
        clerkUserId: row.clerk_user_id,
        name: row.name,
        email: row.email,
      })),
      isLoading: false,
      error: null,
    });
  },

  syncSelf: async (supabase, self) => {
    const { error } = await supabase.from("app_users").upsert(
      { clerk_user_id: self.clerkUserId, name: self.name, email: self.email },
      { onConflict: "clerk_user_id" },
    );
    if (error) {
      console.warn("[appUsersStore] Failed to sync own user row:", error);
      return;
    }
    // Reflect it locally too, without waiting for a full refetch.
    set((state) => ({
      users: [
        ...state.users.filter((user) => user.clerkUserId !== self.clerkUserId),
        { clerkUserId: self.clerkUserId, name: self.name, email: self.email },
      ],
    }));
  },
}));
```

### 2. Sync hook addition — `src/app/(app)/_layout.tsx`

Alongside the existing inventory/units sync effect, add:

```ts
const fetchAppUsers = useAppUsersStore((state) => state.fetchAll);
const syncSelf = useAppUsersStore((state) => state.syncSelf);

useEffect(() => {
  if (!isSignedIn || !user) return;
  void syncSelf(supabase, {
    clerkUserId: user.id,
    name: user.fullName ?? user.firstName ?? "Unknown",
    email: user.primaryEmailAddress?.emailAddress ?? "",
  }).then(() => fetchAppUsers(supabase));
}, [isSignedIn, user, supabase, syncSelf, fetchAppUsers]);
```
(`user` here is Clerk's `useUser()` result, already available in this file for the existing role checks.)

### 3. Rewrite `src/store/reportStore.ts`

No `persist` middleware — same reasoning as 13b's stores. Fetch reports with their entries and snapshots nested in **one** query using Supabase's relational select, then map to the client shape:

```ts
import { create } from "zustand";
import type { SupabaseClient } from "@supabase/supabase-js";

import { generateId } from "@/lib/id";
import { getTodayIsoDate } from "@/lib/reports";
import type { Report, ReportItemEntry } from "@/types/inventory";

function mapDbReportToReport(row: Record<string, any>): Report {
  const entries = (row.report_item_entries ?? []).map(
    (entry: Record<string, any>): ReportItemEntry => ({
      itemId: entry.item_id,
      note: entry.note,
      // Nested relations aren't guaranteed to come back in insertion order —
      // sort explicitly, since `.at(-1)` elsewhere in the app relies on
      // chronological order to find the "latest" snapshot.
      snapshots: (entry.report_item_snapshots ?? [])
        .map((snap: Record<string, any>) => ({
          quantity: snap.quantity,
          recordedAt: snap.recorded_at,
        }))
        .sort((a: { recordedAt: string }, b: { recordedAt: string }) =>
          a.recordedAt.localeCompare(b.recordedAt),
        ),
    }),
  );

  return {
    id: row.id,
    reporterId: row.reporter_id,
    date: row.date,
    content: row.content,
    isLocked: row.is_locked,
    itemEntries: entries,
  };
}

export type ItemSubmission = {
  itemId: string;
  newSnapshotQuantity?: number;
  note?: string;
};

/** `failedItemIds` lets the caller tell the user exactly which items didn't
 * fully save, without needing an all-or-nothing rollback (Supabase REST
 * calls aren't transactional across tables the way a single Postgres
 * function would be — same partial-failure philosophy already used for the
 * inventory write phase in `ReportEntryView`). */
export type SubmitReportResult = { reportId: string; failedItemIds: string[] } | null;

type ReportState = {
  reports: Report[];
  isLoading: boolean;
  error: string | null;
  fetchAll: (supabase: SupabaseClient) => Promise<void>;
  submitReport: (
    supabase: SupabaseClient,
    reporterId: string,
    date: string,
    content: string,
    itemSubmissions: ItemSubmission[],
  ) => Promise<SubmitReportResult>;
  getReportForReporterAndDate: (reporterId: string, date: string) => Report | undefined;
  getReportsForItem: (itemId: string) => Report[];
  getReportsForReporter: (reporterId: string) => Report[];
};

export const useReportStore = create<ReportState>()((set, get) => ({
  reports: [],
  isLoading: true,
  error: null,

  fetchAll: async (supabase) => {
    set({ isLoading: true, error: null });
    const { data, error } = await supabase
      .from("reports")
      .select("*, report_item_entries(*, report_item_snapshots(*))");

    if (error) {
      set({ isLoading: false, error: "Could not load reports. Check your connection and try again." });
      return;
    }
    set({ reports: (data ?? []).map(mapDbReportToReport), isLoading: false, error: null });
  },

  submitReport: async (supabase, reporterId, date, content, itemSubmissions) => {
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

    const reportId = existing?.id ?? generateId("report");
    const { error: reportError } = await supabase
      .from("reports")
      .upsert(
        { id: reportId, reporter_id: reporterId, date, content, is_locked: false },
        { onConflict: "reporter_id,date" },
      );
    if (reportError) return null;

    const failedItemIds: string[] = [];

    for (const submission of itemSubmissions) {
      const existingEntry = existing?.itemEntries.find((e) => e.itemId === submission.itemId);
      // Only overwrite `note` when this submission actually includes one —
      // otherwise a quantity-only submission would silently blank out an
      // already-saved note. Fall back to whatever's already there.
      const noteToWrite = submission.note ?? existingEntry?.note ?? "";

      const { data: entryData, error: entryError } = await supabase
        .from("report_item_entries")
        .upsert(
          { id: generateId("entry"), report_id: reportId, item_id: submission.itemId, note: noteToWrite },
          { onConflict: "report_id,item_id" },
        )
        .select()
        .single();

      if (entryError || !entryData) {
        failedItemIds.push(submission.itemId);
        continue;
      }

      if (submission.newSnapshotQuantity !== undefined) {
        const { error: snapshotError } = await supabase.from("report_item_snapshots").insert({
          id: generateId("snapshot"),
          report_item_entry_id: entryData.id,
          quantity: submission.newSnapshotQuantity,
        });
        if (snapshotError) failedItemIds.push(submission.itemId);
      }
    }

    // Re-fetch this one report rather than trying to hand-merge the partial
    // writes above into local state — simpler, and guarantees local state
    // matches exactly what's actually in the database after a partial failure.
    const { data: refetched } = await supabase
      .from("reports")
      .select("*, report_item_entries(*, report_item_snapshots(*))")
      .eq("id", reportId)
      .single();

    if (refetched) {
      const updated = mapDbReportToReport(refetched);
      set((state) => ({
        reports: existing
          ? state.reports.map((r) => (r.id === reportId ? updated : r))
          : [...state.reports, updated],
      }));
    }

    return { reportId, failedItemIds };
  },

  getReportForReporterAndDate: (reporterId, date) =>
    get().reports.find((report) => report.reporterId === reporterId && report.date === date),
  getReportsForItem: (itemId) =>
    get()
      .reports.filter((report) => report.itemEntries.some((entry) => entry.itemId === itemId))
      .map((report) => ({ ...report })),
  getReportsForReporter: (reporterId) =>
    get()
      .reports.filter((report) => report.reporterId === reporterId)
      .map((report) => ({ ...report })),
}));
```

Add the same fetch call to the sync effect in `(app)/_layout.tsx` (alongside inventory/units/app_users): `void useReportStore.getState().fetchAll(supabase)`, or via a selector the same way the others are wired.

### 4. `ReportEntryView.tsx` — async submit, real Clerk id, richer failure handling

`handleSubmit` becomes:

```tsx
async function handleSubmit() {
  const itemSubmissions: ItemSubmission[] = [
    /* exactly the same computation already in this file — unchanged */
  ];

  const result = await submitReport(supabase, reporterId, todayIsoDate, dayContent.trim(), itemSubmissions);
  if (result === null) {
    Alert.alert("Report could not be saved", "Check your connection and try again.");
    return; // drafts are NOT cleared — nothing the person entered is lost
  }

  const quantityUpdates = itemSubmissions.flatMap((submission) =>
    submission.newSnapshotQuantity === undefined
      ? []
      : [{ itemId: submission.itemId, quantity: submission.newSnapshotQuantity }],
  );
  const writeResults = await Promise.all(
    quantityUpdates.map((update) =>
      updateItem(supabase, update.itemId, { currentQuantity: update.quantity }),
    ),
  );

  clearDrafts(); // the report itself is safely saved in Supabase either way now

  const inventoryFailed = writeResults.some((succeeded) => !succeeded);
  const reportPartiallyFailed = result.failedItemIds.length > 0;

  if (inventoryFailed || reportPartiallyFailed) {
    Alert.alert(
      "Report saved with some issues",
      "Some items could not be fully saved. Check your connection and try those items again.",
    );
    return;
  }

  setShowConfirmation(true);
}
```

`reportStore`'s `isLoading`/`error` need the same combined-with-inventory/units error-state handling already established in 13b — add it to this screen's existing gate the same way.

### 5. `src/app/(app)/reports.tsx` — split identity: self-report uses the real Clerk id, item-scoping doesn't (yet)

The `currentSampleUser` email-bridge stays exactly as it is for scoping which items an Employee sees (`assignedItems`) — untouched, deliberately deferred to 13d. But `reporterId` passed into `ReportEntryView`, for **both** the Employee path and the Admin/Manager self-report path, changes from `currentSampleUser.id` to `user.id` (Clerk's own id, already available from `useUser()`).

This also means the "+ Make a Report" button no longer needs to be gated behind `currentSampleUser` existing — self-reporting only needs `user.id`, which is always available to any signed-in Admin/Manager. Remove that gate for the button specifically; the "No matching employee profile found" fallback stays as it is, but now only actually blocks the Employee item-scoped path, not self-reporting.

### 6. Display name resolution — `ReportCard.tsx`, `ReportDetailModal.tsx`, `ManagerReportsView.tsx`'s `ReporterTodayRow`

These currently resolve a reporter's name via `sampleUsers.find(u => u.id === report.reporterId)`. Since `report.reporterId` is now a real Clerk id, this will never match a `sampleUsers` entry. Switch to `useAppUsersStore().users.find(u => u.clerkUserId === report.reporterId)?.name`, with the same "Unknown reporter" fallback as before for anyone not yet synced.

### 7. Remove now-obsolete dev tooling

Delete `src/components/DevClearStorageButton.tsx` and `src/lib/clearPersistedState.ts` entirely, and remove their usage from `src/app/(app)/settings.tsx`. There is no local persisted state left anywhere in the app for either to clear — `inventoryStore`, `unitsStore`, and now `reportStore` are all Supabase-backed with no `persist` middleware.

## Constraints

- Do not touch `ItemFormModal`'s employee picker or `assignedEmployeeIds` — that's 13d.
- Do not change `DraftReportContext` — it was never persisted and is unaffected by this migration.
- Strict TypeScript, no `any` beyond the same narrow, explicit exception already established in 13b's mapping functions for raw Supabase row shapes.
- Run `npm run lint` and `npm run typecheck` before finishing. Fix all errors.

## Reference

Test the note-preservation fix specifically: submit a report with a note on one item, then in a later submission change only that item's quantity (not the note) — confirm the note survives. This is the exact class of bug (silently overwriting one field while updating another) that has bitten this feature area before.
