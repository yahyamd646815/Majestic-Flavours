import { Ionicons } from "@expo/vector-icons";
import { useState } from "react";
import { Modal, ScrollView, StyleSheet, Text, TouchableOpacity, View } from "react-native";

import { colors, spacing } from "@/constants/theme";
import type { AssignableEmployee } from "@/lib/assignableEmployees";
import { useAppUsersStore } from "@/store/appUsersStore";

type BulkAssignMode = "assign" | "unassign";

type BulkAssignModalProps = {
  visible: boolean;
  /** How many rows the chosen person will be added to or removed from. */
  selectedCount: number;
  /** What those rows are called in this screen's copy — "item" or "task".
   * Pluralized by appending "s", which suits both callers. */
  targetNoun: string;
  /**
   * The pool to pick from, injected rather than computed here. Inventory
   * assigns employees only (`getAssignableEmployees`), while Tasks' pool
   * depends on the signed-in person's own role — so this component can no
   * longer own that decision without picking the wrong one for someone.
   */
  employees: AssignableEmployee[];
  isAssigning: boolean;
  onClose: () => void;
  onAssign: (clerkUserId: string) => void;
  onUnassign: (clerkUserId: string) => void;
};

/**
 * Picks ONE person to add to or remove from every selected row — inventory
 * items on the Inventory screen, tasks on the Tasks screen — depending on the
 * Assign/Unassign mode toggle.
 *
 * Deliberately not `ItemFormModal`'s picker: that one toggles several people
 * for a single row, this one picks a single person for many rows.
 *
 * Both modes are additive/subtractive only — a row already in the target
 * state (already assigned, or already missing that person) is left as-is,
 * never duplicated and never erroring (see the `handleBulkAssign` /
 * `handleBulkUnassign` pair on either screen).
 */
export function BulkAssignModal({
  visible,
  selectedCount,
  targetNoun,
  employees,
  isAssigning,
  onClose,
  onAssign,
  onUnassign,
}: BulkAssignModalProps) {
  const appUsersLoading = useAppUsersStore((state) => state.isLoading);

  // Defaults to "assign" every time the modal opens (it remounts via the
  // `key` each screen bumps on open), so existing behavior is unchanged
  // unless someone actively switches modes.
  const [mode, setMode] = useState<BulkAssignMode>("assign");
  const [selectedClerkUserId, setSelectedClerkUserId] = useState<string | null>(null);

  const canSubmit =
    selectedClerkUserId !== null && selectedCount > 0 && !appUsersLoading && !isAssigning;
  const targetLabel = `${selectedCount} selected ${targetNoun}${selectedCount === 1 ? "" : "s"}`;

  return (
    <Modal visible={visible} transparent animationType="slide" onRequestClose={onClose}>
      <View className="flex-1 justify-end bg-black/50">
        <View className="max-h-[85%] rounded-t-2xl bg-white p-6">
          <ScrollView contentContainerStyle={styles.scrollContent}>
            <Text className="font-inter-bold text-xl text-maroon">
              {mode === "assign" ? "Assign Employee" : "Unassign Employee"}
            </Text>

            <View className="mt-3 flex-row rounded-lg border border-border p-1">
              <TouchableOpacity
                className={
                  mode === "assign" ? "flex-1 items-center rounded-md bg-gold py-2" : "flex-1 items-center py-2"
                }
                activeOpacity={0.8}
                onPress={() => setMode("assign")}
                accessibilityRole="radio"
                accessibilityState={{ checked: mode === "assign" }}
                accessibilityLabel="Assign mode"
              >
                <Text
                  className={
                    mode === "assign"
                      ? "font-inter-semibold text-sm text-text-primary"
                      : "font-inter-medium text-sm text-text-secondary"
                  }
                >
                  Assign
                </Text>
              </TouchableOpacity>
              <TouchableOpacity
                className={
                  mode === "unassign" ? "flex-1 items-center rounded-md bg-gold py-2" : "flex-1 items-center py-2"
                }
                activeOpacity={0.8}
                onPress={() => setMode("unassign")}
                accessibilityRole="radio"
                accessibilityState={{ checked: mode === "unassign" }}
                accessibilityLabel="Unassign mode"
              >
                <Text
                  className={
                    mode === "unassign"
                      ? "font-inter-semibold text-sm text-text-primary"
                      : "font-inter-medium text-sm text-text-secondary"
                  }
                >
                  Unassign
                </Text>
              </TouchableOpacity>
            </View>

            <Text className="mt-3 font-inter text-sm text-text-secondary">
              {mode === "assign"
                ? `Adds one person to ${targetLabel}. Existing assignments are kept.`
                : `Removes one person from ${targetLabel}. Those without that person are left untouched.`}
            </Text>

            <View className="mt-4 gap-2">
              {appUsersLoading ? (
                <Text className="font-inter text-sm text-text-secondary">
                  Loading employees...
                </Text>
              ) : employees.length === 0 ? (
                <Text className="font-inter text-sm text-text-secondary">
                  No one available to assign.
                </Text>
              ) : (
                employees.map((employee) => {
                  const isDisabled = employee.clerkUserId === undefined;
                  const isActive =
                    !isDisabled && selectedClerkUserId === employee.clerkUserId;
                  return (
                    <TouchableOpacity
                      key={employee.id}
                      className={
                        isActive
                          ? "flex-row items-center gap-3 rounded-lg border-2 border-gold px-3 py-3"
                          : isDisabled
                            ? "flex-row items-center gap-3 rounded-lg border-2 border-border px-3 py-3 opacity-50"
                            : "flex-row items-center gap-3 rounded-lg border-2 border-border px-3 py-3"
                      }
                      activeOpacity={isDisabled ? 1 : 0.8}
                      disabled={isDisabled}
                      onPress={() => setSelectedClerkUserId(employee.clerkUserId ?? null)}
                      accessibilityRole="radio"
                      accessibilityState={{ checked: isActive, disabled: isDisabled }}
                      accessibilityLabel={employee.name}
                    >
                      <Ionicons
                        name={isActive ? "radio-button-on" : "radio-button-off"}
                        size={20}
                        color={isActive ? colors.gold : colors.textSecondary}
                      />
                      <Text className="flex-1 font-inter-medium text-sm text-text-primary">
                        {employee.name}
                        {isDisabled ? " (Hasn't signed in yet)" : ""}
                      </Text>
                    </TouchableOpacity>
                  );
                })
              )}
            </View>

            <View className="mt-4 flex-row gap-3">
              <TouchableOpacity
                className="flex-1 items-center rounded-lg border border-border py-3"
                activeOpacity={0.8}
                disabled={isAssigning}
                onPress={onClose}
              >
                <Text className="font-inter-semibold text-base text-text-primary">Cancel</Text>
              </TouchableOpacity>
              <TouchableOpacity
                className={canSubmit ? "btn-primary flex-1" : "btn-primary flex-1 opacity-50"}
                activeOpacity={canSubmit ? 0.85 : 1}
                disabled={!canSubmit}
                onPress={() => {
                  if (selectedClerkUserId === null) return;
                  if (mode === "assign") onAssign(selectedClerkUserId);
                  else onUnassign(selectedClerkUserId);
                }}
              >
                <Text className="btn-primary__text">
                  {isAssigning
                    ? mode === "assign"
                      ? "Assigning..."
                      : "Unassigning..."
                    : mode === "assign"
                      ? "Assign"
                      : "Unassign"}
                </Text>
              </TouchableOpacity>
            </View>
          </ScrollView>
        </View>
      </View>
    </Modal>
  );
}

// ScrollView's contentContainerStyle isn't a NativeWind-stylable prop in the
// version installed here (see AGENTS.md's Style Exception Rules), so this one
// stays StyleSheet while everything else above moved to className.
const styles = StyleSheet.create({
  scrollContent: {
    paddingBottom: spacing.lg,
  },
});
