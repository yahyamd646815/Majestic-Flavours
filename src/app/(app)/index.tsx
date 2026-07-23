import { useAuth, useUser } from "@clerk/expo";
import { Ionicons } from "@expo/vector-icons";
import { Redirect } from "expo-router";
import { ScrollView, StyleSheet, Text, TouchableOpacity, View } from "react-native";
import { SafeAreaView } from "react-native-safe-area-context";

import { DevClearStorageButton } from "@/components/DevClearStorageButton";
import { colors } from "@/constants/theme";
import { sampleUsers } from "@/data/sampleUsers";
import { clearPersistedState } from "@/lib/clearPersistedState";
import { useInventoryStore } from "@/store/inventoryStore";
import { parseRole } from "@/types/role";

const styles = StyleSheet.create({
  scrollContent: {
    paddingBottom: 32,
  },
});

function getAssignedNames(employeeIds: string[]): string {
  const names = employeeIds
    .map((id) => sampleUsers.find((user) => user.id === id)?.name)
    .filter((name): name is string => Boolean(name));

  return names.length > 0 ? names.join(", ") : "Unassigned";
}

export default function Dashboard() {
  const { signOut } = useAuth();
  const { user } = useUser();
  const role = parseRole(user?.publicMetadata?.role);
  const items = useInventoryStore((state) => state.items);
  const getLowStockItems = useInventoryStore((state) => state.getLowStockItems);

  if (role === "employee") return <Redirect href="/reports" />;

  const displayName = user?.firstName ?? user?.fullName ?? "there";
  const today = new Date().toLocaleDateString("en-GB", {
    weekday: "long",
    day: "numeric",
    month: "long",
  });

  const totalItems = items.length;
  const outOfStockCount = items.filter((item) => item.currentQuantity === 0).length;
  const lowStockCount = items.filter(
    (item) => item.currentQuantity > 0 && item.currentQuantity <= item.minThreshold,
  ).length;

  const alertItems = getLowStockItems();

  return (
    <SafeAreaView style={{ flex: 1, backgroundColor: colors.white }}>
      <ScrollView contentContainerStyle={styles.scrollContent}>
        <View className="gap-6 px-4 pt-4">
          <View>
            <Text className="font-inter-bold text-2xl text-maroon">Hello, {displayName}</Text>
            <Text className="mt-1 font-inter text-sm text-text-secondary">{today}</Text>
          </View>

          <View className="flex-row gap-3">
            <View className="card flex-1 items-center gap-1">
              <Text className="font-inter-bold text-2xl text-maroon">{totalItems}</Text>
              <Text className="font-inter text-xs text-text-secondary">Total Items</Text>
            </View>
            <View className="card flex-1 items-center gap-1">
              <Text className="font-inter-bold text-2xl text-out-of-stock">
                {outOfStockCount}
              </Text>
              <Text className="font-inter text-xs text-text-secondary">Out of Stock</Text>
            </View>
            <View className="card flex-1 items-center gap-1">
              <Text className="font-inter-bold text-2xl text-low-stock">{lowStockCount}</Text>
              <Text className="font-inter text-xs text-text-secondary">Low Stock</Text>
            </View>
          </View>

          <View>
            <View className="section-header rounded-t-xl">
              <Text className="section-header__title">Low Stock Alerts</Text>
            </View>

            <View className="gap-3 rounded-b-xl bg-cream p-3">
              {alertItems.length === 0 ? (
                <View className="items-center gap-2 py-8">
                  <Ionicons name="checkmark-circle" size={40} color={colors.inStock} />
                  <Text className="font-inter-medium text-sm text-text-secondary">
                    All items are well stocked.
                  </Text>
                </View>
              ) : (
                alertItems.map((item) => {
                  const isOutOfStock = item.currentQuantity === 0;
                  const badgeClass = isOutOfStock
                    ? "status-badge status-badge--out-of-stock"
                    : "status-badge status-badge--low-stock";
                  const badgeTextClass = isOutOfStock
                    ? "status-badge__text--out-of-stock"
                    : "status-badge__text--low-stock";

                  return (
                    <View key={item.id} className="card gap-2">
                      <View className="flex-row items-start justify-between gap-2">
                        <View className="flex-1">
                          <Text className="font-inter-semibold text-base text-text-primary">
                            {item.name}
                          </Text>
                          <Text className="font-inter text-xs text-text-secondary">
                            {item.category}
                          </Text>
                        </View>
                        <View className={badgeClass}>
                          <Text className={badgeTextClass}>
                            {isOutOfStock ? "Out of Stock" : "Low Stock"}
                          </Text>
                        </View>
                      </View>

                      <Text className="font-inter text-sm text-text-primary">
                        {item.currentQuantity} {item.unit} remaining
                      </Text>

                      <Text className="font-inter text-xs text-text-secondary">
                        Assigned: {getAssignedNames(item.assignedEmployeeIds)}
                      </Text>
                    </View>
                  );
                })
              )}
            </View>
          </View>

          <TouchableOpacity
            className="btn-primary"
            activeOpacity={0.85}
            onPress={() => {
              void (async () => {
                await clearPersistedState();
                await signOut();
              })();
            }}
          >
            <Text className="btn-primary__text">Sign Out</Text>
          </TouchableOpacity>

          <DevClearStorageButton />
        </View>
      </ScrollView>
    </SafeAreaView>
  );
}
