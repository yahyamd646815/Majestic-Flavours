import { Ionicons } from "@expo/vector-icons";
import { useEffect, useMemo, useRef, useState } from "react";
import { Alert, FlatList, StyleSheet, Text, TextInput, TouchableOpacity, View } from "react-native";

import { CategoryFilter } from "@/components/CategoryFilter";
import { ReportEntryCard } from "@/components/ReportEntryCard";
import { ReportSubmittedModal } from "@/components/ReportSubmittedModal";
import { SearchBar } from "@/components/SearchBar";
import { colors, fonts, radii, spacing } from "@/constants/theme";
import { useDraftReport } from "@/context/DraftReportContext";
import { getTodayIsoDate, isReportLocked } from "@/lib/reports";
import { useInventoryStore } from "@/store/inventoryStore";
import { useReportStore, type ItemSubmission } from "@/store/reportStore";
import type { Category, InventoryItem } from "@/types/inventory";

type ReportEntryViewProps = {
  /** The reporter's `sampleUsers` id — an Employee, or an Admin/Manager self-reporting. */
  reporterId: string;
  /** The items this person is reporting on. The caller decides the scope:
   * assigned items for an Employee, all items for Admin/Manager. */
  items: InventoryItem[];
};

/**
 * Filling out one person's report for today: a stepper per item, an optional
 * note per item, and one note for the day.
 *
 * Every edit here is a draft (see DraftReportContext). Nothing reaches
 * `inventoryStore` or `reportStore` until Report / Update Report is pressed.
 */
export function ReportEntryView({ reporterId, items }: ReportEntryViewProps) {
  const todayIsoDate = getTodayIsoDate();

  const updateItem = useInventoryStore((state) => state.updateItem);
  const submitReport = useReportStore((state) => state.submitReport);
  // Called as a selector so the view re-renders when today's report is created
  // or updated — the getter returns the stored report by reference, so this
  // stays stable between renders.
  const todaysReport = useReportStore((state) =>
    state.getReportForReporterAndDate(reporterId, todayIsoDate),
  );

  const { draftQuantities, draftNotes, setDraftQuantity, setDraftNote, clearDrafts } =
    useDraftReport();

  const [showConfirmation, setShowConfirmation] = useState(false);
  // Local to this screen — the Admin/Manager Inventory screen owns
  // inventoryStore.selectedCategory, and sharing it would let the two
  // screens' filters interfere with each other.
  const [selectedCategory, setSelectedCategory] = useState<string | null>(null);
  const [searchQuery, setSearchQuery] = useState("");
  const [dayContent, setDayContent] = useState(todaysReport?.content ?? "");

  // Re-seeds the day note once today's report loads from storage or is created
  // by the first submit. Keyed on the report id so it never overwrites what
  // the person is currently typing.
  const seededReportId = useRef(todaysReport?.id);
  useEffect(() => {
    if (todaysReport?.id === seededReportId.current) return;
    seededReportId.current = todaysReport?.id;
    setDayContent(todaysReport?.content ?? "");
  }, [todaysReport]);

  const isLocked = todaysReport ? isReportLocked(todaysReport, todayIsoDate) : false;

  const categories = useMemo<Category[]>(() => {
    const seen = new Set<string>();
    const result: Category[] = [];
    for (const item of items) {
      if (seen.has(item.category)) continue;
      seen.add(item.category);
      result.push({ id: item.category, name: item.category });
    }
    return result;
  }, [items]);

  const filteredItems = useMemo(() => {
    const query = searchQuery.trim().toLowerCase();
    return items.filter((item) => {
      const matchesCategory = selectedCategory === null || item.category === selectedCategory;
      const matchesQuery = query.length === 0 || item.name.toLowerCase().includes(query);
      return matchesCategory && matchesQuery;
    });
  }, [items, selectedCategory, searchQuery]);

  const entriesByItemId = useMemo(
    () => new Map((todaysReport?.itemEntries ?? []).map((entry) => [entry.itemId, entry])),
    [todaysReport],
  );

  // Pending, not submitted — how many items have been touched since the last
  // submit. Today's already-reported history is shown per card instead.
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

  function handleSubmit() {
    const itemSubmissions: ItemSubmission[] = [];

    for (const item of items) {
      const draftQuantity = draftQuantities[item.id];
      const quantityChanged =
        draftQuantity !== undefined && draftQuantity !== item.currentQuantity;

      const draftNote = draftNotes[item.id];
      const existingNote = todaysReport?.itemEntries.find((e) => e.itemId === item.id)?.note ?? "";
      const noteChanged = draftNote !== undefined && draftNote !== existingNote;

      if (!quantityChanged && !noteChanged) continue;

      itemSubmissions.push({
        itemId: item.id,
        ...(quantityChanged ? { newSnapshotQuantity: draftQuantity } : {}),
        ...(noteChanged ? { note: draftNote } : {}),
      });
    }

    const result = submitReport(reporterId, todayIsoDate, dayContent.trim(), itemSubmissions);
    if (result === null) {
      Alert.alert(
        "Report could not be saved",
        "It looks like the day has changed. Please reopen the app and try again.",
      );
      return;
    }

    // Only now do the actual quantities land in inventoryStore.
    for (const submission of itemSubmissions) {
      if (submission.newSnapshotQuantity !== undefined) {
        updateItem(submission.itemId, { currentQuantity: submission.newSnapshotQuantity });
      }
    }

    clearDrafts();
    setShowConfirmation(true);
  }

  return (
    <>
      <View className="px-4">
        <SearchBar value={searchQuery} onChangeText={setSearchQuery} placeholder="Search items" />
      </View>

      <CategoryFilter
        categories={categories}
        selectedCategory={selectedCategory}
        onSelect={setSelectedCategory}
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
            <DayNoteInput
              value={dayContent}
              onChangeText={setDayContent}
              isLocked={isLocked}
            />
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
            : pendingCount === 0
              ? "No unreported changes."
              : `${pendingCount} item${pendingCount === 1 ? "" : "s"} edited — not reported yet.`}
        </Text>

        {isLocked ? null : (
          <TouchableOpacity className="btn-primary" activeOpacity={0.85} onPress={handleSubmit}>
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

/** The one optional note covering the whole day, above the item list. */
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
  list: {
    flex: 1,
  },
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
