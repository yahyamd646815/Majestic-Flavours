import { Ionicons } from "@expo/vector-icons";
import { type ReactElement, useMemo, useState } from "react";
import { FlatList, StyleSheet, Text, TouchableOpacity, View } from "react-native";

import { ReportCard } from "@/components/ReportCard";
import { ReportDetailModal } from "@/components/ReportDetailModal";
import { ReportFilters } from "@/components/ReportFilters";
import { colors } from "@/constants/theme";
import { sampleUsers } from "@/data/sampleUsers";
import type { ReportDateFilter } from "@/lib/reports";
import {
  getTodayIsoDate,
  isReportLocked,
  matchesDateFilter,
  reportMatchesCategory,
} from "@/lib/reports";
import { getUnitLabel } from "@/lib/inventoryLabels";
import { useInventoryStore } from "@/store/inventoryStore";
import { useReportStore } from "@/store/reportStore";
import { useUnitsStore } from "@/store/unitsStore";
import type { AppUser, InventoryItem, Report, Unit } from "@/types/inventory";

const employees = sampleUsers.filter((user) => user.role === "employee");

type ManagerReportsViewProps = {
  footer: ReactElement;
};

/**
 * Admin and Manager view. "Today" tracks who has reported yet; past ranges
 * list the reports themselves, one per reporter per day.
 */
export function ManagerReportsView({ footer }: ManagerReportsViewProps) {
  const items = useInventoryStore((state) => state.items);
  const categories = useInventoryStore((state) => state.categories);
  const units = useUnitsStore((state) => state.units);
  const reports = useReportStore((state) => state.reports);
  const getReportForReporterAndDate = useReportStore(
    (state) => state.getReportForReporterAndDate,
  );

  const [dateFilter, setDateFilter] = useState<ReportDateFilter>("all");
  const [reporterId, setReporterId] = useState<string | null>(null);
  const [categoryId, setCategoryId] = useState<string | null>(null);
  const [detailReportId, setDetailReportId] = useState<string | null>(null);

  const todayIsoDate = getTodayIsoDate();

  // Today's list is every Employee (expected to report) plus any Admin or
  // Manager who happens to have filed their own report today — not every
  // Admin/Manager, since self-reporting is optional for them, not expected
  // coverage the way it is for Employees.
  const todayReporterCandidates = useMemo(() => {
    const selfReporters = sampleUsers.filter(
      (user) =>
        user.role !== "employee" &&
        getReportForReporterAndDate(user.id, todayIsoDate) !== undefined,
    );
    return [...employees, ...selfReporters];
    // `reports` looks unused to the linter, but `getReportForReporterAndDate`
    // reads it lazily through the store's `get()` — without it as a
    // dependency this memo would not recompute when someone submits or
    // updates today's report.
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [reports, getReportForReporterAndDate, todayIsoDate]);

  const todayRows = useMemo(
    () =>
      todayReporterCandidates
        .filter((reporter) => reporterId === null || reporter.id === reporterId)
        .map((reporter) => ({
          reporter,
          report: getReportForReporterAndDate(reporter.id, todayIsoDate),
        }))
        // With a category filter on: someone who has already reported stays
        // listed only if that report touched the category. An Employee who
        // hasn't reported yet stays listed only if they're actually assigned
        // to an item in that category. A not-yet-reported Admin/Manager
        // never appears here at all (see todayReporterCandidates above), so
        // there's nothing further to filter for them.
        .filter(({ reporter, report }) => {
          if (categoryId === null) return true;
          if (report) return reportMatchesCategory(report, items, categoryId);
          return items.some(
            (item) =>
              item.categoryId === categoryId && item.assignedEmployeeIds.includes(reporter.id),
          );
        }),
    [
      todayReporterCandidates,
      getReportForReporterAndDate,
      reporterId,
      categoryId,
      items,
      todayIsoDate,
    ],
  );

  const historicalReports = useMemo(
    () =>
      reports
        .filter((report) => {
          if (!matchesDateFilter(report.date, dateFilter, todayIsoDate)) return false;
          if (reporterId !== null && report.reporterId !== reporterId) return false;
          if (categoryId !== null && !reportMatchesCategory(report, items, categoryId))
            return false;
          return true;
        })
        // Newest first.
        .sort((a, b) => b.date.localeCompare(a.date)),
    [reports, items, dateFilter, reporterId, categoryId, todayIsoDate],
  );

  const detailReport = reports.find((report) => report.id === detailReportId);

  return (
    <View className="flex-1 gap-4">
      <ReportFilters
        dateFilter={dateFilter}
        onDateFilterChange={setDateFilter}
        reporters={sampleUsers}
        selectedReporterId={reporterId}
        onReporterChange={setReporterId}
        categories={categories}
        selectedCategoryId={categoryId}
        onCategoryChange={setCategoryId}
      />

      {dateFilter === "today" ? (
        <FlatList
          className="flex-1"
          data={todayRows}
          keyExtractor={(row) => row.reporter.id}
          contentContainerStyle={styles.listContent}
          ItemSeparatorComponent={() => <View className="h-3" />}
          ListEmptyComponent={<EmptyState message="No reporters match these filters." />}
          ListFooterComponent={footer}
          renderItem={({ item: row }) => (
            <ReporterTodayRow
              reporter={row.reporter}
              report={row.report}
              items={items}
              units={units}
              onPress={() => setDetailReportId(row.report?.id ?? null)}
            />
          )}
        />
      ) : (
        <FlatList
          className="flex-1"
          data={historicalReports}
          keyExtractor={(report) => report.id}
          contentContainerStyle={styles.listContent}
          ItemSeparatorComponent={() => <View className="h-3" />}
          ListEmptyComponent={<EmptyState message="No reports match these filters yet." />}
          ListFooterComponent={footer}
          renderItem={({ item: report }) => (
            <ReportCard
              report={report}
              items={items}
              categories={categories}
              units={units}
              reporter={sampleUsers.find((user) => user.id === report.reporterId)}
              isLocked={isReportLocked(report, todayIsoDate)}
            />
          )}
        />
      )}

      <ReportDetailModal
        visible={detailReport !== undefined}
        report={detailReport}
        items={items}
        categories={categories}
        units={units}
        reporter={sampleUsers.find((user) => user.id === detailReport?.reporterId)}
        isLocked={detailReport ? isReportLocked(detailReport, todayIsoDate) : false}
        onClose={() => setDetailReportId(null)}
      />
    </View>
  );
}

/** How many touched items the row previews before collapsing the rest into "+N more". */
const PREVIEW_LIMIT = 3;

type ReporterTodayRowProps = {
  reporter: AppUser;
  /** Undefined while this reporter has not reported today. */
  report?: Report;
  /** Used to resolve previewed item names and units. */
  items: InventoryItem[];
  units: Unit[];
  onPress: () => void;
};

/** One reporter's status for today — tappable once their report exists. */
function ReporterTodayRow({ reporter, report, items, units, onPress }: ReporterTodayRowProps) {
  const hasReport = report !== undefined;
  const entries = report?.itemEntries ?? [];
  const previewEntries = entries.slice(0, PREVIEW_LIMIT);
  const extraCount = entries.length - previewEntries.length;

  return (
    <TouchableOpacity
      className="card gap-2"
      activeOpacity={hasReport ? 0.85 : 1}
      disabled={!hasReport}
      onPress={onPress}
      accessibilityRole="button"
      accessibilityLabel={`${reporter.name}: ${
        hasReport ? "report made" : "report still being made"
      }`}
    >
      <View className="flex-row items-center justify-between gap-2">
        <Text className="flex-1 font-inter-semibold text-base text-text-primary">
          {reporter.name}
        </Text>

        {hasReport ? (
          <Ionicons name="chevron-forward" size={18} color={colors.textSecondary} />
        ) : null}
      </View>

      <View className="flex-row flex-wrap items-center gap-2">
        <View
          className={
            hasReport
              ? "status-badge status-badge--in-stock"
              : "status-badge status-badge--low-stock"
          }
        >
          <Text
            className={
              hasReport ? "status-badge__text--in-stock" : "status-badge__text--low-stock"
            }
          >
            {hasReport ? "Report made" : "Report still being made"}
          </Text>
        </View>
      </View>

      {hasReport ? (
        entries.length === 0 ? (
          <Text className="font-inter text-xs text-text-secondary">No items reported.</Text>
        ) : (
          <View className="gap-0.5">
            {previewEntries.map((entry) => {
              const item = items.find((candidate) => candidate.id === entry.itemId);
              const latest = entry.snapshots[entry.snapshots.length - 1];

              return (
                <Text
                  key={entry.itemId}
                  className="font-inter text-xs text-text-secondary"
                  numberOfLines={1}
                >
                  {item?.name ?? "Deleted item"}
                  {latest
                    ? ` — ${latest.quantity}${item ? ` ${getUnitLabel(units, item.unitId)}` : ""}`
                    : " — note only"}
                </Text>
              );
            })}

            {extraCount > 0 ? (
              <Text className="font-inter-medium text-xs text-text-secondary">
                +{extraCount} more
              </Text>
            ) : null}
          </View>
        )
      ) : null}
    </TouchableOpacity>
  );
}

function EmptyState({ message }: { message: string }) {
  return (
    <View className="items-center gap-2 py-16">
      <Ionicons name="document-text-outline" size={40} color={colors.textSecondary} />
      <Text className="text-center font-inter-medium text-sm text-text-secondary">{message}</Text>
    </View>
  );
}

const styles = StyleSheet.create({
  listContent: {
    paddingHorizontal: 16,
    paddingBottom: 32,
  },
});