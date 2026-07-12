import { Image, Text, TouchableOpacity, View } from "react-native";
import { SafeAreaView } from "react-native-safe-area-context";

import { images } from "@/constants/images";

export default function Index() {
  return (
    <SafeAreaView style={{ flex: 1, backgroundColor: "#FFFFFF" }}>
      <View className="section-header flex-row items-center gap-3">
        <Image source={images.logo} className="h-10 w-10 rounded-full" />
        <View>
          <Text className="font-inter-bold text-lg text-white">
            Majestic Flavors
          </Text>
          <Text className="font-inter text-xs text-gold">
            Inventory Management
          </Text>
        </View>
      </View>

      <View className="gap-4 p-4">
        <View className="card gap-3">
          <View className="flex-row items-center justify-between">
            <Text className="font-inter-semibold text-base text-text-primary">
              Basmati Rice
            </Text>
            <View className="badge-gold">
              <Text className="badge-gold__text">Grains</Text>
            </View>
          </View>

          <Text className="font-inter text-sm text-text-secondary">
            Assigned staff: Yumna, Yahya
          </Text>

          <View className="flex-row gap-2">
            <View className="badge-maroon">
              <Text className="badge-maroon__text">Manager</Text>
            </View>
            <View className="status-badge status-badge--in-stock">
              <Text className="status-badge__text--in-stock">In stock</Text>
            </View>
            <View className="status-badge status-badge--low-stock">
              <Text className="status-badge__text--low-stock">Low stock</Text>
            </View>
            <View className="status-badge status-badge--out-of-stock">
              <Text className="status-badge__text--out-of-stock">
                Out of stock
              </Text>
            </View>
          </View>
        </View>

        <TouchableOpacity className="btn-primary" activeOpacity={0.85}>
          <Text className="btn-primary__text">Add Inventory Item</Text>
        </TouchableOpacity>

        <TouchableOpacity className="btn-danger" activeOpacity={0.85}>
          <Text className="btn-danger__text">Delete Item</Text>
        </TouchableOpacity>
      </View>
    </SafeAreaView>
  );
}
