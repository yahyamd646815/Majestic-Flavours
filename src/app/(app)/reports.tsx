import { useAuth, useUser } from "@clerk/expo";
import { Ionicons } from "@expo/vector-icons";
import { Alert, Text, TouchableOpacity, View } from "react-native";
import { SafeAreaView } from "react-native-safe-area-context";

import { DevClearStorageButton } from "@/components/DevClearStorageButton";
import { EmployeeReportsView } from "@/components/EmployeeReportsView";
import { ManagerReportsView } from "@/components/ManagerReportsView";
import { colors } from "@/constants/theme";
import { sampleUsers } from "@/data/sampleUsers";
import { parseRole } from "@/types/role";

function showExportComingSoon() {
  Alert.alert("Coming soon", "Export will be available in a future update.");
}

export default function Reports() {
  const { signOut } = useAuth();
  const { user } = useUser();
  const role = parseRole(user?.publicMetadata?.role);
  const canViewAllReports = role === "admin" || role === "manager";

  // Clerk accounts are not linked to `sampleUsers` yet, so bridge the two by
  // email — `sampleUsers` ids are what inventory and reports are keyed on.
  const currentEmail = user?.primaryEmailAddress?.emailAddress;
  const currentSampleUser = sampleUsers.find((sampleUser) => sampleUser.email === currentEmail);

  const footer = (
    <View className="gap-3 pt-6">
      <TouchableOpacity className="btn-primary" activeOpacity={0.85} onPress={() => void signOut()}>
        <Text className="btn-primary__text">Sign Out</Text>
      </TouchableOpacity>

      <DevClearStorageButton />
    </View>
  );

  return (
    <SafeAreaView style={{ flex: 1, backgroundColor: colors.white }}>
      <View className="flex-1 gap-4 pt-4">
        <View className="flex-row items-center justify-between gap-3 px-4">
          <Text className="font-inter-bold text-2xl text-maroon">Reports</Text>

          {canViewAllReports ? (
            <View className="flex-row gap-2">
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
            </View>
          ) : null}
        </View>

        {canViewAllReports ? (
          <ManagerReportsView footer={footer} />
        ) : currentSampleUser ? (
          <EmployeeReportsView employeeId={currentSampleUser.id} footer={footer} />
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
