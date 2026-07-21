import { Text, TouchableOpacity } from "react-native";

import { useInventoryStore } from "@/store/inventoryStore";
import { useReportStore } from "@/store/reportStore";

/**
 * Dev-only button for wiping this app's persisted Zustand state while testing.
 *
 * It calls each store's own `persist.clearStorage()` so only our keys
 * (`inventory-storage`, `report-storage`) are removed — nothing else in
 * AsyncStorage is touched. Gated behind `__DEV__`, so it renders nothing in
 * production builds.
 */
export function DevClearStorageButton() {
  if (!__DEV__) return null;

  return (
    <TouchableOpacity
      className="btn-danger"
      activeOpacity={0.85}
      onPress={() => {
        useInventoryStore.persist.clearStorage();
        useReportStore.persist.clearStorage();
      }}
    >
      <Text className="btn-danger__text">Clear Persisted State (Dev)</Text>
    </TouchableOpacity>
  );
}
