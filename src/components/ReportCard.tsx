import { Ionicons } from "@expo/vector-icons";
import { Text, View } from "react-native";

import { colors } from "@/constants/theme";
import { formatReportDate } from "@/lib/reports";
import type { AppUser, InventoryItem, Report } from "@/types/inventory";

type ReportCardProps = {
  report: Report;
  /** Used to resolve each change's item name, category and unit. */
  items: InventoryItem[];
  /** Undefined when the report's author is no longer in the user list. */
  employee?: AppUser;
  isLocked: boolean;
};

/** One employee's report for one day, as seen by Admins and Managers. */
export function ReportCard({ report, items, employee, isLocked }: ReportCardProps) {
  return (
    <View className="card gap-3">
      <View className="flex-row items-start justify-between gap-2">
        <View className="flex-1">
          <Text className="font-inter-semibold text-base text-text-primary">
            {employee?.name ?? "Unknown employee"}
          </Text>
          <Text className="font-inter text-xs text-text-secondary">
            {formatReportDate(report.date)}
          </Text>
        </View>

        {isLocked ? (
          <View className="chip flex-row items-center gap-1">
            <Ionicons name="lock-closed" size={12} color={colors.textSecondary} />
            <Text className="chip__text">Locked</Text>
          </View>
        ) : null}
      </View>

      <View className="gap-2 border-t border-border pt-3">
        <Text className="font-inter-medium text-sm text-text-primary">Quantity Changes</Text>

        {report.itemChanges.length === 0 ? (
          <Text className="font-inter text-xs text-text-secondary">No quantity changes.</Text>
        ) : (
          report.itemChanges.map((change) => {
            const item = items.find((candidate) => candidate.id === change.itemId);
            return (
              <View
                key={change.itemId}
                className="flex-row items-center justify-between gap-3"
              >
                <View className="flex-1">
                  <Text className="font-inter-medium text-sm text-text-primary">
                    {item?.name ?? "Deleted item"}
                  </Text>
                  <Text className="font-inter text-xs text-text-secondary">
                    {item?.category ?? "No category"}
                  </Text>
                </View>

                <Text className="font-inter-semibold text-sm text-text-primary">
                  {change.startQuantity} → {change.endQuantity}
                  {item ? ` ${item.unit}` : ""}
                </Text>
              </View>
            );
          })
        )}
      </View>

      <View className="gap-1 border-t border-border pt-3">
        <Text className="font-inter-medium text-sm text-text-primary">Written Report</Text>
        {report.content.trim().length > 0 ? (
          <Text className="font-inter text-sm text-text-primary">{report.content}</Text>
        ) : (
          <Text className="font-inter text-xs text-text-secondary">No written report</Text>
        )}
      </View>
    </View>
  );
}
