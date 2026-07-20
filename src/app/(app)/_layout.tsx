import { useAuth, useUser } from "@clerk/expo";
import { Redirect, Stack } from "expo-router";
import { useEffect } from "react";

import { SplashScreen } from "@/components/SplashScreen";
import { parseRole } from "@/types/role";

export default function AppLayout() {
  const { isLoaded, isSignedIn, signOut } = useAuth();
  const { user } = useUser();
  const role = isSignedIn ? parseRole(user?.publicMetadata?.role) : undefined;
  const hasNoRole = isSignedIn && !role;
  
  useEffect(() => {
    if (hasNoRole) void signOut();
  }, [hasNoRole, signOut]);

  if (!isLoaded) return <SplashScreen />;
  if (!isSignedIn) return <Redirect href="/sign-in" />;
  if (hasNoRole) return <SplashScreen />;

  return <Stack screenOptions={{ headerShown: false }} />;
}