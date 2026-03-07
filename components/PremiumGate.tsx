import React, { useEffect, useState, useRef } from "react";
import { router, useNavigation } from "expo-router";
import RevenueCatUI, { PAYWALL_RESULT } from "react-native-purchases-ui";
import { useSubscriptionContext } from "../contexts/SubscriptionContext";
import { SignInModal } from "./SignInModal";
import { useAnalytics } from "../utils/analytics";
import { qaLog } from "../utils/qaLog";

/**
 * Per-tab access gate for premium features (Journal, Prayers, Speakers).
 *
 * Children always render immediately (hooks execute, content visible).
 * If the user lacks access, PaywallModal or SignInModal overlays on top.
 * This matches the Today tab's instant-render behavior.
 */

interface PremiumGateProps {
  children: React.ReactNode;
}

export const PremiumGate: React.FC<PremiumGateProps> = ({ children }) => {
  const navigation = useNavigation();
  const { gate, refresh: refreshSub } = useSubscriptionContext();
  const { trackPaywallShown, trackPaywallDismissed } = useAnalytics();

  const [purchaseCompleted, setPurchaseCompleted] = useState(false);
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
    if (gate !== "paywall" || purchaseCompleted || dismissed || presentingPaywall.current) return;

    presentingPaywall.current = true;
    trackPaywallShown();
    qaLog("paywall", "PremiumGate presenting paywall", { gate });

    (async () => {
      try {
        const result = await RevenueCatUI.presentPaywall();
        qaLog("paywall", "Paywall result", { result });

        if (result === PAYWALL_RESULT.PURCHASED || result === PAYWALL_RESULT.RESTORED) {
          refreshSub();
          setPurchaseCompleted(true);
        } else {
          trackPaywallDismissed();
          setDismissed(true);
          setTimeout(() => router.navigate("/(tabs)/today"), 50);
        }
      } catch (err) {
        qaLog("paywall", "Paywall error", { error: String(err) });
        setDismissed(true);
        setTimeout(() => router.navigate("/(tabs)/today"), 50);
      } finally {
        presentingPaywall.current = false;
      }
    })();
  }, [gate, purchaseCompleted, dismissed, trackPaywallShown, trackPaywallDismissed, refreshSub]);

  return (
    <>
      {children}

      {(gate === "signin" || purchaseCompleted) && !dismissed && (
        <SignInModal
          visible
          dismissable
          initialMode={gate === "signin" ? "signin" : undefined}
          onClose={() => {
            setPurchaseCompleted(false);
            refreshSub();
            if (gate === "signin") {
              setDismissed(true);
              setTimeout(() => router.navigate("/(tabs)/today"), 50);
            }
          }}
        />
      )}
    </>
  );
};
