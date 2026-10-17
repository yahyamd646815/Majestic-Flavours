import { useUser } from "@clerk/expo";
import { useRef, useState } from "react";
import { Alert } from "react-native";

import { generateId } from "@/lib/id";
import { getTodayIsoDate } from "@/lib/reports";
import type { StockStatus } from "@/lib/stockStatus";
import { useSupabaseClient } from "@/lib/supabase";
import { useAppUsersStore } from "@/store/appUsersStore";
import { useInventoryStore } from "@/store/inventoryStore";
import { useReportStore } from "@/store/reportStore";

/**
 * Changes an item's stock status straight from the Dashboard, without opening
 * a report. Two writes, in this order:
 *
 * 1. The live status, through `updateItem` — the same single write path a
 *    report ping uses, so `status_updated_at` restarts the Dashboard timer.
 * 2. A ping in today's report history, through `submitReport` — the same
 *    path the Reports screen uses, so the item's history has no silent gaps.
 *
 * Live status goes first so that a failure there changes nothing at all. A
 * failure in step 2 leaves the status changed and says so.
 */
export function useStockStatusChange() {
  const { user } = useUser();
  const supabase = useSupabaseClient();
  const updateItem = useInventoryStore((state) => state.updateItem);
  const submitReport = useReportStore((state) => state.submitReport);
  const selfSynced = useAppUsersStore((state) => state.selfSynced);

  const [isChanging, setIsChanging] = useState(false);
  // State alone can't stop a fast double tap: it only updates on the next render.
  const inFlightRef = useRef(false);

  /** Resolves once finished, whatever the outcome — failures are alerted here. */
  async function changeStatus(itemId: string, status: StockStatus): Promise<void> {
    const reporterId = user?.id;
    if (inFlightRef.current || !reporterId) return;

    // `submitReport` rewrites the day note from whatever it is given, so it must
    // be given today's real report. If reports haven't loaded, an existing note
    // would be overwritten with an empty one — so wait rather than risk that.
    const reportState = useReportStore.getState();
    if (!selfSynced || reportState.isLoading || reportState.error !== null) {
      Alert.alert(
        "Please wait a moment",
        "Your account and today's reports are still loading. Try again in a few seconds.",
      );
      return;
    }

    inFlightRef.current = true;
    setIsChanging(true);
    try {
      const statusChanged = await updateItem(supabase, itemId, { statusOverride: status });
      if (!statusChanged) {
        Alert.alert("Status not changed", "Check your connection and try again.");
        return;
      }

      const today = getTodayIsoDate();
      const todaysReport = reportState.getReportForReporterAndDate(reporterId, today);
      const result = await submitReport(
        supabase,
        reporterId,
        today,
        todaysReport?.content ?? "",
        [{ itemId, statusPing: status }],
        generateId("submission"),
      );

      if (result === null || result.failedItemIds.length > 0) {
        Alert.alert(
          "Status changed, but not recorded",
          "The status was updated, but it could not be added to today's report history. Check your connection.",
        );
      }
    } finally {
      inFlightRef.current = false;
      setIsChanging(false);
    }
  }

  return { isChanging, changeStatus };
}
