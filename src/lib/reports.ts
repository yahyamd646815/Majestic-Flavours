import type { InventoryItem, Report } from "@/types/inventory";

/** Local calendar date as `YYYY-MM-DD` — the format every `Report.date` uses. */
export function getTodayIsoDate(): string {
  const now = new Date();
  const month = String(now.getMonth() + 1).padStart(2, "0");
  const day = String(now.getDate()).padStart(2, "0");
  return `${now.getFullYear()}-${month}-${day}`;
}

/**
 * Reports are editable only on the day they were written (AGENTS.md → Report
 * Rules). Nothing flips `isLocked` at midnight yet, so the UI also treats any
 * report dated before today as locked.
 */
export function isReportLocked(report: Report, todayIsoDate: string): boolean {
  return report.isLocked || report.date !== todayIsoDate;
}

/** "12 Jul 2026" — short enough to sit on one line on a phone. */
export function formatReportDate(isoDate: string): string {
  const parsed = new Date(`${isoDate}T00:00:00`);
  if (Number.isNaN(parsed.getTime())) return isoDate;
  return parsed.toLocaleDateString("en-GB", {
    day: "numeric",
    month: "short",
    year: "numeric",
  });
}

/** "14:32" — the time a quantity snapshot was recorded, without the date. */
export function formatSnapshotTime(isoTimestamp: string): string {
  const parsed = new Date(isoTimestamp);
  if (Number.isNaN(parsed.getTime())) return "";
  return parsed.toLocaleTimeString("en-GB", { hour: "2-digit", minute: "2-digit" });
}

/** A report matches a category when any item it touched belongs to that category. */
export function reportMatchesCategory(
  report: Report,
  items: InventoryItem[],
  category: string,
): boolean {
  return report.itemEntries.some((entry) => {
    const item = items.find((candidate) => candidate.id === entry.itemId);
    return item?.category === category;
  });
}

export type ReportDateFilter = "today" | "week" | "all";

/** `"week"` means the last 7 days, today included. */
export function matchesDateFilter(
  isoDate: string,
  filter: ReportDateFilter,
  todayIsoDate: string,
): boolean {
  if (filter === "all") return true;
  if (filter === "today") return isoDate === todayIsoDate;

  const weekStart = new Date(`${todayIsoDate}T00:00:00`);
  weekStart.setDate(weekStart.getDate() - 6);
  return new Date(`${isoDate}T00:00:00`) >= weekStart;
}
