import { Ionicons } from "@expo/vector-icons";
import { type ReactElement, useMemo, useState } from "react";
import { FlatList, StyleSheet, Text, TextInput, TouchableOpacity, View } from "react-native";

import { EmployeeReportCard } from "@/components/EmployeeReportCard";
import { ReportSubmittedModal } from "@/components/ReportSubmittedModal";
import { colors, fonts, radii, spacing } from "@/constants/theme";
import { getTodayIsoDate, isReportLocked } from "@/lib/reports";
import { useInventoryStore } from "@/store/inventoryStore";
import { baselineKey, useReportStore } from "@/store/reportStore";
import type { InventoryItem, ReportItemChange } from "@/types/inventory";

type EmployeeReportsViewProps = {
  /** The signed-in employee's `sampleUsers` id. */
  employeeId: string;
  footer: ReactElement;
};

/**
 * Employee view: the items assigned to them with a stock stepper each, plus the
 * single report covering their whole day.
 */
export function EmployeeReportsView({ employeeId, footer }: EmployeeReportsViewProps) {
  const todayIsoDate = getTodayIsoDate();

  const items = useInventoryStore((state) => state.items);
  const updateItem = useInventoryStore((state) => state.updateItem);
  const dailyBaselines = useReportStore((state) => state.dailyBaselines);
  const getOrCaptureBaseline = useReportStore((state) => state.getOrCaptureBaseline);
  const submitReport = useReportStore((state) => state.submitReport);
  // Called as a selector so the view re-renders when today's report is created
  // or updated — the getter returns the stored report by reference, so this
  // stays stable between renders.
  const todaysReport = useReportStore((state) =>
    state.getReportForEmployeeAndDate(employeeId, todayIsoDate),
  );

  const [showConfirmation, setShowConfirmation] = useState(false);

  const assignedItems = useMemo(
    () => items.filter((item) => item.assignedEmployeeIds.includes(employeeId)),
    [items, employeeId],
  );

  // Only net changes are reported: an item never touched today has no baseline,
  // and one moved and put back matches its baseline again.
  const todaysChanges = useMemo(() => {
    const changes: ReportItemChange[] = [];
    for (const item of assignedItems) {
      const baseline = dailyBaselines[baselineKey(employeeId, todayIsoDate, item.id)];
      if (baseline === undefined || baseline === item.currentQuantity) continue;
      changes.push({
        itemId: item.id,
        startQuantity: baseline,
        endQuantity: item.currentQuantity,
      });
    }
    return changes;
  }, [assignedItems, dailyBaselines, employeeId, todayIsoDate]);

  const changesByItemId = useMemo(
    () => new Map(todaysChanges.map((change) => [change.itemId, change])),
    [todaysChanges],
  );

  function handleQuantityChange(item: InventoryItem, nextQuantity: number) {
    // Baseline first: this has to read the quantity from before the change.
    getOrCaptureBaseline(employeeId, todayIsoDate, item.id, item.currentQuantity);
    updateItem(item.id, { currentQuantity: Math.max(0, nextQuantity) });
  }

  function handleSubmit(content: string) {
    submitReport(employeeId, todayIsoDate, content, todaysChanges);
    setShowConfirmation(true);
  }

  return (
    <>
      <FlatList
        className="flex-1"
        data={assignedItems}
        keyExtractor={(item) => item.id}
        contentContainerStyle={styles.listContent}
        keyboardShouldPersistTaps="handled"
        ItemSeparatorComponent={() => <View className="h-3" />}
        ListEmptyComponent={
          <View className="items-center gap-2 py-16">
            <Ionicons name="clipboard-outline" size={40} color={colors.textSecondary} />
            <Text className="text-center font-inter-medium text-sm text-text-secondary">
              You have no assigned items yet. Ask a manager to assign you some.
            </Text>
          </View>
        }
        ListFooterComponent={
          <View className="gap-4 pt-4">
            <DailyReportForm
              // Remounts the form (re-seeding its draft) once today's report
              // loads from storage or is created by the first submit.
              key={todaysReport?.id ?? "new-report"}
              initialContent={todaysReport?.content ?? ""}
              hasReport={todaysReport !== undefined}
              isLocked={todaysReport ? isReportLocked(todaysReport, todayIsoDate) : false}
              changeCount={todaysChanges.length}
              onSubmit={handleSubmit}
            />

            {footer}
          </View>
        }
        renderItem={({ item }) => (
          <EmployeeReportCard
            item={item}
            todaysChange={changesByItemId.get(item.id)}
            onQuantityChange={(nextQuantity) => handleQuantityChange(item, nextQuantity)}
          />
        )}
      />

      <ReportSubmittedModal
        visible={showConfirmation}
        onClose={() => setShowConfirmation(false)}
      />
    </>
  );
}

type DailyReportFormProps = {
  initialContent: string;
  hasReport: boolean;
  isLocked: boolean;
  changeCount: number;
  onSubmit: (content: string) => void;
};

/** The day's optional written report and the single submit button. */
function DailyReportForm({
  initialContent,
  hasReport,
  isLocked,
  changeCount,
  onSubmit,
}: DailyReportFormProps) {
  const [content, setContent] = useState(initialContent);

  return (
    <View className="card gap-3">
      <Text className="font-inter-semibold text-base text-text-primary">Report for Today</Text>

      <Text className="font-inter text-xs text-text-secondary">
        {changeCount === 0
          ? "No quantity changes yet today."
          : `${changeCount} item${changeCount === 1 ? "" : "s"} changed today.`}
      </Text>

      {isLocked ? (
        <View className="flex-row items-start gap-2 rounded-lg bg-cream p-3">
          <Ionicons name="lock-closed" size={16} color={colors.textSecondary} />
          <View className="flex-1 gap-1">
            <Text className="font-inter text-sm text-text-primary">
              {content.trim().length > 0 ? content : "No written report"}
            </Text>
            <Text className="font-inter text-xs text-text-secondary">
              Locked. Reports can only be edited on the day they were submitted.
            </Text>
          </View>
        </View>
      ) : (
        <>
          <TextInput
            value={content}
            onChangeText={setContent}
            placeholder="Anything to add about today? (optional)"
            placeholderTextColor={colors.textSecondary}
            multiline
            style={styles.input}
          />

          <TouchableOpacity
            className="btn-primary"
            activeOpacity={0.85}
            onPress={() => onSubmit(content.trim())}
          >
            <Text className="btn-primary__text">{hasReport ? "Update Report" : "Report"}</Text>
          </TouchableOpacity>
        </>
      )}
    </View>
  );
}

const styles = StyleSheet.create({
  listContent: {
    paddingHorizontal: 16,
    paddingBottom: 32,
  },
  input: {
    minHeight: 88,
    borderWidth: 1,
    borderColor: colors.border,
    borderRadius: radii.md,
    backgroundColor: colors.white,
    paddingHorizontal: spacing.md,
    paddingVertical: spacing.sm + 4,
    fontFamily: fonts.regular,
    fontSize: 15,
    color: colors.textPrimary,
    textAlignVertical: "top",
  },
});
