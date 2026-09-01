import { useEffect, useState } from "react";
import { Alert, Modal, StyleSheet, Text, TextInput, TouchableOpacity, View } from "react-native";

import { colors, fonts, radii, spacing } from "@/constants/theme";

const CONFIRM_WORD = "DELETE";

type DeleteConfirmModalProps = {
  visible: boolean;
  onCancel: () => void;
  onConfirm: () => void;
  warningMessage?: string;
};

/**
 * Two-step destructive-action confirmation per AGENTS.md's Delete Confirmation
 * Rule: a native "are you sure" alert, then a modal requiring the exact word
 * DELETE before the action can proceed.
 */
export function DeleteConfirmModal({
  visible,
  onCancel,
  onConfirm,
  warningMessage,
}: DeleteConfirmModalProps) {
  const [showTypeStep, setShowTypeStep] = useState(false);
  const [confirmText, setConfirmText] = useState("");

  useEffect(() => {
    // showTypeStep/confirmText are already reset by handleCancel and
    // handleConfirm before visible goes false, so there's nothing to clean up
    // here — this effect only needs to fire the native alert on open.
    if (!visible) return;

    Alert.alert(warningMessage ?? "Are you sure you want to delete this?", undefined, [
      { text: "Cancel", style: "cancel", onPress: onCancel },
      { text: "Confirm", style: "destructive", onPress: () => setShowTypeStep(true) },
    ]);
    // Runs once per open — including onCancel would re-fire the alert
    // whenever the parent's callback identity changes, not just on open.
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [visible]);

  function handleCancel() {
    setShowTypeStep(false);
    setConfirmText("");
    onCancel();
  }

  function handleConfirm() {
    if (confirmText !== CONFIRM_WORD) return;
    setShowTypeStep(false);
    setConfirmText("");
    onConfirm();
  }

  const canConfirm = confirmText === CONFIRM_WORD;

  return (
    <Modal
      visible={visible && showTypeStep}
      transparent
      animationType="fade"
      onRequestClose={handleCancel}
    >
      <View style={styles.overlay}>
        <View className="card gap-4">
          <Text className="font-inter-bold text-base text-text-primary">
            This action cannot be undone. Type DELETE to confirm.
          </Text>

          <TextInput
            value={confirmText}
            onChangeText={setConfirmText}
            placeholder="DELETE"
            placeholderTextColor={colors.textSecondary}
            autoCapitalize="characters"
            autoCorrect={false}
            style={styles.input}
          />

          <View className="flex-row gap-3">
            <TouchableOpacity
              className="flex-1 items-center rounded-lg border border-border py-3"
              activeOpacity={0.8}
              onPress={handleCancel}
            >
              <Text className="font-inter-semibold text-base text-text-primary">Cancel</Text>
            </TouchableOpacity>

            <TouchableOpacity
              className="btn-danger flex-1"
              activeOpacity={canConfirm ? 0.85 : 1}
              disabled={!canConfirm}
              style={!canConfirm ? styles.disabled : undefined}
              onPress={handleConfirm}
            >
              <Text className="btn-danger__text">Delete</Text>
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
  input: {
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
  disabled: {
    opacity: 0.5,
  },
});
