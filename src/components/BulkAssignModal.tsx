import { Ionicons } from "@expo/vector-icons";
import { useMemo, useState } from "react";
import { Modal, ScrollView, StyleSheet, Text, TouchableOpacity, View } from "react-native";

import { colors, radii, spacing } from "@/constants/theme";
import { sampleUsers } from "@/data/sampleUsers";
import { getAssignableEmployees } from "@/lib/assignableEmployees";
import { useAppUsersStore } from "@/store/appUsersStore";

type BulkAssignModalProps = {
  visible: boolean;
  /** How many inventory items the chosen employee will be added to. */
  itemCount: number;
  isAssigning: boolean;
  onClose: () => void;
  onAssign: (clerkUserId: string) => void;
};

/**
 * Picks ONE employee to add to every selected inventory item.
 *
 * Deliberately not `ItemFormModal`'s picker: that one toggles several employees
 * for a single item, this one picks a single employee for many items. The
 * underlying roster-to-Clerk bridging is shared through
 * `getAssignableEmployees` so both stay consistent.
 *
 * Assignment is additive only — an employee already on an item is never removed
 * and never duplicated (see `handleBulkAssign` on the Inventory screen).
 */
export function BulkAssignModal({
  visible,
  itemCount,
  isAssigning,
  onClose,
  onAssign,
}: BulkAssignModalProps) {
  const appUsers = useAppUsersStore((state) => state.users);
  const appUsersLoading = useAppUsersStore((state) => state.isLoading);

  const assignableEmployees = useMemo(
    () => getAssignableEmployees(sampleUsers, appUsers),
    [appUsers],
  );

  const [selectedClerkUserId, setSelectedClerkUserId] = useState<string | null>(null);

  const canAssign =
    selectedClerkUserId !== null && itemCount > 0 && !appUsersLoading && !isAssigning;

  return (
    <Modal visible={visible} transparent animationType="slide" onRequestClose={onClose}>
      <View style={styles.overlay}>
        <View style={styles.sheet}>
          <ScrollView contentContainerStyle={styles.scrollContent}>
            <Text className="font-inter-bold text-xl text-maroon">Assign Employee</Text>
            <Text className="mt-1 font-inter text-sm text-text-secondary">
              Adds one employee to {itemCount} selected item{itemCount === 1 ? "" : "s"}. Existing
              assignments are kept.
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
                className="btn-primary flex-1"
                activeOpacity={canAssign ? 0.85 : 1}
                disabled={!canAssign}
                style={canAssign ? undefined : styles.disabled}
                onPress={() => {
                  if (selectedClerkUserId !== null) onAssign(selectedClerkUserId);
                }}
              >
                <Text className="btn-primary__text">{isAssigning ? "Assigning..." : "Assign"}</Text>
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
    maxHeight: "85%",
    backgroundColor: colors.white,
    borderTopLeftRadius: radii.lg,
    borderTopRightRadius: radii.lg,
    padding: spacing.lg,
  },
  scrollContent: {
    paddingBottom: spacing.lg,
  },
  disabled: {
    opacity: 0.5,
  },
});
