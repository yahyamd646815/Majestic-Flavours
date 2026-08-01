import AsyncStorage from "@react-native-async-storage/async-storage";
import { create } from "zustand";
import { createJSONStorage, persist } from "zustand/middleware";

import { generateId } from "@/lib/id";
import { getTodayIsoDate } from "@/lib/reports";
import type { Report, ReportItemEntry } from "@/types/inventory";

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

type ReportState = {
  reports: Report[];
  /** Returns the report id on success, or `null` if the submission was rejected. */
  submitReport: (
    reporterId: string,
    date: string,
    content: string,
    itemSubmissions: ItemSubmission[],
  ) => string | null;
  getReportForReporterAndDate: (reporterId: string, date: string) => Report | undefined;
  getReportsForItem: (itemId: string) => Report[];
  getReportsForReporter: (reporterId: string) => Report[];
  reset: () => void;
};

export const useReportStore = create<ReportState>()(
  persist(
    (set, get) => ({
      reports: [],
      // Append, not replace: `itemEntries` is the day's history, so each
      // submit adds a snapshot to the items that actually moved and leaves
      // every earlier snapshot in place. The caller only sends items whose
      // quantity or note changed since the last submit.
      //
      // Rejects (returns null) rather than trusting the caller blindly:
      // - `date` must match the store's own idea of "today" — guards against
      //   a UI that went stale across a midnight rollover writing into the
      //   wrong day's report.
      // - an existing report already marked `isLocked` can never be written
      //   to, regardless of what date was passed.
      submitReport: (reporterId, date, content, itemSubmissions) => {
        if (date !== getTodayIsoDate()) {
          console.warn(
            "[reportStore] Refusing to submit a report for a non-today date:",
            date,
          );
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
          const next = entries.map((entry) => ({
            ...entry,
            snapshots: [...entry.snapshots],
          }));
          for (const submission of itemSubmissions) {
            let entry = next.find((e) => e.itemId === submission.itemId);
            if (!entry) {
              entry = { itemId: submission.itemId, snapshots: [], note: "" };
              next.push(entry);
            }
            if (submission.newSnapshotQuantity !== undefined) {
              entry.snapshots.push({
                quantity: submission.newSnapshotQuantity,
                recordedAt: now,
              });
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
            {
              id,
              reporterId,
              date,
              content,
              itemEntries: applySubmissions([]),
              isLocked: false,
            },
          ],
        }));
        return id;
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
      reset: () => set({ reports: [] }),
    }),
    {
      name: "report-storage",
      storage: createJSONStorage(() => AsyncStorage),
    },
  ),
);
