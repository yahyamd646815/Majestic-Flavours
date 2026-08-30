import { useState } from "react";
import { Modal, StyleSheet, Text, TextInput, TouchableOpacity, View } from "react-native";

import { colors, fonts, radii, spacing } from "@/constants/theme";

type TaskCategoryFormModalProps = {
  visible: boolean;
  isSaving: boolean;
  onClose: () => void;
  onSubmit: (name: string) => void;
};

/** Minimal name-only form for a new task category — reached from
 * `TaskAddMenuModal`'s "Create Category" option. */
export function TaskCategoryFormModal({
  visible,
  isSaving,
  onClose,
  onSubmit,
}: TaskCategoryFormModalProps) {
  const [name, setName] = useState("");
  const [error, setError] = useState<string | null>(null);

  function handleClose() {
    setName("");
    setError(null);
    onClose();
  }

  function handleSubmit() {
    if (name.trim().length === 0) {
      setError("Enter a category name.");
      return;
    }
    onSubmit(name.trim());
  }

  return (
    <Modal visible={visible} transparent animationType="slide" onRequestClose={handleClose}>
      <View style={styles.overlay}>
        <View className="card gap-4">
          <Text className="font-inter-bold text-xl text-maroon">New Task Category</Text>

          <View className="gap-1">
            <Text className="font-inter-medium text-sm text-text-primary">Name</Text>
            <TextInput
              value={name}
              onChangeText={setName}
              placeholder="e.g. Cleaning"
              placeholderTextColor={colors.textSecondary}
              style={styles.input}
              autoFocus
            />
          </View>

          {error ? <Text className="font-inter text-sm text-out-of-stock">{error}</Text> : null}

          <View className="flex-row gap-3">
            <TouchableOpacity
              className="flex-1 items-center rounded-lg border border-border py-3"
              activeOpacity={0.8}
              disabled={isSaving}
              onPress={handleClose}
            >
              <Text className="font-inter-semibold text-base text-text-primary">Cancel</Text>
            </TouchableOpacity>
            <TouchableOpacity
              className="btn-primary flex-1"
              activeOpacity={0.85}
              disabled={isSaving}
              onPress={handleSubmit}
            >
              <Text className="btn-primary__text">{isSaving ? "Saving..." : "Save"}</Text>
            </TouchableOpacity>
          </View>
        </View>
      </View>
    </Modal>
  );
}

const styles = StyleSheet.create({
  overlay: {
    flex: 1,
    justifyContent: "center",
    backgroundColor: "rgba(0,0,0,0.5)",
    padding: spacing.lg,
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
