import { useAuth, useSignIn } from "@clerk/expo";
import { router, type Href } from "expo-router";
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
import { parseRole } from "@/types/role";

const NO_ROLE_MESSAGE =
  "Your account has not been assigned a role. Please contact your administrator.";

// Lives outside the component on purpose. `(auth)/_layout.tsx` can briefly
// unmount this screen during a Clerk session transition (isLoaded flickers
// false around sign-out), which wipes normal useState. A module-level
// variable survives that remount so the message still reaches the screen
// once it comes back.
let pendingAuthError: string | null = null;

export default function SignIn() {
  const { signIn, errors, fetchStatus } = useSignIn();
  const { signOut } = useAuth();

  const [email, setEmail] = useState("");
  const [password, setPassword] = useState("");
  const [formError, setFormError] = useState<string | null>(() => {
    if (pendingAuthError) {
      const msg = pendingAuthError;
      pendingAuthError = null;
      return msg;
    }
    return null;
  });

  const isSubmitting = fetchStatus === "fetching";

  const clerkError =
    errors.fields.identifier?.message ??
    errors.fields.password?.message ??
    errors.global?.[0]?.message ??
    null;
  const displayError = formError ?? clerkError;

  async function handleSignIn() {
    setFormError(null);

    const { error } = await signIn.password({
      emailAddress: email.trim(),
      password,
    });
    if (error) return;

    if (signIn.status === "complete") {
      const { error: finalizeError } = await signIn.finalize({
        navigate: async ({ session, decorateUrl }) => {
          try {
            if (session?.currentTask) {
              pendingAuthError =
                "Additional account setup is required. Please contact your administrator.";
              await signOut();
              return;
            }
            const role = parseRole(session?.user?.publicMetadata?.role);
            if (!role) {
              pendingAuthError = NO_ROLE_MESSAGE;
              await signOut();
              return;
            }
            const url = decorateUrl(role === "employee" ? "/reports" : "/");
            if (Platform.OS === "web" && url.startsWith("http")) {
              window.location.assign(url);
              return;
            }
            router.replace(url as Href);
          } catch {
            pendingAuthError = "Something went wrong. Please try again.";
          }
        },
      });
      if (finalizeError) setFormError("Something went wrong. Please try again.");
      return;
    }

    if (signIn.status === "needs_second_factor" || signIn.status === "needs_client_trust") {
      setFormError("Additional verification is required. Please contact your administrator.");
    }
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

          {displayError ? (
            <Text className="mt-3 text-center font-inter text-sm text-out-of-stock">
              {displayError}
            </Text>
          ) : null}

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
            Forgot your password? Contact your administrator.
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