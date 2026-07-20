import { useAuth, useUser } from "@clerk/expo";
import { Redirect, Stack } from "expo-router";

import { SplashScreen } from "@/components/SplashScreen";
import { parseRole } from "@/types/role";

export default function AuthLayout() {
  const { isLoaded, isSignedIn } = useAuth();
  const { user } = useUser();

  const role = isSignedIn ? parseRole(user?.publicMetadata?.role) : undefined;
  
  if (!isLoaded) return <SplashScreen />;

  if (isSignedIn && role) {
    return <Redirect href={role === "employee" ? "/reports" : "/"} />;
  }

  return <Stack screenOptions={{ headerShown: false }} />;
}