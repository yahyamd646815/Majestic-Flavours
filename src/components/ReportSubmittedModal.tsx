import { Ionicons } from "@expo/vector-icons";
import { Modal, StyleSheet, Text, TouchableOpacity, View } from "react-native";

import { colors, spacing } from "@/constants/theme";

type ReportSubmittedModalProps = {
  visible: boolean;
  onClose: () => void;
};

/**
 * Shown after every successful report submit or update. A custom Modal rather
 * than a native Alert because the three language blocks need real layout — and
 * Arabic and Urdu need their own writing direction.
 */
export function ReportSubmittedModal({ visible, onClose }: ReportSubmittedModalProps) {
  return (
    <Modal visible={visible} transparent animationType="fade" onRequestClose={onClose}>
      <View style={styles.overlay}>
        <View className="card gap-4">
          <View className="items-center gap-2">
            <Ionicons name="checkmark-circle" size={40} color={colors.inStock} />
            <Text className="font-inter-bold text-base text-maroon">Report Saved</Text>
          </View>

          <View className="gap-3">
            <Text className="font-inter text-sm text-text-primary">
              Thank you for submitting your report. You can change it anytime until the day is over.
            </Text>

            <View className="h-px bg-border" />

            <Text
              className="font-inter text-sm text-text-primary"
              style={{ writingDirection: "rtl" }}
            >
              شكراً لتقديم تقريرك. يمكنك تعديله في أي وقت حتى نهاية اليوم.
            </Text>

            <View className="h-px bg-border" />

            <Text
              className="font-inter text-sm text-text-primary"
              style={{ writingDirection: "rtl" }}
            >
              آپ کی رپورٹ جمع کرنے کا شکریہ۔ آپ اسے دن ختم ہونے تک کسی بھی وقت تبدیل کر سکتے ہیں۔
            </Text>
          </View>

          <TouchableOpacity className="btn-primary" activeOpacity={0.85} onPress={onClose}>
            <Text className="btn-primary__text">OK</Text>
          </TouchableOpacity>
        </View>
      </View>
    </Modal>
  );
}

const styles = StyleSheet.create({
  overlay: {
    flex: 1,
    justifyContent: "center",
    backgroundColor: "rgba(0,0,0,0.5)",
    padding: spacing.lg,
  },
});
