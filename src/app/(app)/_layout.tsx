import { useAuth, useUser } from "@clerk/expo";
import { Ionicons } from "@expo/vector-icons";
import { Redirect, Tabs } from "expo-router";
import { useEffect } from "react";
import { StyleSheet } from "react-native";

import { SplashScreen } from "@/components/SplashScreen";
import { colors } from "@/constants/theme";
import { DraftReportProvider } from "@/context/DraftReportContext";
import { useAnalyticsIdentify } from "@/hooks/useAnalyticsIdentify";
import { useReportCleanup } from "@/hooks/useReportCleanup";
import { useSupabaseSync } from "@/hooks/useSupabaseSync";
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

  // Loads inventory, categories, units, reports and the user directory from
  // Supabase for this session, and syncs this user's own `app_users` row. The
  // hook itself is a no-op unless genuinely signed in — it has to be called
  // above the early returns below to satisfy the rules of hooks.
  useSupabaseSync(isSignedIn === true);

  // Drops reports past the 4-month retention window (AGENTS.md → Report
  // Rules). Admin-only and silent; same placement, above the early returns,
  // for the same rules-of-hooks reason.
  useReportCleanup(isSignedIn === true);

  // Identifies this person to PostHog and captures `user_signed_in`, once per
  // session. Same placement and same rules-of-hooks reason as the two above.
  useAnalyticsIdentify(isSignedIn === true);

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
          name="manage"
          options={{
            title: "Manage",
            href: canManage ? undefined : null,
            tabBarIcon: ({ color, size, focused }) => (
              <Ionicons name={focused ? "apps" : "apps-outline"} color={color} size={size} />
            ),
          }}
        />
        <Tabs.Screen
          name="inventory"
          options={{
            title: "Inventory",
            href: null,
            tabBarIcon: ({ color, size, focused }) => (
              <Ionicons name={focused ? "cube" : "cube-outline"} color={color} size={size} />
            ),
          }}
        />
        <Tabs.Screen
          name="reports"
          options={{
            title: "Reports",
            href: canManage ? null : undefined,
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
          name="tasks"
          options={{
            title: "Tasks",
            tabBarIcon: ({ color, size, focused }) => (
              <Ionicons
                name={focused ? "checkbox" : "checkbox-outline"}
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