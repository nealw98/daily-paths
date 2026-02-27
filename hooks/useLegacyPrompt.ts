import { useEffect, useRef } from "react";
import { Alert, Platform } from "react-native";
import AsyncStorage from "@react-native-async-storage/async-storage";
import { useAuth } from "../contexts/AuthContext";
import { useSubscription } from "../hooks/useSubscription";
import { isRevenueCatInitialized } from "../lib/subscription";
import { canAccessUnlimitedFeatures } from "../utils/accessControl";
import { qaLog } from "../utils/qaLog";

/**
 * One-time legacy user welcome prompt.
 *
 * Detects: device has RevenueCat entitlement (from original $3.99 App Store
 * receipt) + user is NOT authenticated + prompt hasn't been shown before.
 *
 * iOS-only — Android has no legacy users (v2.5 is the first production release).
 */

const LEGACY_PROMPT_KEY = "@daily_paths_legacy_prompt_shown";

export function useLegacyPrompt() {
  const { user, isAuthenticated, loading: authLoading } = useAuth();
  const { status: subStatus, loading: subLoading } = useSubscription();
  const prompted = useRef(false);

  useEffect(() => {
    if (Platform.OS !== "ios") return; // Legacy users are iOS-only
    if (authLoading || subLoading) return;
    if (isAuthenticated) return; // Already signed in
    if (!isRevenueCatInitialized()) return; // RC not set up
    if (!canAccessUnlimitedFeatures(subStatus)) return; // No entitlement
    if (prompted.current) return; // Already prompted this session

    prompted.current = true;

    (async () => {
      try {
        const shown = await AsyncStorage.getItem(LEGACY_PROMPT_KEY);
        if (shown === "true") return;

        qaLog("legacy", "Showing legacy user welcome prompt");

        Alert.alert(
          "Welcome to Daily Paths 2.5",
          "As a founding member, you have lifetime access to all features. " +
          "Create a free account to protect your access and sync your data across devices.",
          [
            {
              text: "Later",
              style: "cancel",
              onPress: () => {
                // Mark as shown so it doesn't re-appear
                AsyncStorage.setItem(LEGACY_PROMPT_KEY, "true");
              },
            },
            {
              text: "Create Account",
              onPress: () => {
                // Mark as shown — the SignInModal will appear when they
                // tap a premium tab (PremiumGate handles it).
                AsyncStorage.setItem(LEGACY_PROMPT_KEY, "true");
              },
            },
          ],
        );
      } catch (err) {
        qaLog("legacy", "Legacy prompt error", { error: String(err) });
      }
    })();
  }, [authLoading, subLoading, isAuthenticated, subStatus]);
}
