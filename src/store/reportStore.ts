import AsyncStorage from "@react-native-async-storage/async-storage";
import { create } from "zustand";
import { createJSONStorage, persist } from "zustand/middleware";

import type { Report } from "@/types/inventory";

type ReportState = {
  /**
   * User-generated daily reports. This is real data with no seed source, so it
   * is fully persisted and must survive app restarts.
   */
  reports: Report[];
  addReport: (report: Report) => void;
  /**
   * Updates a report's content. Locked reports (past midnight) cannot be
   * edited, so this is a no-op that returns `false` in that case; returns
   * `true` on a successful update.
   */
  updateReport: (id: string, content: string) => boolean;
  getReportsForItem: (itemId: string) => Report[];
  getReportsForEmployee: (employeeId: string) => Report[];
};

export const useReportStore = create<ReportState>()(
  persist(
    (set, get) => ({
      reports: [],
      addReport: (report) =>
        set((state) => ({ reports: [...state.reports, report] })),
      updateReport: (id, content) => {
        const report = get().reports.find((r) => r.id === id);
        if (!report || report.isLocked) return false;
        set((state) => ({
          reports: state.reports.map((r) =>
            r.id === id ? { ...r, content } : r,
          ),
        }));
        return true;
      },
      getReportsForItem: (itemId) =>
        get().reports.filter((report) => report.itemId === itemId),
      getReportsForEmployee: (employeeId) =>
        get().reports.filter((report) => report.employeeId === employeeId),
    }),
    {
      name: "report-storage",
      storage: createJSONStorage(() => AsyncStorage),
    },
  ),
);
