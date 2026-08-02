import { Alert, Text, TouchableOpacity } from "react-native";

import { clearPersistedState } from "@/lib/clearPersistedState";

export function DevClearStorageButton() {
  if (!__DEV__) return null;

  function handlePress() {
    Alert.alert(
      "Clear local reports?",
      "This wipes every stored report for every test user on this device. Inventory, categories and units live in Supabase now and are not affected. This cannot be undone.",
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
      <Text className="btn-danger__text">Clear Local Reports (Dev)</Text>
    </TouchableOpacity>
  );
}