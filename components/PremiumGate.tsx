import React, { useEffect, useState, useRef } from "react";
import { router, useNavigation } from "expo-router";
import RevenueCatUI, { PAYWALL_RESULT } from "react-native-purchases-ui";
import { Alert } from "react-native";
import { useIsFocused } from "@react-navigation/native";
import { useSubscriptionContext } from "../contexts/SubscriptionContext";
import { useAnalytics } from "../utils/analytics";
import { qaLog } from "../utils/qaLog";

/**
 * Per-tab access gate for premium features (Journal, Prayers, Speakers).
 *
 * Children always render immediately (hooks execute, content visible).
 * If the user lacks entitlement, the RevenueCat paywall overlays on top.
 * This matches the Today tab's instant-render behavior.
 */

interface PremiumGateProps {
  children: React.ReactNode;
}

export const PremiumGate: React.FC<PremiumGateProps> = ({ children }) => {
  const navigation = useNavigation();
  const isFocused = useIsFocused();
  const { gate, refresh: refreshSub } = useSubscriptionContext();
  const { trackPaywallShown, trackPaywallDismissed } = useAnalytics();

  const [dismissed, setDismissed] = useState(false);
  const presentingPaywall = useRef(false);

  useEffect(() => {
    const unsubscribe = navigation.addListener("focus", () => {
      setDismissed(false);
      presentingPaywall.current = false;
    });
    return unsubscribe;
  }, [navigation]);

  // Present RevenueCat's native paywall when gate requires it
  useEffect(() => {
    if (gate !== "paywall" || !isFocused || dismissed || presentingPaywall.current) return;

    presentingPaywall.current = true;
    trackPaywallShown();
    qaLog("paywall", "PremiumGate presenting paywall", { gate });

    (async () => {
      try {
        const result = await RevenueCatUI.presentPaywall();
        qaLog("paywall", "Paywall result", { result });

        if (result === PAYWALL_RESULT.PURCHASED || result === PAYWALL_RESULT.RESTORED) {
          await refreshSub();
        } else {
          trackPaywallDismissed();
          setDismissed(true);
          setTimeout(() => router.navigate("/(tabs)/today"), 50);
        }
      } catch (err) {
        qaLog("paywall", "Paywall error", { error: String(err) });
        Alert.alert(
          "Unable to Load Subscription",
          "The subscription page couldn't be loaded. Please try again.",
        );
        setDismissed(true);
        setTimeout(() => router.navigate("/(tabs)/today"), 50);
      } finally {
        presentingPaywall.current = false;
      }
    })();
  }, [gate, isFocused, dismissed, trackPaywallShown, trackPaywallDismissed, refreshSub]);

  return (
    <>
      {children}
    </>
  );
};
