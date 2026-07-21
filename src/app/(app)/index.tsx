import { useAuth, useUser } from "@clerk/expo";
import { Redirect } from "expo-router";
import { Text, TouchableOpacity, View } from "react-native";
import { SafeAreaView } from "react-native-safe-area-context";

import { DevClearStorageButton } from "@/components/DevClearStorageButton";
import { colors } from "@/constants/theme";
import { parseRole } from "@/types/role";

/**
 * Dashboard placeholder at `/` (Admin and Manager only). The real dashboard is
 * built in a later prompt. Employees are never allowed here — they are bounced
 * to Reports.
 */
export default function Dashboard() {
  const { signOut } = useAuth();
  const { user } = useUser();
  const role = parseRole(user?.publicMetadata?.role);

  if (role === "employee") return <Redirect href="/reports" />;

  return (
    <SafeAreaView style={{ flex: 1, backgroundColor: colors.white }}>
      <View className="flex-1 items-center justify-center gap-8 px-6">
        <Text className="font-inter-bold text-2xl text-maroon">Dashboard</Text>

        <TouchableOpacity
          className="btn-primary"
          activeOpacity={0.85}
          onPress={() => void signOut()}
        >
          <Text className="btn-primary__text">Sign Out</Text>
        </TouchableOpacity>

        <DevClearStorageButton />
      </View>
    </SafeAreaView>
  );
}