import { useUser } from "@clerk/expo";
import { Ionicons } from "@expo/vector-icons";
import { Redirect } from "expo-router";
import { usePostHog } from "posthog-react-native";
import { useEffect, useRef, useState } from "react";
import { ScrollView, StyleSheet, Text, View } from "react-native";
import { SafeAreaView } from "react-native-safe-area-context";

import { CategoryFilter } from "@/components/CategoryFilter";
import { CollapsibleSection } from "@/components/CollapsibleSection";
import { ErrorState } from "@/components/ErrorState";
import { LoadingState } from "@/components/LoadingState";
import { StockStatusBadge } from "@/components/StockStatusBadge";
import { colors } from "@/constants/theme";
import { ONE_MINUTE_MS, useNowTick } from "@/hooks/useNowTick";
import { formatElapsedSince } from "@/lib/elapsedTime";
import { getAssignedNames } from "@/lib/getAssignedNames";
import { getCategoryName, getUnitLabel } from "@/lib/inventoryLabels";
import { getEffectiveStatus } from "@/lib/stockStatus";
import { useSupabaseClient } from "@/lib/supabase";
import type { SyncedUser } from "@/store/appUsersStore";
import { useAppUsersStore } from "@/store/appUsersStore";
import { useInventoryStore } from "@/store/inventoryStore";
import { useUnitsStore } from "@/store/unitsStore";
import type { Category, InventoryItem, Unit } from "@/types/inventory";
import { parseRole } from "@/types/role";

/** Pinged items (manual override) first, quantity-derived items after, and
 * within each of those two groups most-recently-updated first — so the item
 * whose status just changed sits at the top of its group and the one that has
 * been sitting there for weeks sinks to the bottom. Group membership stays the
 * primary key; recency only breaks ties inside a group. Still stable-sorted, so
 * two items updated in the same minute keep their relative arrival order.
 * Dashboard-only: Inventory and Reports keep their own sort logic. */
function sortPingedFirst(items: InventoryItem[]): InventoryItem[] {
  return [...items].sort((a, b) => {
    const aWeight = a.statusOverride !== null ? 0 : 1;
    const bWeight = b.statusOverride !== null ? 0 : 1;
    if (aWeight !== bWeight) return aWeight - bWeight;
    // Parsed rather than string-compared: these timestamps are rendered as a
    // clock reading elsewhere on the same card, so they are compared as
    // instants, not as text that happens to sort.
    return Date.parse(b.statusUpdatedAt) - Date.parse(a.statusUpdatedAt);
  });
}

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

  // Drives the elapsed-time timers on the alert cards. A minute is as fine as
  // the DD:HH:MM display can show, so there is nothing to gain from ticking
  // faster.
  const nowMs = useNowTick(ONE_MINUTE_MS);

  // Local, not `inventoryStore.selectedCategoryIds`: that set belongs to the
  // Inventory screen, and sharing it would mean narrowing the Dashboard
  // silently re-filters Inventory too. One control here, shared by both alert
  // sections — deliberately no employee filter, since this is a quick overview
  // and Inventory/Tasks already own assignment browsing.
  const [selectedCategoryIds, setSelectedCategoryIds] = useState<Set<string>>(new Set());

  function toggleCategoryId(categoryId: string) {
    setSelectedCategoryIds((current) => {
      const next = new Set(current);
      if (next.has(categoryId)) next.delete(categoryId);
      else next.add(categoryId);
      return next;
    });
  }

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
  // Counted through `getEffectiveStatus`, exactly like `getLowStockItems`
  // below and the Inventory card badges — so a manually pinged status can
  // never make these three disagree with each other.
  const outOfStockCount = items.filter(
    (item) => getEffectiveStatus(item) === "out_of_stock",
  ).length;
  const lowStockCount = items.filter((item) => getEffectiveStatus(item) === "low_stock").length;

  // `alertItems` stays unfiltered so the "All items are well stocked" empty
  // state below can tell "nothing is wrong" apart from "nothing matches this
  // category" — the two sections themselves read the filtered list. An empty
  // selection means the filter is inactive and matches everything, matching
  // how `CategoryFilter` behaves on Inventory.
  const alertItems = getLowStockItems();
  const filteredAlertItems = alertItems.filter(
    (item) => selectedCategoryIds.size === 0 || selectedCategoryIds.has(item.categoryId),
  );
  const outOfStockItems = sortPingedFirst(
    filteredAlertItems.filter((item) => getEffectiveStatus(item) === "out_of_stock"),
  );
  const lowStockAlertItems = sortPingedFirst(
    filteredAlertItems.filter((item) => getEffectiveStatus(item) === "low_stock"),
  );

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
        <>
          <View className="pt-4">
            <CategoryFilter
              categories={categories}
              selectedCategoryIds={selectedCategoryIds}
              onToggle={toggleCategoryId}
              onClear={() => setSelectedCategoryIds(new Set())}
            />
          </View>

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

              {alertItems.length === 0 ? (
                <View>
                  <View className="section-header rounded-t-xl">
                    <Text className="section-header__title">Low Stock Alerts</Text>
                  </View>
                  <View className="items-center gap-2 rounded-b-xl bg-cream p-3 py-8">
                    <Ionicons name="checkmark-circle" size={40} color={colors.inStock} />
                    <Text className="font-inter-medium text-sm text-text-secondary">
                      All items are well stocked.
                    </Text>
                  </View>
                </View>
              ) : (
                <View className="gap-4">
                  <CollapsibleSection title="Out of Stock" count={outOfStockItems.length}>
                    {outOfStockItems.length === 0 ? (
                      <Text className="py-2 text-center font-inter text-xs text-text-secondary">
                        No items out of stock.
                      </Text>
                    ) : (
                      outOfStockItems.map((item) => (
                        <AlertItemCard
                          key={item.id}
                          item={item}
                          categories={categories}
                          units={units}
                          appUsers={appUsers}
                          nowMs={nowMs}
                        />
                      ))
                    )}
                  </CollapsibleSection>

                  <CollapsibleSection title="Low Stock" count={lowStockAlertItems.length}>
                    {lowStockAlertItems.length === 0 ? (
                      <Text className="py-2 text-center font-inter text-xs text-text-secondary">
                        No items low on stock.
                      </Text>
                    ) : (
                      lowStockAlertItems.map((item) => (
                        <AlertItemCard
                          key={item.id}
                          item={item}
                          categories={categories}
                          units={units}
                          appUsers={appUsers}
                          nowMs={nowMs}
                        />
                      ))
                    )}
                  </CollapsibleSection>
                </View>
              )}
            </View>
          </ScrollView>
        </>
      )}
    </SafeAreaView>
  );
}

type AlertItemCardProps = {
  item: InventoryItem;
  categories: Category[];
  units: Unit[];
  appUsers: SyncedUser[];
  /** Ticked once a minute by the screen, so every card's timer advances
   * together instead of each one owning its own interval. */
  nowMs: number;
};

function AlertItemCard({ item, categories, units, appUsers, nowMs }: AlertItemCardProps) {
  const status = getEffectiveStatus(item);
  const assignedNames = getAssignedNames(item.assignedEmployeeIds, appUsers);

  return (
    <View className="card gap-2">
      <View className="flex-row items-start justify-between gap-2">
        <View className="flex-1">
          <Text className="font-inter-semibold text-base text-text-primary">{item.name}</Text>
          <Text className="font-inter text-xs text-text-secondary">
            {getCategoryName(categories, item.categoryId)}
          </Text>
        </View>
        <StockStatusBadge status={status} isOverridden={item.statusOverride !== null} />
      </View>

      <Text className="font-inter text-sm text-text-primary">
        {item.currentQuantity} {getUnitLabel(units, item.unitId)} remaining
      </Text>

      <Text className="font-inter text-xs text-text-secondary">
        Assigned: {assignedNames.length > 0 ? assignedNames.join(", ") : "Unassigned"}
      </Text>

      {/* Counts from whenever this item's status last moved, whether that was
          a manual ping or an ordinary quantity change — the timer does not
          distinguish between the two. */}
      <View className="flex-row items-center gap-1.5">
        <Ionicons name="time-outline" size={13} color={colors.textSecondary} />
        <Text className="font-inter-semibold text-xs text-text-primary">
          {formatElapsedSince(item.statusUpdatedAt, nowMs)}
        </Text>
        <Text className="font-inter text-xs text-text-secondary">
          since status change (DD:HH:MM)
        </Text>
      </View>
    </View>
  );
}