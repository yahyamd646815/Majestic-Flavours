import { Ionicons } from "@expo/vector-icons";
import { type ReactElement, useMemo, useState } from "react";
import { Alert, FlatList, StyleSheet, Text, TouchableOpacity, View } from "react-native";

import { ReportCard } from "@/components/ReportCard";
import { ReportDetailModal } from "@/components/ReportDetailModal";
import { ReportFilters } from "@/components/ReportFilters";
import { colors } from "@/constants/theme";
import { sampleUsers } from "@/data/sampleUsers";
import { bridgeRosterByEmail } from "@/lib/assignableEmployees";
import { getUnitLabel } from "@/lib/inventoryLabels";
import type { ReportExportInput } from "@/lib/reportExport";
import { exportReportsAsPdf, exportReportsAsXlsx } from "@/lib/reportExport";
import type { ReportDateFilter } from "@/lib/reports";
import {
  REPORT_DATE_FILTER_LABELS,
  getTodayIsoDate,
  isReportLocked,
  matchesDateFilter,
  reportMatchesCategory,
} from "@/lib/reports";
import { useAppUsersStore } from "@/store/appUsersStore";
import { useInventoryStore } from "@/store/inventoryStore";
import { useReportStore } from "@/store/reportStore";
import { useUnitsStore } from "@/store/unitsStore";
import type { AppUser, InventoryItem, Report, Unit } from "@/types/inventory";

type ReporterCandidate = AppUser & { clerkUserId?: string };

type ManagerReportsViewProps = {
  footer: ReactElement;
  /** Switches the Reports screen over to the signed-in user's own report. */
  onSelfReport: () => void;
};

export function ManagerReportsView({ footer, onSelfReport }: ManagerReportsViewProps) {
  const items = useInventoryStore((state) => state.items);
  const categories = useInventoryStore((state) => state.categories);
  const units = useUnitsStore((state) => state.units);
  const appUsers = useAppUsersStore((state) => state.users);
  const reports = useReportStore((state) => state.reports);
  const getReportForReporterAndDate = useReportStore(
    (state) => state.getReportForReporterAndDate,
  );

  const [dateFilter, setDateFilter] = useState<ReportDateFilter>("all");
  const [reporterId, setReporterId] = useState<string | null>(null);
  const [categoryId, setCategoryId] = useState<string | null>(null);
  const [detailReportId, setDetailReportId] = useState<string | null>(null);
  const [isExporting, setIsExporting] = useState(false);

  const todayIsoDate = getTodayIsoDate();

  // Roles still live only in `sampleUsers` on the client, but reports are
  // keyed on real Clerk ids now — bridged by email via the shared helper
  // (also used by ItemFormModal/BulkAssignModal's employee pickers), which
  // compares `.trim().toLowerCase()` on both sides. Someone who has never
  // signed in simply has no Clerk id, and therefore no report. Every role is
  // kept here (not just employees) since Admins and Managers can self-report.
  const reporters = useMemo<ReporterCandidate[]>(
    () => bridgeRosterByEmail(sampleUsers, appUsers),
    [appUsers],
  );

  const todayReporterCandidates = useMemo(() => {
    const selfReporters = reporters.filter(
      (reporter) =>
        reporter.role !== "employee" &&
        reporter.clerkUserId !== undefined &&
        getReportForReporterAndDate(reporter.clerkUserId, todayIsoDate) !== undefined,
    );
    return [...reporters.filter((reporter) => reporter.role === "employee"), ...selfReporters];
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [reports, reporters, getReportForReporterAndDate, todayIsoDate]);

  const todayRows = useMemo(
    () =>
      todayReporterCandidates
        .filter((reporter) => reporterId === null || reporter.id === reporterId)
        .map((reporter) => ({
          reporter,
          report: reporter.clerkUserId
            ? getReportForReporterAndDate(reporter.clerkUserId, todayIsoDate)
            : undefined,
        }))
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

  const selectedReporterClerkId =
    reporterId === null
      ? null
      : (reporters.find((reporter) => reporter.id === reporterId)?.clerkUserId ?? null);

  const historicalReports = useMemo(
    () =>
      reports
        .filter((report) => {
          if (!matchesDateFilter(report.date, dateFilter, todayIsoDate)) return false;
          if (reporterId !== null && report.reporterId !== selectedReporterClerkId)
            return false;
          if (categoryId !== null && !reportMatchesCategory(report, items, categoryId))
            return false;
          return true;
        })
        .sort((a, b) => b.date.localeCompare(a.date)),
    [reports, items, dateFilter, reporterId, selectedReporterClerkId, categoryId, todayIsoDate],
  );

  const detailReport = reports.find((report) => report.id === detailReportId);

  const filterSummary = [
    REPORT_DATE_FILTER_LABELS[dateFilter],
    reporterId === null
      ? "All reporters"
      : (reporters.find((reporter) => reporter.id === reporterId)?.name ?? "Unknown reporter"),
    categoryId === null
      ? "All categories"
      : (categories.find((category) => category.id === categoryId)?.name ?? "Unknown category"),
  ].join(" · ");

  // `historicalReports` already applies all three filters for every date
  // filter — including "today", where the list itself renders the roster-based
  // `todayRows` instead. So it is the right export set in all cases.
  const runExport = async (exporter: (input: ReportExportInput) => Promise<void>) => {
    if (historicalReports.length === 0) {
      Alert.alert("Nothing to export", "No reports match the current filters.");
      return;
    }

    setIsExporting(true);
    try {
      await exporter({
        reports: historicalReports,
        items,
        categories,
        units,
        appUsers,
        filterSummary,
      });
    } catch (error) {
      console.warn("[ManagerReportsView] Report export failed:", error);
      Alert.alert("Export failed", "Please try again.");
    } finally {
      setIsExporting(false);
    }
  };

  return (
    <View className="flex-1 gap-4">
      <View className="flex-row flex-wrap items-center justify-between gap-2 px-4">
        <Text className="font-inter-bold text-2xl text-maroon">Reports</Text>

        <View className="flex-row flex-wrap items-center gap-2">
          <TouchableOpacity
            className="flex-row items-center gap-1 rounded-lg bg-gold px-3 py-2"
            activeOpacity={0.8}
            onPress={onSelfReport}
            accessibilityRole="button"
            accessibilityLabel="Make a report"
          >
            <Ionicons name="add" size={14} color={colors.textPrimary} />
            <Text className="font-inter-semibold text-xs text-text-primary">Make a Report</Text>
          </TouchableOpacity>

          <ExportButton
            label="PDF"
            accessibilityLabel="Export reports as PDF"
            disabled={isExporting}
            onPress={() => void runExport(exportReportsAsPdf)}
          />

          <ExportButton
            label="XLSX"
            accessibilityLabel="Export reports as XLSX"
            disabled={isExporting}
            onPress={() => void runExport(exportReportsAsXlsx)}
          />
        </View>
      </View>

      <ReportFilters
        dateFilter={dateFilter}
        onDateFilterChange={setDateFilter}
        reporters={reporters}
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
        isLocked={detailReport ? isReportLocked(detailReport, todayIsoDate) : false}
        onClose={() => setDetailReportId(null)}
      />
    </View>
  );
}

type ExportButtonProps = {
  label: string;
  accessibilityLabel: string;
  disabled: boolean;
  onPress: () => void;
};

function ExportButton({ label, accessibilityLabel, disabled, onPress }: ExportButtonProps) {
  return (
    <TouchableOpacity
      className="flex-row items-center gap-1 rounded-lg border border-border px-3 py-2"
      style={{ opacity: disabled ? 0.5 : 1 }}
      activeOpacity={0.8}
      disabled={disabled}
      onPress={onPress}
      accessibilityRole="button"
      accessibilityLabel={accessibilityLabel}
      accessibilityState={{ disabled }}
    >
      <Ionicons name="download-outline" size={14} color={colors.maroon} />
      <Text className="font-inter-semibold text-xs text-maroon">{label}</Text>
    </TouchableOpacity>
  );
}

const PREVIEW_LIMIT = 3;

type ReporterTodayRowProps = {
  reporter: AppUser;
  report?: Report;
  items: InventoryItem[];
  units: Unit[];
  onPress: () => void;
};

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