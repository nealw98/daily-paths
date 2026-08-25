import React, { useCallback, useEffect, useState, useRef } from "react";
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
import { CloudSyncGate } from "../hooks/useCloudSync";
import { SubscriptionProvider, useSubscriptionContext } from "../contexts/SubscriptionContext";
import {
  View,
  ActivityIndicator,
  AppState,
  type AppStateStatus,
  StyleSheet,
  Text,
  TouchableOpacity,
  Platform,
} from "react-native";
import * as Notifications from "expo-notifications";
import * as SplashScreen from "expo-splash-screen";
import * as Updates from "expo-updates";
import { installGlobalErrorHandler } from "../utils/errorLogger";
import { initMixpanel } from "../lib/mixpanel";
import { qaLog } from "../utils/qaLog";
import { GrandfatheredLifetimeModal } from "../components/GrandfatheredLifetimeModal";
import { SubscriberToLifetimeModal } from "../components/SubscriberToLifetimeModal";
import { KeyboardProvider } from "react-native-keyboard-controller";
import { AppDateProvider } from "../contexts/AppDateContext";
import { ReadingDateProvider } from "../contexts/ReadingDateContext";
import { useAnalytics } from "../utils/analytics";
import Constants from "expo-constants";
import { OnboardingFlow } from "../components/onboarding/OnboardingFlow";

console.log("[STARTUP] _layout.tsx module loading...");
console.log("[STARTUP] Platform:", Platform.OS, Platform.Version);

// Keep the native splash visible until the subscription gate resolves
// before either onboarding or the entitled app is ready to render.
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
  const updateCheckInFlight = useRef(false);
  const lastUpdateCheckAt = useRef(0);
  const appState = useRef<AppStateStatus>(AppState.currentState);
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
  // RevenueCat access is managed by SubscriptionContext.
  useEffect(() => {
    if (fontsLoaded) {
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

  const checkForUpdate = useCallback(async (
    source: "startup" | "foreground",
    force = false,
  ) => {
    if (__DEV__ || updateCheckInFlight.current) return;

    const now = Date.now();
    if (!force && now - lastUpdateCheckAt.current < 30_000) return;

    lastUpdateCheckAt.current = now;
    updateCheckInFlight.current = true;
    try {
      qaLog("Updates", "Checking for updates", { source });
      const result = await Updates.checkForUpdateAsync();
      qaLog("Updates", "Check result", {
        source,
        isAvailable: result.isAvailable,
      });
      if (result.isAvailable) {
        qaLog("Updates", "Downloading update", { source });
        await Updates.fetchUpdateAsync();
        qaLog("Updates", "Download complete, ready to restart", { source });
        setUpdateReady(true);
      } else {
        qaLog("Updates", "App is up to date", { source });
      }
    } catch (err) {
      qaLog("Updates", "Check/fetch failed", {
        source,
        error: String(err),
      });
    } finally {
      updateCheckInFlight.current = false;
    }
  }, []);

  // Check at startup and whenever an existing session returns to the
  // foreground. This lets active installs discover an OTA without requiring
  // the user to terminate and relaunch the app.
  useEffect(() => {
    void checkForUpdate("startup", true);

    const subscription = AppState.addEventListener("change", (nextState) => {
      const previousState = appState.current;
      appState.current = nextState;
      if (
        nextState === "active" &&
        (previousState === "inactive" || previousState === "background")
      ) {
        void checkForUpdate("foreground");
      }
    });

    return () => subscription.remove();
  }, [checkForUpdate]);

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
          <ReadingDateProvider>
            <SubscriptionProvider>
              <SubscriptionTree
                colors={colors}
                updateReady={updateReady}
                setUpdateReady={setUpdateReady}
                restarting={restarting}
                handleRestart={handleRestart}
              />
            </SubscriptionProvider>
          </ReadingDateProvider>
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
 * Mounts the tab Stack only when the user is entitled on Android. New Android
 * users see the two-page product introduction and open RevenueCat checkout
 * from there; iOS remains a paid download and enters the app directly.
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
    Platform.OS !== "android" || (!loading && gate === "none");
  const showOnboarding =
    Platform.OS === "android" && !loading && gate === "paywall";

  useEffect(() => {
    if (!loading) {
      SplashScreen.hideAsync().catch(() => {});
    }
  }, [loading]);

  return (
    <View style={{ flex: 1 }}>
      {showMainStack ? <CloudSyncGate /> : null}
      <PendingModalPresenter />
      {updateReady && (
        <View style={styles.updateBanner}>
          <Text style={styles.updateText}>
            An update is ready.
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
                {restarting ? "Applying…" : "Apply"}
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
      {showOnboarding ? (
        <OnboardingFlow />
      ) : showMainStack ? (
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
    backgroundColor: "#F7FAFA",
  },
});
