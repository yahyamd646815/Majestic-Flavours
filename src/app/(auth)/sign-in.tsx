import { useState } from "react";
import {
  ActivityIndicator,
  Image,
  KeyboardAvoidingView,
  Platform,
  ScrollView,
  StyleSheet,
  Text,
  TextInput,
  TouchableOpacity,
  View,
} from "react-native";
import { SafeAreaView } from "react-native-safe-area-context";

import { images } from "@/constants/images";
import { colors, fonts, radii, spacing } from "@/constants/theme";

export default function SignIn() {
  const [email, setEmail] = useState("");
  const [password, setPassword] = useState("");
  const [isSubmitting, setIsSubmitting] = useState(false);

  function handleSignIn() {
    setIsSubmitting(true);
    setTimeout(() => setIsSubmitting(false), 1200);
  }

  return (
    <SafeAreaView style={{ flex: 1, backgroundColor: colors.white }}>
      <KeyboardAvoidingView
        style={{ flex: 1 }}
        behavior={Platform.OS === "ios" ? "padding" : undefined}
      >
        <ScrollView
          contentContainerStyle={styles.scrollContent}
          keyboardShouldPersistTaps="handled"
        >
          <View className="items-center">
            <Image
              source={images.logo}
              className="h-28 w-24"
              resizeMode="contain"
            />
            <Text className="mt-4 font-inter-bold text-2xl text-maroon">
              Majestic Flavors
            </Text>
            <Text className="mt-1 font-inter text-sm text-text-secondary">
              Inventory Management
            </Text>
          </View>

          <View className="mt-10 gap-4">
            <TextInput
              value={email}
              onChangeText={setEmail}
              placeholder="Email"
              placeholderTextColor={colors.textSecondary}
              keyboardType="email-address"
              autoCapitalize="none"
              autoCorrect={false}
              style={styles.input}
            />
            <TextInput
              value={password}
              onChangeText={setPassword}
              placeholder="Password"
              placeholderTextColor={colors.textSecondary}
              secureTextEntry
              autoCapitalize="none"
              style={styles.input}
            />
          </View>

          <TouchableOpacity
            className="btn-primary mt-6"
            activeOpacity={0.85}
            onPress={handleSignIn}
            disabled={isSubmitting}
          >
            {isSubmitting ? (
              <ActivityIndicator color={colors.textPrimary} />
            ) : (
              <Text className="btn-primary__text">Sign In</Text>
            )}
          </TouchableOpacity>

          <Text className="mt-4 text-center font-inter text-sm text-text-secondary">
            Forgot password?
          </Text>
        </ScrollView>
      </KeyboardAvoidingView>
    </SafeAreaView>
  );
}

const styles = StyleSheet.create({
  scrollContent: {
    flexGrow: 1,
    justifyContent: "center",
    paddingHorizontal: spacing.lg,
  },
  input: {
    height: 52,
    borderWidth: 1,
    borderColor: colors.border,
    borderRadius: radii.md,
    backgroundColor: colors.white,
    paddingHorizontal: spacing.md,
    fontFamily: fonts.regular,
    fontSize: 16,
    color: colors.textPrimary,
  },
});
