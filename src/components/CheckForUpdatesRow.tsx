import * as Updates from "expo-updates";
import { useEffect, useState } from "react";
import { Alert, Text, TouchableOpacity, View } from "react-native";

export function CheckForUpdatesRow() {
  const { isUpdatePending } = Updates.useUpdates();
  const [isChecking, setIsChecking] = useState(false);

  useEffect(() => {
    if (isUpdatePending) {
      void Updates.reloadAsync();
    }
  }, [isUpdatePending]);

  async function handleCheck() {
    setIsChecking(true);
    try {
      const result = await Updates.checkForUpdateAsync();
      if (result.isAvailable) {
        await Updates.fetchUpdateAsync();
        // reloadAsync() fires automatically above once isUpdatePending flips true.
      } else {
        Alert.alert("Up to date", "You already have the latest version.");
      }
    } catch {
      Alert.alert("Couldn't check for updates", "Check your connection and try again.");
    } finally {
      setIsChecking(false);
    }
  }

  return (
    <View>
      <View className="section-header rounded-t-xl">
        <Text className="section-header__title">App Updates</Text>
      </View>
      <View className="gap-3 rounded-b-xl bg-cream p-3">
        <Text className="card font-inter text-sm text-text-primary">
          Get the latest version of the app without a new install.
        </Text>
        <TouchableOpacity
          className={isChecking ? "btn-primary opacity-50" : "btn-primary"}
          activeOpacity={0.85}
          disabled={isChecking}
          onPress={() => void handleCheck()}
          accessibilityRole="button"
          accessibilityLabel="Check for updates"
        >
          <Text className="btn-primary__text">
            {isChecking ? "Checking..." : "Check for Updates"}
          </Text>
        </TouchableOpacity>
      </View>
    </View>
  );
}
