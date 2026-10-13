import { useUser } from "@clerk/expo";
import { Ionicons } from "@expo/vector-icons";
import { Redirect } from "expo-router";
import { usePostHog } from "posthog-react-native";
import { useMemo, useState } from "react";
import { Alert, FlatList, StyleSheet, Text, TouchableOpacity, View } from "react-native";
import { SafeAreaView } from "react-native-safe-area-context";

import { BulkAssignModal } from "@/components/BulkAssignModal";
import { CategoryFilter } from "@/components/CategoryFilter";
import { DeleteConfirmModal } from "@/components/DeleteConfirmModal";
import { EmployeeFilter } from "@/components/EmployeeFilter";
import { ErrorState } from "@/components/ErrorState";
import { InventoryCard } from "@/components/InventoryCard";
import { ItemFormModal, type ItemFormValues } from "@/components/ItemFormModal";
import { LoadingState } from "@/components/LoadingState";
import { SearchBar } from "@/components/SearchBar";
import { SortToggle } from "@/components/SortToggle";
import { colors } from "@/constants/theme";
import { sampleUsers } from "@/data/sampleUsers";
import { getAssignableEmployees } from "@/lib/assignableEmployees";
import { matchesEmployeeFilter } from "@/lib/inventoryFilters";
import { getCategoryName } from "@/lib/inventoryLabels";
import { useSupabaseClient } from "@/lib/supabase";
import { useAppUsersStore } from "@/store/appUsersStore";
import { useInventoryStore } from "@/store/inventoryStore";
import { useUnitsStore } from "@/store/unitsStore";
import type { InventoryItem } from "@/types/inventory";
import { parseRole } from "@/types/role";

// A string union (not a boolean) so a third "by status" mode, once the ping
// feature ships, is just another value — not a redesign of the toggle.
// "recent" replaced the old "default" mode (which was simply whatever order
// Supabase returned) and matches Tasks' own Recently Added / A–Z pair.
type InventorySortMode = "recent" | "alphabetical";

export default function Inventory() {
  const { user } = useUser();
  const role = parseRole(user?.publicMetadata?.role);

  const supabase = useSupabaseClient();
  const items = useInventoryStore((state) => state.items);
  const categories = useInventoryStore((state) => state.categories);
  const units = useUnitsStore((state) => state.units);
  const isLoading = useInventoryStore((state) => state.isLoading);
  const error = useInventoryStore((state) => state.error);
  const fetchAll = useInventoryStore((state) => state.fetchAll);
  const unitsLoading = useUnitsStore((state) => state.isLoading);
  const unitsError = useUnitsStore((state) => state.error);
  const fetchUnits = useUnitsStore((state) => state.fetchAll);
  const selectedCategoryIds = useInventoryStore((state) => state.selectedCategoryIds);
  const toggleCategoryId = useInventoryStore((state) => state.toggleCategoryId);
  const clearCategoryIds = useInventoryStore((state) => state.clearCategoryIds);
  const selectedEmployeeIds = useInventoryStore((state) => state.selectedEmployeeIds);
  const toggleEmployeeId = useInventoryStore((state) => state.toggleEmployeeId);
  const clearEmployeeIds = useInventoryStore((state) => state.clearEmployeeIds);
  const addItem = useInventoryStore((state) => state.addItem);
  const updateItem = useInventoryStore((state) => state.updateItem);
  const deleteItem = useInventoryStore((state) => state.deleteItem);
  const addEmployeeToItem = useInventoryStore((state) => state.addEmployeeToItem);
  const removeEmployeeFromItem = useInventoryStore((state) => state.removeEmployeeFromItem);
  const posthog = usePostHog();

  const [isAddOpen, setIsAddOpen] = useState(false);
  const [editItem, setEditItem] = useState<InventoryItem | null>(null);
  const [deleteTarget, setDeleteTarget] = useState<InventoryItem | null>(null);
  // Bumped on every open so ItemFormModal remounts (via its `key`) and its
  // fields reset from scratch instead of carrying over the previous session.
  const [formSession, setFormSession] = useState(0);
  const [searchQuery, setSearchQuery] = useState("");
  const [sortMode, setSortMode] = useState<InventorySortMode>("recent");

  const appUsers = useAppUsersStore((state) => state.users);
  const assignableEmployees = useMemo(
    () => getAssignableEmployees(sampleUsers, appUsers),
    [appUsers],
  );

  // Bulk assignment. `selectedItemIds` deliberately survives search/category
  // filter changes — that is what lets one action cover items from several
  // categories: filter, select, re-filter, select more, assign once. It is
  // cleared only when selection mode is left or an assignment completes.
  const [isSelectionMode, setIsSelectionMode] = useState(false);
  const [selectedItemIds, setSelectedItemIds] = useState<Set<string>>(new Set());
  const [isAssignOpen, setIsAssignOpen] = useState(false);
  const [isAssigning, setIsAssigning] = useState(false);
  // Bumped on every open so BulkAssignModal remounts and forgets the employee
  // picked last time, mirroring how `formSession` resets ItemFormModal.
  const [assignSession, setAssignSession] = useState(0);

  const filteredItems = useMemo(() => {
    const query = searchQuery.trim().toLowerCase();
    return items.filter((item) => {
      // Empty selection set means the filter dimension is inactive — matches
      // everything, not nothing. Within a dimension, matching ANY selected
      // value is enough (OR); category and employee dimensions must each
      // individually pass (AND).
      const matchesCategory =
        selectedCategoryIds.size === 0 || selectedCategoryIds.has(item.categoryId);
      const matchesQuery = query.length === 0 || item.name.toLowerCase().includes(query);
      const matchesEmployee = matchesEmployeeFilter(item, selectedEmployeeIds);
      return matchesCategory && matchesQuery && matchesEmployee;
    });
  }, [items, selectedCategoryIds, searchQuery, selectedEmployeeIds]);

  const sortedItems = useMemo(
    () =>
      [...filteredItems].sort((a, b) =>
        sortMode === "alphabetical"
          ? a.name.localeCompare(b.name)
          : b.createdAt.localeCompare(a.createdAt),
      ),
    [filteredItems, sortMode],
  );

  // Admin and Manager both, matching what individual item editing already
  // allows — bulk assignment is not an Admin-only action.
  if (role !== "admin" && role !== "manager") return <Redirect href="/reports" />;

  const selectedCount = selectedItemIds.size;
  const allVisibleSelected =
    filteredItems.length > 0 && filteredItems.every((item) => selectedItemIds.has(item.id));

  function exitSelectionMode() {
    setIsSelectionMode(false);
    setSelectedItemIds(new Set());
    setIsAssignOpen(false);
  }

  function toggleItemSelected(itemId: string) {
    setSelectedItemIds((current) => {
      const next = new Set(current);
      if (next.has(itemId)) next.delete(itemId);
      else next.add(itemId);
      return next;
    });
  }

  /** Operates on `filteredItems` only — selections outside the current filter
   * are left exactly as they are. */
  function toggleSelectAllVisible() {
    setSelectedItemIds((current) => {
      const next = new Set(current);
      for (const item of filteredItems) {
        if (allVisibleSelected) next.delete(item.id);
        else next.add(item.id);
      }
      return next;
    });
  }

  async function handleBulkAssign(employeeId: string) {
    if (isAssigning) return;
    setIsAssigning(true);
    try {
      const targets = items.filter((item) => selectedItemIds.has(item.id));

      // The RPC is already idempotent (append-if-absent), so there's no need
      // to short-circuit already-assigned items client-side.
      const results = await Promise.all(
        targets.map((item) => addEmployeeToItem(supabase, item.id, employeeId)),
      );

      const failedCount = results.filter((succeeded) => !succeeded).length;
      if (failedCount > 0) {
        Alert.alert(
          "Some items could not be updated",
          `${failedCount} of ${targets.length} items failed. Check your connection and try again.`,
        );
        return;
      }

      exitSelectionMode();
    } finally {
      setIsAssigning(false);
    }
  }

  async function handleBulkUnassign(employeeId: string) {
    if (isAssigning) return;
    setIsAssigning(true);
    try {
      const targets = items.filter((item) => selectedItemIds.has(item.id));

      // remove_employee_from_item is idempotent (array_remove is a no-op when
      // the id isn't present), so items that never had this employee assigned
      // are left untouched rather than causing a failure.
      const results = await Promise.all(
        targets.map((item) => removeEmployeeFromItem(supabase, item.id, employeeId)),
      );

      const failedCount = results.filter((succeeded) => !succeeded).length;
      if (failedCount > 0) {
        Alert.alert(
          "Some items could not be updated",
          `${failedCount} of ${targets.length} items failed. Check your connection and try again.`,
        );
        return;
      }

      exitSelectionMode();
    } finally {
      setIsAssigning(false);
    }
  }

  function closeForm() {
    setIsAddOpen(false);
    setEditItem(null);
  }

  function openAddForm() {
    setEditItem(null);
    setIsAddOpen(true);
    setFormSession((session) => session + 1);
  }

  function openEditForm(item: InventoryItem) {
    setIsAddOpen(false);
    setEditItem(item);
    setFormSession((session) => session + 1);
  }

  async function handleSubmit(values: ItemFormValues) {
    let succeeded: boolean;

    if (editItem) {
      // assignedEmployeeIds is diffed against the item as it was when the
      // form opened and sent through the atomic add/remove RPCs instead of a
      // full-array overwrite in the same updateItem call — see
      // addEmployeeToItem/removeEmployeeFromItem for why.
      const { assignedEmployeeIds, ...rest } = values;
      const originalEmployeeIds = editItem.assignedEmployeeIds;
      const addedEmployeeIds = assignedEmployeeIds.filter(
        (id) => !originalEmployeeIds.includes(id),
      );
      const removedEmployeeIds = originalEmployeeIds.filter(
        (id) => !assignedEmployeeIds.includes(id),
      );

      const results = await Promise.all([
        updateItem(supabase, editItem.id, rest),
        ...addedEmployeeIds.map((id) => addEmployeeToItem(supabase, editItem.id, id)),
        ...removedEmployeeIds.map((id) => removeEmployeeFromItem(supabase, editItem.id, id)),
      ]);
      succeeded = results.every(Boolean);
    } else {
      succeeded = await addItem(supabase, values);
    }

    if (succeeded) {
      closeForm();
      return;
    }

    Alert.alert(
      editItem ? "Could not save changes" : "Could not add item",
      "The item was not saved. Check your connection and try again.",
    );
  }

  // Reached only after DeleteConfirmModal's two-step confirmation passes.
  async function handleDelete(item: InventoryItem) {
    const succeeded = await deleteItem(supabase, item.id);
    if (!succeeded) {
      Alert.alert(
        "Could not delete item",
        "The item was not deleted. Check your connection and try again.",
      );
      return;
    }

    // Items store `categoryId`, so the category is resolved to its name here —
    // a raw id would be meaningless in PostHog.
    posthog.capture("inventory_item_deleted", {
      item_name: item.name,
      category: getCategoryName(categories, item.categoryId),
    });
  }

  const combinedError = error ?? unitsError;
  const isEmptyAndLoading = (isLoading || unitsLoading) && items.length === 0;
  const isReady = combinedError === null && !isEmptyAndLoading;

  return (
    <SafeAreaView style={{ flex: 1, backgroundColor: colors.white }}>
      <View className="flex-1 gap-4 pt-4">
        <View className="flex-row items-center justify-between gap-3 px-4">
          <Text className="font-inter-bold text-2xl text-maroon">Inventory</Text>

          {isReady ? (
            <TouchableOpacity
              className={
                isSelectionMode
                  ? "flex-row items-center gap-1 rounded-lg bg-gold px-3 py-2"
                  : "flex-row items-center gap-1 rounded-lg border border-border px-3 py-2"
              }
              activeOpacity={0.85}
              onPress={() => (isSelectionMode ? exitSelectionMode() : setIsSelectionMode(true))}
              accessibilityRole="button"
              accessibilityLabel={isSelectionMode ? "Exit selection mode" : "Select items"}
            >
              <Ionicons
                name={isSelectionMode ? "close" : "checkbox-outline"}
                size={16}
                color={isSelectionMode ? colors.textPrimary : colors.maroon}
              />
              <Text
                className={
                  isSelectionMode
                    ? "font-inter-semibold text-xs text-text-primary"
                    : "font-inter-semibold text-xs text-maroon"
                }
              >
                {isSelectionMode ? "Done" : "Select"}
              </Text>
            </TouchableOpacity>
          ) : null}
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
            <View className="px-4">
              <SearchBar
                value={searchQuery}
                onChangeText={setSearchQuery}
                placeholder="Search items"
              />
            </View>

            <CategoryFilter
              categories={categories}
              selectedCategoryIds={selectedCategoryIds}
              onToggle={toggleCategoryId}
              onClear={clearCategoryIds}
            />

            <EmployeeFilter
              employees={assignableEmployees}
              selectedEmployeeIds={selectedEmployeeIds}
              onToggle={toggleEmployeeId}
              onClear={clearEmployeeIds}
            />

            <SortToggle
              label="Sort"
              options={[
                { value: "recent", label: "Recently Added" },
                { value: "alphabetical", label: "A–Z" },
              ]}
              value={sortMode}
              onChange={setSortMode}
            />

            <FlatList
              className="flex-1"
              data={sortedItems}
              keyExtractor={(item) => item.id}
              contentContainerStyle={styles.listContent}
              ItemSeparatorComponent={() => <View className="h-3" />}
              ListEmptyComponent={
                <View className="items-center gap-2 py-16">
                  <Ionicons name="cube-outline" size={40} color={colors.textSecondary} />
                  <Text className="font-inter-medium text-sm text-text-secondary">
                    No items match these filters — try a different combination.
                  </Text>
                </View>
              }
              renderItem={({ item }) => (
                <InventoryCard
                  item={item}
                  categories={categories}
                  units={units}
                  canDelete={role === "admin"}
                  onEdit={() => openEditForm(item)}
                  onDelete={() => setDeleteTarget(item)}
                  selectionMode={isSelectionMode}
                  isSelected={selectedItemIds.has(item.id)}
                  onToggleSelect={() => toggleItemSelected(item.id)}
                />
              )}
            />
          </>
        )}
      </View>

      {isReady && isSelectionMode ? (
        <View className="gap-3 border-t border-border bg-white px-4 py-3">
          <View className="flex-row items-center justify-between gap-3">
            <Text className="font-inter-medium text-sm text-text-primary">
              {selectedCount} item{selectedCount === 1 ? "" : "s"} selected
            </Text>

            <TouchableOpacity
              className={filteredItems.length === 0 ? "chip opacity-50" : "chip"}
              activeOpacity={0.8}
              disabled={filteredItems.length === 0}
              onPress={toggleSelectAllVisible}
            >
              <Text className="chip__text">
                {allVisibleSelected ? "Deselect All Visible" : "Select All Visible"}
              </Text>
            </TouchableOpacity>
          </View>

          <View className="flex-row gap-3">
            <TouchableOpacity
              className="flex-1 items-center rounded-lg border border-border py-3"
              activeOpacity={0.8}
              onPress={exitSelectionMode}
            >
              <Text className="font-inter-semibold text-base text-text-primary">Cancel</Text>
            </TouchableOpacity>

            <TouchableOpacity
              className={selectedCount === 0 ? "btn-primary flex-1 opacity-50" : "btn-primary flex-1"}
              activeOpacity={selectedCount === 0 ? 1 : 0.85}
              disabled={selectedCount === 0}
              onPress={() => {
                setAssignSession((session) => session + 1);
                setIsAssignOpen(true);
              }}
            >
              <Text className="btn-primary__text">Assign to...</Text>
            </TouchableOpacity>
          </View>
        </View>
      ) : null}

      {isReady && !isSelectionMode ? (
        <TouchableOpacity
          className="fab"
          style={styles.fabShadow}
          activeOpacity={0.85}
          onPress={openAddForm}
          accessibilityRole="button"
          accessibilityLabel="Add item"
        >
          <Ionicons name="add" size={28} color={colors.textPrimary} />
        </TouchableOpacity>
      ) : null}

      <ItemFormModal
        key={`form-${formSession}`}
        visible={isAddOpen || editItem !== null}
        item={editItem ?? undefined}
        onClose={closeForm}
        onSubmit={(values) => void handleSubmit(values)}
      />

      <BulkAssignModal
        key={`assign-${assignSession}`}
        visible={isAssignOpen}
        selectedCount={selectedCount}
        targetNoun="item"
        employees={assignableEmployees}
        isAssigning={isAssigning}
        onClose={() => setIsAssignOpen(false)}
        onAssign={(clerkUserId) => void handleBulkAssign(clerkUserId)}
        onUnassign={(clerkUserId) => void handleBulkUnassign(clerkUserId)}
      />

      <DeleteConfirmModal
        visible={deleteTarget !== null}
        onCancel={() => setDeleteTarget(null)}
        onConfirm={() => {
          if (deleteTarget) void handleDelete(deleteTarget);
          setDeleteTarget(null);
        }}
      />
    </SafeAreaView>
  );
}

const styles = StyleSheet.create({
  listContent: {
    paddingHorizontal: 16,
    paddingBottom: 96,
  },
  fabShadow: {
    shadowColor: "#000",
    shadowOffset: { width: 0, height: 4 },
    shadowOpacity: 0.25,
    shadowRadius: 6,
    elevation: 6,
  },
});