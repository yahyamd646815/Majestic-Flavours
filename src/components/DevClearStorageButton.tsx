import { Alert, Text, TouchableOpacity } from "react-native";

import { clearPersistedState } from "@/lib/clearPersistedState";

export function DevClearStorageButton() {
  if (!__DEV__) return null;

  function handlePress() {
    Alert.alert(
      "Clear all local data?",
      "This wipes every stored report, inventory edit, category and unit for every test user on this device. This cannot be undone.",
      [
        { text: "Cancel", style: "cancel" },
        {
          text: "Clear",
          style: "destructive",
          onPress: () => void clearPersistedState(),
        },
      ],
    );
  }

  return (
    <TouchableOpacity className="btn-danger" activeOpacity={0.85} onPress={handlePress}>
      <Text className="btn-danger__text">Clear Persisted State (Dev)</Text>
    </TouchableOpacity>
  );
}