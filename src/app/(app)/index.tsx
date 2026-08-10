import { useUser } from "@clerk/expo";
import { Ionicons } from "@expo/vector-icons";
import { Redirect } from "expo-router";
import { usePostHog } from "posthog-react-native";
import { useEffect, useRef } from "react";
import { ScrollView, StyleSheet, Text, View } from "react-native";
import { SafeAreaView } from "react-native-safe-area-context";

import { ErrorState } from "@/components/ErrorState";
import { LoadingState } from "@/components/LoadingState";
import { colors } from "@/constants/theme";
import { getAssignedNames } from "@/lib/getAssignedNames";
import { getCategoryName, getUnitLabel } from "@/lib/inventoryLabels";
import { useSupabaseClient } from "@/lib/supabase";
import { useAppUsersStore } from "@/store/appUsersStore";
import { useInventoryStore } from "@/store/inventoryStore";
import { useUnitsStore } from "@/store/unitsStore";
import { parseRole } from "@/types/role";

const styles = StyleSheet.create({
  scrollContent: {
    paddingBottom: 32,
  },
});

export default function Dashboard() {
  const { user } = useUser();
  const role = parseRole(user?.publicMetadata?.role);
  const supabase = useSupabaseClient();
  const items = useInventoryStore((state) => state.items);
  const categories = useInventoryStore((state) => state.categories);
  const units = useUnitsStore((state) => state.units);
  const appUsers = useAppUsersStore((state) => state.users);
  const isLoading = useInventoryStore((state) => state.isLoading);
  const error = useInventoryStore((state) => state.error);
  const fetchAll = useInventoryStore((state) => state.fetchAll);
  const unitsLoading = useUnitsStore((state) => state.isLoading);
  const unitsError = useUnitsStore((state) => state.error);
  const fetchUnits = useUnitsStore((state) => state.fetchAll);
  const getLowStockItems = useInventoryStore((state) => state.getLowStockItems);

  const posthog = usePostHog();
  const hasCapturedLowStockView = useRef(false);

  // Fires at most once per Dashboard mount, the first time this screen has at
  // least one low-stock item to show. It depends on `items` rather than firing
  // on mount alone because inventory arrives asynchronously from Supabase —
  // on the very first render the list is still empty, so a mount-only effect
  // would report zero and never correct itself. Employees are excluded: they
  // are redirected below and never actually see this screen, but the effect
  // would still run on the render that returns the redirect.
  useEffect(() => {
    if (role === "employee" || hasCapturedLowStockView.current) return;
    const lowStockCount = getLowStockItems().length;
    if (lowStockCount === 0) return;
    hasCapturedLowStockView.current = true;
    posthog.capture("low_stock_alert_viewed", { low_stock_count: lowStockCount });
  }, [items, role, getLowStockItems, posthog]);

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

  const combinedError = error ?? unitsError;
  const isEmptyAndLoading = (isLoading || unitsLoading) && items.length === 0;

  return (
    <SafeAreaView style={{ flex: 1, backgroundColor: colors.white }}>
      <View className="px-4 pt-4">
        <Text className="font-inter-bold text-2xl text-maroon">Hello, {displayName}</Text>
        <Text className="mt-1 font-inter text-sm text-text-secondary">{today}</Text>
      </View>

      {combinedError !== null ? (
        <ErrorState
          message={combinedError}
          onRetry={() => {
            void fetchAll(supabase);
            void fetchUnits(supabase);
          }}
        />
      ) : isEmptyAndLoading ? (
        <LoadingState />
      ) : (
        <ScrollView contentContainerStyle={styles.scrollContent}>
          <View className="gap-6 px-4 pt-6">
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
                    const assignedNames = getAssignedNames(item.assignedEmployeeIds, appUsers);

                    return (
                      <View key={item.id} className="card gap-2">
                        <View className="flex-row items-start justify-between gap-2">
                          <View className="flex-1">
                            <Text className="font-inter-semibold text-base text-text-primary">
                              {item.name}
                            </Text>
                            <Text className="font-inter text-xs text-text-secondary">
                              {getCategoryName(categories, item.categoryId)}
                            </Text>
                          </View>
                          <View className={badgeClass}>
                            <Text className={badgeTextClass}>
                              {isOutOfStock ? "Out of Stock" : "Low Stock"}
                            </Text>
                          </View>
                        </View>

                        <Text className="font-inter text-sm text-text-primary">
                          {item.currentQuantity} {getUnitLabel(units, item.unitId)} remaining
                        </Text>

                        <Text className="font-inter text-xs text-text-secondary">
                          Assigned:{" "}
                          {assignedNames.length > 0 ? assignedNames.join(", ") : "Unassigned"}
                        </Text>
                      </View>
                    );
                  })
                )}
              </View>
            </View>
          </View>
        </ScrollView>
      )}
    </SafeAreaView>
  );
}