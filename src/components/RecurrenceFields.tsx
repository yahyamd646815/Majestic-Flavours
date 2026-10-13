import { Ionicons } from "@expo/vector-icons";
import NativeDateTimePicker from "@expo/ui/community/datetime-picker";
import { useState } from "react";
import { StyleSheet, Text, TextInput, TouchableOpacity, View } from "react-native";

import { RecurrenceDatePickerModal } from "@/components/RecurrenceDatePickerModal";
import { RecurrenceOccurrencePreview } from "@/components/RecurrenceOccurrencePreview";
import { colors, fonts, radii, spacing } from "@/constants/theme";
import { formatReportDate, getTodayIsoDate } from "@/lib/reports";
import {
  isoDateToPickerDate,
  pickerDateToIsoDate,
  pickerTimeToHHMM,
  type RecurrenceFormDraft,
} from "@/lib/taskRecurrence";
import type { RecurrenceDayPattern, RecurrenceTimePattern } from "@/types/tasks";

/** Index is the stored `days_of_week` value — 0=Sunday, matching
 * `Date.prototype.getDay()`. */
const WEEKDAY_LABELS = ["Sun", "Mon", "Tue", "Wed", "Thu", "Fri", "Sat"] as const;

const DAY_PATTERN_OPTIONS: { value: RecurrenceDayPattern; label: string }[] = [
  { value: "daily", label: "Daily" },
  { value: "weekly", label: "Weekly" },
  { value: "monthly", label: "Monthly" },
  { value: "custom", label: "Specific Dates" },
];

const TIME_PATTERN_OPTIONS: { value: RecurrenceTimePattern; label: string }[] = [
  { value: "fixed", label: "At set times" },
  { value: "interval", label: "Every few hours" },
];

/** `custom` is absent on purpose: it has no interval, and the field it labels
 * is not rendered for it at all. */
const INTERVAL_UNIT_LABELS: Record<Exclude<RecurrenceDayPattern, "custom">, string> = {
  daily: "days",
  weekly: "weeks",
  monthly: "months",
};

type RecurrenceFieldsProps = {
  draft: RecurrenceFormDraft;
  onChange: (draft: RecurrenceFormDraft) => void;
};

/** A labelled row of single-choice chips — the same pattern the category and
 * assignee pickers already use, just driven by a fixed option list. */
function ChipGroup<T extends string>({
  label,
  options,
  value,
  onSelect,
}: {
  label: string;
  options: { value: T; label: string }[];
  value: T;
  onSelect: (value: T) => void;
}) {
  return (
    <View className="gap-1">
      <Text className="font-inter-medium text-sm text-text-primary">{label}</Text>
      <View className="flex-row flex-wrap gap-2">
        {options.map((option) => {
          const isActive = option.value === value;
          return (
            <TouchableOpacity
              key={option.value}
              className={isActive ? "chip chip--active" : "chip"}
              activeOpacity={0.8}
              onPress={() => onSelect(option.value)}
              accessibilityRole="button"
              accessibilityState={{ selected: isActive }}
            >
              <Text className={isActive ? "chip__text chip__text--active" : "chip__text"}>
                {option.label}
              </Text>
            </TouchableOpacity>
          );
        })}
      </View>
    </View>
  );
}

/**
 * The recurrence controls shown when `TaskFormModal` is set to Recurring: a
 * structured pattern, explicitly picked calendar dates, or both together.
 *
 * "Specific Dates" is a fourth pattern rather than a mode switch, because
 * that is exactly what the data model says: `day_pattern = 'custom'` means
 * the picked dates are the whole schedule, while the other three patterns can
 * carry picked dates on top of themselves. Which is why the date picker sits
 * in the same column as everything else and simply changes label — nothing
 * about combining the two is a special case to be toggled into.
 *
 * Fully controlled: the draft lives in `TaskFormModal` so it survives this
 * component re-rendering, and `validateRecurrenceDraft` turns it into real
 * values in one place at submit time. Numeric fields stay as text here so a
 * field can be cleared while being retyped.
 */
export function RecurrenceFields({ draft, onChange }: RecurrenceFieldsProps) {
  const [isTimePickerOpen, setIsTimePickerOpen] = useState(false);
  const [isEndDatePickerOpen, setIsEndDatePickerOpen] = useState(false);
  const [isDatePickerOpen, setIsDatePickerOpen] = useState(false);

  // Riyadh's today, not the device's — the same "today" every date in this
  // form is measured against (AGENTS.md → Report Rules).
  const todayIsoDate = getTodayIsoDate();
  const isCustomOnly = draft.dayPattern === "custom";

  function update(changes: Partial<RecurrenceFormDraft>) {
    onChange({ ...draft, ...changes });
  }

  function toggleWeekday(day: number) {
    const next = draft.daysOfWeek.includes(day)
      ? draft.daysOfWeek.filter((existing) => existing !== day)
      : [...draft.daysOfWeek, day];
    update({ daysOfWeek: next });
  }

  function addTime(picked: Date) {
    const time = pickerTimeToHHMM(picked);
    // Adding the same time twice would read as a duplicate occurrence that
    // never actually happens, so it collapses silently.
    if (draft.timesOfDay.includes(time)) return;
    update({ timesOfDay: [...draft.timesOfDay, time] });
  }

  const sortedTimes = [...draft.timesOfDay].sort();
  // ISO dates sort lexicographically into chronological order, so this is
  // both the display order and the order they are stored in.
  const sortedCustomDates = [...draft.customDates].sort();

  return (
    <View className="gap-4 rounded-lg border border-border bg-cream/40 p-3">
      <ChipGroup
        label="Repeats"
        options={DAY_PATTERN_OPTIONS}
        value={draft.dayPattern}
        onSelect={(dayPattern) => update({ dayPattern })}
      />

      {draft.dayPattern === "custom" ? (
        <Text className="font-inter text-xs text-text-secondary">
          No repeating pattern — this runs on exactly the dates you pick below, and nothing else.
        </Text>
      ) : (
        <View className="gap-1">
          <Text className="font-inter-medium text-sm text-text-primary">Every</Text>
          <View className="flex-row items-center gap-3">
            <TextInput
              value={draft.dayIntervalText}
              onChangeText={(dayIntervalText) => update({ dayIntervalText })}
              keyboardType="number-pad"
              maxLength={3}
              style={styles.numberInput}
              accessibilityLabel="Repeat interval"
            />
            <Text className="font-inter text-base text-text-primary">
              {INTERVAL_UNIT_LABELS[draft.dayPattern]}
            </Text>
          </View>
          {draft.dayPattern === "weekly" ? (
            <Text className="font-inter text-xs text-text-secondary">
              &ldquo;Every 2 weeks on Monday&rdquo; means a Monday every second week — not the
              second Monday of the month.
            </Text>
          ) : null}
          {draft.dayPattern === "monthly" ? (
            <Text className="font-inter text-xs text-text-secondary">
              Repeats on the same day of the month. Months without that day are skipped.
            </Text>
          ) : null}
        </View>
      )}

      {draft.dayPattern === "weekly" ? (
        <View className="gap-1">
          <Text className="font-inter-medium text-sm text-text-primary">On These Days</Text>
          <View className="flex-row flex-wrap gap-2">
            {WEEKDAY_LABELS.map((label, day) => {
              const isActive = draft.daysOfWeek.includes(day);
              return (
                <TouchableOpacity
                  key={label}
                  className={isActive ? "chip chip--active" : "chip"}
                  activeOpacity={0.8}
                  onPress={() => toggleWeekday(day)}
                  accessibilityRole="button"
                  accessibilityState={{ selected: isActive }}
                >
                  <Text className={isActive ? "chip__text chip__text--active" : "chip__text"}>
                    {label}
                  </Text>
                </TouchableOpacity>
              );
            })}
          </View>
        </View>
      ) : null}

      <View className="gap-2">
        <Text className="font-inter-medium text-sm text-text-primary">
          {isCustomOnly ? "Dates" : "Extra Dates (optional)"}
        </Text>
        <Text className="font-inter text-xs text-text-secondary">
          {isCustomOnly
            ? "The exact days this runs on. They use the same times of day chosen below."
            : "One-off days to add on top of the pattern above. They use the same times of day, and a date the pattern already covers is not repeated."}
        </Text>

        {sortedCustomDates.length > 0 ? (
          <View className="flex-row flex-wrap gap-2">
            {sortedCustomDates.map((isoDate) => (
              <TouchableOpacity
                key={isoDate}
                className="chip chip--active flex-row items-center gap-1"
                activeOpacity={0.8}
                onPress={() =>
                  update({ customDates: draft.customDates.filter((d) => d !== isoDate) })
                }
                accessibilityRole="button"
                accessibilityLabel={`Remove ${formatReportDate(isoDate)}`}
              >
                <Text className="chip__text chip__text--active">{formatReportDate(isoDate)}</Text>
                <Ionicons name="close" size={12} color={colors.textPrimary} />
              </TouchableOpacity>
            ))}
          </View>
        ) : null}

        <TouchableOpacity
          className="flex-row items-center justify-center gap-1 rounded-lg border border-border bg-white py-3"
          activeOpacity={0.8}
          onPress={() => setIsDatePickerOpen(true)}
          accessibilityRole="button"
          accessibilityLabel="Pick dates on a calendar"
        >
          <Ionicons name="calendar-outline" size={16} color={colors.maroon} />
          <Text className="font-inter-semibold text-sm text-text-primary">
            {sortedCustomDates.length > 0 ? "Edit Dates" : "Pick Dates"}
          </Text>
        </TouchableOpacity>
      </View>

      {isDatePickerOpen ? (
        <RecurrenceDatePickerModal
          visible
          selectedDates={draft.customDates}
          minDate={todayIsoDate}
          maxDate={draft.endMode === "onDate" ? (draft.endsOnDate ?? undefined) : undefined}
          onCancel={() => setIsDatePickerOpen(false)}
          onDone={(customDates) => {
            update({ customDates });
            setIsDatePickerOpen(false);
          }}
        />
      ) : null}

      <ChipGroup
        label="Time Of Day"
        options={TIME_PATTERN_OPTIONS}
        value={draft.timePattern}
        onSelect={(timePattern) => {
          setIsTimePickerOpen(false);
          update({ timePattern });
        }}
      />

      {draft.timePattern === "fixed" ? (
        <View className="gap-2">
          <Text className="font-inter text-xs text-text-secondary">
            Add as many times as you need — the task is created once for each.
          </Text>
          {sortedTimes.length > 0 ? (
            <View className="flex-row flex-wrap gap-2">
              {sortedTimes.map((time) => (
                <TouchableOpacity
                  key={time}
                  className="chip chip--active flex-row items-center gap-1"
                  activeOpacity={0.8}
                  onPress={() =>
                    update({ timesOfDay: draft.timesOfDay.filter((t) => t !== time) })
                  }
                  accessibilityRole="button"
                  accessibilityLabel={`Remove ${time}`}
                >
                  <Text className="chip__text chip__text--active">{time}  ×</Text>
                </TouchableOpacity>
              ))}
            </View>
          ) : null}

          <TouchableOpacity
            className="items-center rounded-lg border border-border bg-white py-3"
            activeOpacity={0.8}
            onPress={() => setIsTimePickerOpen((open) => !open)}
            accessibilityRole="button"
            accessibilityLabel="Add a time of day"
          >
            <Text className="font-inter-semibold text-sm text-text-primary">+ Add Time</Text>
          </TouchableOpacity>

          {isTimePickerOpen ? (
            <NativeDateTimePicker
              mode="time"
              value={new Date()}
              onValueChange={(_, date) => {
                addTime(date);
                setIsTimePickerOpen(false);
              }}
              onDismiss={() => setIsTimePickerOpen(false)}
            />
          ) : null}
        </View>
      ) : (
        <View className="gap-1">
          <View className="flex-row items-center gap-3">
            <TextInput
              value={draft.hourIntervalText}
              onChangeText={(hourIntervalText) => update({ hourIntervalText })}
              keyboardType="number-pad"
              maxLength={2}
              style={styles.numberInput}
              accessibilityLabel="Hours between times"
            />
            <Text className="font-inter text-base text-text-primary">hours apart</Text>
          </View>
          <Text className="font-inter text-xs text-text-secondary">
            Counted from midnight, so every 8 hours means 00:00, 08:00 and 16:00.
          </Text>
        </View>
      )}

      <ChipGroup
        label="Ends"
        options={[
          { value: "after", label: "After a number of times" },
          { value: "onDate", label: "On a date" },
        ]}
        value={draft.endMode}
        onSelect={(endMode) => {
          setIsEndDatePickerOpen(false);
          update({ endMode });
        }}
      />

      {draft.endMode === "after" ? (
        <View className="flex-row items-center gap-3">
          <TextInput
            value={draft.endsAfterText}
            onChangeText={(endsAfterText) => update({ endsAfterText })}
            keyboardType="number-pad"
            maxLength={4}
            style={styles.numberInput}
            accessibilityLabel="Number of times this repeats"
          />
          <Text className="font-inter text-base text-text-primary">times in total</Text>
        </View>
      ) : (
        <View className="gap-2">
          <TouchableOpacity
            className="items-center rounded-lg border border-border bg-white py-3"
            activeOpacity={0.8}
            onPress={() => setIsEndDatePickerOpen((open) => !open)}
            accessibilityRole="button"
            accessibilityLabel="Pick the date this stops repeating"
          >
            <Text className="font-inter-semibold text-sm text-text-primary">
              {draft.endsOnDate ? formatReportDate(draft.endsOnDate) : "Pick End Date"}
            </Text>
          </TouchableOpacity>

          {isEndDatePickerOpen ? (
            <NativeDateTimePicker
              mode="date"
              // The already-picked end date if there is one, otherwise
              // Riyadh's today — seeded in the UTC digits the date picker
              // reads its `value` back in.
              value={isoDateToPickerDate(draft.endsOnDate ?? todayIsoDate)}
              onValueChange={(_, date) => {
                update({ endsOnDate: pickerDateToIsoDate(date) });
                setIsEndDatePickerOpen(false);
              }}
              onDismiss={() => setIsEndDatePickerOpen(false)}
            />
          ) : null}
        </View>
      )}

      <RecurrenceOccurrencePreview draft={draft} todayIsoDate={todayIsoDate} />
    </View>
  );
}

const styles = StyleSheet.create({
  // Same treatment as TaskFormModal's `input`, sized for a one- to
  // four-character number rather than a full-width line of text.
  numberInput: {
    width: 80,
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
