import { ScrollView, StyleSheet, Text, TouchableOpacity } from "react-native";

import type { Category } from "@/types/inventory";

type CategoryFilterProps = {
  categories: Category[];
  selectedCategory: string | null;
  onSelect: (category: string | null) => void;
};

export function CategoryFilter({ categories, selectedCategory, onSelect }: CategoryFilterProps) {
  const isAllActive = selectedCategory === null;

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
        const isActive = selectedCategory === category.name;
        return (
          <TouchableOpacity
            key={category.id}
            className={isActive ? "chip chip--active" : "chip"}
            activeOpacity={0.8}
            onPress={() => onSelect(category.name)}
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
