import { Ionicons } from "@expo/vector-icons";
import { Modal, StyleSheet, Text, TouchableOpacity, View } from "react-native";

import { colors, spacing } from "@/constants/theme";

type UnsavedChangesWarningModalProps = {
  visible: boolean;
  onCancel: () => void;
  onSignOutAnyway: () => void;
};

/**
 * Shown when someone signs out with report changes they never submitted. A
 * custom Modal rather than a native Alert because the three language blocks
 * need real layout — and Arabic and Urdu need their own writing direction.
 */
export function UnsavedChangesWarningModal({
  visible,
  onCancel,
  onSignOutAnyway,
}: UnsavedChangesWarningModalProps) {
  return (
    <Modal visible={visible} transparent animationType="fade" onRequestClose={onCancel}>
      <View style={styles.overlay}>
        <View className="card gap-4">
          <View className="items-center gap-2">
            <Ionicons name="warning" size={40} color={colors.lowStock} />
            <Text className="font-inter-bold text-base text-maroon">Unsaved Changes</Text>
          </View>

          <View className="gap-3">
            <Text className="font-inter text-sm text-text-primary">
              You have unsaved changes that haven&apos;t been reported. Signing out now will
              discard them — your inventory will not be updated. Are you sure you want to sign
              out?
            </Text>

            <View className="h-px bg-border" />

            <Text
              className="font-inter text-sm text-text-primary"
              style={{ writingDirection: "rtl" }}
            >
              لديك تغييرات غير محفوظة لم يتم الإبلاغ عنها. تسجيل الخروج الآن سيؤدي إلى تجاهلها - لن
              يتم تحديث المخزون. هل أنت متأكد أنك تريد تسجيل الخروج؟
            </Text>

            <View className="h-px bg-border" />

            <Text
              className="font-inter text-sm text-text-primary"
              style={{ writingDirection: "rtl" }}
            >
              آپ کے پاس غیر محفوظ شدہ تبدیلیاں ہیں جو رپورٹ نہیں کی گئیں۔ ابھی سائن آؤٹ کرنے سے وہ
              ضائع ہو جائیں گی - آپ کی انوینٹری اپ ڈیٹ نہیں ہوگی۔ کیا آپ واقعی سائن آؤٹ کرنا چاہتے
              ہیں؟
            </Text>
          </View>

          <View className="gap-2">
            <TouchableOpacity className="btn-primary" activeOpacity={0.85} onPress={onCancel}>
              <Text className="btn-primary__text">Cancel</Text>
            </TouchableOpacity>

            <TouchableOpacity
              className="btn-danger"
              activeOpacity={0.85}
              onPress={onSignOutAnyway}
            >
              <Text className="btn-danger__text">Sign Out Anyway</Text>
            </TouchableOpacity>
          </View>
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
