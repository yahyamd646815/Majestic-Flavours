import { useAuth } from "@clerk/expo";
import { Text, TouchableOpacity, View } from "react-native";
import { SafeAreaView } from "react-native-safe-area-context";

import { DevClearStorageButton } from "@/components/DevClearStorageButton";
import { colors } from "@/constants/theme";
import { clearPersistedState } from "@/lib/clearPersistedState";

export default function Reports() {
  const { signOut } = useAuth();

  return (
    <SafeAreaView style={{ flex: 1, backgroundColor: colors.white }}>
      <View className="flex-1 items-center justify-center gap-8 px-6">
        <Text className="font-inter-bold text-2xl text-maroon">Reports</Text>

        <TouchableOpacity
          className="btn-primary"
          activeOpacity={0.85}
          onPress={() => {
            void (async () => {
              await clearPersistedState();
              await signOut();
            })();
          }}
        >
          <Text className="btn-primary__text">Sign Out</Text>
        </TouchableOpacity>

        <DevClearStorageButton />
      </View>
    </SafeAreaView>
  );
}