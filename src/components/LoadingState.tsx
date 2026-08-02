import { ActivityIndicator, Text, View } from "react-native";

import { colors } from "@/constants/theme";

type LoadingStateProps = {
  message?: string;
};

/** Shown while a store's first fetch is still in flight. */
export function LoadingState({ message = "Loading inventory..." }: LoadingStateProps) {
  return (
    <View className="flex-1 items-center justify-center gap-3 py-16">
      <ActivityIndicator size="large" color={colors.gold} />
      <Text className="font-inter-medium text-sm text-text-secondary">{message}</Text>
    </View>
  );
}
