import { Text, TouchableOpacity } from "react-native";

import { clearPersistedState } from "@/lib/clearPersistedState";

/**
 * Dev-only button for wiping this app's persisted Zustand state while testing.
 *
 * Gated behind `__DEV__`, so it renders nothing in production builds.
 */
export function DevClearStorageButton() {
  if (!__DEV__) return null;

  return (
    <TouchableOpacity
      className="btn-danger"
      activeOpacity={0.85}
      onPress={clearPersistedState}
    >
      <Text className="btn-danger__text">Clear Persisted State (Dev)</Text>
    </TouchableOpacity>
  );
}
