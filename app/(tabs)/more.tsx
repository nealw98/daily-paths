import React, { useState } from "react";
import { View, Text, StyleSheet, ScrollView, TouchableOpacity, Alert } from "react-native";
import { SafeAreaView } from "react-native-safe-area-context";
import { Ionicons } from "@expo/vector-icons";
import { useTheme } from "../../hooks/useTheme";
import { useAuth } from "../../contexts/AuthContext";
import { fonts } from "../../constants/theme";
import { SettingsModal } from "../../components/SettingsModal";
import { SettingsContent } from "../../components/SettingsContent";
import { PaywallModal } from "../../components/PaywallModal";
import { SignInModal } from "../../components/SignInModal";
import { TealHeader } from "../../components/shared/TealHeader";
import { StackedStones } from "../../components/icons";

type MoreView = "menu" | "account";

export default function MoreTab() {
  const { colors } = useTheme();
  const { user, isAuthenticated, signOut } = useAuth();
  const [view, setView] = useState<MoreView>("menu");
  const [showSettings, setShowSettings] = useState(false);
  const [showPaywall, setShowPaywall] = useState(false);
  const [showSignIn, setShowSignIn] = useState(false);
  const menuItems = [
    {
      id: "settings",
      title: "Settings",
      icon: "settings-outline" as const,
      available: true,
      onPress: () => setShowSettings(true),
    },
    {
      id: "subscription",
      title: "Manage Subscription",
      icon: "card-outline" as const,
      available: true,
      onPress: () => setShowPaywall(true),
    },
    {
      id: "account",
      title: isAuthenticated ? "Account" : "Sign In",
      icon: "person-outline" as const,
      available: true,
      onPress: () => {
        if (isAuthenticated) {
          setView("account");
        } else {
          setShowSignIn(true);
        }
      },
    },
  ];

  return (
    <SafeAreaView
      style={[styles.container, { backgroundColor: colors.pearl }]}
      edges={["top"]}
    >
      <TealHeader
        title="More"
        leftIcon={<StackedStones size={28} color={colors.textOnAccent} />}
      />
      <ScrollView style={styles.content}>
        {/* User info banner if authenticated */}
        {isAuthenticated && user?.email && (
          <View
            style={[
              styles.userBanner,
              { backgroundColor: colors.cloud },
            ]}
          >
            <View style={[styles.userAvatar, { backgroundColor: colors.accent }]}>
              <Ionicons name="person" size={20} color={colors.textOnAccent} />
            </View>
            <View style={styles.userInfo}>
              <Text style={[styles.userName, { color: colors.text }]}>
                {user.email}
              </Text>
              <Text style={[styles.userStatus, { color: colors.textSecondary }]}>
                Signed in
              </Text>
            </View>
          </View>
        )}

        {menuItems.map((item) => (
          <TouchableOpacity
            key={item.id}
            style={[styles.menuItem, { borderBottomColor: colors.border }]}
            onPress={item.onPress}
            disabled={!item.available}
          >
            <View style={styles.menuItemLeft}>
              <Ionicons
                name={item.icon}
                size={24}
                color={item.available ? colors.ocean : colors.textSecondary}
              />
              <Text
                style={[
                  styles.menuItemText,
                  { color: item.available ? colors.text : colors.textSecondary },
                ]}
              >
                {item.title}
              </Text>
            </View>
            {item.available ? (
              <Ionicons name="chevron-forward" size={20} color={colors.seafoam} />
            ) : (
              <Text style={[styles.comingSoon, { color: colors.seafoam }]}>
                Sign in required
              </Text>
            )}
          </TouchableOpacity>
        ))}

        {/* Sign Out button */}
        {isAuthenticated && (
          <TouchableOpacity
            style={[styles.signOutButton, { borderColor: colors.danger + "40" }]}
            onPress={() => {
              Alert.alert("Sign Out", "Are you sure you want to sign out?", [
                { text: "Cancel", style: "cancel" },
                {
                  text: "Sign Out",
                  style: "destructive",
                  onPress: async () => {
                    await signOut();
                  },
                },
              ]);
            }}
          >
            <Ionicons name="log-out-outline" size={20} color={colors.danger} />
            <Text style={[styles.signOutText, { color: colors.danger }]}>
              Sign Out
            </Text>
          </TouchableOpacity>
        )}
      </ScrollView>

      <SettingsModal visible={showSettings} onClose={() => setShowSettings(false)}>
        <SettingsContent onOpenQaLogs={() => setShowSettings(false)} />
      </SettingsModal>

      <PaywallModal visible={showPaywall} onClose={() => setShowPaywall(false)} />

      <SignInModal visible={showSignIn} onClose={() => setShowSignIn(false)} />

    </SafeAreaView>
  );
}

const styles = StyleSheet.create({
  container: {
    flex: 1,
  },
  content: {
    flex: 1,
  },
  userBanner: {
    flexDirection: "row",
    alignItems: "center",
    gap: 14,
    marginHorizontal: 16,
    marginTop: 16,
    padding: 16,
    borderRadius: 14,
    shadowColor: "#000",
    shadowOffset: { width: 0, height: 1 },
    shadowOpacity: 0.04,
    shadowRadius: 3,
    elevation: 1,
  },
  userAvatar: {
    width: 40,
    height: 40,
    borderRadius: 20,
    alignItems: "center",
    justifyContent: "center",
  },
  userInfo: {
    flex: 1,
  },
  userName: {
    fontFamily: fonts.bodyFamilyRegular,
    fontSize: 15,
    fontWeight: "600",
  },
  userStatus: {
    fontFamily: fonts.bodyFamily,
    fontSize: 13,
    marginTop: 2,
  },
  menuItem: {
    flexDirection: "row",
    alignItems: "center",
    justifyContent: "space-between",
    paddingHorizontal: 20,
    paddingVertical: 16,
    borderBottomWidth: 1,
  },
  menuItemLeft: {
    flexDirection: "row",
    alignItems: "center",
    gap: 16,
  },
  menuItemText: {
    fontFamily: "Inter_500Medium",
    fontSize: 16,
    fontWeight: "600",
  },
  comingSoon: {
    fontFamily: fonts.bodyFamily,
    fontSize: 12,
    fontStyle: "italic",
  },
  signOutButton: {
    flexDirection: "row",
    alignItems: "center",
    justifyContent: "center",
    gap: 8,
    marginHorizontal: 20,
    marginTop: 24,
    paddingVertical: 14,
    borderRadius: 12,
    borderWidth: 1,
  },
  signOutText: {
    fontFamily: fonts.bodyFamilyRegular,
    fontSize: 15,
    fontWeight: "500",
  },
});
