import { ScrollView, StyleSheet, Text, TouchableOpacity } from "react-native";

import type { Category } from "@/types/inventory";

type CategoryFilterProps = {
  categories: Category[];
  /** `null` means "All". Otherwise a `Category.id`, matched against `item.categoryId`. */
  selectedCategoryId: string | null;
  onSelect: (categoryId: string | null) => void;
};

export function CategoryFilter({
  categories,
  selectedCategoryId,
  onSelect,
}: CategoryFilterProps) {
  const isAllActive = selectedCategoryId === null;

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
        onPress={() => onSelect(null)}
      >
        <Text className={isAllActive ? "chip__text chip__text--active" : "chip__text"}>All</Text>
      </TouchableOpacity>

      {categories.map((category) => {
        const isActive = selectedCategoryId === category.id;
        return (
          <TouchableOpacity
            key={category.id}
            className={isActive ? "chip chip--active" : "chip"}
            activeOpacity={0.8}
            onPress={() => onSelect(category.id)}
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
