import { Text, TouchableOpacity } from "react-native";

import { clearPersistedState } from "@/lib/clearPersistedState";

export function DevClearStorageButton() {
  if (!__DEV__) return null;

  return (
    <TouchableOpacity
      className="btn-danger"
      activeOpacity={0.85}
      onPress={() => {
        void clearPersistedState();
      }}
    >
      <Text className="btn-danger__text">Clear Persisted State (Dev)</Text>
    </TouchableOpacity>
  );
}