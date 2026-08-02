import { Ionicons } from "@expo/vector-icons";
import { Text, TouchableOpacity, View } from "react-native";

import { colors } from "@/constants/theme";

type ErrorStateProps = {
  message: string;
  onRetry: () => void;
};

/** Shown when a store's fetch failed — always offers a way back. */
export function ErrorState({ message, onRetry }: ErrorStateProps) {
  return (
    <View className="flex-1 items-center justify-center gap-3 px-6 py-16">
      <Ionicons name="cloud-offline-outline" size={40} color={colors.textSecondary} />

      <Text className="text-center font-inter-medium text-sm text-text-secondary">
        {message}
      </Text>

      <TouchableOpacity
        className="items-center rounded-lg bg-gold px-6 py-3"
        activeOpacity={0.85}
        onPress={onRetry}
        accessibilityRole="button"
        accessibilityLabel="Try again"
      >
        <Text className="font-inter-semibold text-base text-text-primary">Try Again</Text>
      </TouchableOpacity>
    </View>
  );
}
