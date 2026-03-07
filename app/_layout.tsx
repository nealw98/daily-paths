import React, { useEffect, useState } from "react";
import { Stack, useRouter } from "expo-router";
import { useFonts } from "expo-font";
import {
  CormorantGaramond_600SemiBold,
  CormorantGaramond_600SemiBold_Italic,
  CormorantGaramond_700Bold_Italic,
} from "@expo-google-fonts/cormorant-garamond";
import {
  Inter_300Light,
  Inter_400Regular,
  Inter_600SemiBold,
} from "@expo-google-fonts/inter";
import {
  Lora_400Regular,
  Lora_400Regular_Italic,
  Lora_700Bold,
} from "@expo-google-fonts/lora";
import { fallbackColors } from "../constants/theme";
import { SettingsProvider } from "../hooks/useSettings";
import { AuthProvider, useAuth } from "../contexts/AuthContext";
import { SubscriptionProvider } from "../contexts/SubscriptionContext";
import { usePostAuthMigration } from "../hooks/usePostAuthMigration";
import { View, ActivityIndicator, StyleSheet, Text, TouchableOpacity, Platform } from "react-native";
import * as Notifications from "expo-notifications";
import * as Updates from "expo-updates";
import { installGlobalErrorHandler } from "../utils/errorLogger";
import { initMixpanel } from "../lib/mixpanel";
import { qaLog } from "../utils/qaLog";

console.log("[STARTUP] _layout.tsx module loading...");
console.log("[STARTUP] Platform:", Platform.OS, Platform.Version);

let notificationHandlerSet = false;
try {
  console.log("[STARTUP] Setting notification handler...");
  Notifications.setNotificationHandler({
    handleNotification: async () => ({
      shouldShowAlert: true,
      shouldShowBanner: true,
      shouldShowList: true,
      shouldPlaySound: false,
      shouldSetBadge: false,
    }),
  });
  notificationHandlerSet = true;
  console.log("[STARTUP] Notification handler set successfully");
} catch (err) {
  console.error("[STARTUP] ERROR setting notification handler:", err);
}

export default function RootLayout() {
  console.log("[STARTUP] RootLayout function called");
  
  // Use fallback palette for loading screen (before SettingsProvider is available)
  const colors = fallbackColors;
  
  let router;
  try {
    console.log("[STARTUP] Getting router...");
    router = useRouter();
    console.log("[STARTUP] Router obtained successfully");
  } catch (err) {
    console.error("[STARTUP] ERROR getting router:", err);
    throw err;
  }

  try {
    console.log("[STARTUP] Installing global error handler...");
    installGlobalErrorHandler();
    console.log("[STARTUP] Global error handler installed");
  } catch (err) {
    console.error("[STARTUP] ERROR installing error handler:", err);
  }

  console.log("[STARTUP] Initializing state...");
  const [updateReady, setUpdateReady] = useState(false);
  const [restarting, setRestarting] = useState(false);
  const [checkingUpdate, setCheckingUpdate] = useState(false);
  console.log("[STARTUP] State initialized");

  console.log("[STARTUP] Loading fonts...");
  let fontsLoaded = false;
  try {
    [fontsLoaded] = useFonts({
      CormorantGaramond_600SemiBold,
      CormorantGaramond_600SemiBold_Italic,
      CormorantGaramond_700Bold_Italic,
      Inter_300Light,
      Inter_400Regular,
      Inter_600SemiBold,
      Lora_400Regular,
      Lora_400Regular_Italic,
      Lora_700Bold,
    });
    console.log("[STARTUP] useFonts called, fontsLoaded:", fontsLoaded);
  } catch (err) {
    console.error("[STARTUP] ERROR loading fonts:", err);
  }

  // Initialize analytics once fonts are loaded.
  // RevenueCat and trial timer are now managed by SubscriptionContext.
  useEffect(() => {
    if (fontsLoaded) {
      initMixpanel();
    }
  }, [fontsLoaded]);

  // Check for OTA updates once on startup; if downloaded, prompt to restart.
  useEffect(() => {
    qaLog("Updates", "Check starting", { __DEV__ });
    if (__DEV__) return; // skip in dev client
    let cancelled = false;
    (async () => {
      try {
        qaLog("Updates", "Checking for updates...");
        const result = await Updates.checkForUpdateAsync();
        qaLog("Updates", "Check result", { isAvailable: result.isAvailable });
        if (result.isAvailable) {
          qaLog("Updates", "Downloading update...");
          await Updates.fetchUpdateAsync();
          qaLog("Updates", "Download complete, ready to restart");
          if (!cancelled) {
            setUpdateReady(true);
          }
        } else {
          qaLog("Updates", "App is up to date");
        }
      } catch (err) {
        qaLog("Updates", "Check/fetch failed", { error: String(err) });
      }
    })();
    return () => {
      cancelled = true;
    };
  }, []);

  // When a notification is tapped, navigate to the reading screen for today.
  useEffect(() => {
    console.log("[STARTUP] Notification listener useEffect running");
    try {
      const sub = Notifications.addNotificationResponseReceivedListener(() => {
        console.log("[STARTUP] Notification response received");
        router.push(`/?jump=today&ts=${Date.now()}`);
      });
      console.log("[STARTUP] Notification listener added successfully");
      return () => sub.remove();
    } catch (err) {
      console.error("[STARTUP] ERROR adding notification listener:", err);
    }
  }, [router]);

  const handleRestart = async () => {
    try {
      qaLog("Updates", "Restarting app to apply update");
      setRestarting(true);
      await Updates.reloadAsync();
    } catch (err) {
      setRestarting(false);
      qaLog("Updates", "Reload failed", { error: String(err) });
    }
  };

  // Manual updater for QA screen: runs a check + fetch + reload and logs to QA.
  const checkAndApplyUpdate = async () => {
    if (__DEV__) return;
    if (checkingUpdate || restarting) return;
    setCheckingUpdate(true);
    try {
      qaLog("Updates", "Manual check starting");
      const result = await Updates.checkForUpdateAsync();
      if (!result.isAvailable) {
        qaLog("Updates", "Manual check: no update available");
        setCheckingUpdate(false);
        return;
      }
      qaLog("Updates", "Manual check: downloading update...");
      await Updates.fetchUpdateAsync();
      qaLog("Updates", "Manual check: download complete, restarting");
      setCheckingUpdate(false);
      await handleRestart();
    } catch (err) {
      setCheckingUpdate(false);
      qaLog("Updates", "Manual check failed", { error: String(err) });
    }
  };

  console.log("[STARTUP] About to render, fontsLoaded:", fontsLoaded);
  
  if (!fontsLoaded) {
    console.log("[STARTUP] Rendering loading screen (fonts not loaded)");
    return (
      <View style={[styles.loadingContainer, { backgroundColor: colors.pearl }]}>
        <ActivityIndicator size="large" color={colors.ocean} />
      </View>
    );
  }

  console.log("[STARTUP] Fonts loaded, rendering main app with SettingsProvider");

  return (
    <SettingsProvider>
      <AuthProvider>
          <SubscriptionProvider>
            <PostAuthMigrationRunner>
              {updateReady && (
                <View style={styles.updateBanner}>
                  <Text style={styles.updateText}>
                    Update available. Restart to apply.
                  </Text>
                  <View style={styles.updateActions}>
                    <TouchableOpacity
                      style={[styles.updateButtonPrimary, { backgroundColor: colors.seafoam }]}
                      onPress={handleRestart}
                      disabled={restarting}
                      activeOpacity={0.8}
                    >
                      <Text style={[styles.updateButtonPrimaryText, { color: colors.deepTeal }]}>
                        {restarting ? "Restarting..." : "Restart"}
                      </Text>
                    </TouchableOpacity>
                    <TouchableOpacity
                      style={styles.updateButtonSecondary}
                      onPress={() => setUpdateReady(false)}
                      activeOpacity={0.8}
                      disabled={restarting}
                    >
                      <Text style={styles.updateButtonSecondaryText}>Later</Text>
                    </TouchableOpacity>
                  </View>
                </View>
              )}
              <Stack
                screenOptions={{
                  headerShown: false,
                  contentStyle: { backgroundColor: colors.pearl },
                }}
              />
            </PostAuthMigrationRunner>
          </SubscriptionProvider>
      </AuthProvider>
    </SettingsProvider>
  );
}


// ─── Post-Auth Migration Runner ───────────────────────────────────────────────
// Thin wrapper that runs post-sign-in tasks (trial migration, legacy detection).

function PostAuthMigrationRunner({ children }: { children: React.ReactNode }) {
  usePostAuthMigration();
  return <>{children}</>;
}

// Static styles without theme colors (colors applied inline based on theme)
const styles = StyleSheet.create({
  loadingContainer: {
    flex: 1,
    justifyContent: "center",
    alignItems: "center",
  },
  updateBanner: {
    position: "absolute",
    bottom: 12,
    left: 12,
    right: 12,
    zIndex: 999,
    backgroundColor: "#0f172a",
    borderRadius: 12,
    padding: 12,
    shadowColor: "#000",
    shadowOffset: { width: 0, height: 2 },
    shadowOpacity: 0.2,
    shadowRadius: 6,
    elevation: 5,
    flexDirection: "column",
    gap: 8,
  },
  updateText: {
    color: "#e2e8f0",
    fontFamily: "Inter_400Regular",
    fontSize: 14,
  },
  updateActions: {
    flexDirection: "row",
    gap: 8,
    justifyContent: "flex-end",
  },
  updateButtonPrimary: {
    paddingHorizontal: 12,
    paddingVertical: 8,
    borderRadius: 999,
  },
  updateButtonPrimaryText: {
    fontFamily: "Inter_400Regular",
    fontSize: 13,
    fontWeight: "600",
  },
  updateButtonSecondary: {
    borderColor: "#94a3b8",
    borderWidth: 1,
    paddingHorizontal: 12,
    paddingVertical: 8,
    borderRadius: 999,
  },
  updateButtonSecondaryText: {
    color: "#e2e8f0",
    fontFamily: "Inter_400Regular",
    fontSize: 13,
  },
});