import AsyncStorage from "@react-native-async-storage/async-storage";
import { create } from "zustand";
import { createJSONStorage, persist } from "zustand/middleware";

import type { Report } from "@/types/inventory";

type ReportState = {
  reports: Report[];
  addReport: (report: Report) => void;
  updateReport: (id: string, content: string) => boolean;
  getReportsForItem: (itemId: string) => Report[];
  getReportsForEmployee: (employeeId: string) => Report[];
};

export const useReportStore = create<ReportState>()(
  persist(
    (set, get) => ({
      reports: [],
      addReport: (report) =>
        set((state) => ({ reports: [...state.reports, { ...report }] })),
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
        get()
          .reports.filter((report) => report.itemId === itemId)
          .map((report) => ({ ...report })),
      getReportsForEmployee: (employeeId) =>
        get()
          .reports.filter((report) => report.employeeId === employeeId)
          .map((report) => ({ ...report })),
    }),
    {
      name: "report-storage",
      storage: createJSONStorage(() => AsyncStorage),
    },
  ),
);