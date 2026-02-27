import React, { useEffect, useRef, useState, useCallback } from "react";
import Constants from "expo-constants";
import { router, useNavigation } from "expo-router";
import { useAuth } from "../contexts/AuthContext";
import { useSubscriptionContext } from "../contexts/SubscriptionContext";
import { migrateTrialDataToSupabase } from "../utils/dataMigration";
import { performLegacyMigration, grantLifetimeEntitlement } from "../utils/legacyUserMigration";
import { PaywallModal } from "./PaywallModal";
import { SignInModal } from "./SignInModal";
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
  const { user, isAuthenticated } = useAuth();
  const navigation = useNavigation();
  const { gate, refresh: refreshSub } = useSubscriptionContext();

  // Track previous auth state to detect fresh sign-ins
  const prevAuth = useRef(isAuthenticated);

  // After a purchase the paywall closes; we need to re-evaluate the gate and
  // potentially show the sign-in modal.  This state bridges that transition.
  const [purchaseCompleted, setPurchaseCompleted] = useState(false);

  // When the user dismisses the paywall ("Not Now" / X), we set this to true
  // so the modal unmounts before we navigate away.
  const [dismissed, setDismissed] = useState(false);

  // Dev / simulator bypass — allow dismissing modals for testing
  const isSimulator = !Constants.isDevice;
  const devBypass = __DEV__ || isSimulator;

  // ── Reset dismissed state when this tab regains focus ────────────────
  // So the paywall shows again if the user navigates back to a premium tab.
  useEffect(() => {
    const unsubscribe = navigation.addListener("focus", () => {
      setDismissed(false);
    });
    return unsubscribe;
  }, [navigation]);

  // ── Detect fresh sign-in → migrate data ─────────────────────────────
  // loginRevenueCat is now handled by SubscriptionContext.
  useEffect(() => {
    if (!prevAuth.current && isAuthenticated && user?.id) {
      (async () => {
        try {
          qaLog("PremiumGate", "Fresh sign-in detected, migrating data");
          await migrateTrialDataToSupabase(user.id);

          // Detect legacy users and grant RevenueCat lifetime entitlement
          const isLegacy = await performLegacyMigration(user.id);
          if (isLegacy) {
            qaLog("PremiumGate", "Legacy user detected, granting lifetime entitlement");
            await grantLifetimeEntitlement(user.id);
          }

          refreshSub();
        } catch (err) {
          qaLog("PremiumGate", "Post-sign-in error", { error: String(err) });
        }
      })();
    }
    prevAuth.current = isAuthenticated;
  }, [isAuthenticated, user?.id, refreshSub]);

  // ── Dismiss handler — hides Modal overlay, then navigates to home ─────
  const handleDismiss = useCallback(() => {
    setDismissed(true);
    // Use setTimeout so the modal unmounts before navigation
    setTimeout(() => {
      router.navigate("/(tabs)/today");
    }, 50);
  }, []);

  // ── Always render children; overlay modals when gated ─────────────────
  return (
    <>
      {children}

      {/* Paywall overlay */}
      {gate === "paywall" && !purchaseCompleted && !dismissed && (
        <PaywallModal
          visible
          dismissable
          onClose={() => {
            refreshSub();
            setPurchaseCompleted(true);
          }}
          onDismiss={handleDismiss}
        />
      )}

      {/* Sign-in overlay */}
      {(gate === "signin" || purchaseCompleted) && !dismissed && (
        <SignInModal
          visible
          dismissable={devBypass}
          initialMode={gate === "signin" ? "signin" : undefined}
          onClose={() => {
            setPurchaseCompleted(false);
            refreshSub();
          }}
        />
      )}
    </>
  );
};
