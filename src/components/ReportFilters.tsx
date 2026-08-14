import type { ReactNode } from "react";
import { ScrollView, StyleSheet, Text, TouchableOpacity, View } from "react-native";

import type { ReportDateFilter } from "@/lib/reports";
import { REPORT_DATE_FILTER_LABELS } from "@/lib/reports";
import type { AppUser, Category } from "@/types/inventory";

const DATE_FILTERS: ReportDateFilter[] = ["today", "week", "all"];

type ReportFiltersProps = {
  // Date stays single-select: date ranges have inherent subsumption ("This
  // Week" already includes "Today") that doesn't compose the same way
  // categories or people do.
  dateFilter: ReportDateFilter;
  onDateFilterChange: (filter: ReportDateFilter) => void;
  reporters: AppUser[];
  /** Empty set means "All" — matches every report, not none. */
  selectedReporterIds: Set<string>;
  onReporterToggle: (reporterId: string) => void;
  onReporterClear: () => void;
  categories: Category[];
  /** Empty set means "All" — matches every report, not none. */
  selectedCategoryIds: Set<string>;
  onCategoryToggle: (categoryId: string) => void;
  onCategoryClear: () => void;
};

/** Date / reporter / category chip filters above the Admin and Manager report list. */
export function ReportFilters({
  dateFilter,
  onDateFilterChange,
  reporters,
  selectedReporterIds,
  onReporterToggle,
  onReporterClear,
  categories,
  selectedCategoryIds,
  onCategoryToggle,
  onCategoryClear,
}: ReportFiltersProps) {
  return (
    <View className="gap-3">
      <FilterRow label="Date">
        {DATE_FILTERS.map((filter) => (
          <FilterChip
            key={filter}
            label={REPORT_DATE_FILTER_LABELS[filter]}
            isActive={dateFilter === filter}
            onPress={() => onDateFilterChange(filter)}
          />
        ))}
      </FilterRow>

      <FilterRow label="Reporter">
        <FilterChip
          label="All"
          isActive={selectedReporterIds.size === 0}
          onPress={onReporterClear}
        />
        {reporters.map((reporter) => (
          <FilterChip
            key={reporter.id}
            label={reporter.name}
            isActive={selectedReporterIds.has(reporter.id)}
            onPress={() => onReporterToggle(reporter.id)}
          />
        ))}
      </FilterRow>

      <FilterRow label="Category">
        <FilterChip
          label="All"
          isActive={selectedCategoryIds.size === 0}
          onPress={onCategoryClear}
        />
        {categories.map((category) => (
          <FilterChip
            key={category.id}
            label={category.name}
            isActive={selectedCategoryIds.has(category.id)}
            onPress={() => onCategoryToggle(category.id)}
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
        className="grow-0"
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
  content: {
    gap: 8,
    paddingHorizontal: 16,
    alignItems: "center",
  },
});
