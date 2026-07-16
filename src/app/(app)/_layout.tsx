import { useAuth } from "@clerk/expo";
import { Redirect, Stack } from "expo-router";

import { SplashScreen } from "@/components/SplashScreen";

/**
 * Guard for the protected app area (Dashboard, Reports, and everything built
 * later). While Clerk restores the session we show the branded splash; signed
 * out users are redirected to the Sign In screen.
 */
export default function AppLayout() {
  const { isLoaded, isSignedIn } = useAuth();

  if (!isLoaded) return <SplashScreen />;
  if (!isSignedIn) return <Redirect href="/sign-in" />;

  return <Stack screenOptions={{ headerShown: false }} />;
}
