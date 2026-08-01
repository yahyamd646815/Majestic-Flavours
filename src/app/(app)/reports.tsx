import { useUser } from "@clerk/expo";
import { Ionicons } from "@expo/vector-icons";
import { useMemo, useState } from "react";
import { Alert, Text, TouchableOpacity, View } from "react-native";
import { SafeAreaView } from "react-native-safe-area-context";

import { ManagerReportsView } from "@/components/ManagerReportsView";
import { ReportEntryView } from "@/components/ReportEntryView";
import { colors } from "@/constants/theme";
import { sampleUsers } from "@/data/sampleUsers";
import { useInventoryStore } from "@/store/inventoryStore";
import { parseRole } from "@/types/role";

function showExportComingSoon() {
  Alert.alert("Coming soon", "Export will be available in a future update.");
}

export default function Reports() {
  const { user } = useUser();
  const role = parseRole(user?.publicMetadata?.role);
  const canViewAllReports = role === "admin" || role === "manager";

  const items = useInventoryStore((state) => state.items);

  // Clerk accounts are not linked to `sampleUsers` yet, so bridge the two by
  // email — `sampleUsers` ids are what inventory and reports are keyed on.
  // Admins and Managers resolve their own identity the same way, so they can
  // file a report of their own.
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
                  {currentSampleUser ? (
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
                  ) : null}

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

        {canViewAllReports ? (
          // Admins and Managers report on every item, not just assigned ones.
          isSelfReporting && currentSampleUser ? (
            <ReportEntryView reporterId={currentSampleUser.id} items={items} />
          ) : (
            <ManagerReportsView footer={footer} />
          )
        ) : currentSampleUser ? (
          <ReportEntryView reporterId={currentSampleUser.id} items={assignedItems} />
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
