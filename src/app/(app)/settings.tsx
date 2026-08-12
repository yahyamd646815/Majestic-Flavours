import { useAuth, useUser } from "@clerk/expo";
import { useState } from "react";
import { Alert, ScrollView, StyleSheet, Text, TouchableOpacity, View } from "react-native";
import { SafeAreaView } from "react-native-safe-area-context";

import { CheckForUpdatesRow } from "@/components/CheckForUpdatesRow";
import { ErrorState } from "@/components/ErrorState";
import { LoadingState } from "@/components/LoadingState";
import { SettingsListSection } from "@/components/SettingsListSection";
import { UnsavedChangesWarningModal } from "@/components/UnsavedChangesWarningModal";
import { colors } from "@/constants/theme";
import { useDraftReport } from "@/context/DraftReportContext";
import { useSupabaseClient } from "@/lib/supabase";
import { useInventoryStore } from "@/store/inventoryStore";
import { useUnitsStore } from "@/store/unitsStore";
import { parseRole } from "@/types/role";

const styles = StyleSheet.create({
  scrollContent: {
    paddingBottom: 32,
  },
});

export default function Settings() {
  const { signOut } = useAuth();
  const { user } = useUser();
  const role = parseRole(user?.publicMetadata?.role);

  const supabase = useSupabaseClient();

  const units = useUnitsStore((state) => state.units);
  const addUnit = useUnitsStore((state) => state.addUnit);
  const deleteUnit = useUnitsStore((state) => state.deleteUnit);
  const isUnitInUse = useUnitsStore((state) => state.isUnitInUse);
  const unitsLoading = useUnitsStore((state) => state.isLoading);
  const unitsError = useUnitsStore((state) => state.error);
  const fetchUnits = useUnitsStore((state) => state.fetchAll);

  const categories = useInventoryStore((state) => state.categories);
  const addCategory = useInventoryStore((state) => state.addCategory);
  const deleteCategory = useInventoryStore((state) => state.deleteCategory);
  const isCategoryInUse = useInventoryStore((state) => state.isCategoryInUse);
  const inventoryLoading = useInventoryStore((state) => state.isLoading);
  const inventoryError = useInventoryStore((state) => state.error);
  const fetchInventory = useInventoryStore((state) => state.fetchAll);

  const { hasUnsavedChanges, clearDrafts } = useDraftReport();
  const [showUnsavedWarning, setShowUnsavedWarning] = useState(false);

  async function performSignOut() {
    try {
      await signOut();
    } catch {
      Alert.alert("Sign out failed", "Please check your connection and try again.");
      return;
    }
    // Cleared only after a successful sign-out, so the next person to sign in
    // on this device never inherits leftover draft state.
    clearDrafts();
  }

  function handleSignOutPress() {
    if (hasUnsavedChanges) {
      setShowUnsavedWarning(true);
      return;
    }
    void performSignOut();
  }

  function handleConfirmSignOutAnyway() {
    setShowUnsavedWarning(false);
    void performSignOut();
  }

  async function performDeleteUnit(id: string) {
    const succeeded = await deleteUnit(supabase, id);
    if (!succeeded) {
      Alert.alert(
        "Could not delete unit",
        "The unit was not deleted. Check your connection and try again.",
      );
    }
  }

  function handleDeleteUnit(id: string) {
    if (isUnitInUse(id)) {
      Alert.alert("Unit in use", "Some items are still using this unit. Remove them first.");
      return;
    }
    Alert.alert("Delete this unit?", undefined, [
      { text: "Cancel", style: "cancel" },
      { text: "Delete", style: "destructive", onPress: () => void performDeleteUnit(id) },
    ]);
  }

  async function performDeleteCategory(id: string) {
    const succeeded = await deleteCategory(supabase, id);
    if (!succeeded) {
      Alert.alert(
        "Could not delete category",
        "The category was not deleted. Check your connection and try again.",
      );
    }
  }

  function handleDeleteCategory(id: string) {
    if (isCategoryInUse(id)) {
      Alert.alert(
        "Category in use",
        "Some items are still assigned to this category. Remove them first.",
      );
      return;
    }
    Alert.alert("Delete this category?", undefined, [
      { text: "Cancel", style: "cancel" },
      { text: "Delete", style: "destructive", onPress: () => void performDeleteCategory(id) },
    ]);
  }

  const categoryItems = categories.map((category) => ({ id: category.id, label: category.name }));

  // Scoped to the list sections rather than the whole screen on purpose: Sign
  // Out lives here too, and must stay reachable even when Supabase is
  // unreachable. Employees see neither section, so they never hit either state.
  const unitsSection =
    unitsError !== null ? (
      <ErrorState message={unitsError} onRetry={() => void fetchUnits(supabase)} />
    ) : unitsLoading && units.length === 0 ? (
      <LoadingState message="Loading units..." />
    ) : (
      <SettingsListSection
        title="Units"
        items={units}
        onAdd={(label) => addUnit(supabase, label)}
        onDelete={handleDeleteUnit}
      />
    );

  function renderCategoriesSection(canDelete: boolean) {
    if (inventoryError !== null) {
      return (
        <ErrorState message={inventoryError} onRetry={() => void fetchInventory(supabase)} />
      );
    }
    if (inventoryLoading && categories.length === 0) {
      return <LoadingState message="Loading categories..." />;
    }
    return (
      <SettingsListSection
        title="Categories"
        items={categoryItems}
        onAdd={(name) => addCategory(supabase, name)}
        onDelete={handleDeleteCategory}
        canDelete={canDelete}
      />
    );
  }

  return (
    <SafeAreaView style={{ flex: 1, backgroundColor: colors.white }}>
      <ScrollView contentContainerStyle={styles.scrollContent}>
        <View className="gap-6 px-4 pt-4">
          <Text className="font-inter-bold text-2xl text-maroon">Settings</Text>

          {role === "admin" ? (
            <>
              {unitsSection}

              {renderCategoriesSection(true)}

              <View>
                <View className="section-header rounded-t-xl">
                  <Text className="section-header__title">Report Retention</Text>
                </View>
                <View className="rounded-b-xl bg-cream p-3">
                  <Text className="card font-inter text-sm text-text-primary">
                    Daily reports are automatically deleted after 4 months.
                  </Text>
                </View>
              </View>
            </>
          ) : null}

          {role === "manager" ? renderCategoriesSection(false) : null}

          {role === "admin" || role === "manager" ? <CheckForUpdatesRow /> : null}

          <TouchableOpacity
            className="btn-primary"
            activeOpacity={0.85}
            onPress={handleSignOutPress}
          >
            <Text className="btn-primary__text">Sign Out</Text>
          </TouchableOpacity>
        </View>
      </ScrollView>

      <UnsavedChangesWarningModal
        visible={showUnsavedWarning}
        onCancel={() => setShowUnsavedWarning(false)}
        onSignOutAnyway={handleConfirmSignOutAnyway}
      />
    </SafeAreaView>
  );
}
