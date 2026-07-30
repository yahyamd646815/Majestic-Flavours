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
import { useInventoryStore } from "@/store/inventoryStore";
import { useReportStore } from "@/store/reportStore";
import type { AppUser, Report } from "@/types/inventory";

const employees = sampleUsers.filter((user) => user.role === "employee");

type ManagerReportsViewProps = {
  footer: ReactElement;
};

/**
 * Admin and Manager view. "Today" tracks which employees have reported yet;
 * past ranges list the reports themselves, one per employee per day.
 */
export function ManagerReportsView({ footer }: ManagerReportsViewProps) {
  const items = useInventoryStore((state) => state.items);
  const categories = useInventoryStore((state) => state.categories);
  const reports = useReportStore((state) => state.reports);
  const getReportForEmployeeAndDate = useReportStore(
    (state) => state.getReportForEmployeeAndDate,
  );

  const [dateFilter, setDateFilter] = useState<ReportDateFilter>("all");
  const [employeeId, setEmployeeId] = useState<string | null>(null);
  const [category, setCategory] = useState<string | null>(null);
  const [detailReportId, setDetailReportId] = useState<string | null>(null);

  const todayIsoDate = getTodayIsoDate();

  const todayRows = useMemo(
    () =>
      employees
        .filter((employee) => employeeId === null || employee.id === employeeId)
        .map((employee) => ({
          employee,
          report: getReportForEmployeeAndDate(employee.id, todayIsoDate),
        }))
        // With a category filter on: an employee who has already reported
        // stays listed only if that report touched the category. An employee
        // who hasn't reported yet stays listed only if they're actually
        // assigned to an item in that category — otherwise the filter would
        // show someone with nothing to do with the selected category.
        .filter(({ employee, report }) => {
          if (category === null) return true;
          if (report) return reportMatchesCategory(report, items, category);
          return items.some(
            (item) =>
              item.category === category && item.assignedEmployeeIds.includes(employee.id),
          );
        }),
    // `reports` looks unused to the linter, but the getter reads it lazily
    // through the store's `get()` — without it as a dependency this memo would
    // not recompute when an employee submits or updates today's report.
    // eslint-disable-next-line react-hooks/exhaustive-deps
    [reports, getReportForEmployeeAndDate, employeeId, category, items, todayIsoDate],
  );

  const historicalReports = useMemo(
    () =>
      reports
        .filter((report) => {
          if (!matchesDateFilter(report.date, dateFilter, todayIsoDate)) return false;
          if (employeeId !== null && report.employeeId !== employeeId) return false;
          if (category !== null && !reportMatchesCategory(report, items, category)) return false;
          return true;
        })
        // Newest first.
        .sort((a, b) => b.date.localeCompare(a.date)),
    [reports, items, dateFilter, employeeId, category, todayIsoDate],
  );

  const detailReport = reports.find((report) => report.id === detailReportId);

  return (
    <View className="flex-1 gap-4">
      <ReportFilters
        dateFilter={dateFilter}
        onDateFilterChange={setDateFilter}
        employees={employees}
        selectedEmployeeId={employeeId}
        onEmployeeChange={setEmployeeId}
        categories={categories}
        selectedCategory={category}
        onCategoryChange={setCategory}
      />

      {dateFilter === "today" ? (
        <FlatList
          className="flex-1"
          data={todayRows}
          keyExtractor={(row) => row.employee.id}
          contentContainerStyle={styles.listContent}
          ItemSeparatorComponent={() => <View className="h-3" />}
          ListEmptyComponent={
            <EmptyState message="No employees match these filters." />
          }
          ListFooterComponent={footer}
          renderItem={({ item: row }) => (
            <EmployeeTodayRow
              employee={row.employee}
              report={row.report}
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
          ListEmptyComponent={
            <EmptyState message="No reports match these filters yet." />
          }
          ListFooterComponent={footer}
          renderItem={({ item: report }) => (
            <ReportCard
              report={report}
              items={items}
              employee={sampleUsers.find((user) => user.id === report.employeeId)}
              isLocked={isReportLocked(report, todayIsoDate)}
            />
          )}
        />
      )}

      <ReportDetailModal
        visible={detailReport !== undefined}
        report={detailReport}
        items={items}
        employee={sampleUsers.find((user) => user.id === detailReport?.employeeId)}
        isLocked={detailReport ? isReportLocked(detailReport, todayIsoDate) : false}
        onClose={() => setDetailReportId(null)}
      />
    </View>
  );
}

type EmployeeTodayRowProps = {
  employee: AppUser;
  /** Undefined while the employee has not reported today. */
  report?: Report;
  onPress: () => void;
};

/** One employee's status for today — tappable once their report exists. */
function EmployeeTodayRow({ employee, report, onPress }: EmployeeTodayRowProps) {
  const hasReport = report !== undefined;
  const changeCount = report?.itemChanges.length ?? 0;

  return (
    <TouchableOpacity
      className="card gap-2"
      activeOpacity={hasReport ? 0.85 : 1}
      disabled={!hasReport}
      onPress={onPress}
      accessibilityRole="button"
      accessibilityLabel={`${employee.name}: ${
        hasReport ? "report made" : "report still being made"
      }`}
    >
      <View className="flex-row items-center justify-between gap-2">
        <Text className="flex-1 font-inter-semibold text-base text-text-primary">
          {employee.name}
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

        {hasReport ? (
          <Text className="font-inter text-xs text-text-secondary">
            {changeCount} item{changeCount === 1 ? "" : "s"} changed
          </Text>
        ) : null}
      </View>
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