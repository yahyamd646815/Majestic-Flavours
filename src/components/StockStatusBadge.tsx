import { Ionicons } from "@expo/vector-icons";
import { Text, View } from "react-native";

import { colors } from "@/constants/theme";
import {
  STOCK_STATUS_BADGE_CLASSES,
  STOCK_STATUS_LABELS,
  type StockStatus,
} from "@/lib/stockStatus";

const iconColors: Record<StockStatus, string> = {
  out_of_stock: colors.outOfStock,
  low_stock: colors.lowStock,
  in_stock: colors.inStock,
};

type StockStatusBadgeProps = {
  status: StockStatus;
  /** True when this status came from a manual ping rather than the quantity.
   * Shows a small flag, without which "Out of Stock" next to 50 units in
   * stock reads as a bug rather than a deliberate flag. */
  isOverridden: boolean;
};

export function StockStatusBadge({ status, isOverridden }: StockStatusBadgeProps) {
  const classes = STOCK_STATUS_BADGE_CLASSES[status];

  return (
    <View className="flex-row items-center gap-1">
      {isOverridden ? (
        <Ionicons
          name="flag"
          size={12}
          color={iconColors[status]}
          accessibilityLabel="Status set manually in a report"
        />
      ) : null}
      <View className={classes.badge}>
        <Text className={classes.text}>{STOCK_STATUS_LABELS[status]}</Text>
      </View>
    </View>
  );
}
