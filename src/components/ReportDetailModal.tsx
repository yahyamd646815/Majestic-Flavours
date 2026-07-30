import { Modal, ScrollView, StyleSheet, Text, TouchableOpacity, View } from "react-native";

import { ReportCard } from "@/components/ReportCard";
import { colors, radii, spacing } from "@/constants/theme";
import type { AppUser, InventoryItem, Report } from "@/types/inventory";

type ReportDetailModalProps = {
  visible: boolean;
  /** Undefined while no report is selected — the modal renders nothing then. */
  report?: Report;
  items: InventoryItem[];
  employee?: AppUser;
  isLocked: boolean;
  onClose: () => void;
};

/** Item-by-item detail for one report, opened from the Today list. */
export function ReportDetailModal({
  visible,
  report,
  items,
  employee,
  isLocked,
  onClose,
}: ReportDetailModalProps) {
  if (!report) return null;

  return (
    <Modal visible={visible} transparent animationType="slide" onRequestClose={onClose}>
      <View style={styles.overlay}>
        <View style={styles.sheet}>
          <ScrollView contentContainerStyle={styles.scrollContent}>
            <Text className="font-inter-bold text-xl text-maroon">Report Detail</Text>

            <View className="mt-4 gap-4">
              <ReportCard
                report={report}
                items={items}
                employee={employee}
                isLocked={isLocked}
              />

              <TouchableOpacity
                className="items-center rounded-lg border border-border py-3"
                activeOpacity={0.8}
                onPress={onClose}
              >
                <Text className="font-inter-semibold text-base text-text-primary">Close</Text>
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
    backgroundColor: colors.cream,
    borderTopLeftRadius: radii.lg,
    borderTopRightRadius: radii.lg,
    padding: spacing.lg,
  },
  scrollContent: {
    paddingBottom: spacing.lg,
  },
});
