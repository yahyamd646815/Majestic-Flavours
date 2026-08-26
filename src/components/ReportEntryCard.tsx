import { Ionicons } from "@expo/vector-icons";
import { useState } from "react";
import { StyleSheet, Text, TextInput, TouchableOpacity, View } from "react-native";

import { StockStatusBadge } from "@/components/StockStatusBadge";
import { colors, fonts, radii, spacing } from "@/constants/theme";
import { getCategoryName, getUnitLabel } from "@/lib/inventoryLabels";
import { formatSnapshotTime } from "@/lib/reports";
import {
  getEffectiveStatus,
  STOCK_STATUS_LABELS,
  STOCK_STATUS_ORDER,
  STOCK_STATUS_PING_CLASSES,
  STOCK_STATUS_PING_INACTIVE_CLASSES,
  type StockStatus,
} from "@/lib/stockStatus";
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
  /** The status pinged in this draft, if any. Undefined means nothing has
   * been pinged since the last submit. */
  statusPing?: StockStatus;
  onQuantityChange: (nextQuantity: number) => void;
  onNoteChange: (note: string) => void;
  onStatusPing: (status: StockStatus) => void;
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
  statusPing,
  onQuantityChange,
  onNoteChange,
  onStatusPing,
}: ReportEntryCardProps) {
  // Collapsed by default — a list can run to 200+ items, and most of them
  // never get a note.
  const [isNoteOpen, setIsNoteOpen] = useState(false);

  const categoryName = getCategoryName(categories, item.categoryId);
  const unitLabel = getUnitLabel(units, item.unitId);

  const hasPendingChange = displayQuantity !== item.currentQuantity;

  // Previews what submitting this card would actually produce: a ping wins,
  // and otherwise a pending quantity change clears any existing override —
  // the same rule `updateItem` applies when the report is sent.
  const pendingOverride = statusPing ?? (hasPendingChange ? null : item.statusOverride);
  const status = getEffectiveStatus({
    currentQuantity: displayQuantity,
    minThreshold: item.minThreshold,
    statusOverride: pendingOverride,
  });
  // Guards the decrement button only, so it stays tied to the real quantity:
  // an item pinged "Out of Stock" while 50 units are still counted must not
  // lose its minus button.
  const isAtZero = displayQuantity === 0;

  const lastSnapshot = snapshots[snapshots.length - 1];

  return (
    <View className="card gap-3">
      <View className="flex-row items-start justify-between gap-2">
        <View className="flex-1">
          <Text className="font-inter-semibold text-base text-text-primary">{item.name}</Text>
          <Text className="font-inter text-xs text-text-secondary">{categoryName}</Text>
        </View>
        <StockStatusBadge status={status} isOverridden={pendingOverride !== null} />
      </View>

      <View className="flex-row items-center justify-between rounded-lg border border-border px-3 py-2">
        <TouchableOpacity
          className={
            isAtZero || isLocked
              ? "h-11 w-11 items-center justify-center rounded-full bg-cream opacity-40"
              : "h-11 w-11 items-center justify-center rounded-full bg-cream"
          }
          activeOpacity={0.8}
          disabled={isAtZero || isLocked}
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

      <View className="gap-1.5">
        <Text className="font-inter-medium text-xs text-text-secondary">Stock status</Text>
        <View className={isLocked ? "flex-row gap-2 opacity-50" : "flex-row gap-2"}>
          {STOCK_STATUS_ORDER.map((pingStatus) => {
            const isActive = pingStatus === status;
            const classes = isActive
              ? STOCK_STATUS_PING_CLASSES[pingStatus]
              : STOCK_STATUS_PING_INACTIVE_CLASSES;

            return (
              <TouchableOpacity
                key={pingStatus}
                className={classes.button}
                activeOpacity={isActive ? 1 : 0.8}
                disabled={isLocked}
                // Tapping the already-active status is a no-op: there is no
                // "clear the ping" gesture — only changing the quantity or
                // pinging a different status moves it.
                onPress={() => {
                  if (!isActive) onStatusPing(pingStatus);
                }}
                accessibilityRole="button"
                accessibilityState={{ selected: isActive }}
                accessibilityLabel={`Mark ${item.name} as ${STOCK_STATUS_LABELS[pingStatus]}`}
              >
                <Text className={classes.text}>{STOCK_STATUS_LABELS[pingStatus]}</Text>
              </TouchableOpacity>
            );
          })}
        </View>
      </View>

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
