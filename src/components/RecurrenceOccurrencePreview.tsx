import { useMemo, useState } from "react";
import { Text, View } from "react-native";

import { CalendarMonth } from "@/components/CalendarMonth";
import { formatReportDate } from "@/lib/reports";
import { buildRecurrencePreview, type RecurrenceFormDraft } from "@/lib/taskRecurrence";

/**
 * How many months of calendar are drawn. A rule may legitimately run for
 * years — "every month for 100 times" is nine of them — and drawing every one
 * of those grids would cost far more than it tells anyone. The months shown
 * are the earliest ones, which is what a person is actually checking, and the
 * summary line above them always states the true total.
 */
const MAX_PREVIEW_MONTHS = 6;

type RecurrenceOccurrencePreviewProps = {
  draft: RecurrenceFormDraft;
  todayIsoDate: string;
};

/**
 * The dates the draft in front of you will actually produce, drawn on real
 * calendars.
 *
 * Every date shown comes from `generateDueOccurrences` run against the draft
 * itself — the same function that will later create the occurrences, never a
 * second reading of the same rules — so the union of a structured pattern and
 * any picked dates is shown exactly as it will be generated, duplicates
 * already collapsed.
 */
export function RecurrenceOccurrencePreview({
  draft,
  todayIsoDate,
}: RecurrenceOccurrencePreviewProps) {
  // Fixed at mount rather than read per render: a rule's sequence starts at
  // its creation instant, and a "now" that crept forward between renders
  // would make the first row flicker in and out as its time passed.
  const [nowMs] = useState(() => Date.now());

  const preview = useMemo(
    () => buildRecurrencePreview(draft, todayIsoDate, nowMs),
    [draft, todayIsoDate, nowMs],
  );

  const grouped = useMemo(() => {
    if (!preview.ok) return null;

    // An occurrenceKey is `YYYY-MM-DDTHH:MM`, so its date and month are plain
    // slices — no re-parsing, and no chance of drifting off Riyadh's calendar.
    const countByDate = new Map<string, number>();
    for (const occurrence of preview.occurrences) {
      const isoDate = occurrence.occurrenceKey.slice(0, 10);
      countByDate.set(isoDate, (countByDate.get(isoDate) ?? 0) + 1);
    }

    const allMonths = [...new Set([...countByDate.keys()].map((date) => date.slice(0, 7)))].sort();
    const dates = [...countByDate.keys()].sort();

    return {
      selectedDates: new Set(dates),
      // Only days carrying more than one time need saying out loud; a single
      // occurrence is what a highlighted day already means.
      dayCaptions: new Map(
        [...countByDate.entries()]
          .filter(([, count]) => count > 1)
          .map(([date, count]) => [date, `${count}×`]),
      ),
      months: allMonths.slice(0, MAX_PREVIEW_MONTHS),
      hiddenMonthCount: Math.max(0, allMonths.length - MAX_PREVIEW_MONTHS),
      firstDate: dates[0],
      lastDate: dates[dates.length - 1],
    };
  }, [preview]);

  if (!preview.ok) {
    return (
      <View className="gap-1 rounded-lg border border-border bg-white p-3">
        <Text className="font-inter-medium text-sm text-text-primary">Preview</Text>
        <Text className="font-inter text-xs text-text-secondary">{preview.message}</Text>
      </View>
    );
  }

  if (grouped === null || preview.occurrences.length === 0) {
    return (
      <View className="gap-1 rounded-lg border border-border bg-white p-3">
        <Text className="font-inter-medium text-sm text-text-primary">Preview</Text>
        <Text className="font-inter text-xs text-text-secondary">
          This creates nothing — every date and time it describes has already gone by.
        </Text>
      </View>
    );
  }

  const total = preview.occurrences.length;

  return (
    <View className="gap-3 rounded-lg border border-border bg-white p-3">
      <View className="gap-1">
        <Text className="font-inter-medium text-sm text-text-primary">Preview</Text>
        <Text className="font-inter text-xs text-text-secondary">
          {total}
          {preview.isTruncated ? "+" : ""} task{total === 1 ? "" : "s"} ·{" "}
          {formatReportDate(grouped.firstDate)}
          {total > 1 ? ` – ${formatReportDate(grouped.lastDate)}` : ""}
          {preview.isTruncated ? " and on" : ""}
        </Text>
      </View>

      {grouped.months.map((yearMonth) => (
        <CalendarMonth
          key={yearMonth}
          year={Number(yearMonth.slice(0, 4))}
          month={Number(yearMonth.slice(5, 7))}
          selectedDates={grouped.selectedDates}
          dayCaptions={grouped.dayCaptions}
        />
      ))}

      {grouped.hiddenMonthCount > 0 ? (
        <Text className="font-inter text-xs text-text-secondary">
          Showing the first {MAX_PREVIEW_MONTHS} months. {grouped.hiddenMonthCount} more month
          {grouped.hiddenMonthCount === 1 ? "" : "s"} follow, up to{" "}
          {formatReportDate(grouped.lastDate)}.
        </Text>
      ) : null}
    </View>
  );
}
