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
import { fallbackColors, fonts } from "../constants/theme";
import { SettingsProvider } from "../hooks/useSettings";
import { SubscriptionProvider, useSubscriptionContext } from "../contexts/SubscriptionContext";
import { View, ActivityIndicator, StyleSheet, Text, TouchableOpacity, Platform, AppState, AppStateStatus, Image } from "react-native";
import * as Notifications from "expo-notifications";
import * as SplashScreen from "expo-splash-screen";
import * as Updates from "expo-updates";
import { installGlobalErrorHandler } from "../utils/errorLogger";
import { initMixpanel } from "../lib/mixpanel";
import { qaLog } from "../utils/qaLog";
import { markLaunchPhase } from "../utils/launchTiming";
import Purchases from "react-native-purchases";
import RevenueCatUI, { PAYWALL_RESULT } from "react-native-purchases-ui";
import { GrandfatheredLifetimeModal } from "../components/GrandfatheredLifetimeModal";
import { SubscriberToLifetimeModal } from "../components/SubscriberToLifetimeModal";
import { FirstLaunchTrialModal } from "../components/FirstLaunchTrialModal";
import { KeyboardProvider } from "react-native-keyboard-controller";
import { AppDateProvider } from "../contexts/AppDateContext";
import { useAnalytics } from "../utils/analytics";
import { expireTrial } from "../utils/trialTimer";
import { getRawEntitlements, restorePurchases } from "../lib/subscription";
import { clearSubscriptionOverride } from "../utils/subscriptionOverride";
import Constants from "expo-constants";

console.log("[STARTUP] _layout.tsx module loading...");
console.log("[STARTUP] Platform:", Platform.OS, Platform.Version);

/**
 * RevenueCat offering identifier to target when presenting the 2.7 hard
 * paywall. RC offerings are global across SDK versions — so we explicitly
 * request the lifetime offering here to prevent the 2.6.x binaries (which
 * call `presentPaywall()` against whatever offering is "current") from
 * accidentally showing the 2.7 lifetime product if it's activated as
 * default in RC. Set this constant to the exact identifier of the lifetime
 * offering in RC dashboard. Fallback to the current/default offering if
 * the identifier can't be resolved (logged to QA).
 */
const TARGET_PAYWALL_OFFERING_ID = "android_unlock";

// Keep the native splash visible until the subscription gate resolves
// (and, on Android, the hard paywall has presented). Hidden via
// SplashScreen.hideAsync() in AndroidHardPaywallGate / SubscriptionGateSplash.
SplashScreen.preventAutoHideAsync().catch(() => {
  // No-op: already hidden or unsupported. Safe to ignore.
});

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
  markLaunchPhase("RootLayout component invoked");
  
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
      markLaunchPhase("Fonts loaded");
      initMixpanel();
      qaLog("runtime", "App runtime snapshot", {
        nativeAppVersion: Constants.nativeAppVersion,
        nativeBuildVersion: Constants.nativeBuildVersion,
        expoVersion: Constants.expoConfig?.version,
        androidVersionCode: Constants.expoConfig?.android?.versionCode,
        iosBuildNumber: Constants.expoConfig?.ios?.buildNumber,
        updateId: (Updates as any).updateId ?? null,
        channel: (Updates as any).channel ?? null,
        runtimeVersion: (Updates as any).runtimeVersion ?? null,
        isEmbeddedLaunch: (Updates as any).isEmbeddedLaunch ?? null,
        createdAt: (Updates as any).createdAt ?? null,
      });
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
            <SubscriptionTree
              colors={colors}
              updateReady={updateReady}
              setUpdateReady={setUpdateReady}
              restarting={restarting}
              handleRestart={handleRestart}
            />
          </SubscriptionProvider>
        </AppDateProvider>
      </SettingsProvider>
    </KeyboardProvider>
  );
}

type SubscriptionTreeProps = {
  colors: typeof fallbackColors;
  updateReady: boolean;
  setUpdateReady: (v: boolean) => void;
  restarting: boolean;
  handleRestart: () => Promise<void>;
};

/**
 * Mounts the tab Stack only when the user is entitled on Android — avoids
 * painting Home under the paywall / splash handoff.
 */
function SubscriptionTree({
  colors,
  updateReady,
  setUpdateReady,
  restarting,
  handleRestart,
}: SubscriptionTreeProps) {
  const { gate, loading } = useSubscriptionContext();
  const showMainStack =
    Platform.OS !== "android" || (!loading && gate !== "paywall");

  return (
    <View style={{ flex: 1 }}>
      <AndroidHardPaywallGate />
      <FirstLaunchTrialPresenter />
      <PendingModalPresenter />
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
      {showMainStack ? (
        <Stack
          screenOptions={{
            headerShown: false,
            contentStyle: { backgroundColor: colors.pearl },
          }}
        />
      ) : (
        <View style={styles.androidGatePlaceholder} />
      )}
    </View>
  );
}

/**
 * Root-level hard paywall for Android.
 *
 * When the gate is "paywall" and the app is foreground, presents the
 * RevenueCat-rendered paywall. The main Stack is not mounted while gated, so
 * Home never flashes. Native splash stays up until just before
 * `presentPaywall()` so there is no blank gap.
 *
 * The RC paywall is configured **non-dismissable** in the dashboard for 2.7.
 * The retry shell below is a defensive fallback in case that config is ever
 * lost — it should not normally render.
 */
function AndroidHardPaywallGate() {
  const { gate, loading, refresh, trialStatus } = useSubscriptionContext();
  const {
    trackPaywallShown,
    trackPaywallDismissed,
    trackPaywallPurchaseCompleted,
    trackPaywallPurchaseCancelled,
    trackRestoreCompleted,
  } = useAnalytics();
  const presenting = useRef(false);
  const appStateRef = useRef<AppStateStatus>(AppState.currentState);
  /** After RC paywall close/error — show Retry instead of mounting the app. */
  const [showPaywallRetryShell, setShowPaywallRetryShell] = useState(false);

  const hideNativeSplash = () => {
    markLaunchPhase("hideNativeSplash() called");
    SplashScreen.hideAsync().catch(() => {
      // Already hidden / unsupported — safe to ignore.
    });
  };

  const present = async () => {
    if (Platform.OS !== "android") return;
    if (presenting.current) return;
    if (loading) return;
    if (gate !== "paywall") return;

    presenting.current = true;
    try {
      trackPaywallShown();
      hideNativeSplash();

      // Resolve the target offering by identifier so this 2.7 build never
      // accidentally renders whatever RC has set as "current" (e.g. a legacy
      // subscription offering). Falls back to the SDK default if our named
      // offering isn't found.
      let targetOffering = null;
      try {
        const offerings = await Purchases.getOfferings();
        targetOffering = offerings.all?.[TARGET_PAYWALL_OFFERING_ID] ?? null;
        qaLog("paywall", "Resolved target offering", {
          targetId: TARGET_PAYWALL_OFFERING_ID,
          found: !!targetOffering,
          currentId: offerings.current?.identifier ?? null,
          allIds: Object.keys(offerings.all ?? {}),
        });
      } catch (err) {
        qaLog("paywall", "Failed to fetch offerings — falling back to default", {
          error: String(err),
        });
      }

      qaLog("paywall", "Hard paywall presenting", {
        offeringId: targetOffering?.identifier ?? "(default)",
      });
      const result = targetOffering
        ? await RevenueCatUI.presentPaywall({ offering: targetOffering })
        : await RevenueCatUI.presentPaywall();
      qaLog("paywall", "Hard paywall result", { result });

      if (result === PAYWALL_RESULT.PURCHASED) {
        trackPaywallPurchaseCompleted();
        const rawAfterPurchase = await getRawEntitlements();
        if (rawAfterPurchase.hasUnlimited || rawAfterPurchase.hasLifetime) {
          await clearSubscriptionOverride();
        }
        // RC's CustomerInfo listener in SubscriptionContext fires on its own
        // when the entitlement actually lands. Trigger one refresh to cover
        // the case where the listener hasn't seen the event yet.
        await refresh();
        try {
          await expireTrial();
          await trialStatus.refresh();
        } catch {
          // Non-critical — entitlement already unlocks the app
        }
        setShowPaywallRetryShell(false);
      } else if (result === PAYWALL_RESULT.RESTORED) {
        trackRestoreCompleted(true);
        const rawAfterRestore = await getRawEntitlements();
        if (rawAfterRestore.hasUnlimited || rawAfterRestore.hasLifetime) {
          await clearSubscriptionOverride();
          qaLog("paywall", "Cleared QA subscription override after paywall restore");
        }
        await refresh();
        try {
          await expireTrial();
          await trialStatus.refresh();
        } catch {
          // Non-critical
        }
        setShowPaywallRetryShell(false);
      } else {
        trackPaywallPurchaseCancelled();
        trackPaywallDismissed();
        setShowPaywallRetryShell(true);
      }
    } catch (err) {
      qaLog("paywall", "Hard paywall error", { error: String(err) });
      const errStr = String(err).toLowerCase();
      const looksLikeAlreadyOwned =
        errStr.includes("already") ||
        errStr.includes("owned") ||
        errStr.includes("active for the user") ||
        errStr.includes("itemalreadyowned");
      if (Platform.OS === "android" && looksLikeAlreadyOwned) {
        try {
          qaLog("paywall", "Recovering via restorePurchases after already-owned error");
          await restorePurchases();
          const rawAfterRestore = await getRawEntitlements();
          if (rawAfterRestore.hasUnlimited || rawAfterRestore.hasLifetime) {
            await clearSubscriptionOverride();
            qaLog("paywall", "Cleared QA subscription override after already-owned restore");
          }
          await refresh();
          try {
            await expireTrial();
            await trialStatus.refresh();
          } catch {
            // Non-critical
          }
          trackPaywallPurchaseCompleted();
          setShowPaywallRetryShell(false);
          return;
        } catch (re) {
          qaLog("paywall", "post-error restore failed", { error: String(re) });
        }
      }
      trackPaywallPurchaseCancelled();
      setShowPaywallRetryShell(true);
    } finally {
      presenting.current = false;
    }
  };

  // Hide native splash when appropriate. On Android paywall path, defer until
  // `present()` runs (just before RC paywall) so we never show Home/blank.
  useEffect(() => {
    if (loading) return;
    if (
      Platform.OS === "android" &&
      gate === "paywall" &&
      !showPaywallRetryShell
    ) {
      return;
    }
    hideNativeSplash();
  }, [loading, gate, showPaywallRetryShell]);

  useEffect(() => {
    if (Platform.OS !== "android") return;
    if (gate === "none") {
      setShowPaywallRetryShell(false);
    }
  }, [gate]);

  // Present paywall when gate flips to "paywall".
  useEffect(() => {
    if (Platform.OS !== "android") return;
    if (loading) return;
    if (gate !== "paywall") return;
    setShowPaywallRetryShell(false);
    void present();
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [gate, loading]);

  // Re-present on foreground if still gated (and not stuck on retry shell).
  useEffect(() => {
    if (Platform.OS !== "android") return;
    const sub = AppState.addEventListener("change", (next) => {
      if (appStateRef.current.match(/inactive|background/) && next === "active") {
        if (gate === "paywall" && !loading && !showPaywallRetryShell) {
          void present();
        }
      }
      appStateRef.current = next;
    });
    return () => sub.remove();
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [gate, loading, showPaywallRetryShell]);

  if (Platform.OS !== "android") return null;

  const showBlockingOverlay =
    loading || gate === "paywall" || showPaywallRetryShell;
  if (!showBlockingOverlay) return null;

  return (
    <View
      pointerEvents={showPaywallRetryShell ? "auto" : "none"}
      style={styles.splashOverlay}
    >
      <Image
        source={require("../assets/new-splash-icon.png")}
        style={styles.splashIcon}
        resizeMode="contain"
      />
      {showPaywallRetryShell ? (
        <View style={styles.paywallRetryBlock}>
          <Text style={styles.paywallRetryTitle}>Subscription required</Text>
          <Text style={styles.paywallRetryBody}>
            The paywall closed without a purchase. Tap Retry to open it again.
          </Text>
          <TouchableOpacity
            style={styles.paywallRetryButton}
            activeOpacity={0.85}
            onPress={() => {
              setShowPaywallRetryShell(false);
              void present();
            }}
          >
            <Text style={styles.paywallRetryButtonText}>Retry paywall</Text>
          </TouchableOpacity>
        </View>
      ) : null}
    </View>
  );
}

/**
 * Onboarding modal shown once on first Android launch. Renders nothing on
 * iOS or after the user has acknowledged it once.
 */
function FirstLaunchTrialPresenter() {
  const { showFirstLaunchModal, dismissFirstLaunchModal } = useSubscriptionContext();
  if (Platform.OS !== "android") return null;
  return (
    <FirstLaunchTrialModal
      visible={showFirstLaunchModal}
      onContinue={() => {
        void dismissFirstLaunchModal();
      }}
    />
  );
}

/**
 * Renders whichever one-time modal the server decided for this user.
 * Exactly one of Modal A (subscriber-to-lifetime) or Modal B (grandfathered)
 * — or neither. Acknowledgment goes through the server so the modal can never
 * fire again, even after a reinstall.
 */
function PendingModalPresenter() {
  const { pendingModal, acknowledgePendingModal } = useSubscriptionContext();
  const { trackModalShown } = useAnalytics();
  const announced = useRef<string | null>(null);

  useEffect(() => {
    if (!pendingModal) {
      announced.current = null;
      return;
    }
    if (announced.current === pendingModal.modal) return;
    trackModalShown(pendingModal.modal);
    announced.current = pendingModal.modal;
  }, [pendingModal, trackModalShown]);

  if (Platform.OS !== "android") return null;

  const showSubscriberModal = pendingModal?.modal === "subscriber_to_lifetime";
  const showGrandfatheredModal = pendingModal?.modal === "grandfathered";

  return (
    <>
      <SubscriberToLifetimeModal
        visible={showSubscriberModal}
        onClose={() => {
          void acknowledgePendingModal();
        }}
      />
      <GrandfatheredLifetimeModal
        visible={showGrandfatheredModal}
        onClose={() => {
          void acknowledgePendingModal();
        }}
      />
    </>
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
    backgroundColor: "#376662",
    justifyContent: "center",
    alignItems: "center",
    zIndex: 998,
    elevation: 998,
  },
  splashIcon: {
    // Match `imageWidth: 300` from the expo-splash-screen plugin config in
    // app.json so the handoff from native splash → JS overlay is invisible.
    width: 300,
    height: 300,
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
    fontFamily: "Manrope_400Regular",
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
    fontFamily: "Manrope_400Regular",
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
    fontFamily: "Manrope_400Regular",
    fontSize: 13,
  },
  androidGatePlaceholder: {
    flex: 1,
    backgroundColor: "#376662",
  },
  paywallRetryBlock: {
    marginTop: 24,
    paddingHorizontal: 24,
    alignItems: "center",
    maxWidth: 320,
    alignSelf: "center",
  },
  paywallRetryTitle: {
    fontFamily: fonts.bodyFamilySemiBold,
    fontSize: 18,
    color: "#f8fafc",
    textAlign: "center",
    marginBottom: 8,
  },
  paywallRetryBody: {
    fontFamily: fonts.bodyFamilyRegular,
    fontSize: 14,
    color: "#e2e8f0",
    textAlign: "center",
    lineHeight: 20,
    marginBottom: 16,
  },
  paywallRetryButton: {
    backgroundColor: "#7dd3c0",
    paddingHorizontal: 20,
    paddingVertical: 12,
    borderRadius: 999,
  },
  paywallRetryButtonText: {
    fontFamily: fonts.bodyFamilySemiBold,
    fontSize: 15,
    color: "#0f172a",
  },
});