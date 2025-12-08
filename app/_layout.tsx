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
} from "@expo-google-fonts/inter";
import {
  Lora_400Regular,
  Lora_400Regular_Italic,
} from "@expo-google-fonts/lora";
import { colors } from "../constants/theme";
import { SettingsProvider } from "../hooks/useSettings";
import {
  View,
  ActivityIndicator,
  StyleSheet,
  Text,
  TouchableOpacity,
} from "react-native";
import * as Notifications from "expo-notifications";
import * as Updates from "expo-updates";
import { installGlobalErrorHandler } from "../utils/errorLogger";

Notifications.setNotificationHandler({
  handleNotification: async () => ({
    shouldShowAlert: true,
    shouldPlaySound: false,
    shouldSetBadge: false,
  }),
});

export default function RootLayout() {
  const router = useRouter();
  installGlobalErrorHandler();

  const [updateReady, setUpdateReady] = useState(false);
  const [restarting, setRestarting] = useState(false);
  const [checkingUpdate, setCheckingUpdate] = useState(false);

  const [fontsLoaded] = useFonts({
    CormorantGaramond_600SemiBold,
    CormorantGaramond_600SemiBold_Italic,
    CormorantGaramond_700Bold_Italic,
    Inter_300Light,
    Inter_400Regular,
    Lora_400Regular,
    Lora_400Regular_Italic,
  });

  // Check for OTA updates once on startup; if downloaded, prompt to restart.
  useEffect(() => {
    if (__DEV__) return; // skip in dev client
    let cancelled = false;
    (async () => {
      try {
        const result = await Updates.checkForUpdateAsync();
        if (result.isAvailable) {
          await Updates.fetchUpdateAsync();
          if (!cancelled) {
            setUpdateReady(true);
          }
        }
      } catch (err) {
        // eslint-disable-next-line no-console
        console.log("[Updates] check/fetch failed", err);
      }
    })();
    return () => {
      cancelled = true;
    };
  }, []);

  // When a notification is tapped, navigate to the reading screen for today.
  useEffect(() => {
    const sub = Notifications.addNotificationResponseReceivedListener(() => {
      // Adding a cache-busting param ensures the navigation runs even if already on the screen.
      router.push(`/?jump=today&ts=${Date.now()}`);
    });
    return () => sub.remove();
  }, [router]);

  const handleRestart = async () => {
    try {
      setRestarting(true);
      await Updates.reloadAsync();
    } catch (err) {
      setRestarting(false);
      // eslint-disable-next-line no-console
      console.log("[Updates] reload failed", err);
    }
  };

  // Manual updater for QA screen: runs a check + fetch + reload and logs to QA.
  const checkAndApplyUpdate = async () => {
    if (__DEV__) return;
    if (checkingUpdate || restarting) return;
    setCheckingUpdate(true);
    try {
      const result = await Updates.checkForUpdateAsync();
      if (!result.isAvailable) {
        // eslint-disable-next-line no-console
        console.log("[Updates] No update available");
        setCheckingUpdate(false);
        return;
      }
      await Updates.fetchUpdateAsync();
      setCheckingUpdate(false);
      await handleRestart();
    } catch (err) {
      setCheckingUpdate(false);
      // eslint-disable-next-line no-console
      console.log("[Updates] Manual check failed", err);
    }
  };

  if (!fontsLoaded) {
    return (
      <View style={styles.loadingContainer}>
        <ActivityIndicator size="large" color={colors.ocean} />
      </View>
    );
  }

  return (
    <SettingsProvider>
      {updateReady && (
        <View style={styles.updateBanner}>
          <Text style={styles.updateText}>
            Update available. Restart to apply.
          </Text>
          <View style={styles.updateActions}>
            <TouchableOpacity
              style={styles.updateButtonPrimary}
              onPress={handleRestart}
              disabled={restarting}
              activeOpacity={0.8}
            >
              <Text style={styles.updateButtonPrimaryText}>
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
        initialParams={{ checkAndApplyUpdate }}
      />
    </SettingsProvider>
  );
}

const styles = StyleSheet.create({
  loadingContainer: {
    flex: 1,
    justifyContent: "center",
    alignItems: "center",
    backgroundColor: colors.pearl,
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
    backgroundColor: colors.seafoam,
    paddingHorizontal: 12,
    paddingVertical: 8,
    borderRadius: 999,
  },
  updateButtonPrimaryText: {
    color: colors.deepTeal,
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

