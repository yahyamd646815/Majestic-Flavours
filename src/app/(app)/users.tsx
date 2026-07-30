import { useUser } from "@clerk/expo";
import { Ionicons } from "@expo/vector-icons";
import { Redirect } from "expo-router";
import { Alert, FlatList, StyleSheet, Text, TouchableOpacity, View } from "react-native";
import { SafeAreaView } from "react-native-safe-area-context";

import { UserCard } from "@/components/UserCard";
import { colors } from "@/constants/theme";
import { sampleUsers } from "@/data/sampleUsers";
import { parseRole } from "@/types/role";

function showAddUserComingSoon() {
  Alert.alert("Coming soon", "User creation will be available in a future update.");
}

function showEditRoleComingSoon() {
  Alert.alert("Coming soon", "Role editing will be available in a future update.");
}

function showRemoveUserComingSoon() {
  Alert.alert("Coming soon", "User removal will be available in a future update.");
}

export default function Users() {
  const { user } = useUser();
  const role = parseRole(user?.publicMetadata?.role);

  if (role !== "admin") return <Redirect href="/reports" />;

  return (
    <SafeAreaView style={{ flex: 1, backgroundColor: colors.white }}>
      <View className="flex-1 gap-4 pt-4">
        <View className="flex-row items-center justify-between gap-3 px-4">
          <Text className="font-inter-bold text-2xl text-maroon">Users</Text>

          <TouchableOpacity
            className="flex-row items-center gap-1 rounded-lg bg-gold px-3 py-2"
            activeOpacity={0.85}
            onPress={showAddUserComingSoon}
            accessibilityRole="button"
            accessibilityLabel="Add user"
          >
            <Ionicons name="add" size={16} color={colors.textPrimary} />
            <Text className="font-inter-semibold text-xs text-text-primary">Add User</Text>
          </TouchableOpacity>
        </View>

        <FlatList
          className="flex-1"
          data={sampleUsers}
          keyExtractor={(item) => item.id}
          contentContainerStyle={styles.listContent}
          ItemSeparatorComponent={() => <View className="h-3" />}
          renderItem={({ item }) => (
            <UserCard user={item} onEditRole={showEditRoleComingSoon} onRemove={showRemoveUserComingSoon} />
          )}
        />
      </View>
    </SafeAreaView>
  );
}

const styles = StyleSheet.create({
  listContent: {
    paddingHorizontal: 16,
    paddingBottom: 24,
  },
});
