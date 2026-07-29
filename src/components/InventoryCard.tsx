import { Ionicons } from "@expo/vector-icons";
import { Text, TouchableOpacity, View } from "react-native";

import { colors } from "@/constants/theme";
import { getAssignedNames } from "@/lib/getAssignedNames";
import type { InventoryItem } from "@/types/inventory";

type InventoryCardProps = {
  item: InventoryItem;
  canDelete: boolean;
  onEdit: () => void;
  onDelete: () => void;
};

export function InventoryCard({ item, canDelete, onEdit, onDelete }: InventoryCardProps) {
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

  const assignedNames = getAssignedNames(item.assignedEmployeeIds);

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

      <Text className="font-inter text-sm text-text-primary">
        {item.currentQuantity} {item.unit}
      </Text>

      {assignedNames.length > 0 ? (
        <View className="flex-row flex-wrap gap-2">
          {assignedNames.map((name, index) => (
            <View key={`${item.id}-${index}`} className="chip">
              <Text className="chip__text">{name}</Text>
            </View>
          ))}
        </View>
      ) : (
        <Text className="font-inter text-xs text-text-secondary">Unassigned</Text>
      )}

      <View className="flex-row gap-3 border-t border-border pt-3">
        <TouchableOpacity
          className="flex-1 flex-row items-center justify-center gap-1 rounded-lg border border-border py-2"
          activeOpacity={0.8}
          onPress={onEdit}
        >
          <Ionicons name="create-outline" size={16} color={colors.maroon} />
          <Text className="font-inter-semibold text-sm text-maroon">Edit</Text>
        </TouchableOpacity>

        {canDelete ? (
          <TouchableOpacity
            className="flex-1 flex-row items-center justify-center gap-1 rounded-lg border border-out-of-stock py-2"
            activeOpacity={0.8}
            onPress={onDelete}
          >
            <Ionicons name="trash-outline" size={16} color={colors.outOfStock} />
            <Text className="font-inter-semibold text-sm text-out-of-stock">Delete</Text>
          </TouchableOpacity>
        ) : null}
      </View>
    </View>
  );
}
