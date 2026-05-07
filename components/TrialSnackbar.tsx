import React, { useEffect, useRef, useState } from "react";
import {
  Animated,
  AppState,
  AppStateStatus,
  Platform,
  StyleSheet,
  Text,
  View,
} from "react-native";
import { useSafeAreaInsets } from "react-native-safe-area-context";
import AsyncStorage from "@react-native-async-storage/async-storage";
import { useSubscriptionContext } from "../contexts/SubscriptionContext";
import { useTheme } from "../hooks/useTheme";
import { fonts } from "../constants/theme";

/**
 * Once-per-day trial countdown snackbar.
 *
 * Animates in from the bottom on first foreground per local-day, holds for a
 * few seconds, then animates out. Android-only — entitled users never see it,
 * and iOS doesn't have a trial. Replaces the in-Settings countdown so the
 * Settings tab can mirror iOS's "paid app" surface for entitled users.
 */

const SHOWN_DATE_KEY = "@daily_paths_trial_snackbar_shown_date";
const HOLD_MS = 3500;
const FADE_MS = 250;

function todayKey(): string {
  const d = new Date();
  const y = d.getFullYear();
  const m = String(d.getMonth() + 1).padStart(2, "0");
  const day = String(d.getDate()).padStart(2, "0");
  return `${y}-${m}-${day}`;
}

export const TrialSnackbar: React.FC = () => {
  const { trialStatus, loading } = useSubscriptionContext();
  const { colors } = useTheme();
  const insets = useSafeAreaInsets();
  const [visible, setVisible] = useState(false);
  const [message, setMessage] = useState("");
  const opacity = useRef(new Animated.Value(0)).current;
  const translateY = useRef(new Animated.Value(20)).current;
  const appState = useRef<AppStateStatus>(AppState.currentState);
  const showingRef = useRef(false);

  const formatMessage = (daysRemaining: number): string => {
    if (daysRemaining === 0) return "Free Trial — expires today";
    return `Free Trial — ${daysRemaining} day${daysRemaining === 1 ? "" : "s"} left`;
  };

  const tryShow = async () => {
    if (Platform.OS !== "android") return;
    if (loading) return;
    if (!trialStatus.isInTrial) return;
    if (showingRef.current) return;

    try {
      const lastShown = await AsyncStorage.getItem(SHOWN_DATE_KEY);
      const today = todayKey();
      if (lastShown === today) return;
      await AsyncStorage.setItem(SHOWN_DATE_KEY, today);
    } catch {
      // If storage fails, still show — falling silent on the snackbar would
      // be more confusing than letting it appear an extra time.
    }

    showingRef.current = true;
    setMessage(formatMessage(trialStatus.daysRemaining));
    setVisible(true);

    Animated.parallel([
      Animated.timing(opacity, { toValue: 1, duration: FADE_MS, useNativeDriver: true }),
      Animated.timing(translateY, { toValue: 0, duration: FADE_MS, useNativeDriver: true }),
    ]).start();

    setTimeout(() => {
      Animated.parallel([
        Animated.timing(opacity, { toValue: 0, duration: FADE_MS, useNativeDriver: true }),
        Animated.timing(translateY, { toValue: 20, duration: FADE_MS, useNativeDriver: true }),
      ]).start(() => {
        setVisible(false);
        showingRef.current = false;
      });
    }, HOLD_MS);
  };

  // Trigger on initial mount once the subscription state has settled.
  useEffect(() => {
    if (loading) return;
    if (!trialStatus.isInTrial) return;
    void tryShow();
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [loading, trialStatus.isInTrial]);

  // Trigger again when the user foregrounds the app on a new local day.
  useEffect(() => {
    const sub = AppState.addEventListener("change", (next) => {
      if (appState.current.match(/inactive|background/) && next === "active") {
        void tryShow();
      }
      appState.current = next;
    });
    return () => sub.remove();
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [trialStatus.isInTrial, loading]);

  if (Platform.OS !== "android") return null;
  if (!visible) return null;

  // Sit above the tab bar (60dp + bottom safe-area) with a 16dp gap.
  const TAB_BAR_HEIGHT = 60;
  const bottomOffset = TAB_BAR_HEIGHT + insets.bottom + 16;

  return (
    <View
      pointerEvents="none"
      style={[styles.wrapper, { paddingBottom: bottomOffset }]}
    >
      <Animated.View
        style={[
          styles.pill,
          {
            backgroundColor: colors.deepTeal,
            opacity,
            transform: [{ translateY }],
          },
        ]}
      >
        <Text style={[styles.text, { color: "#FFFFFF" }]}>{message}</Text>
      </Animated.View>
    </View>
  );
};

/** QA helper: clear the once-per-day flag so the snackbar can re-fire. */
export async function resetTrialSnackbarShown(): Promise<void> {
  try {
    await AsyncStorage.removeItem(SHOWN_DATE_KEY);
  } catch {
    // Non-critical
  }
}

const styles = StyleSheet.create({
  wrapper: {
    position: "absolute",
    left: 0,
    right: 0,
    bottom: 0,
    alignItems: "center",
    paddingHorizontal: 16,
    zIndex: 1000,
    elevation: 12,
  },
  pill: {
    paddingVertical: 12,
    paddingHorizontal: 20,
    borderRadius: 999,
    maxWidth: "100%",
    shadowColor: "#000",
    shadowOffset: { width: 0, height: 2 },
    shadowOpacity: 0.25,
    shadowRadius: 8,
    elevation: 12,
  },
  text: {
    fontFamily: fonts.bodyFamilyMedium,
    fontSize: 14,
    lineHeight: 20,
  },
});
