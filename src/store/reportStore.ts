import AsyncStorage from "@react-native-async-storage/async-storage";
import { create } from "zustand";
import { createJSONStorage, persist } from "zustand/middleware";

import { generateId } from "@/lib/id";
import type { Report, ReportItemChange } from "@/types/inventory";

/**
 * Key into `dailyBaselines` — one entry per employee, calendar day and item,
 * holding that item's quantity the first time the employee touched it that day.
 */
export function baselineKey(employeeId: string, date: string, itemId: string): string {
  return `${employeeId}:${date}:${itemId}`;
}

type ReportState = {
  reports: Report[];
  /** Start-of-day quantities, keyed by `baselineKey`. */
  dailyBaselines: Record<string, number>;
  getOrCaptureBaseline: (
    employeeId: string,
    date: string,
    itemId: string,
    currentQuantity: number,
  ) => number;
  submitReport: (
    employeeId: string,
    date: string,
    content: string,
    changes: ReportItemChange[],
  ) => string;
  getReportForEmployeeAndDate: (employeeId: string, date: string) => Report | undefined;
  getReportsForItem: (itemId: string) => Report[];
  getReportsForEmployee: (employeeId: string) => Report[];
  reset: () => void;
};

export const useReportStore = create<ReportState>()(
  persist(
    (set, get) => ({
      reports: [],
      dailyBaselines: {},
      // Must be called before the quantity actually changes, so the very first
      // value captured for the day is the true start-of-day quantity.
      getOrCaptureBaseline: (employeeId, date, itemId, currentQuantity) => {
        const key = baselineKey(employeeId, date, itemId);
        const existing = get().dailyBaselines[key];
        if (existing !== undefined) return existing;

        set((state) => ({
          dailyBaselines: { ...state.dailyBaselines, [key]: currentQuantity },
        }));
        return currentQuantity;
      },
      // Full replace, not a merge: the caller (EmployeeReportsView) always
      // computes the complete, current set of net changes from
      // `dailyBaselines` vs. live quantities — so `changes` is already the
      // whole accurate picture, every time. Merging by item id would leave
      // stale entries behind for items an employee changed and then reverted
      // back to their baseline (they'd correctly drop out of a fresh
      // `changes` array, but a merge would never remove the old entry).
      submitReport: (employeeId, date, content, changes) => {
        const existing = get().reports.find(
          (report) => report.employeeId === employeeId && report.date === date,
        );

        const itemChanges = changes.map((change) => ({ ...change }));

        if (existing) {
          set((state) => ({
            reports: state.reports.map((report) =>
              report.id === existing.id ? { ...report, content, itemChanges } : report,
            ),
          }));
          return existing.id;
        }

        const id = generateId("report");
        set((state) => ({
          reports: [
            ...state.reports,
            { id, employeeId, date, content, itemChanges, isLocked: false },
          ],
        }));
        return id;
      },
      // Returned by reference (not copied like the getters below) so it is safe
      // to call straight from a Zustand selector without re-rendering forever.
      getReportForEmployeeAndDate: (employeeId, date) =>
        get().reports.find(
          (report) => report.employeeId === employeeId && report.date === date,
        ),
      getReportsForItem: (itemId) =>
        get()
          .reports.filter((report) =>
            report.itemChanges.some((change) => change.itemId === itemId),
          )
          .map((report) => ({ ...report })),
      getReportsForEmployee: (employeeId) =>
        get()
          .reports.filter((report) => report.employeeId === employeeId)
          .map((report) => ({ ...report })),
      reset: () => set({ reports: [], dailyBaselines: {} }),
    }),
    {
      name: "report-storage",
      storage: createJSONStorage(() => AsyncStorage),
    },
  ),
);