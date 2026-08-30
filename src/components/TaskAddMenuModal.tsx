import { Ionicons } from "@expo/vector-icons";
import { Modal, Text, TouchableOpacity, View } from "react-native";

import { colors } from "@/constants/theme";

type TaskAddMenuModalProps = {
  visible: boolean;
  /** Task creation is genuinely unreachable without an existing category —
   * not just a UI nudge (AGENTS.md). Reflected here as a real disabled
   * state, not just button ordering. */
  hasCategories: boolean;
  onClose: () => void;
  onCreateCategory: () => void;
  onCreateTask: () => void;
};

/** The "+" FAB's popup on the Tasks screen — routes to either
 * `TaskCategoryFormModal` or `TaskFormModal`. */
export function TaskAddMenuModal({
  visible,
  hasCategories,
  onClose,
  onCreateCategory,
  onCreateTask,
}: TaskAddMenuModalProps) {
  return (
    <Modal visible={visible} transparent animationType="slide" onRequestClose={onClose}>
      <View className="flex-1 justify-end bg-black/50">
        <View className="gap-4 rounded-t-2xl bg-white p-6">
          <Text className="font-inter-bold text-xl text-maroon">Add</Text>

          <TouchableOpacity
            className="flex-row items-center gap-3 rounded-lg border border-border px-4 py-4"
            activeOpacity={0.8}
            onPress={onCreateCategory}
            accessibilityRole="button"
            accessibilityLabel="Create category"
          >
            <View className="h-10 w-10 items-center justify-center rounded-full bg-cream">
              <Ionicons name="pricetag-outline" size={20} color={colors.maroon} />
            </View>
            <View className="flex-1">
              <Text className="font-inter-semibold text-base text-text-primary">
                Create Category
              </Text>
              <Text className="font-inter text-xs text-text-secondary">
                Group tasks, e.g. &ldquo;Cleaning&rdquo; or &ldquo;Prep&rdquo;
              </Text>
            </View>
          </TouchableOpacity>

          <TouchableOpacity
            className={
              hasCategories
                ? "flex-row items-center gap-3 rounded-lg border border-border px-4 py-4"
                : "flex-row items-center gap-3 rounded-lg border border-border px-4 py-4 opacity-50"
            }
            activeOpacity={hasCategories ? 0.8 : 1}
            disabled={!hasCategories}
            onPress={onCreateTask}
            accessibilityRole="button"
            accessibilityLabel="Create task"
            accessibilityState={{ disabled: !hasCategories }}
          >
            <View className="h-10 w-10 items-center justify-center rounded-full bg-cream">
              <Ionicons name="checkbox-outline" size={20} color={colors.maroon} />
            </View>
            <View className="flex-1">
              <Text className="font-inter-semibold text-base text-text-primary">
                Create Task
              </Text>
              <Text className="font-inter text-xs text-text-secondary">
                {hasCategories
                  ? "Assign a task to one or more employees"
                  : "Create a category first"}
              </Text>
            </View>
          </TouchableOpacity>

          <TouchableOpacity
            className="items-center rounded-lg border border-border py-3"
            activeOpacity={0.8}
            onPress={onClose}
          >
            <Text className="font-inter-semibold text-base text-text-primary">Cancel</Text>
          </TouchableOpacity>
        </View>
      </View>
    </Modal>
  );
}
