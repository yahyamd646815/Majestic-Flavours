import { useUser } from "@clerk/expo";
import { Ionicons } from "@expo/vector-icons";
import { useMemo, useState } from "react";
import { Alert, Text, TouchableOpacity, View } from "react-native";
import { SafeAreaView } from "react-native-safe-area-context";

import { ErrorState } from "@/components/ErrorState";
import { LoadingState } from "@/components/LoadingState";
import { ManagerReportsView } from "@/components/ManagerReportsView";
import { ReportEntryView } from "@/components/ReportEntryView";
import { colors } from "@/constants/theme";
import { useSupabaseClient } from "@/lib/supabase";
import { useInventoryStore } from "@/store/inventoryStore";
import { useReportStore } from "@/store/reportStore";
import { useUnitsStore } from "@/store/unitsStore";
import { parseRole } from "@/types/role";

function showExportComingSoon() {
  Alert.alert("Coming soon", "Export will be available in a future update.");
}

export default function Reports() {
  const { user } = useUser();
  const role = parseRole(user?.publicMetadata?.role);
  const canViewAllReports = role === "admin" || role === "manager";

  const supabase = useSupabaseClient();
  const items = useInventoryStore((state) => state.items);
  const isLoading = useInventoryStore((state) => state.isLoading);
  const error = useInventoryStore((state) => state.error);
  const fetchAll = useInventoryStore((state) => state.fetchAll);
  const unitsLoading = useUnitsStore((state) => state.isLoading);
  const unitsError = useUnitsStore((state) => state.error);
  const fetchUnits = useUnitsStore((state) => state.fetchAll);
  const reportsLoading = useReportStore((state) => state.isLoading);
  const reportsError = useReportStore((state) => state.error);
  const fetchReports = useReportStore((state) => state.fetchAll);

  const reporterId = user?.id ?? null;

  const [isSelfReporting, setIsSelfReporting] = useState(false);

  const assignedItems = useMemo(
    () =>
      reporterId ? items.filter((item) => item.assignedEmployeeIds.includes(reporterId)) : [],
    [items, reporterId],
  );

  const footer = <View className="pt-6" />;

  const combinedError = error ?? unitsError ?? reportsError;
  // Each store's own empty-state is checked independently — combining them
  // with a single shared "items.length === 0" check let the reports fetch
  // finish invisibly after inventory resolved first, showing "Report"
  // instead of "Update Report" for a day already reported.
  const isEmptyAndLoading =
    (isLoading && items.length === 0) || unitsLoading || reportsLoading;

  return (
    <SafeAreaView style={{ flex: 1, backgroundColor: colors.white }}>
      <View className="flex-1 gap-4 pt-4">
        <View className="flex-row flex-wrap items-center justify-between gap-2 px-4">
          <Text className="font-inter-bold text-2xl text-maroon">
            {isSelfReporting ? "My Report" : "Reports"}
          </Text>

          {canViewAllReports ? (
            <View className="flex-row flex-wrap items-center gap-2">
              {isSelfReporting ? (
                <TouchableOpacity
                  className="flex-row items-center gap-1 rounded-lg border border-border px-3 py-2"
                  activeOpacity={0.8}
                  onPress={() => setIsSelfReporting(false)}
                  accessibilityRole="button"
                  accessibilityLabel="Back to all reports"
                >
                  <Ionicons name="chevron-back" size={14} color={colors.maroon} />
                  <Text className="font-inter-semibold text-xs text-maroon">Back to Reports</Text>
                </TouchableOpacity>
              ) : (
                <>
                  <TouchableOpacity
                    className="flex-row items-center gap-1 rounded-lg bg-gold px-3 py-2"
                    activeOpacity={0.8}
                    onPress={() => setIsSelfReporting(true)}
                    accessibilityRole="button"
                    accessibilityLabel="Make a report"
                  >
                    <Ionicons name="add" size={14} color={colors.textPrimary} />
                    <Text className="font-inter-semibold text-xs text-text-primary">
                      Make a Report
                    </Text>
                  </TouchableOpacity>

                  <TouchableOpacity
                    className="flex-row items-center gap-1 rounded-lg border border-border px-3 py-2"
                    activeOpacity={0.8}
                    onPress={showExportComingSoon}
                    accessibilityRole="button"
                    accessibilityLabel="Export reports as PDF"
                  >
                    <Ionicons name="download-outline" size={14} color={colors.maroon} />
                    <Text className="font-inter-semibold text-xs text-maroon">PDF</Text>
                  </TouchableOpacity>

                  <TouchableOpacity
                    className="flex-row items-center gap-1 rounded-lg border border-border px-3 py-2"
                    activeOpacity={0.8}
                    onPress={showExportComingSoon}
                    accessibilityRole="button"
                    accessibilityLabel="Export reports as XLSX"
                  >
                    <Ionicons name="download-outline" size={14} color={colors.maroon} />
                    <Text className="font-inter-semibold text-xs text-maroon">XLSX</Text>
                  </TouchableOpacity>
                </>
              )}
            </View>
          ) : null}
        </View>

        {combinedError !== null ? (
          <ErrorState
            message={combinedError}
            onRetry={() => {
              void fetchAll(supabase);
              void fetchUnits(supabase);
              void fetchReports(supabase);
            }}
          />
        ) : isEmptyAndLoading ? (
          <LoadingState />
        ) : canViewAllReports ? (
          isSelfReporting && reporterId !== null ? (
            <ReportEntryView reporterId={reporterId} items={items} />
          ) : (
            <ManagerReportsView footer={footer} />
          )
        ) : role === "employee" && reporterId !== null ? (
          <ReportEntryView reporterId={reporterId} items={assignedItems} />
        ) : (
          <View className="flex-1 items-center gap-3 px-6 pt-12">
            <Ionicons name="person-circle-outline" size={44} color={colors.textSecondary} />
            <Text className="text-center font-inter-medium text-sm text-text-secondary">
              No matching employee profile found for this account.
            </Text>
            {footer}
          </View>
        )}
      </View>
    </SafeAreaView>
  );
}