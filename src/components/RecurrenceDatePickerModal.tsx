import { Ionicons } from "@expo/vector-icons";
import { useState } from "react";
import { Modal, ScrollView, StyleSheet, Text, TouchableOpacity, View } from "react-native";

import { CalendarMonth, MONTH_SHORT_NAMES } from "@/components/CalendarMonth";
import { colors, radii, spacing } from "@/constants/theme";
import { formatReportDate } from "@/lib/reports";

/** How far ahead a date can be picked, counted from the earliest pickable
 * year. Wide enough for any real restaurant schedule, narrow enough that the
 * year stepper stays a short, obvious range rather than an open-ended one. */
const YEARS_AHEAD = 5;

type RecurrenceDatePickerModalProps = {
  visible: boolean;
  /** The dates already picked, as `YYYY-MM-DD`. */
  selectedDates: string[];
  /** `YYYY-MM-DD`; days before this cannot be picked — a date in the past
   * would never produce anything, since a rule's sequence starts at the
   * instant it is created. */
  minDate: string;
  /** `YYYY-MM-DD`; set when the rule ends on a date, since a day past it
   * cannot produce an occurrence either. */
  maxDate?: string;
  onCancel: () => void;
  onDone: (dates: string[]) => void;
};

/**
 * Picks any number of individual dates, across as many months as needed, in
 * one sitting: step to a year, tap a month, tap its days, then move to
 * another month with everything picked so far still held.
 *
 * Edits a local copy and hands it back only on Done, so Cancel genuinely
 * discards. The parent renders this conditionally rather than toggling
 * `visible` on a mounted instance, which is what makes that copy start fresh
 * from `selectedDates` each time it opens.
 */
export function RecurrenceDatePickerModal({
  visible,
  selectedDates,
  minDate,
  maxDate,
  onCancel,
  onDone,
}: RecurrenceDatePickerModalProps) {
  const [picked, setPicked] = useState<string[]>(selectedDates);

  const minYear = Number(minDate.slice(0, 4));
  const maxYear = maxDate ? Number(maxDate.slice(0, 4)) : minYear + YEARS_AHEAD;
  // Opens on the earliest month that still has something pickable in it,
  // rather than on January of a year that may be entirely in the past.
  const [year, setYear] = useState(minYear);
  const [month, setMonth] = useState(Number(minDate.slice(5, 7)));

  const pickedSet = new Set(picked);
  const sortedPicked = [...picked].sort();

  function toggleDate(isoDate: string) {
    setPicked((current) =>
      current.includes(isoDate)
        ? current.filter((existing) => existing !== isoDate)
        : [...current, isoDate],
    );
  }

  function stepYear(delta: number) {
    const next = year + delta;
    if (next < minYear || next > maxYear) return;
    setYear(next);
  }

  return (
    <Modal visible={visible} transparent animationType="slide" onRequestClose={onCancel}>
      <View style={styles.overlay}>
        <View style={styles.sheet}>
          <ScrollView contentContainerStyle={styles.scrollContent}>
            <Text className="font-inter-bold text-xl text-maroon">Pick Dates</Text>
            <Text className="mt-1 font-inter text-xs text-text-secondary">
              Pick as many days as you need. You can move between months and years — everything
              you pick is kept.
            </Text>

            <View className="mt-4 flex-row items-center justify-between">
              <TouchableOpacity
                className={year <= minYear ? "chip opacity-40" : "chip"}
                activeOpacity={year <= minYear ? 1 : 0.8}
                disabled={year <= minYear}
                onPress={() => stepYear(-1)}
                accessibilityRole="button"
                accessibilityLabel="Previous year"
              >
                <Ionicons name="chevron-back" size={16} color={colors.textSecondary} />
              </TouchableOpacity>

              <Text className="font-inter-bold text-lg text-text-primary">{year}</Text>

              <TouchableOpacity
                className={year >= maxYear ? "chip opacity-40" : "chip"}
                activeOpacity={year >= maxYear ? 1 : 0.8}
                disabled={year >= maxYear}
                onPress={() => stepYear(1)}
                accessibilityRole="button"
                accessibilityLabel="Next year"
              >
                <Ionicons name="chevron-forward" size={16} color={colors.textSecondary} />
              </TouchableOpacity>
            </View>

            <View className="mt-3 flex-row flex-wrap gap-2">
              {MONTH_SHORT_NAMES.map((name, index) => {
                const isActive = month === index + 1;
                return (
                  <TouchableOpacity
                    key={name}
                    className={isActive ? "chip chip--active" : "chip"}
                    activeOpacity={0.8}
                    onPress={() => setMonth(index + 1)}
                    accessibilityRole="button"
                    accessibilityState={{ selected: isActive }}
                  >
                    <Text className={isActive ? "chip__text chip__text--active" : "chip__text"}>
                      {name}
                    </Text>
                  </TouchableOpacity>
                );
              })}
            </View>

            <View className="mt-4">
              <CalendarMonth
                year={year}
                month={month}
                selectedDates={pickedSet}
                onToggleDate={toggleDate}
                minDate={minDate}
                maxDate={maxDate}
              />
            </View>

            <View className="mt-4 gap-2">
              <Text className="font-inter-medium text-sm text-text-primary">
                Picked ({sortedPicked.length})
              </Text>
              {sortedPicked.length === 0 ? (
                <Text className="font-inter text-xs text-text-secondary">
                  No dates picked yet.
                </Text>
              ) : (
                <View className="flex-row flex-wrap gap-2">
                  {sortedPicked.map((isoDate) => (
                    <TouchableOpacity
                      key={isoDate}
                      className="chip chip--active flex-row items-center gap-1"
                      activeOpacity={0.8}
                      onPress={() => toggleDate(isoDate)}
                      accessibilityRole="button"
                      accessibilityLabel={`Remove ${formatReportDate(isoDate)}`}
                    >
                      <Text className="chip__text chip__text--active">
                        {formatReportDate(isoDate)}
                      </Text>
                      <Ionicons name="close" size={12} color={colors.textPrimary} />
                    </TouchableOpacity>
                  ))}
                </View>
              )}
            </View>

            <View className="mt-5 flex-row gap-3">
              <TouchableOpacity
                className="flex-1 items-center rounded-lg border border-border py-3"
                activeOpacity={0.8}
                onPress={onCancel}
              >
                <Text className="font-inter-semibold text-base text-text-primary">Cancel</Text>
              </TouchableOpacity>
              <TouchableOpacity
                className="btn-primary flex-1"
                activeOpacity={0.85}
                onPress={() => onDone(sortedPicked)}
              >
                <Text className="btn-primary__text">Done</Text>
              </TouchableOpacity>
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
    maxHeight: "88%",
    backgroundColor: colors.white,
    borderTopLeftRadius: radii.lg,
    borderTopRightRadius: radii.lg,
    padding: spacing.lg,
  },
  scrollContent: {
    paddingBottom: spacing.lg,
  },
});
