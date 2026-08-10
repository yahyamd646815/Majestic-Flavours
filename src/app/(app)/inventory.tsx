import { useUser } from "@clerk/expo";
import { Ionicons } from "@expo/vector-icons";
import { Redirect } from "expo-router";
import { usePostHog } from "posthog-react-native";
import { useMemo, useState } from "react";
import { Alert, FlatList, StyleSheet, Text, TouchableOpacity, View } from "react-native";
import { SafeAreaView } from "react-native-safe-area-context";

import { CategoryFilter } from "@/components/CategoryFilter";
import { DeleteConfirmModal } from "@/components/DeleteConfirmModal";
import { ErrorState } from "@/components/ErrorState";
import { InventoryCard } from "@/components/InventoryCard";
import { ItemFormModal, type ItemFormValues } from "@/components/ItemFormModal";
import { LoadingState } from "@/components/LoadingState";
import { SearchBar } from "@/components/SearchBar";
import { colors } from "@/constants/theme";
import { getCategoryName } from "@/lib/inventoryLabels";
import { useSupabaseClient } from "@/lib/supabase";
import { useInventoryStore } from "@/store/inventoryStore";
import { useUnitsStore } from "@/store/unitsStore";
import type { InventoryItem } from "@/types/inventory";
import { parseRole } from "@/types/role";

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
  const selectedCategoryId = useInventoryStore((state) => state.selectedCategoryId);
  const setSelectedCategoryId = useInventoryStore((state) => state.setSelectedCategoryId);
  const addItem = useInventoryStore((state) => state.addItem);
  const updateItem = useInventoryStore((state) => state.updateItem);
  const deleteItem = useInventoryStore((state) => state.deleteItem);
  const posthog = usePostHog();

  const [isAddOpen, setIsAddOpen] = useState(false);
  const [editItem, setEditItem] = useState<InventoryItem | null>(null);
  const [deleteTarget, setDeleteTarget] = useState<InventoryItem | null>(null);
  // Bumped on every open so ItemFormModal remounts (via its `key`) and its
  // fields reset from scratch instead of carrying over the previous session.
  const [formSession, setFormSession] = useState(0);
  const [searchQuery, setSearchQuery] = useState("");

  const filteredItems = useMemo(() => {
    const query = searchQuery.trim().toLowerCase();
    return items.filter((item) => {
      const matchesCategory =
        selectedCategoryId === null || item.categoryId === selectedCategoryId;
      const matchesQuery = query.length === 0 || item.name.toLowerCase().includes(query);
      return matchesCategory && matchesQuery;
    });
  }, [items, selectedCategoryId, searchQuery]);

  if (role !== "admin" && role !== "manager") return <Redirect href="/reports" />;

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
    const succeeded = editItem
      ? await updateItem(supabase, editItem.id, values)
      : await addItem(supabase, values);

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
        <Text className="px-4 font-inter-bold text-2xl text-maroon">Inventory</Text>

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
              selectedCategoryId={selectedCategoryId}
              onSelect={setSelectedCategoryId}
            />

            <FlatList
              className="flex-1"
              data={filteredItems}
              keyExtractor={(item) => item.id}
              contentContainerStyle={styles.listContent}
              ItemSeparatorComponent={() => <View className="h-3" />}
              ListEmptyComponent={
                <View className="items-center gap-2 py-16">
                  <Ionicons name="cube-outline" size={40} color={colors.textSecondary} />
                  <Text className="font-inter-medium text-sm text-text-secondary">
                    No items in this category yet.
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
                />
              )}
            />
          </>
        )}
      </View>

      {isReady ? (
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
        key={formSession}
        visible={isAddOpen || editItem !== null}
        item={editItem ?? undefined}
        onClose={closeForm}
        onSubmit={(values) => void handleSubmit(values)}
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