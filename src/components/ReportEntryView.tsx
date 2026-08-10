import { Ionicons } from "@expo/vector-icons";
import { usePostHog } from "posthog-react-native";
import { useEffect, useMemo, useRef, useState } from "react";
import { Alert, FlatList, StyleSheet, Text, TextInput, TouchableOpacity, View } from "react-native";

import { CategoryFilter } from "@/components/CategoryFilter";
import { ReportEntryCard } from "@/components/ReportEntryCard";
import { ReportSubmittedModal } from "@/components/ReportSubmittedModal";
import { SearchBar } from "@/components/SearchBar";
import { colors, fonts, radii, spacing } from "@/constants/theme";
import { useDraftReport } from "@/context/DraftReportContext";
import { getTodayIsoDate, isReportLocked } from "@/lib/reports";
import { useSupabaseClient } from "@/lib/supabase";
import { useAppUsersStore } from "@/store/appUsersStore";
import { useInventoryStore } from "@/store/inventoryStore";
import { useReportStore, type ItemSubmission } from "@/store/reportStore";
import { useUnitsStore } from "@/store/unitsStore";
import type { InventoryItem } from "@/types/inventory";

type ReportEntryViewProps = {
  reporterId: string;
  items: InventoryItem[];
};

export function ReportEntryView({ reporterId, items }: ReportEntryViewProps) {
  const todayIsoDate = getTodayIsoDate();

  const supabase = useSupabaseClient();
  const updateItem = useInventoryStore((state) => state.updateItem);
  const allCategories = useInventoryStore((state) => state.categories);
  const units = useUnitsStore((state) => state.units);
  const submitReport = useReportStore((state) => state.submitReport);
  const selfSynced = useAppUsersStore((state) => state.selfSynced);
  const posthog = usePostHog();
  const todaysReport = useReportStore((state) =>
    state.getReportForReporterAndDate(reporterId, todayIsoDate),
  );

  const { draftQuantities, draftNotes, setDraftQuantity, setDraftNote, clearDrafts } =
    useDraftReport();

  const [showConfirmation, setShowConfirmation] = useState(false);
  const [isSubmitting, setIsSubmitting] = useState(false);
  const [selectedCategoryId, setSelectedCategoryId] = useState<string | null>(null);
  const [searchQuery, setSearchQuery] = useState("");
  const [dayContent, setDayContent] = useState(todaysReport?.content ?? "");

  const seededReportId = useRef(todaysReport?.id);
  useEffect(() => {
    if (todaysReport?.id === seededReportId.current) return;
    seededReportId.current = todaysReport?.id;
    setDayContent(todaysReport?.content ?? "");
  }, [todaysReport]);

  const isLocked = todaysReport ? isReportLocked(todaysReport, todayIsoDate) : false;

  const visibleCategories = useMemo(() => {
    const presentIds = new Set(items.map((item) => item.categoryId));
    return allCategories.filter((category) => presentIds.has(category.id));
  }, [items, allCategories]);

  const filteredItems = useMemo(() => {
    const query = searchQuery.trim().toLowerCase();
    return items.filter((item) => {
      const matchesCategory =
        selectedCategoryId === null || item.categoryId === selectedCategoryId;
      const matchesQuery = query.length === 0 || item.name.toLowerCase().includes(query);
      return matchesCategory && matchesQuery;
    });
  }, [items, selectedCategoryId, searchQuery]);

  const entriesByItemId = useMemo(
    () => new Map((todaysReport?.itemEntries ?? []).map((entry) => [entry.itemId, entry])),
    [todaysReport],
  );

  const pendingCount = useMemo(
    () => new Set([...Object.keys(draftQuantities), ...Object.keys(draftNotes)]).size,
    [draftQuantities, draftNotes],
  );

  function getDisplayQuantity(item: InventoryItem): number {
    return draftQuantities[item.id] ?? item.currentQuantity;
  }

  function handleQuantityChange(item: InventoryItem, nextQuantity: number) {
    setDraftQuantity(item.id, Math.max(0, nextQuantity));
  }

  async function handleSubmit() {
    if (isSubmitting) return;
    setIsSubmitting(true);
    try {
      const itemSubmissions: ItemSubmission[] = [];

      for (const item of items) {
        const draftQuantity = draftQuantities[item.id];
        const quantityChanged =
          draftQuantity !== undefined && draftQuantity !== item.currentQuantity;

        const draftNote = draftNotes[item.id];
        const existingNote =
          todaysReport?.itemEntries.find((e) => e.itemId === item.id)?.note ?? "";
        const noteChanged = draftNote !== undefined && draftNote !== existingNote;

        if (!quantityChanged && !noteChanged) continue;

        itemSubmissions.push({
          itemId: item.id,
          ...(quantityChanged ? { newSnapshotQuantity: draftQuantity } : {}),
          ...(noteChanged ? { note: draftNote } : {}),
        });
      }

      const result = await submitReport(
        supabase,
        reporterId,
        todayIsoDate,
        dayContent.trim(),
        itemSubmissions,
      );
      if (result === null) {
        Alert.alert("Report could not be saved", "Check your connection and try again.");
        return;
      }

      // Fires here, once the report itself is genuinely saved — not on a null
      // result (locked or wrong-day report). One report covers many items and
      // any role can file one, so this counts items and names the reporter
      // rather than recording a single item or assuming an employee.
      posthog.capture("report_submitted", {
        reporter_id: reporterId,
        date: todayIsoDate,
        items_changed_count: itemSubmissions.length,
        has_day_note: dayContent.trim().length > 0,
      });

      const quantityUpdates = itemSubmissions.flatMap((submission) =>
        submission.newSnapshotQuantity === undefined
          ? []
          : [{ itemId: submission.itemId, quantity: submission.newSnapshotQuantity }],
      );

      const writeResults = await Promise.all(
        quantityUpdates.map((update) =>
          updateItem(supabase, update.itemId, { currentQuantity: update.quantity }),
        ),
      );

      const inventoryFailed = writeResults.some((succeeded) => !succeeded);
      const reportPartiallyFailed = result.failedItemIds.length > 0;

      if (inventoryFailed || reportPartiallyFailed) {
        // Drafts are kept here too — the alert tells the person to retry the
        // failed items, so wiping their entered values first would make
        // that impossible without re-typing everything.
        Alert.alert(
          "Report saved with some issues",
          "Some items could not be fully saved. Check your connection and try those items again.",
        );
        return;
      }

      clearDrafts();
      setShowConfirmation(true);
    } finally {
      setIsSubmitting(false);
    }
  }

  return (
    <>
      <View className="px-4">
        <SearchBar value={searchQuery} onChangeText={setSearchQuery} placeholder="Search items" />
      </View>

      <CategoryFilter
        categories={visibleCategories}
        selectedCategoryId={selectedCategoryId}
        onSelect={setSelectedCategoryId}
      />

      <FlatList
        style={styles.list}
        data={filteredItems}
        keyExtractor={(item) => item.id}
        contentContainerStyle={styles.listContent}
        keyboardShouldPersistTaps="handled"
        ItemSeparatorComponent={() => <View className="h-3" />}
        ListHeaderComponent={
          <View className="pb-3">
            <DayNoteInput value={dayContent} onChangeText={setDayContent} isLocked={isLocked} />
          </View>
        }
        ListEmptyComponent={
          <View className="items-center gap-2 py-16">
            <Ionicons name="clipboard-outline" size={40} color={colors.textSecondary} />
            <Text className="text-center font-inter-medium text-sm text-text-secondary">
              {items.length === 0
                ? "You have no assigned items yet. Ask a manager to assign you some."
                : "No items match your search."}
            </Text>
          </View>
        }
        renderItem={({ item }) => {
          const entry = entriesByItemId.get(item.id);
          return (
            <ReportEntryCard
              item={item}
              categories={allCategories}
              units={units}
              displayQuantity={getDisplayQuantity(item)}
              snapshots={entry?.snapshots ?? []}
              note={draftNotes[item.id] ?? entry?.note ?? ""}
              isLocked={isLocked}
              onQuantityChange={(nextQuantity) => handleQuantityChange(item, nextQuantity)}
              onNoteChange={(note) => setDraftNote(item.id, note)}
            />
          );
        }}
      />

      <View className="gap-2 border-t border-border bg-white px-4 py-3">
        <Text className="font-inter text-xs text-text-secondary">
          {isLocked
            ? "Locked. Reports can only be edited on the day they were submitted."
            : !selfSynced
              ? "Preparing your account..."
              : pendingCount === 0
                ? "No unreported changes."
                : `${pendingCount} item${pendingCount === 1 ? "" : "s"} edited — not reported yet.`}
        </Text>

        {isLocked ? null : (
          <TouchableOpacity
            className="btn-primary"
            activeOpacity={0.85}
            disabled={isSubmitting || !selfSynced}
            onPress={() => void handleSubmit()}
          >
            <Text className="btn-primary__text">
              {todaysReport ? "Update Report" : "Report"}
            </Text>
          </TouchableOpacity>
        )}
      </View>

      <ReportSubmittedModal
        visible={showConfirmation}
        onClose={() => setShowConfirmation(false)}
      />
    </>
  );
}

type DayNoteInputProps = {
  value: string;
  onChangeText: (value: string) => void;
  isLocked: boolean;
};

function DayNoteInput({ value, onChangeText, isLocked }: DayNoteInputProps) {
  return (
    <View className="card gap-2">
      <Text className="font-inter-semibold text-base text-text-primary">Report for Today</Text>

      {isLocked ? (
        <View className="flex-row items-start gap-2 rounded-lg bg-cream p-3">
          <Ionicons name="lock-closed" size={16} color={colors.textSecondary} />
          <Text className="flex-1 font-inter text-sm text-text-primary">
            {value.trim().length > 0 ? value : "No written report"}
          </Text>
        </View>
      ) : (
        <TextInput
          value={value}
          onChangeText={onChangeText}
          placeholder="Anything to add about today? (optional)"
          placeholderTextColor={colors.textSecondary}
          multiline
          style={styles.input}
        />
      )}
    </View>
  );
}

const styles = StyleSheet.create({
  list: { flex: 1 },
  listContent: { paddingHorizontal: 16, paddingBottom: 32 },
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