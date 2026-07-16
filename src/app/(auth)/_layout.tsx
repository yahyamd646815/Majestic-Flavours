import { useAuth, useUser } from "@clerk/expo";
import { Redirect, Stack } from "expo-router";

import { SplashScreen } from "@/components/SplashScreen";
import { parseRole } from "@/types/role";

/**
 * Guard for the public auth screens. A signed-in user must never see the Sign
 * In screen, so we redirect them to their home route by role. While Clerk
 * restores the session we show the branded splash.
 */
export default function AuthLayout() {
  const { isLoaded, isSignedIn } = useAuth();
  const { user } = useUser();

  if (!isLoaded) return <SplashScreen />;

  if (isSignedIn) {
    const role = parseRole(user?.publicMetadata?.role);
    return <Redirect href={role === "employee" ? "/reports" : "/"} />;
  }

  return <Stack screenOptions={{ headerShown: false }} />;
}
