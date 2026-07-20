import { Image, Text, View } from "react-native";
import { SafeAreaView } from "react-native-safe-area-context";

import { images } from "@/constants/images";
import { colors } from "@/constants/theme";

/**
 * Branded loading screen (MF crown logo + Arabic branding).
 *
 * Rendered by the auth guards while Clerk resolves the session from the token
 * cache. It has no timer and does not navigate — routing is driven entirely by
 * the guards once `isLoaded` becomes true.
 */
export function SplashScreen() {
  return (
    <SafeAreaView style={{ flex: 1, backgroundColor: colors.cream }}>
      <View className="flex-1 items-center justify-center px-8">
        <Image source={images.logo} className="h-44 w-44" resizeMode="contain" />

        <Text className="mt-6 text-center font-inter-bold text-3xl text-maroon">
          Majestic Flavors
        </Text>
        <Text
          className="mt-1 text-center font-inter-semibold text-lg text-maroon"
          style={{ writingDirection: "rtl" }}
        >
          ماجستيك فليفرز
        </Text>

        <Text className="mt-4 text-center font-inter-semibold text-base text-gold">
          Authentic Pakistani Taste
        </Text>

        <View className="mt-8 h-px w-16 bg-border" />
      </View>

      <View className="absolute bottom-10 w-full items-center">
        <Text className="font-inter text-xs text-text-secondary">
          Inventory Management System
        </Text>
      </View>
    </SafeAreaView>
  );
}
