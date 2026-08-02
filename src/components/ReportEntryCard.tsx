import { Ionicons } from "@expo/vector-icons";
import { useState } from "react";
import { StyleSheet, Text, TextInput, TouchableOpacity, View } from "react-native";

import { colors, fonts, radii, spacing } from "@/constants/theme";
import { getCategoryName, getUnitLabel } from "@/lib/inventoryLabels";
import { formatSnapshotTime } from "@/lib/reports";
import type { Category, InventoryItem, ReportItemSnapshot, Unit } from "@/types/inventory";

type ReportEntryCardProps = {
  item: InventoryItem;
  /** Needed to resolve the item's `categoryId` / `unitId` into display text. */
  categories: Category[];
  units: Unit[];
  /** The draft quantity if this item has been touched, otherwise the live one. */
  displayQuantity: number;
  /** Everything already recorded for this item in today's report. */
  snapshots: ReportItemSnapshot[];
  /** The draft note if edited, otherwise whatever today's report already holds. */
  note: string;
  /** Today's report is locked — nothing on this card can be changed. */
  isLocked: boolean;
  onQuantityChange: (nextQuantity: number) => void;
  onNoteChange: (note: string) => void;
};

/** One item being reported: stepper, recorded history and an optional note. */
export function ReportEntryCard({
  item,
  categories,
  units,
  displayQuantity,
  snapshots,
  note,
  isLocked,
  onQuantityChange,
  onNoteChange,
}: ReportEntryCardProps) {
  // Collapsed by default — a list can run to 200+ items, and most of them
  // never get a note.
  const [isNoteOpen, setIsNoteOpen] = useState(false);

  const categoryName = getCategoryName(categories, item.categoryId);
  const unitLabel = getUnitLabel(units, item.unitId);

  const isOutOfStock = displayQuantity === 0;
  const isLowStock = !isOutOfStock && displayQuantity <= item.minThreshold;
  const hasPendingChange = displayQuantity !== item.currentQuantity;

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

  const lastSnapshot = snapshots[snapshots.length - 1];

  return (
    <View className="card gap-3">
      <View className="flex-row items-start justify-between gap-2">
        <View className="flex-1">
          <Text className="font-inter-semibold text-base text-text-primary">{item.name}</Text>
          <Text className="font-inter text-xs text-text-secondary">{categoryName}</Text>
        </View>
        <View className={badgeClass}>
          <Text className={badgeTextClass}>{statusLabel}</Text>
        </View>
      </View>

      <View className="flex-row items-center justify-between rounded-lg border border-border px-3 py-2">
        <TouchableOpacity
          className={
            isOutOfStock || isLocked
              ? "h-11 w-11 items-center justify-center rounded-full bg-cream opacity-40"
              : "h-11 w-11 items-center justify-center rounded-full bg-cream"
          }
          activeOpacity={0.8}
          disabled={isOutOfStock || isLocked}
          onPress={() => onQuantityChange(displayQuantity - 1)}
          accessibilityRole="button"
          accessibilityLabel={`Remove one ${unitLabel} of ${item.name}`}
        >
          <Ionicons name="remove" size={22} color={colors.maroon} />
        </TouchableOpacity>

        <Text className="font-inter-semibold text-lg text-text-primary">
          {displayQuantity} {unitLabel}
        </Text>

        <TouchableOpacity
          className={
            isLocked
              ? "h-11 w-11 items-center justify-center rounded-full bg-gold opacity-40"
              : "h-11 w-11 items-center justify-center rounded-full bg-gold"
          }
          activeOpacity={0.8}
          disabled={isLocked}
          onPress={() => onQuantityChange(displayQuantity + 1)}
          accessibilityRole="button"
          accessibilityLabel={`Add one ${unitLabel} of ${item.name}`}
        >
          <Ionicons name="add" size={22} color={colors.textPrimary} />
        </TouchableOpacity>
      </View>

      {hasPendingChange ? (
        <Text className="font-inter text-xs text-low-stock">
          Not reported yet: {item.currentQuantity} → {displayQuantity} {unitLabel}
        </Text>
      ) : null}

      {snapshots.length > 0 ? (
        <View className="gap-0.5">
          <Text className="font-inter-medium text-xs text-text-primary">
            {snapshots.map((snapshot) => snapshot.quantity).join(" → ")} {unitLabel}
          </Text>
          <Text className="font-inter text-xs text-text-secondary">
            {snapshots.length === 1 ? "Reported at" : "Last reported at"}{" "}
            {formatSnapshotTime(lastSnapshot.recordedAt)}
          </Text>
        </View>
      ) : null}

      <TouchableOpacity
        className="flex-row items-center gap-1.5"
        activeOpacity={0.8}
        onPress={() => setIsNoteOpen((open) => !open)}
        accessibilityRole="button"
        accessibilityLabel={`${isNoteOpen ? "Hide" : "Show"} note for ${item.name}`}
      >
        <Ionicons
          name={isNoteOpen ? "chevron-down" : "chevron-forward"}
          size={14}
          color={colors.textSecondary}
        />
        <Text className="flex-1 font-inter-medium text-xs text-text-secondary" numberOfLines={1}>
          {note.trim().length > 0 ? note : "Add a note (optional)"}
        </Text>
      </TouchableOpacity>

      {isNoteOpen ? (
        isLocked ? (
          <Text className="font-inter text-sm text-text-primary">
            {note.trim().length > 0 ? note : "No note"}
          </Text>
        ) : (
          <TextInput
            value={note}
            onChangeText={onNoteChange}
            placeholder={`Anything to add about ${item.name}?`}
            placeholderTextColor={colors.textSecondary}
            multiline
            style={styles.noteInput}
          />
        )
      ) : null}
    </View>
  );
}

const styles = StyleSheet.create({
  noteInput: {
    minHeight: 64,
    borderWidth: 1,
    borderColor: colors.border,
    borderRadius: radii.md,
    backgroundColor: colors.white,
    paddingHorizontal: spacing.md,
    paddingVertical: spacing.sm,
    fontFamily: fonts.regular,
    fontSize: 14,
    color: colors.textPrimary,
    textAlignVertical: "top",
  },
});
