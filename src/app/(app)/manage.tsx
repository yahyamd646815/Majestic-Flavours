import { useUser } from "@clerk/expo";
import { Ionicons } from "@expo/vector-icons";
import { Redirect, useRouter } from "expo-router";
import type { ComponentProps } from "react";
import { Text, TouchableOpacity, View } from "react-native";
import { SafeAreaView } from "react-native-safe-area-context";

import { colors } from "@/constants/theme";
import { parseRole } from "@/types/role";

export default function Manage() {
  const { user } = useUser();
  const role = parseRole(user?.publicMetadata?.role);
  const router = useRouter();

  if (role !== "admin" && role !== "manager") return <Redirect href="/reports" />;

  return (
    <SafeAreaView style={{ flex: 1, backgroundColor: colors.white }}>
      <View className="px-4 pt-4">
        <Text className="font-inter-bold text-2xl text-maroon">Manage</Text>
        <Text className="mt-1 font-inter text-sm text-text-secondary">
          Jump to inventory, reports, or start a new report.
        </Text>
      </View>

      <View className="flex-1 justify-center gap-5 px-4 pb-12">
        <ManageButton
          icon="cube"
          label="Inventory"
          description="View and update stock levels"
          onPress={() => router.push("/inventory")}
        />
        <ManageButton
          icon="document-text"
          label="Reports"
          description="Browse daily reports"
          onPress={() => router.push("/reports")}
        />
        <ManageButton
          icon="add-circle"
          label="Make a Report"
          description="Submit your own report"
          highlight
          onPress={() => router.push("/reports?selfReport=1")}
        />
      </View>
    </SafeAreaView>
  );
}

type ManageButtonProps = {
  icon: ComponentProps<typeof Ionicons>["name"];
  label: string;
  description: string;
  onPress: () => void;
  highlight?: boolean;
};

function ManageButton({
  icon,
  label,
  description,
  onPress,
  highlight = false,
}: ManageButtonProps) {
  return (
    <TouchableOpacity
      className={
        highlight
          ? "flex-row items-center gap-4 rounded-xl bg-gold p-5 shadow-sm"
          : "flex-row items-center gap-4 rounded-xl bg-white p-5 shadow-sm"
      }
      activeOpacity={0.85}
      onPress={onPress}
      accessibilityRole="button"
      accessibilityLabel={label}
    >
      <View
        className={
          highlight
            ? "h-14 w-14 items-center justify-center rounded-full bg-white/30"
            : "h-14 w-14 items-center justify-center rounded-full bg-cream"
        }
      >
        <Ionicons name={icon} size={28} color={highlight ? colors.textPrimary : colors.maroon} />
      </View>

      <View className="flex-1">
        <Text className="font-inter-bold text-lg text-text-primary">{label}</Text>
        <Text
          className={
            highlight ? "font-inter text-sm text-text-primary/70" : "font-inter text-sm text-text-secondary"
          }
        >
          {description}
        </Text>
      </View>

      <Ionicons
        name="chevron-forward"
        size={22}
        color={highlight ? colors.textPrimary : colors.textSecondary}
      />
    </TouchableOpacity>
  );
}
