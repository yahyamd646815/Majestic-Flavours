import type { SupabaseClient } from "@supabase/supabase-js";
import { create } from "zustand";

import { generateId } from "@/lib/id";
import { getTodayIsoDate } from "@/lib/reports";
import type { Report, ReportItemEntry } from "@/types/inventory";

/** A report and its two child tables arrive as one nested row — same loose
 * raw-row typing, narrowed in one place, as `inventoryStore`'s mapper. */
function mapDbReportToReport(row: Record<string, unknown>): Report {
  const entryRows = (row.report_item_entries as Record<string, unknown>[] | null) ?? [];

  const itemEntries = entryRows.map((entryRow): ReportItemEntry => {
    const snapshotRows =
      (entryRow.report_item_snapshots as Record<string, unknown>[] | null) ?? [];

    return {
      itemId: entryRow.item_id as string,
      note: entryRow.note as string,
      // Nested relations aren't guaranteed to come back in insertion order —
      // sort explicitly, since the "latest" snapshot the UI shows is simply
      // the last element of this array.
      snapshots: snapshotRows
        .map((snapshotRow) => ({
          quantity: snapshotRow.quantity as number,
          recordedAt: snapshotRow.recorded_at as string,
        }))
        .sort((a, b) => a.recordedAt.localeCompare(b.recordedAt)),
    };
  });

  return {
    id: row.id as string,
    reporterId: row.reporter_id as string,
    date: row.date as string,
    content: row.content as string,
    isLocked: row.is_locked as boolean,
    itemEntries,
  };
}

/** The nested select used for both the full fetch and the post-write refetch. */
const REPORT_SELECT = "*, report_item_entries(*, report_item_snapshots(*))";

/** One item's part of a submit — quantity and note are independent, so an
 * item can be submitted for either, or both. */
export type ItemSubmission = {
  itemId: string;
  /** Present only if this item's quantity is being recorded now. */
  newSnapshotQuantity?: number;
  /** Present only if this item's note was added or edited. Can be "" to
   * explicitly clear an existing note. */
  note?: string;
};

/** `failedItemIds` lets the caller tell the user exactly which items didn't
 * fully save, without needing an all-or-nothing rollback (Supabase REST
 * calls aren't transactional across tables the way a single Postgres
 * function would be — same partial-failure philosophy already used for the
 * inventory write phase in `ReportEntryView`). `null` means the report
 * itself was rejected and nothing was written at all. */
export type SubmitReportResult = { reportId: string; failedItemIds: string[] } | null;

/** An in-memory cache of whatever Supabase last returned — see the longer
 * note in `inventoryStore`. Deliberately not persisted. */
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
    const { data, error } = await supabase.from("reports").select(REPORT_SELECT);

    if (error) {
      set({
        isLoading: false,
        error: "Could not load reports. Check your connection and try again.",
      });
      return;
    }

    set({
      reports: ((data ?? []) as Record<string, unknown>[]).map(mapDbReportToReport),
      isLoading: false,
      error: null,
    });
  },

  // Append, not replace: each item's snapshots are the day's history, so a
  // submit adds one snapshot to the items that actually moved and leaves
  // every earlier snapshot in place. The caller only sends items whose
  // quantity or note changed since the last submit.
  //
  // Rejects (returns null) rather than trusting the caller blindly:
  // - `date` must match the store's own idea of "today" — guards against a UI
  //   that went stale across a midnight rollover writing into the wrong day.
  // - an existing report already marked `isLocked` can never be written to.
  // Supabase's RLS policies enforce both again server-side.
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
      const existingEntry = existing?.itemEntries.find(
        (entry) => entry.itemId === submission.itemId,
      );
      // Only overwrite `note` when this submission actually includes one —
      // otherwise a quantity-only submission would silently blank out an
      // already-saved note. Fall back to whatever's already there.
      const noteToWrite = submission.note ?? existingEntry?.note ?? "";

      const { data: entryData, error: entryError } = await supabase
        .from("report_item_entries")
        .upsert(
          {
            // Derived from the row's natural key, not randomly generated:
            // this upsert conflicts on (report_id, item_id) and writes back
            // every column it is given, `id` included. A fresh id here would
            // rewrite the entry's primary key on every update — and once that
            // entry has snapshots pointing at the old id, the foreign key
            // rejects the write outright.
            id: `entry-${reportId}-${submission.itemId}`,
            report_id: reportId,
            item_id: submission.itemId,
            note: noteToWrite,
          },
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
      .select(REPORT_SELECT)
      .eq("id", reportId)
      .single();

    if (refetched) {
      const updated = mapDbReportToReport(refetched as Record<string, unknown>);
      set((state) => ({
        reports: existing
          ? state.reports.map((report) => (report.id === reportId ? updated : report))
          : [...state.reports, updated],
      }));
    }

    return { reportId, failedItemIds };
  },

  getReportForReporterAndDate: (reporterId, date) =>
    get().reports.find(
      (report) => report.reporterId === reporterId && report.date === date,
    ),
  getReportsForItem: (itemId) =>
    get()
      .reports.filter((report) =>
        report.itemEntries.some((entry) => entry.itemId === itemId),
      )
      .map((report) => ({ ...report })),
  getReportsForReporter: (reporterId) =>
    get()
      .reports.filter((report) => report.reporterId === reporterId)
      .map((report) => ({ ...report })),
}));
