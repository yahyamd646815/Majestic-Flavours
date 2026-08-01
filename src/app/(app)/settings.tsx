import { useAuth, useUser } from "@clerk/expo";
import { useState } from "react";
import { Alert, ScrollView, StyleSheet, Text, TouchableOpacity, View } from "react-native";
import { SafeAreaView } from "react-native-safe-area-context";

import { DevClearStorageButton } from "@/components/DevClearStorageButton";
import { SettingsListSection } from "@/components/SettingsListSection";
import { UnsavedChangesWarningModal } from "@/components/UnsavedChangesWarningModal";
import { colors } from "@/constants/theme";
import { useDraftReport } from "@/context/DraftReportContext";
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

  const units = useUnitsStore((state) => state.units);
  const addUnit = useUnitsStore((state) => state.addUnit);
  const deleteUnit = useUnitsStore((state) => state.deleteUnit);
  const isUnitInUse = useUnitsStore((state) => state.isUnitInUse);

  const categories = useInventoryStore((state) => state.categories);
  const addCategory = useInventoryStore((state) => state.addCategory);
  const deleteCategory = useInventoryStore((state) => state.deleteCategory);
  const isCategoryInUse = useInventoryStore((state) => state.isCategoryInUse);

  const { hasUnsavedChanges, clearDrafts } = useDraftReport();
  const [showUnsavedWarning, setShowUnsavedWarning] = useState(false);

  function handleSignOutPress() {
    if (hasUnsavedChanges) {
      setShowUnsavedWarning(true);
      return;
    }
    // Always cleared on the way out, so the next person to sign in on this
    // device never inherits leftover draft state.
    clearDrafts();
    void signOut();
  }

  function handleConfirmSignOutAnyway() {
    setShowUnsavedWarning(false);
    clearDrafts();
    void signOut();
  }

  function handleDeleteUnit(id: string) {
    if (isUnitInUse(id)) {
      Alert.alert("Unit in use", "Some items are still using this unit. Remove them first.");
      return;
    }
    Alert.alert("Delete this unit?", undefined, [
      { text: "Cancel", style: "cancel" },
      { text: "Delete", style: "destructive", onPress: () => deleteUnit(id) },
    ]);
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
      { text: "Delete", style: "destructive", onPress: () => deleteCategory(id) },
    ]);
  }

  const categoryItems = categories.map((category) => ({ id: category.id, label: category.name }));

  return (
    <SafeAreaView style={{ flex: 1, backgroundColor: colors.white }}>
      <ScrollView contentContainerStyle={styles.scrollContent}>
        <View className="gap-6 px-4 pt-4">
          <Text className="font-inter-bold text-2xl text-maroon">Settings</Text>

          {role === "admin" ? (
            <>
              <SettingsListSection
                title="Units"
                items={units}
                onAdd={addUnit}
                onDelete={handleDeleteUnit}
              />

              <SettingsListSection
                title="Categories"
                items={categoryItems}
                onAdd={addCategory}
                onDelete={handleDeleteCategory}
              />

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

          {role === "manager" ? (
            <SettingsListSection
              title="Categories"
              items={categoryItems}
              onAdd={addCategory}
              onDelete={handleDeleteCategory}
              canDelete={false}
            />
          ) : null}

          <View className="gap-3">
            <TouchableOpacity
              className="btn-primary"
              activeOpacity={0.85}
              onPress={handleSignOutPress}
            >
              <Text className="btn-primary__text">Sign Out</Text>
            </TouchableOpacity>

            {role === "admin" ? <DevClearStorageButton /> : null}
          </View>
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
