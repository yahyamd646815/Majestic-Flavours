import { Ionicons } from "@expo/vector-icons";
import { useState } from "react";
import { StyleSheet, Text, TextInput, TouchableOpacity, View } from "react-native";

import { colors, fonts, radii, spacing } from "@/constants/theme";
import { formatDueDateTime } from "@/lib/reports";
import {
  MAX_REMINDERS_PER_TASK,
  formatReminderOffset,
  hasReminderAtOffset,
  parseReminderOffsetValue,
  reminderTriggerMs,
} from "@/lib/taskReminders";
import type { ReminderOffsetUnit, TaskReminder } from "@/types/tasks";

const UNIT_OPTIONS: { value: ReminderOffsetUnit; label: string }[] = [
  { value: "hours", label: "Hours" },
  { value: "days", label: "Days" },
];

type TaskReminderControlProps = {
  /** The task's due time — the instant every offset below is measured back
   * from, so the preview can say exactly when the reminder would fire. */
  dueAt: string;
  /** "Now", from the caller's `useNowTick` — the same value `TaskCard` uses
   * for its overdue checks. Read here rather than calling `Date.now()` during
   * render, which is impure and would leave the "already passed" warning
   * frozen at whatever the clock said when this card last rendered. */
  nowMs: number;
  /** This person's existing reminders on the task, longest lead time first
   * (`remindersForTask`) — empty when they have set none. Each is independent:
   * adding one never replaces another, and removing one leaves the rest
   * scheduled. */
  reminders: TaskReminder[];
  onAdd: (offsetValue: number, offsetUnit: ReminderOffsetUnit) => void;
  onRemove: (reminderId: string) => void;
};

/**
 * A personal "remind me N hours/days before this is due" control, rendered on
 * `TaskCard` for whoever is signed in on a task they are genuinely assigned
 * to — and only while the task is still open and not yet past due, since
 * neither state has a reminder instant left to fire at (see `canSetReminder`
 * in `TaskCard`).
 *
 * Up to `MAX_REMINDERS_PER_TASK` reminders can be stacked, each with its own
 * lead time, so "the day before" and "an hour before" are both possible on one
 * task. The add affordance simply stops being offered at the limit rather than
 * failing afterwards — the limit is client-side only, so nothing else enforces
 * it.
 *
 * A number field beside a unit choice, matching `RecurrenceFields`' own
 * number-input-plus-unit pattern rather than introducing a new convention —
 * the unit is a two-chip choice here only because it is picked rather than
 * fixed by the pattern above it.
 *
 * The preview line under the field is the point of the whole component: a
 * reminder that silently never fires (because the lead time reaches back past
 * now) is the one failure nobody would notice, so it is stated before the
 * reminder is even saved.
 */
export function TaskReminderControl({
  dueAt,
  nowMs,
  reminders,
  onAdd,
  onRemove,
}: TaskReminderControlProps) {
  const [isAdding, setIsAdding] = useState(false);
  // Text, not a number, so the field can be cleared while being retyped —
  // same reasoning as `RecurrenceFields`' numeric drafts.
  const [valueText, setValueText] = useState("1");
  const [unit, setUnit] = useState<ReminderOffsetUnit>("hours");
  const [error, setError] = useState<string | null>(null);

  const draftValue = parseReminderOffsetValue(valueText);
  const draftTriggerMs =
    draftValue === null ? null : reminderTriggerMs(dueAt, draftValue, unit);
  const isDraftInThePast = draftTriggerMs !== null && draftTriggerMs <= nowMs;
  const canAddMore = reminders.length < MAX_REMINDERS_PER_TASK;

  function openEditor() {
    // Always the default rather than a copy of an existing reminder: a second
    // reminder is a different lead time by definition, so seeding it from one
    // already set would only ever be a value that has to be changed.
    setValueText("1");
    setUnit("hours");
    setError(null);
    setIsAdding(true);
  }

  function handleSave() {
    if (draftValue === null) {
      setError("Enter a whole number of hours or days, from 1 upwards.");
      return;
    }
    if (hasReminderAtOffset(reminders, draftValue, unit)) {
      setError("You already have a reminder set for that time.");
      return;
    }
    onAdd(draftValue, unit);
    setIsAdding(false);
    setError(null);
  }

  return (
    <View className="gap-2 border-t border-border pt-3">
      {reminders.map((reminder) => (
        <View key={reminder.id} className="flex-row items-center gap-2">
          <Ionicons name="notifications" size={16} color={colors.gold} />
          <Text className="flex-1 font-inter text-sm text-text-primary">
            Reminder {formatReminderOffset(reminder.offsetValue, reminder.offsetUnit)} before
            due
          </Text>
          <TouchableOpacity
            onPress={() => onRemove(reminder.id)}
            accessibilityRole="button"
            accessibilityLabel={`Remove the reminder ${formatReminderOffset(reminder.offsetValue, reminder.offsetUnit)} before due`}
            hitSlop={8}
          >
            <Ionicons name="close" size={16} color={colors.textSecondary} />
          </TouchableOpacity>
        </View>
      ))}

      {isAdding ? (
        <View className="gap-3 pt-1">
          <Text className="font-inter-medium text-sm text-text-primary">Remind me</Text>

          <View className="flex-row items-center gap-3">
            <TextInput
              value={valueText}
              onChangeText={(text) => {
                setValueText(text);
                setError(null);
              }}
              keyboardType="number-pad"
              maxLength={3}
              style={styles.numberInput}
              accessibilityLabel="How long before the task is due"
            />
            <View className="flex-row gap-2">
              {UNIT_OPTIONS.map((option) => {
                const isActive = option.value === unit;
                return (
                  <TouchableOpacity
                    key={option.value}
                    className={isActive ? "chip chip--active" : "chip"}
                    activeOpacity={0.8}
                    onPress={() => {
                      setUnit(option.value);
                      setError(null);
                    }}
                    accessibilityRole="button"
                    accessibilityState={{ selected: isActive }}
                  >
                    <Text
                      className={isActive ? "chip__text chip__text--active" : "chip__text"}
                    >
                      {option.label}
                    </Text>
                  </TouchableOpacity>
                );
              })}
            </View>
            <Text className="font-inter text-sm text-text-secondary">before due</Text>
          </View>

          {draftTriggerMs === null ? null : isDraftInThePast ? (
            <Text className="font-inter text-xs text-out-of-stock">
              That time has already passed, so nothing will be sent. Choose a shorter
              reminder.
            </Text>
          ) : (
            <Text className="font-inter text-xs text-text-secondary">
              Fires {formatDueDateTime(new Date(draftTriggerMs).toISOString())}
            </Text>
          )}

          {error ? (
            <Text className="font-inter text-sm text-out-of-stock">{error}</Text>
          ) : null}

          <View className="flex-row gap-3">
            <TouchableOpacity
              className="flex-1 items-center rounded-lg border border-border py-2"
              activeOpacity={0.8}
              onPress={() => {
                setIsAdding(false);
                setError(null);
              }}
            >
              <Text className="font-inter-semibold text-sm text-text-primary">Cancel</Text>
            </TouchableOpacity>
            <TouchableOpacity
              className="btn-primary flex-1"
              activeOpacity={0.85}
              onPress={handleSave}
            >
              <Text className="btn-primary__text">Save Reminder</Text>
            </TouchableOpacity>
          </View>
        </View>
      ) : canAddMore ? (
        <TouchableOpacity
          className="flex-row items-center justify-center gap-1 rounded-lg border border-border py-2"
          activeOpacity={0.8}
          onPress={openEditor}
          accessibilityRole="button"
          accessibilityLabel={
            reminders.length === 0
              ? "Set a reminder for this task"
              : "Add another reminder for this task"
          }
        >
          <Ionicons name="notifications-outline" size={16} color={colors.maroon} />
          <Text className="font-inter-semibold text-sm text-maroon">
            {reminders.length === 0 ? "Set Reminder" : "Add Another Reminder"}
          </Text>
        </TouchableOpacity>
      ) : (
        // Said rather than left blank: three reminders and then nothing to tap
        // reads as a bug otherwise.
        <Text className="font-inter text-xs text-text-secondary">
          You have the maximum of {MAX_REMINDERS_PER_TASK} reminders on this task. Remove one
          to add a different time.
        </Text>
      )}
    </View>
  );
}

const styles = StyleSheet.create({
  // Same treatment as `RecurrenceFields`' own number field.
  numberInput: {
    width: 72,
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
