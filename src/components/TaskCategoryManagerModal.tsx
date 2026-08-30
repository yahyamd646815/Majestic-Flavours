import { Modal, Text, TouchableOpacity, View } from "react-native";

import { SettingsListSection } from "@/components/SettingsListSection";
import type { TaskCategory } from "@/types/tasks";

type TaskCategoryManagerModalProps = {
  visible: boolean;
  categories: TaskCategory[];
  onClose: () => void;
  /** Resolves `false` when the add was rejected — a duplicate name, or a
   * failed write to Supabase. */
  onAdd: (name: string) => Promise<boolean>;
  onDelete: (id: string) => void;
};

/** Lists every task category with a delete button, plus an add-new row —
 * reached from `TaskAddMenuModal`'s "Manage Categories" option. Reuses
 * `SettingsListSection` directly so this matches Settings' inventory-category
 * management pattern exactly rather than inventing a separate look. */
export function TaskCategoryManagerModal({
  visible,
  categories,
  onClose,
  onAdd,
  onDelete,
}: TaskCategoryManagerModalProps) {
  const items = categories.map((category) => ({ id: category.id, label: category.name }));

  return (
    <Modal visible={visible} transparent animationType="slide" onRequestClose={onClose}>
      <View className="flex-1 justify-center bg-black/50 p-6">
        <View className="gap-4">
          <SettingsListSection
            title="Task Categories"
            items={items}
            onAdd={onAdd}
            onDelete={onDelete}
          />

          <TouchableOpacity
            className="items-center rounded-lg border border-border bg-white py-3"
            activeOpacity={0.8}
            onPress={onClose}
          >
            <Text className="font-inter-semibold text-base text-text-primary">Done</Text>
          </TouchableOpacity>
        </View>
      </View>
    </Modal>
  );
}
