import React, { useState } from "react";
import { View, Text, StyleSheet, ScrollView, TouchableOpacity } from "react-native";
import { SafeAreaView } from "react-native-safe-area-context";
import { Ionicons } from "@expo/vector-icons";
import { useTheme } from "../../hooks/useTheme";
import { useAuth } from "../../contexts/AuthContext";
import { fonts } from "../../constants/theme";
import { SettingsModal } from "../../components/SettingsModal";
import { SettingsContent } from "../../components/SettingsContent";
import { PaywallModal } from "../../components/PaywallModal";
import { SignInModal } from "../../components/SignInModal";
import { ExportOptionsModal } from "../../components/ExportOptionsModal";

type MoreView = "menu" | "account";

export default function MoreTab() {
  const { colors } = useTheme();
  const { user, isAuthenticated, signOut } = useAuth();
  const [view, setView] = useState<MoreView>("menu");
  const [showSettings, setShowSettings] = useState(false);
  const [showPaywall, setShowPaywall] = useState(false);
  const [showSignIn, setShowSignIn] = useState(false);
  const [showExport, setShowExport] = useState(false);

  const menuItems = [
    {
      id: "export",
      title: "Export Journal",
      icon: "download-outline" as const,
      available: isAuthenticated,
      onPress: () => setShowExport(true),
    },
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
    <SafeAreaView style={[styles.container, { backgroundColor: colors.background }]} edges={["top"]}>
      <View style={[styles.header, { backgroundColor: colors.background, borderBottomColor: colors.border }]}>
        <Text style={[styles.headerTitle, { color: colors.text }]}>More</Text>
      </View>
      <ScrollView style={styles.content}>
        {/* User info banner if authenticated */}
        {isAuthenticated && user?.email && (
          <View style={[styles.userBanner, { backgroundColor: colors.cardBackground, borderColor: colors.border }]}>
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
                color={item.available ? colors.accent : colors.textSecondary}
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
              <Ionicons name="chevron-forward" size={20} color={colors.textSecondary} />
            ) : (
              <Text style={[styles.comingSoon, { color: colors.textSecondary }]}>
                Sign in required
              </Text>
            )}
          </TouchableOpacity>
        ))}

        {/* Sign Out button */}
        {isAuthenticated && (
          <TouchableOpacity
            style={[styles.signOutButton, { borderColor: colors.danger + "40" }]}
            onPress={async () => {
              try {
                await signOut();
              } catch {
                // handled by context
              }
            }}
          >
            <Ionicons name="log-out-outline" size={20} color={colors.danger} />
            <Text style={[styles.signOutText, { color: colors.danger }]}>Sign Out</Text>
          </TouchableOpacity>
        )}
      </ScrollView>

      <SettingsModal visible={showSettings} onClose={() => setShowSettings(false)}>
        <SettingsContent onOpenQaLogs={() => setShowSettings(false)} />
      </SettingsModal>

      <PaywallModal
        visible={showPaywall}
        onClose={() => setShowPaywall(false)}
      />

      <SignInModal
        visible={showSignIn}
        onClose={() => setShowSignIn(false)}
      />

      <ExportOptionsModal
        visible={showExport}
        onClose={() => setShowExport(false)}
      />
    </SafeAreaView>
  );
}

const styles = StyleSheet.create({
  container: {
    flex: 1,
  },
  header: {
    paddingHorizontal: 20,
    paddingVertical: 16,
    borderBottomWidth: 1,
  },
  headerTitle: {
    fontFamily: fonts.headerFamily,
    fontSize: 28,
    fontWeight: "700",
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
    borderWidth: 1,
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
    fontFamily: fonts.bodyFamilyRegular,
    fontSize: 16,
    fontWeight: "500",
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
