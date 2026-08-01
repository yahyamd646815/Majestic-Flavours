import type { ReactNode } from "react";
import { ScrollView, StyleSheet, Text, TouchableOpacity, View } from "react-native";

import type { ReportDateFilter } from "@/lib/reports";
import type { AppUser, Category } from "@/types/inventory";

const DATE_FILTERS: { id: ReportDateFilter; label: string }[] = [
  { id: "today", label: "Today" },
  { id: "week", label: "This Week" },
  { id: "all", label: "All Time" },
];

type ReportFiltersProps = {
  dateFilter: ReportDateFilter;
  onDateFilterChange: (filter: ReportDateFilter) => void;
  reporters: AppUser[];
  selectedReporterId: string | null;
  onReporterChange: (reporterId: string | null) => void;
  categories: Category[];
  selectedCategory: string | null;
  onCategoryChange: (category: string | null) => void;
};

/** Date / reporter / category chip filters above the Admin and Manager report list. */
export function ReportFilters({
  dateFilter,
  onDateFilterChange,
  reporters,
  selectedReporterId,
  onReporterChange,
  categories,
  selectedCategory,
  onCategoryChange,
}: ReportFiltersProps) {
  return (
    <View className="gap-3">
      <FilterRow label="Date">
        {DATE_FILTERS.map((filter) => (
          <FilterChip
            key={filter.id}
            label={filter.label}
            isActive={dateFilter === filter.id}
            onPress={() => onDateFilterChange(filter.id)}
          />
        ))}
      </FilterRow>

      <FilterRow label="Reporter">
        <FilterChip
          label="All"
          isActive={selectedReporterId === null}
          onPress={() => onReporterChange(null)}
        />
        {reporters.map((reporter) => (
          <FilterChip
            key={reporter.id}
            label={reporter.name}
            isActive={selectedReporterId === reporter.id}
            onPress={() => onReporterChange(reporter.id)}
          />
        ))}
      </FilterRow>

      <FilterRow label="Category">
        <FilterChip
          label="All"
          isActive={selectedCategory === null}
          onPress={() => onCategoryChange(null)}
        />
        {categories.map((category) => (
          <FilterChip
            key={category.id}
            label={category.name}
            isActive={selectedCategory === category.name}
            onPress={() => onCategoryChange(category.name)}
          />
        ))}
      </FilterRow>
    </View>
  );
}

function FilterRow({ label, children }: { label: string; children: ReactNode }) {
  return (
    <View className="gap-1.5">
      <Text className="px-4 font-inter-medium text-xs text-text-secondary">{label}</Text>
      <ScrollView
        horizontal
        showsHorizontalScrollIndicator={false}
        style={styles.scrollView}
        contentContainerStyle={styles.content}
      >
        {children}
      </ScrollView>
    </View>
  );
}

function FilterChip({
  label,
  isActive,
  onPress,
}: {
  label: string;
  isActive: boolean;
  onPress: () => void;
}) {
  return (
    <TouchableOpacity
      className={isActive ? "chip chip--active" : "chip"}
      activeOpacity={0.8}
      onPress={onPress}
      accessibilityRole="button"
      accessibilityLabel={label}
      accessibilityState={{ selected: isActive }}
    >
      <Text className={isActive ? "chip__text chip__text--active" : "chip__text"}>{label}</Text>
    </TouchableOpacity>
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