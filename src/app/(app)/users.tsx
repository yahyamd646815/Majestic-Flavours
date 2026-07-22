import { useUser } from "@clerk/expo";
import { Redirect } from "expo-router";
import { Text, View } from "react-native";
import { SafeAreaView } from "react-native-safe-area-context";

import { colors } from "@/constants/theme";
import { parseRole } from "@/types/role";

export default function Users() {
  const { user } = useUser();
  const role = parseRole(user?.publicMetadata?.role);

  if (role !== "admin") return <Redirect href="/reports" />;

  return (
    <SafeAreaView style={{ flex: 1, backgroundColor: colors.white }}>
      <View className="flex-1 items-center justify-center gap-8 px-6">
        <Text className="font-inter-bold text-2xl text-maroon">Users</Text>
      </View>
    </SafeAreaView>
  );
}
