import { useAuth, useUser } from "@clerk/expo";
import { Ionicons } from "@expo/vector-icons";
import { Redirect, Tabs } from "expo-router";
import { useEffect } from "react";
import { StyleSheet } from "react-native";

import { SplashScreen } from "@/components/SplashScreen";
import { colors } from "@/constants/theme";
import { DraftReportProvider } from "@/context/DraftReportContext";
import { useInventorySync } from "@/hooks/useInventorySync";
import { parseRole } from "@/types/role";

const styles = StyleSheet.create({
  tabBar: {
    backgroundColor: colors.white,
    borderTopWidth: 1,
    borderTopColor: colors.border,
  },
});

export default function AppLayout() {
  const { isLoaded, isSignedIn, signOut } = useAuth();
  const { user } = useUser();
  const role = isSignedIn ? parseRole(user?.publicMetadata?.role) : undefined;
  const hasNoRole = isSignedIn && !role;

  useEffect(() => {
    if (hasNoRole) void signOut();
  }, [hasNoRole, signOut]);

  // Loads inventory, categories and units from Supabase for this session. The
  // hook itself is a no-op unless genuinely signed in — it has to be called
  // above the early returns below to satisfy the rules of hooks.
  useInventorySync(isSignedIn === true);

  if (!isLoaded) return <SplashScreen />;
  if (!isSignedIn) return <Redirect href="/sign-in" />;
  if (hasNoRole) return <SplashScreen />;

  const canManage = role === "admin" || role === "manager";
  const isAdmin = role === "admin";

  return (
    // Above the tabs: Reports writes report drafts, Settings reads them to
    // warn before signing out with unsubmitted changes.
    <DraftReportProvider>
      <Tabs
        screenOptions={{
          headerShown: false,
          tabBarActiveTintColor: colors.gold,
          tabBarInactiveTintColor: colors.textSecondary,
          tabBarStyle: styles.tabBar,
        }}
      >
        <Tabs.Screen
          name="index"
          options={{
            title: "Dashboard",
            href: canManage ? undefined : null,
            tabBarIcon: ({ color, size, focused }) => (
              <Ionicons name={focused ? "home" : "home-outline"} color={color} size={size} />
            ),
          }}
        />
        <Tabs.Screen
          name="inventory"
          options={{
            title: "Inventory",
            href: canManage ? undefined : null,
            tabBarIcon: ({ color, size, focused }) => (
              <Ionicons name={focused ? "cube" : "cube-outline"} color={color} size={size} />
            ),
          }}
        />
        <Tabs.Screen
          name="reports"
          options={{
            title: "Reports",
            tabBarIcon: ({ color, size, focused }) => (
              <Ionicons
                name={focused ? "document-text" : "document-text-outline"}
                color={color}
                size={size}
              />
            ),
          }}
        />
        <Tabs.Screen
          name="users"
          options={{
            title: "Users",
            href: isAdmin ? undefined : null,
            tabBarIcon: ({ color, size, focused }) => (
              <Ionicons name={focused ? "people" : "people-outline"} color={color} size={size} />
            ),
          }}
        />
        <Tabs.Screen
          name="settings"
          options={{
            title: "Settings",
            tabBarIcon: ({ color, size, focused }) => (
              <Ionicons
                name={focused ? "settings" : "settings-outline"}
                color={color}
                size={size}
              />
            ),
          }}
        />
      </Tabs>
    </DraftReportProvider>
  );
}