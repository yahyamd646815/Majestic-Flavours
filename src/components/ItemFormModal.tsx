import { useState } from "react";
import { Modal, ScrollView, StyleSheet, Text, TextInput, TouchableOpacity, View } from "react-native";

import { colors, fonts, radii, spacing } from "@/constants/theme";
import { sampleUsers } from "@/data/sampleUsers";
import { useInventoryStore } from "@/store/inventoryStore";
import { useUnitsStore } from "@/store/unitsStore";
import type { InventoryItem } from "@/types/inventory";

export type ItemFormValues = Omit<InventoryItem, "id" | "createdAt">;

type ItemFormModalProps = {
  visible: boolean;
  item?: InventoryItem;
  onClose: () => void;
  onSubmit: (values: ItemFormValues) => void;
};

const employees = sampleUsers.filter((user) => user.role === "employee");

export function ItemFormModal({ visible, item, onClose, onSubmit }: ItemFormModalProps) {
  const categories = useInventoryStore((state) => state.categories);
  const units = useUnitsStore((state) => state.units);

  // No useEffect-based reset here — the parent remounts this component (via a
  // changing `key`) each time it opens for a new item, so these initializers
  // running fresh on mount is all the "reset" that's needed.
  const [name, setName] = useState(item?.name ?? "");
  const [category, setCategory] = useState<string | null>(
    item?.category ?? categories[0]?.name ?? null,
  );
  const [quantity, setQuantity] = useState(item ? String(item.currentQuantity) : "");
  const [unit, setUnit] = useState<string | null>(item?.unit ?? units[0]?.label ?? null);
  const [minThreshold, setMinThreshold] = useState(item ? String(item.minThreshold) : "");
  const [assignedEmployeeIds, setAssignedEmployeeIds] = useState<string[]>(
    item?.assignedEmployeeIds ?? [],
  );
  const [error, setError] = useState<string | null>(null);

  function toggleEmployee(id: string) {
    setAssignedEmployeeIds((current) =>
      current.includes(id) ? current.filter((existing) => existing !== id) : [...current, id],
    );
  }

  function handleSubmit() {
    const trimmedName = name.trim();
    const parsedQuantity = Number(quantity);
    const parsedThreshold = Number(minThreshold);

    if (trimmedName.length === 0) {
      setError("Enter an item name.");
      return;
    }
    if (!category) {
      setError("Select a category.");
      return;
    }
    if (!unit) {
      setError("Select a unit.");
      return;
    }
    if (quantity.trim().length === 0 || !Number.isFinite(parsedQuantity) || parsedQuantity < 0) {
      setError("Enter a valid quantity.");
      return;
    }
    if (
      minThreshold.trim().length === 0 ||
      !Number.isFinite(parsedThreshold) ||
      parsedThreshold < 0
    ) {
      setError("Enter a valid minimum threshold.");
      return;
    }

    onSubmit({
      name: trimmedName,
      category,
      currentQuantity: parsedQuantity,
      unit,
      minThreshold: parsedThreshold,
      assignedEmployeeIds,
    });
  }

  return (
    <Modal visible={visible} transparent animationType="slide" onRequestClose={onClose}>
      <View style={styles.overlay}>
        <View style={styles.sheet}>
          <ScrollView
            contentContainerStyle={styles.scrollContent}
            keyboardShouldPersistTaps="handled"
          >
            <Text className="font-inter-bold text-xl text-maroon">
              {item ? "Edit Item" : "Add Item"}
            </Text>

            <View className="mt-4 gap-4">
              <View className="gap-1">
                <Text className="font-inter-medium text-sm text-text-primary">Name</Text>
                <TextInput
                  value={name}
                  onChangeText={setName}
                  placeholder="e.g. Whole Milk"
                  placeholderTextColor={colors.textSecondary}
                  style={styles.input}
                />
              </View>

              <View className="gap-1">
                <Text className="font-inter-medium text-sm text-text-primary">Category</Text>
                <View className="flex-row flex-wrap gap-2">
                  {categories.map((c) => {
                    const isActive = category === c.name;
                    return (
                      <TouchableOpacity
                        key={c.id}
                        className={isActive ? "chip chip--active" : "chip"}
                        activeOpacity={0.8}
                        onPress={() => setCategory(c.name)}
                      >
                        <Text className={isActive ? "chip__text chip__text--active" : "chip__text"}>
                          {c.name}
                        </Text>
                      </TouchableOpacity>
                    );
                  })}
                </View>
              </View>

              <View className="flex-row gap-3">
                <View className="flex-1 gap-1">
                  <Text className="font-inter-medium text-sm text-text-primary">Quantity</Text>
                  <TextInput
                    value={quantity}
                    onChangeText={setQuantity}
                    placeholder="0"
                    placeholderTextColor={colors.textSecondary}
                    keyboardType="numeric"
                    style={styles.input}
                  />
                </View>
                <View className="flex-1 gap-1">
                  <Text className="font-inter-medium text-sm text-text-primary">Min. Threshold</Text>
                  <TextInput
                    value={minThreshold}
                    onChangeText={setMinThreshold}
                    placeholder="0"
                    placeholderTextColor={colors.textSecondary}
                    keyboardType="numeric"
                    style={styles.input}
                  />
                </View>
              </View>

              <View className="gap-1">
                <Text className="font-inter-medium text-sm text-text-primary">Unit</Text>
                <View className="flex-row flex-wrap gap-2">
                  {units.map((u) => {
                    const isActive = unit === u.label;
                    return (
                      <TouchableOpacity
                        key={u.id}
                        className={isActive ? "chip chip--active" : "chip"}
                        activeOpacity={0.8}
                        onPress={() => setUnit(u.label)}
                      >
                        <Text className={isActive ? "chip__text chip__text--active" : "chip__text"}>
                          {u.label}
                        </Text>
                      </TouchableOpacity>
                    );
                  })}
                </View>
              </View>

              <View className="gap-1">
                <Text className="font-inter-medium text-sm text-text-primary">
                  Assigned Employees
                </Text>
                <View className="flex-row flex-wrap gap-2">
                  {employees.map((employee) => {
                    const isActive = assignedEmployeeIds.includes(employee.id);
                    return (
                      <TouchableOpacity
                        key={employee.id}
                        className={isActive ? "chip chip--active" : "chip"}
                        activeOpacity={0.8}
                        onPress={() => toggleEmployee(employee.id)}
                      >
                        <Text className={isActive ? "chip__text chip__text--active" : "chip__text"}>
                          {employee.name}
                        </Text>
                      </TouchableOpacity>
                    );
                  })}
                </View>
              </View>

              {error ? <Text className="font-inter text-sm text-out-of-stock">{error}</Text> : null}

              <View className="flex-row gap-3">
                <TouchableOpacity
                  className="flex-1 items-center rounded-lg border border-border py-3"
                  activeOpacity={0.8}
                  onPress={onClose}
                >
                  <Text className="font-inter-semibold text-base text-text-primary">Cancel</Text>
                </TouchableOpacity>
                <TouchableOpacity className="btn-primary flex-1" activeOpacity={0.85} onPress={handleSubmit}>
                  <Text className="btn-primary__text">Save</Text>
                </TouchableOpacity>
              </View>
            </View>
          </ScrollView>
        </View>
      </View>
    </Modal>
  );
}

const styles = StyleSheet.create({
  overlay: {
    flex: 1,
    justifyContent: "flex-end",
    backgroundColor: "rgba(0,0,0,0.5)",
  },
  sheet: {
    maxHeight: "85%",
    backgroundColor: colors.white,
    borderTopLeftRadius: radii.lg,
    borderTopRightRadius: radii.lg,
    padding: spacing.lg,
  },
  scrollContent: {
    paddingBottom: spacing.lg,
  },
  input: {
    height: 48,
    borderWidth: 1,
    borderColor: colors.border,
    borderRadius: radii.md,
    backgroundColor: colors.white,
    paddingHorizontal: spacing.md,
    fontFamily: fonts.regular,
    fontSize: 16,
    color: colors.textPrimary,
  },
});
