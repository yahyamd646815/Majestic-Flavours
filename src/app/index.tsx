import { router } from "expo-router";
import { useEffect } from "react";
import { Image, Text, View } from "react-native";
import { SafeAreaView } from "react-native-safe-area-context";
import Animated, {
  Easing,
  runOnJS,
  useAnimatedStyle,
  useSharedValue,
  withDelay,
  withTiming,
} from "react-native-reanimated";

import { images } from "@/constants/images";
import { colors } from "@/constants/theme";

const DISPLAY_DURATION = 3000;
const FADE_OUT_DURATION = 400;

export default function Splash() {
  const opacity = useSharedValue(1);

  useEffect(() => {
    opacity.value = withDelay(
      DISPLAY_DURATION,
      withTiming(
        0,
        { duration: FADE_OUT_DURATION, easing: Easing.out(Easing.ease) },
        (finished) => {
          if (finished) {
            runOnJS(router.replace)("/sign-in");
          }
        },
      ),
    );
  }, [opacity]);

  const animatedStyle = useAnimatedStyle(() => ({
    opacity: opacity.value,
  }));

  return (
    <SafeAreaView style={{ flex: 1, backgroundColor: colors.cream }}>
      <Animated.View
        style={animatedStyle}
        className="flex-1 items-center justify-center px-8"
      >
        <Image
          source={images.logo}
          className="h-44 w-44"
          resizeMode="contain"
        />

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
      </Animated.View>

      <View className="absolute bottom-10 w-full items-center">
        <Animated.Text
          style={animatedStyle}
          className="font-inter text-xs text-text-secondary"
        >
          Inventory Management System
        </Animated.Text>
      </View>
    </SafeAreaView>
  );
}
