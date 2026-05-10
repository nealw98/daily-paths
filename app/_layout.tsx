import React, { useEffect, useState, useRef } from "react";
import { Stack, useRouter } from "expo-router";
import { useFonts } from "expo-font";
import {
  Manrope_300Light,
  Manrope_400Regular,
  Manrope_500Medium,
  Manrope_600SemiBold,
  Manrope_700Bold,
  Manrope_800ExtraBold,
} from "@expo-google-fonts/manrope";
import {
  Lora_400Regular,
  Lora_400Regular_Italic,
  Lora_500Medium,
  Lora_700Bold,
} from "@expo-google-fonts/lora";
import {
  CormorantGaramond_400Regular,
  CormorantGaramond_500Medium,
  CormorantGaramond_500Medium_Italic,
  CormorantGaramond_600SemiBold,
  CormorantGaramond_600SemiBold_Italic,
  CormorantGaramond_700Bold,
} from "@expo-google-fonts/cormorant-garamond";
import { fallbackColors } from "../constants/theme";
import { SettingsProvider } from "../hooks/useSettings";
import { SubscriptionProvider, useSubscriptionContext } from "../contexts/SubscriptionContext";
import { View, ActivityIndicator, StyleSheet, Text, TouchableOpacity, Platform, AppState, AppStateStatus, Image } from "react-native";
import * as Notifications from "expo-notifications";
import * as Updates from "expo-updates";
import { installGlobalErrorHandler } from "../utils/errorLogger";
import { initMixpanel } from "../lib/mixpanel";
import { qaLog } from "../utils/qaLog";
import RevenueCatUI, { PAYWALL_RESULT } from "react-native-purchases-ui";
import { SubscriberToLifetimeModal } from "../components/SubscriberToLifetimeModal";
import { GrandfatheredLifetimeModal } from "../components/GrandfatheredLifetimeModal";
import AsyncStorage from "@react-native-async-storage/async-storage";
import { KeyboardProvider } from "react-native-keyboard-controller";
import { AppDateProvider } from "../contexts/AppDateContext";
import { useAnalytics } from "../utils/analytics";

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
      Manrope_300Light,
      Manrope_400Regular,
      Manrope_500Medium,
      Manrope_600SemiBold,
      Manrope_700Bold,
      Manrope_800ExtraBold,
      Lora_400Regular,
      Lora_400Regular_Italic,
      Lora_500Medium,
      Lora_700Bold,
      CormorantGaramond_400Regular,
      CormorantGaramond_500Medium,
      CormorantGaramond_500Medium_Italic,
      CormorantGaramond_600SemiBold,
      CormorantGaramond_600SemiBold_Italic,
      CormorantGaramond_700Bold,
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
        router.push(`/(tabs)/reading?jump=today&ts=${Date.now()}`);
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
    <KeyboardProvider>
      <SettingsProvider>
        <AppDateProvider>
          <SubscriptionProvider>
            <AndroidHardPaywallGate />
            <SubscriberToLifetimePresenter />
            <GrandfatheredLifetimePresenter />
            {updateReady && (
              <View style={styles.updateBanner}>
                <Text style={styles.updateText}>
                  Update available. Restart to apply.
                </Text>
                <View style={styles.updateActions}>
                  <TouchableOpacity
                    style={[
                      styles.updateButtonPrimary,
                      { backgroundColor: colors.seafoam },
                    ]}
                    onPress={handleRestart}
                    disabled={restarting}
                    activeOpacity={0.8}
                  >
                    <Text
                      style={[
                        styles.updateButtonPrimaryText,
                        { color: colors.deepTeal },
                      ]}
                    >
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
          </SubscriptionProvider>
        </AppDateProvider>
      </SettingsProvider>
    </KeyboardProvider>
  );
}


/**
 * Root-level hard paywall for Android.
 *
 * When the gate is "paywall" and the app is foreground, presents the
 * RevenueCat-rendered paywall as an overlay above the Stack (so notifications
 * deep-linking still works when the user eventually purchases).  The user
 * cannot dismiss without purchasing or restoring — that's enforced via the
 * RevenueCat dashboard config (Close button disabled). Re-presents if the
 * paywall returns without an entitlement.
 *
 * Also renders a launch-splash overlay on top of the Stack while the gate is
 * resolving or "paywall", so the user never sees a flash of Home before the
 * native paywall slides up. The overlay clears if paywall presentation fails,
 * so a failure doesn't trap the user on a blank splash.
 */
function AndroidHardPaywallGate() {
  const { gate, loading, refresh } = useSubscriptionContext();
  const { trackPaywallShown, trackPaywallDismissed, trackRestoreCompleted } = useAnalytics();
  const presenting = useRef(false);
  const appStateRef = useRef<AppStateStatus>(AppState.currentState);
  const [presentFailed, setPresentFailed] = useState(false);

  const present = async () => {
    if (Platform.OS !== "android") return;
    if (presenting.current) return;
    if (loading) return;
    if (gate !== "paywall") return;

    presenting.current = true;
    try {
      trackPaywallShown();
      qaLog("paywall", "Hard paywall presenting");
      const result = await RevenueCatUI.presentPaywall();
      qaLog("paywall", "Hard paywall result", { result });
      // Successful presentation — clear any prior failure flag.
      setPresentFailed(false);

      if (result === PAYWALL_RESULT.PURCHASED) {
        await refresh();
        await new Promise((r) => setTimeout(r, 350));
        await refresh();
      } else if (result === PAYWALL_RESULT.RESTORED) {
        trackRestoreCompleted(true);
        await refresh();
        await new Promise((r) => setTimeout(r, 350));
        await refresh();
      } else {
        // Closed without purchasing/restoring — re-present on next focus / launch.
        trackPaywallDismissed();
      }
    } catch (err) {
      qaLog("paywall", "Hard paywall error", { error: String(err) });
      // Hide the splash so the user isn't trapped on a blank screen.
      // They'll see Home underneath; foreground / next launch will retry.
      setPresentFailed(true);
    } finally {
      presenting.current = false;
    }
  };

  // Present whenever gate transitions to paywall and we're not already showing it.
  useEffect(() => {
    if (Platform.OS !== "android") return;
    if (loading) return;
    if (gate !== "paywall") return;
    void present();
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [gate, loading]);

  // Re-present on foreground if still gated.
  useEffect(() => {
    if (Platform.OS !== "android") return;
    const sub = AppState.addEventListener("change", (next) => {
      if (appStateRef.current.match(/inactive|background/) && next === "active") {
        if (gate === "paywall" && !loading) void present();
      }
      appStateRef.current = next;
    });
    return () => sub.remove();
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [gate, loading]);

  // Hold the splash for a short grace period after the gate clears so the
  // tab tree and Home content have time to render — prevents a one-frame
  // flash of an empty pearl background between splash and Home.
  const [splashHeld, setSplashHeld] = useState(true);
  useEffect(() => {
    if (loading || gate !== "none") {
      setSplashHeld(true);
      return;
    }
    const t = setTimeout(() => setSplashHeld(false), 250);
    return () => clearTimeout(t);
  }, [loading, gate]);

  // Splash overlay — Android-only, hides Home until gate resolves to "none"
  // (plus a short grace period) or paywall presentation fails. Sits above
  // the Stack so the user never sees a flash of Home before RC's native
  // paywall slides up.
  if (Platform.OS !== "android") return null;
  if (presentFailed) return null;
  if (!loading && gate === "none" && !splashHeld) return null;
  return (
    <View pointerEvents="none" style={styles.splashOverlay}>
      <Image
        source={require("../assets/splash-icon.png")}
        style={styles.splashImage}
        resizeMode="contain"
      />
    </View>
  );
}

const SUB_TO_LIFETIME_MODAL_KEY = "@daily_paths_modal_sub_to_lifetime_seen";

/**
 * Modal A — fires once on Android for users with both `unlimited` and
 * `lifetime` entitlements (legacy annual subscribers manually granted
 * lifetime in the RC dashboard during the 2.6.6 transition).
 */
function SubscriberToLifetimePresenter() {
  const { hasSubAndLifetime, isAnnualSubscriber } = useSubscriptionContext();
  const { trackModalShown } = useAnalytics();
  const [visible, setVisible] = useState(false);

  useEffect(() => {
    if (Platform.OS !== "android") return;
    if (!hasSubAndLifetime) return;
    (async () => {
      const seen = await AsyncStorage.getItem(SUB_TO_LIFETIME_MODAL_KEY);
      if (seen !== "true") {
        setVisible(true);
        trackModalShown("subscriber_to_lifetime");
      }
    })();
  }, [hasSubAndLifetime, trackModalShown]);

  if (Platform.OS !== "android") return null;

  return (
    <SubscriberToLifetimeModal
      visible={visible}
      isAnnual={isAnnualSubscriber}
      onClose={async () => {
        await AsyncStorage.setItem(SUB_TO_LIFETIME_MODAL_KEY, "true");
        setVisible(false);
      }}
    />
  );
}

/**
 * Modal B — fires once on Android for users who were just granted lifetime
 * via the grandfather edge function. Dismissal clears the pending flag.
 */
function GrandfatheredLifetimePresenter() {
  const { showGrandfatherModal, acknowledgeGrandfatherModal } = useSubscriptionContext();
  const { trackModalShown } = useAnalytics();
  const announced = useRef(false);

  useEffect(() => {
    if (showGrandfatherModal && !announced.current) {
      trackModalShown("grandfathered");
      announced.current = true;
    }
  }, [showGrandfatherModal, trackModalShown]);

  if (Platform.OS !== "android") return null;

  return (
    <GrandfatheredLifetimeModal
      visible={showGrandfatherModal}
      onClose={() => {
        void acknowledgeGrandfatherModal();
      }}
    />
  );
}

// Static styles without theme colors (colors applied inline based on theme)
const styles = StyleSheet.create({
  loadingContainer: {
    flex: 1,
    justifyContent: "center",
    alignItems: "center",
  },
  splashOverlay: {
    ...StyleSheet.absoluteFillObject,
    backgroundColor: "#F7FAFA",
    justifyContent: "center",
    alignItems: "center",
    zIndex: 998,
    elevation: 998,
  },
  splashImage: {
    width: 200,
    height: 200,
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