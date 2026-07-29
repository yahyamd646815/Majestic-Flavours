import { useUser } from "@clerk/expo";
import { Ionicons } from "@expo/vector-icons";
import { Redirect } from "expo-router";
import { useMemo, useState } from "react";
import { FlatList, StyleSheet, Text, TouchableOpacity, View } from "react-native";
import { SafeAreaView } from "react-native-safe-area-context";

import { CategoryFilter } from "@/components/CategoryFilter";
import { DeleteConfirmModal } from "@/components/DeleteConfirmModal";
import { InventoryCard } from "@/components/InventoryCard";
import { ItemFormModal, type ItemFormValues } from "@/components/ItemFormModal";
import { colors } from "@/constants/theme";
import { useInventoryStore } from "@/store/inventoryStore";
import type { InventoryItem } from "@/types/inventory";
import { parseRole } from "@/types/role";

export default function Inventory() {
  const { user } = useUser();
  const role = parseRole(user?.publicMetadata?.role);

  const items = useInventoryStore((state) => state.items);
  const categories = useInventoryStore((state) => state.categories);
  const selectedCategory = useInventoryStore((state) => state.selectedCategory);
  const setSelectedCategory = useInventoryStore((state) => state.setSelectedCategory);
  const addItem = useInventoryStore((state) => state.addItem);
  const updateItem = useInventoryStore((state) => state.updateItem);
  const deleteItem = useInventoryStore((state) => state.deleteItem);

  const [isAddOpen, setIsAddOpen] = useState(false);
  const [editItem, setEditItem] = useState<InventoryItem | null>(null);
  const [deleteTarget, setDeleteTarget] = useState<InventoryItem | null>(null);
  // Bumped on every open so ItemFormModal remounts (via its `key`) and its
  // fields reset from scratch instead of carrying over the previous session.
  const [formSession, setFormSession] = useState(0);

  const filteredItems = useMemo(
    () =>
      selectedCategory === null
        ? items
        : items.filter((item) => item.category === selectedCategory),
    [items, selectedCategory],
  );

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

  function handleSubmit(values: ItemFormValues) {
    if (editItem) {
      updateItem(editItem.id, values);
    } else {
      addItem(values);
    }
    closeForm();
  }

  return (
    <SafeAreaView style={{ flex: 1, backgroundColor: colors.white }}>
      <View className="flex-1 gap-4 pt-4">
        <Text className="px-4 font-inter-bold text-2xl text-maroon">Inventory</Text>

        <CategoryFilter
          categories={categories}
          selectedCategory={selectedCategory}
          onSelect={setSelectedCategory}
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
              canDelete={role === "admin"}
              onEdit={() => openEditForm(item)}
              onDelete={() => setDeleteTarget(item)}
            />
          )}
        />
      </View>

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

      <ItemFormModal
        key={formSession}
        visible={isAddOpen || editItem !== null}
        item={editItem ?? undefined}
        onClose={closeForm}
        onSubmit={handleSubmit}
      />

      <DeleteConfirmModal
        visible={deleteTarget !== null}
        onCancel={() => setDeleteTarget(null)}
        onConfirm={() => {
          if (deleteTarget) deleteItem(deleteTarget.id);
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
