import { Ionicons } from "@expo/vector-icons";
import { useState } from "react";
import { StyleSheet, Text, TextInput, TouchableOpacity, View } from "react-native";

import { colors, fonts, radii, spacing } from "@/constants/theme";

export type SettingsListItem = {
  id: string;
  label: string;
};

type SettingsListSectionProps = {
  title: string;
  items: SettingsListItem[];
  /** Resolves `false` when the add was rejected — a duplicate name, or a
   * failed write to Supabase. */
  onAdd: (label: string) => Promise<boolean>;
  onDelete: (id: string) => void;
  canDelete?: boolean;
};

export function SettingsListSection({
  title,
  items,
  onAdd,
  onDelete,
  canDelete = true,
}: SettingsListSectionProps) {
  const [label, setLabel] = useState("");
  const [error, setError] = useState<string | null>(null);
  const [isAdding, setIsAdding] = useState(false);

  async function handleAdd() {
    const trimmed = label.trim();
    if (trimmed.length === 0 || isAdding) return;

    setIsAdding(true);
    const success = await onAdd(trimmed);
    setIsAdding(false);

    if (!success) {
      setError(`Could not add "${trimmed}". It may already exist, or the save failed.`);
      return;
    }

    setError(null);
    setLabel("");
  }

  return (
    <View>
      <View className="section-header rounded-t-xl">
        <Text className="section-header__title">{title}</Text>
      </View>

      <View className="gap-3 rounded-b-xl bg-cream p-3">
        {items.length === 0 ? (
          <Text className="py-2 text-center font-inter text-sm text-text-secondary">
            None added yet.
          </Text>
        ) : (
          items.map((item) => (
            <View key={item.id} className="card flex-row items-center justify-between">
              <Text className="flex-1 font-inter-medium text-sm text-text-primary">
                {item.label}
              </Text>
              {canDelete ? (
                <TouchableOpacity
                  activeOpacity={0.7}
                  onPress={() => onDelete(item.id)}
                  accessibilityRole="button"
                  accessibilityLabel={`Delete ${item.label}`}
                >
                  <Ionicons name="trash-outline" size={18} color={colors.outOfStock} />
                </TouchableOpacity>
              ) : null}
            </View>
          ))
        )}

        <View className="flex-row gap-2">
          <TextInput
            value={label}
            onChangeText={(text) => {
              setLabel(text);
              if (error) setError(null);
            }}
            placeholder="Add new..."
            placeholderTextColor={colors.textSecondary}
            style={styles.input}
            accessibilityLabel={`New ${title.toLowerCase()} name`}
          />
          <TouchableOpacity
            className={
              isAdding
                ? "items-center justify-center rounded-lg bg-gold px-4 opacity-50"
                : "items-center justify-center rounded-lg bg-gold px-4"
            }
            activeOpacity={0.85}
            disabled={isAdding}
            onPress={() => void handleAdd()}
            accessibilityRole="button"
            accessibilityLabel={`Add ${title.toLowerCase()}`}
          >
            <Text className="font-inter-semibold text-sm text-text-primary">
              {isAdding ? "Adding..." : "Add"}
            </Text>
          </TouchableOpacity>
        </View>

        {error ? (
          <Text className="font-inter text-xs text-out-of-stock">{error}</Text>
        ) : null}
      </View>
    </View>
  );
}

const styles = StyleSheet.create({
  input: {
    flex: 1,
    height: 44,
    borderWidth: 1,
    borderColor: colors.border,
    borderRadius: radii.md,
    backgroundColor: colors.white,
    paddingHorizontal: spacing.md,
    fontFamily: fonts.regular,
    fontSize: 14,
    color: colors.textPrimary,
  },
});