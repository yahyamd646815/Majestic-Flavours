import { Ionicons } from "@expo/vector-icons";
import { type ReactNode, useState } from "react";
import { Text, TouchableOpacity, View } from "react-native";

import { colors } from "@/constants/theme";

type CollapsibleSectionProps = {
  title: string;
  count: number;
  defaultExpanded?: boolean;
  children: ReactNode;
};

/** Pressable `section-header` row that toggles its own body visibility.
 * Rounding on the header switches between top-only (expanded, so it sits
 * flush above the body) and all four corners (collapsed, so it reads as a
 * complete card on its own). */
export function CollapsibleSection({
  title,
  count,
  defaultExpanded = false,
  children,
}: CollapsibleSectionProps) {
  const [isExpanded, setIsExpanded] = useState(defaultExpanded);

  return (
    <View>
      <TouchableOpacity
        className={
          isExpanded
            ? "section-header flex-row items-center justify-between rounded-t-xl"
            : "section-header flex-row items-center justify-between rounded-xl"
        }
        activeOpacity={0.8}
        onPress={() => setIsExpanded((current) => !current)}
        accessibilityRole="button"
        accessibilityState={{ expanded: isExpanded }}
        accessibilityLabel={`${title}, ${count} items`}
      >
        <Text className="section-header__title">
          {title} ({count})
        </Text>
        <Ionicons name={isExpanded ? "chevron-up" : "chevron-down"} size={18} color={colors.white} />
      </TouchableOpacity>

      {isExpanded ? <View className="gap-3 rounded-b-xl bg-cream p-3">{children}</View> : null}
    </View>
  );
}
