import type { InventoryItem, Report } from "@/types/inventory";

/**
 * The Riyadh wall-clock date and time of an instant, as plain numbers —
 * 1-indexed month, matching both how `YYYY-MM-DD` strings read and what
 * `riyadhDateTimeToIso` takes back. Riyadh has a fixed UTC+3 offset with no
 * DST, so plain UTC arithmetic is both simpler and more reliable than
 * Intl.DateTimeFormat with a timeZone option, which has real documented
 * cross-platform inconsistencies in Hermes (React Native's JS engine).
 *
 * This is the shared core of `getTodayIsoDate` below, exposed separately for
 * callers that need the time components too (see `lib/taskRecurrence.ts`) —
 * so the app has exactly one place where an instant becomes Riyadh digits.
 */
export function getRiyadhParts(instantMs: number): {
  year: number;
  month: number;
  day: number;
  hour: number;
  minute: number;
} {
  const riyadh = new Date(instantMs + 3 * 60 * 60 * 1000);
  return {
    year: riyadh.getUTCFullYear(),
    month: riyadh.getUTCMonth() + 1,
    day: riyadh.getUTCDate(),
    hour: riyadh.getUTCHours(),
    minute: riyadh.getUTCMinutes(),
  };
}

/** `YYYY-MM-DD` for any instant's Riyadh calendar date — the general form of
 * `getTodayIsoDate` below, for callers that need a date other than "now"
 * (e.g. bucketing a task's `dueAt` into a day for `matchesDateFilter`). */
export function getRiyadhIsoDate(instantMs: number): string {
  const { year, month, day } = getRiyadhParts(instantMs);
  return `${year}-${String(month).padStart(2, "0")}-${String(day).padStart(2, "0")}`;
}

/**
 * Local calendar date as `YYYY-MM-DD`, computed for Riyadh specifically —
 * not the device's own timezone. This means the app's notion of "today" does
 * not depend on a test device's timezone being set correctly at all.
 */
export function getTodayIsoDate(): string {
  return getRiyadhIsoDate(Date.now());
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

/**
 * Converts Riyadh wall-clock date/time components (1-indexed month, matching
 * how `YYYY-MM-DD` strings read) to the equivalent UTC ISO timestamp. Same
 * fixed-UTC+3, no-DST reasoning as `getTodayIsoDate`, just inverted: build the
 * instant directly from Riyadh digits rather than deriving Riyadh digits from
 * an instant.
 */
export function riyadhDateTimeToIso(
  year: number,
  month: number,
  day: number,
  hour: number,
  minute: number,
): string {
  return new Date(Date.UTC(year, month - 1, day, hour - 3, minute, 0, 0)).toISOString();
}

/** 23:59 on the given Riyadh calendar date (`YYYY-MM-DD`), as a UTC ISO
 * timestamp — the default a task's `due_at` resolves to when no due time was
 * explicitly chosen (AGENTS.md → to-do task creation rules). */
export function getEndOfDayRiyadhIso(riyadhIsoDate: string): string {
  const [year, month, day] = riyadhIsoDate.split("-").map(Number);
  return riyadhDateTimeToIso(year, month, day, 23, 59);
}

/** "12 Jul 2026 · 14:32" — a task's due date and time together, for display
 * only (uses the device's own locale rendering, same as `formatSnapshotTime`
 * — this is not the Riyadh-authoritative value, which is `dueAt` itself). */
export function formatDueDateTime(isoTimestamp: string): string {
  const parsed = new Date(isoTimestamp);
  if (Number.isNaN(parsed.getTime())) return isoTimestamp;
  const datePart = parsed.toLocaleDateString("en-GB", {
    day: "numeric",
    month: "short",
    year: "numeric",
  });
  const timePart = parsed.toLocaleTimeString("en-GB", { hour: "2-digit", minute: "2-digit" });
  return `${datePart} · ${timePart}`;
}

/** A report matches when any item it touched belongs to one of the given
 * categories. Callers are expected to treat an empty `categoryIds` set as
 * "filter inactive" themselves — this only checks actual membership. */
export function reportMatchesAnyCategory(
  report: Report,
  items: InventoryItem[],
  categoryIds: Set<string>,
): boolean {
  return report.itemEntries.some((entry) => {
    const item = items.find((candidate) => candidate.id === entry.itemId);
    return item !== undefined && categoryIds.has(item.categoryId);
  });
}

export type ReportDateFilter = "today" | "week" | "all";

export const REPORT_DATE_FILTER_LABELS: Record<ReportDateFilter, string> = {
  today: "Today",
  week: "This Week",
  all: "All Time",
};

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