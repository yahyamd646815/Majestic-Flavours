import { Ionicons } from "@expo/vector-icons";
import { Text, TouchableOpacity, View } from "react-native";

import { colors } from "@/constants/theme";
import type { AppUser } from "@/types/inventory";
import type { Role } from "@/types/role";

const ROLE_BADGE: Record<Role, { badgeClass: string; textClass: string; label: string }> = {
  admin: { badgeClass: "badge-maroon", textClass: "badge-maroon__text", label: "Admin" },
  manager: { badgeClass: "badge-gold", textClass: "badge-gold__text", label: "Manager" },
  employee: { badgeClass: "badge-green", textClass: "badge-green__text", label: "Employee" },
};

type UserCardProps = {
  user: AppUser;
  onEditRole: () => void;
  onRemove: () => void;
};

export function UserCard({ user, onEditRole, onRemove }: UserCardProps) {
  const badge = ROLE_BADGE[user.role];

  return (
    <View className="card gap-3">
      <View className="flex-row items-start justify-between gap-2">
        <View className="flex-1">
          <Text className="font-inter-semibold text-base text-text-primary">{user.name}</Text>
          <Text className="font-inter text-xs text-text-secondary">{user.email}</Text>
        </View>
        <View className={badge.badgeClass}>
          <Text className={badge.textClass}>{badge.label}</Text>
        </View>
      </View>

      <View className="flex-row gap-3 border-t border-border pt-3">
        <TouchableOpacity
          className="flex-1 flex-row items-center justify-center gap-1 rounded-lg border border-border py-2"
          activeOpacity={0.8}
          onPress={onEditRole}
        >
          <Ionicons name="create-outline" size={16} color={colors.maroon} />
          <Text className="font-inter-semibold text-sm text-maroon">Edit Role</Text>
        </TouchableOpacity>

        <TouchableOpacity
          className="flex-1 flex-row items-center justify-center gap-1 rounded-lg border border-out-of-stock py-2"
          activeOpacity={0.8}
          onPress={onRemove}
        >
          <Ionicons name="trash-outline" size={16} color={colors.outOfStock} />
          <Text className="font-inter-semibold text-sm text-out-of-stock">Remove</Text>
        </TouchableOpacity>
      </View>
    </View>
  );
}
