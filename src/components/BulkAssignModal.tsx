import { Ionicons } from "@expo/vector-icons";
import { useMemo, useState } from "react";
import { Modal, ScrollView, StyleSheet, Text, TouchableOpacity, View } from "react-native";

import { colors, spacing } from "@/constants/theme";
import { sampleUsers } from "@/data/sampleUsers";
import { getAssignableEmployees } from "@/lib/assignableEmployees";
import { useAppUsersStore } from "@/store/appUsersStore";

type BulkAssignMode = "assign" | "unassign";

type BulkAssignModalProps = {
  visible: boolean;
  /** How many inventory items the chosen employee will be added to or removed from. */
  itemCount: number;
  isAssigning: boolean;
  onClose: () => void;
  onAssign: (clerkUserId: string) => void;
  onUnassign: (clerkUserId: string) => void;
};

/**
 * Picks ONE employee to add to or remove from every selected inventory item,
 * depending on the Assign/Unassign mode toggle.
 *
 * Deliberately not `ItemFormModal`'s picker: that one toggles several employees
 * for a single item, this one picks a single employee for many items. The
 * underlying roster-to-Clerk bridging is shared through
 * `getAssignableEmployees` so both stay consistent.
 *
 * Both modes are additive/subtractive only — an item already in the target
 * state (already assigned, or already missing the employee) is left as-is,
 * never duplicated and never erroring (see `handleBulkAssign` /
 * `handleBulkUnassign` on the Inventory screen).
 */
export function BulkAssignModal({
  visible,
  itemCount,
  isAssigning,
  onClose,
  onAssign,
  onUnassign,
}: BulkAssignModalProps) {
  const appUsers = useAppUsersStore((state) => state.users);
  const appUsersLoading = useAppUsersStore((state) => state.isLoading);

  const assignableEmployees = useMemo(
    () => getAssignableEmployees(sampleUsers, appUsers),
    [appUsers],
  );

  // Defaults to "assign" every time the modal opens (it remounts via the
  // `key` the Inventory screen bumps on each open), so existing behavior is
  // unchanged unless someone actively switches modes.
  const [mode, setMode] = useState<BulkAssignMode>("assign");
  const [selectedClerkUserId, setSelectedClerkUserId] = useState<string | null>(null);

  const canSubmit =
    selectedClerkUserId !== null && itemCount > 0 && !appUsersLoading && !isAssigning;

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
                ? `Adds one employee to ${itemCount} selected item${itemCount === 1 ? "" : "s"}. Existing assignments are kept.`
                : `Removes one employee from ${itemCount} selected item${itemCount === 1 ? "" : "s"}. Items without that employee are left untouched.`}
            </Text>

            <View className="mt-4 gap-2">
              {appUsersLoading ? (
                <Text className="font-inter text-sm text-text-secondary">
                  Loading employees...
                </Text>
              ) : assignableEmployees.length === 0 ? (
                <Text className="font-inter text-sm text-text-secondary">
                  No employees available to assign.
                </Text>
              ) : (
                assignableEmployees.map((employee) => {
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
