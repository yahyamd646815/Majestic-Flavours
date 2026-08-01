import { Ionicons } from "@expo/vector-icons";
import { Text, View } from "react-native";

import { colors } from "@/constants/theme";
import { formatReportDate, formatSnapshotTime } from "@/lib/reports";
import type { AppUser, InventoryItem, Report } from "@/types/inventory";

type ReportCardProps = {
  report: Report;
  /** Used to resolve each entry's item name, category and unit. */
  items: InventoryItem[];
  /** Undefined when the report's author is no longer in the user list. */
  reporter?: AppUser;
  isLocked: boolean;
};

/** One person's report for one day, as seen by Admins and Managers. */
export function ReportCard({ report, items, reporter, isLocked }: ReportCardProps) {
  return (
    <View className="card gap-3">
      <View className="flex-row items-start justify-between gap-2">
        <View className="flex-1">
          <Text className="font-inter-semibold text-base text-text-primary">
            {reporter?.name ?? "Unknown reporter"}
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

      <View className="gap-3 border-t border-border pt-3">
        <Text className="font-inter-medium text-sm text-text-primary">Items Reported</Text>

        {report.itemEntries.length === 0 ? (
          <Text className="font-inter text-xs text-text-secondary">No items reported.</Text>
        ) : (
          report.itemEntries.map((entry) => {
            const item = items.find((candidate) => candidate.id === entry.itemId);
            const latest = entry.snapshots[entry.snapshots.length - 1];

            return (
              <View key={entry.itemId} className="gap-1">
                <View className="flex-row items-start justify-between gap-3">
                  <View className="flex-1">
                    <Text className="font-inter-medium text-sm text-text-primary">
                      {item?.name ?? "Deleted item"}
                    </Text>
                    <Text className="font-inter text-xs text-text-secondary">
                      {item?.category ?? "No category"}
                    </Text>
                  </View>

                  {latest ? (
                    <Text className="font-inter-semibold text-sm text-text-primary">
                      {latest.quantity}
                      {item ? ` ${item.unit}` : ""}
                    </Text>
                  ) : null}
                </View>

                {entry.snapshots.length > 0 ? (
                  <Text className="font-inter text-xs text-text-secondary">
                    {entry.snapshots
                      .map(
                        (snapshot) =>
                          `${snapshot.quantity} at ${formatSnapshotTime(snapshot.recordedAt)}`,
                      )
                      .join("  →  ")}
                  </Text>
                ) : null}

                {entry.note.trim().length > 0 ? (
                  <Text className="font-inter text-xs text-text-primary">
                    Note: {entry.note}
                  </Text>
                ) : null}
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
