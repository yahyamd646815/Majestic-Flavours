import type { SupabaseClient } from "@supabase/supabase-js";
import { create } from "zustand";

import { generateId } from "@/lib/id";
import { getTodayIsoDate } from "@/lib/reports";
import type { StockStatus } from "@/lib/stockStatus";
import type { Report, ReportItemEntry } from "@/types/inventory";

function mapDbReportToReport(row: Record<string, unknown>): Report {
  const entryRows = (row.report_item_entries as Record<string, unknown>[] | null) ?? [];

  const itemEntries = entryRows.map((entryRow): ReportItemEntry => {
    const snapshotRows =
      (entryRow.report_item_snapshots as Record<string, unknown>[] | null) ?? [];

    return {
      itemId: entryRow.item_id as string,
      note: entryRow.note as string,
      snapshots: snapshotRows
        .map((snapshotRow) => ({
          quantity: snapshotRow.quantity as number,
          recordedAt: snapshotRow.recorded_at as string,
        }))
        .sort((a, b) => a.recordedAt.localeCompare(b.recordedAt)),
      statusPings: ((entryRow.report_item_status_pings as Record<string, unknown>[] | null) ?? [])
        .map((row) => ({
          status: row.status as StockStatus,
          recordedAt: row.recorded_at as string,
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

const REPORT_SELECT =
  "*, report_item_entries(*, report_item_snapshots(*), report_item_status_pings(*))";

export type ItemSubmission = {
  itemId: string;
  newSnapshotQuantity?: number;
  note?: string;
  statusPing?: StockStatus;
};

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
    submissionId: string,
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

  submitReport: async (supabase, reporterId, date, content, itemSubmissions, submissionId) => {
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
      const noteToWrite = submission.note ?? existingEntry?.note ?? "";

      const { data: entryData, error: entryError } = await supabase
        .from("report_item_entries")
        .upsert(
          {
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
        const { error: snapshotError } = await supabase.from("report_item_snapshots").upsert(
          {
            id: `snapshot-${submissionId}-${submission.itemId}`,
            report_item_entry_id: entryData.id,
            quantity: submission.newSnapshotQuantity,
          },
          { onConflict: "id" },
        );
        if (snapshotError) failedItemIds.push(submission.itemId);
      }

      if (submission.statusPing !== undefined) {
        const { error: pingError } = await supabase.from("report_item_status_pings").upsert(
          {
            id: `status-ping-${submissionId}-${submission.itemId}`,
            report_item_entry_id: entryData.id,
            status: submission.statusPing,
          },
          { onConflict: "id" },
        );
        if (pingError) failedItemIds.push(submission.itemId);
      }
    }

    const { data: refetched } = await supabase
      .from("reports")
      .select(REPORT_SELECT)
      .eq("id", reportId)
      .single();

    if (refetched) {
      const updated = mapDbReportToReport(refetched as Record<string, unknown>);
      // Keyed on the current state at merge time, not the `existing` value
      // captured before the write — a cache miss earlier shouldn't be able
      // to produce a duplicate entry for the same report id here.
      set((state) => ({
        reports: state.reports.some((report) => report.id === reportId)
          ? state.reports.map((report) => (report.id === reportId ? updated : report))
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