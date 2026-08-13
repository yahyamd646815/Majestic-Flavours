import { ScrollView, StyleSheet, Text, TouchableOpacity } from "react-native";

import type { Category } from "@/types/inventory";

type CategoryFilterProps = {
  categories: Category[];
  /** Empty set means "All" — matches every item, not none. Otherwise one or
   * more `Category.id`s, OR'd together against `item.categoryId`. */
  selectedCategoryIds: Set<string>;
  onToggle: (categoryId: string) => void;
  onClear: () => void;
};

export function CategoryFilter({
  categories,
  selectedCategoryIds,
  onToggle,
  onClear,
}: CategoryFilterProps) {
  const isAllActive = selectedCategoryIds.size === 0;

  return (
    <ScrollView
      horizontal
      showsHorizontalScrollIndicator={false}
      style={styles.scrollView}
      contentContainerStyle={styles.content}
    >
      <TouchableOpacity
        className={isAllActive ? "chip chip--active" : "chip"}
        activeOpacity={0.8}
        onPress={onClear}
      >
        <Text className={isAllActive ? "chip__text chip__text--active" : "chip__text"}>All</Text>
      </TouchableOpacity>

      {categories.map((category) => {
        const isActive = selectedCategoryIds.has(category.id);
        return (
          <TouchableOpacity
            key={category.id}
            className={isActive ? "chip chip--active" : "chip"}
            activeOpacity={0.8}
            onPress={() => onToggle(category.id)}
          >
            <Text className={isActive ? "chip__text chip__text--active" : "chip__text"}>
              {category.name}
            </Text>
          </TouchableOpacity>
        );
      })}
    </ScrollView>
  );
}

const styles = StyleSheet.create({
  scrollView: {
    flexGrow: 0,
  },
  content: {
    gap: 8,
    paddingHorizontal: 16,
    alignItems: "center",
  },
});
