import { Ionicons } from "@expo/vector-icons";
import { Text, TouchableOpacity, View } from "react-native";

import { colors } from "@/constants/theme";
import type { InventoryItem, ReportItemChange } from "@/types/inventory";

type EmployeeReportCardProps = {
  item: InventoryItem;
  /** Today's net change for this item, when the employee has already moved it. */
  todaysChange?: ReportItemChange;
  onQuantityChange: (nextQuantity: number) => void;
};

/** One assigned item: stock stepper plus today's net change, if any. */
export function EmployeeReportCard({
  item,
  todaysChange,
  onQuantityChange,
}: EmployeeReportCardProps) {
  const isOutOfStock = item.currentQuantity === 0;
  const isLowStock = !isOutOfStock && item.currentQuantity <= item.minThreshold;

  const badgeClass = isOutOfStock
    ? "status-badge status-badge--out-of-stock"
    : isLowStock
      ? "status-badge status-badge--low-stock"
      : "status-badge status-badge--in-stock";
  const badgeTextClass = isOutOfStock
    ? "status-badge__text--out-of-stock"
    : isLowStock
      ? "status-badge__text--low-stock"
      : "status-badge__text--in-stock";
  const statusLabel = isOutOfStock ? "Out of Stock" : isLowStock ? "Low Stock" : "In Stock";

  return (
    <View className="card gap-3">
      <View className="flex-row items-start justify-between gap-2">
        <View className="flex-1">
          <Text className="font-inter-semibold text-base text-text-primary">{item.name}</Text>
          <Text className="font-inter text-xs text-text-secondary">{item.category}</Text>
        </View>
        <View className={badgeClass}>
          <Text className={badgeTextClass}>{statusLabel}</Text>
        </View>
      </View>

      <View className="flex-row items-center justify-between rounded-lg border border-border px-3 py-2">
        <TouchableOpacity
          className={
            isOutOfStock
              ? "h-11 w-11 items-center justify-center rounded-full bg-cream opacity-40"
              : "h-11 w-11 items-center justify-center rounded-full bg-cream"
          }
          activeOpacity={0.8}
          disabled={isOutOfStock}
          onPress={() => onQuantityChange(item.currentQuantity - 1)}
          accessibilityRole="button"
          accessibilityLabel={`Remove one ${item.unit} of ${item.name}`}
        >
          <Ionicons name="remove" size={22} color={colors.maroon} />
        </TouchableOpacity>

        <Text className="font-inter-semibold text-lg text-text-primary">
          {item.currentQuantity} {item.unit}
        </Text>

        <TouchableOpacity
          className="h-11 w-11 items-center justify-center rounded-full bg-gold"
          activeOpacity={0.8}
          onPress={() => onQuantityChange(item.currentQuantity + 1)}
          accessibilityRole="button"
          accessibilityLabel={`Add one ${item.unit} of ${item.name}`}
        >
          <Ionicons name="add" size={22} color={colors.textPrimary} />
        </TouchableOpacity>
      </View>

      {todaysChange ? (
        <Text className="font-inter text-xs text-text-secondary">
          Today: {todaysChange.startQuantity} → {todaysChange.endQuantity} {item.unit}
        </Text>
      ) : null}
    </View>
  );
}
