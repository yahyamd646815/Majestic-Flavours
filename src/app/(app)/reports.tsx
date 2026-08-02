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
import { sampleUsers } from "@/data/sampleUsers";
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

  // Who owns the report: the real Clerk id, which is what Supabase stores and
  // what RLS checks. Always present for a signed-in user — the guard is only
  // there because Clerk types it as optional.
  const reporterId = user?.id ?? null;

  // Which items an Employee reports on is still keyed on placeholder
  // `sampleUsers` ids (`assignedEmployeeIds`), so that side keeps the
  // email bridge until 13d replaces the placeholder users for good.
  const currentEmail = user?.primaryEmailAddress?.emailAddress;
  const currentSampleUser = sampleUsers.find((sampleUser) => sampleUser.email === currentEmail);

  // Admin/Manager only: swaps the browsing view for their own report entry.
  const [isSelfReporting, setIsSelfReporting] = useState(false);

  const assignedItems = useMemo(
    () =>
      currentSampleUser
        ? items.filter((item) => item.assignedEmployeeIds.includes(currentSampleUser.id))
        : [],
    [items, currentSampleUser],
  );

  const footer = <View className="pt-6" />;

  const combinedError = error ?? unitsError ?? reportsError;
  const isEmptyAndLoading =
    (isLoading || unitsLoading || reportsLoading) && items.length === 0;

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

        {/* Inventory, units AND reports all have to be loaded before any of
            this is meaningful — an employee would otherwise be told they have
            no assigned items, see blank unit labels, or be shown an empty
            "Report" button for a day they have already reported, while a
            fetch is still in flight. */}
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
          // Admins and Managers report on every item, not just assigned ones.
          isSelfReporting && reporterId !== null ? (
            <ReportEntryView reporterId={reporterId} items={items} />
          ) : (
            <ManagerReportsView footer={footer} />
          )
        ) : reporterId !== null && currentSampleUser ? (
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