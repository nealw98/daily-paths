import React, { useEffect, useRef, useState } from "react";
import { View, ActivityIndicator, StyleSheet } from "react-native";
import Constants from "expo-constants";
import { useAuth } from "../contexts/AuthContext";
import { useSubscription } from "../hooks/useSubscription";
import { useTrialStatus } from "../hooks/useTrialStatus";
import { useTheme } from "../hooks/useTheme";
import { isRevenueCatInitialized, loginRevenueCat } from "../lib/subscription";
import { getRequiredGate, canAccessUnlimitedFeatures } from "../utils/accessControl";
import { migrateTrialDataToSupabase } from "../utils/dataMigration";
import { performLegacyMigration, grantLifetimeEntitlement } from "../utils/legacyUserMigration";
import { PaywallModal } from "./PaywallModal";
import { SignInModal } from "./SignInModal";
import { qaLog } from "../utils/qaLog";

/**
 * Per-tab access gate for premium features (Journal, Prayers, Speakers).
 *
 * Replaces the old global PaywallModal + SignInModal gates from _layout.tsx.
 * Wraps the premium tab's content and shows the appropriate gate when access
 * is denied.
 *
 * When gated, children are NOT rendered (their hooks don't execute).
 * When open, children render normally.
 */

interface PremiumGateProps {
  children: React.ReactNode;
}

export const PremiumGate: React.FC<PremiumGateProps> = ({ children }) => {
  const { colors } = useTheme();
  const { user, isAuthenticated } = useAuth();
  const {
    status: subStatus,
    loading: subLoading,
    refresh: refreshSub,
  } = useSubscription(user?.id);
  const trialStatus = useTrialStatus();

  // Track previous auth state to detect fresh sign-ins
  const prevAuth = useRef(isAuthenticated);

  // After a purchase the paywall closes; we need to re-evaluate the gate and
  // potentially show the sign-in modal.  This state bridges that transition.
  const [purchaseCompleted, setPurchaseCompleted] = useState(false);

  const revenueCatActive = isRevenueCatInitialized();
  const stillLoading = subLoading || trialStatus.loading;

  // Dev / simulator bypass — allow dismissing modals for testing
  const isSimulator = !Constants.isDevice;
  const devBypass = __DEV__ || isSimulator;

  // ── Detect fresh sign-in → link RevenueCat + migrate data ──────────
  useEffect(() => {
    if (!prevAuth.current && isAuthenticated && user?.id) {
      (async () => {
        try {
          qaLog("PremiumGate", "Fresh sign-in detected, linking RevenueCat + migrating data");
          await loginRevenueCat(user.id);
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

  // ── Loading state ──────────────────────────────────────────────────────
  if (stillLoading) {
    return (
      <View style={[styles.centered, { backgroundColor: colors.background }]}>
        <ActivityIndicator size="large" color={colors.accent} />
      </View>
    );
  }

  // ── Compute gate ───────────────────────────────────────────────────────
  // When RevenueCat isn't configured (dev mode without API keys), treat
  // entitlement as satisfied — only the trial timer and auth matter.
  const gate = !revenueCatActive
    ? (trialStatus.isInTrial || isAuthenticated ? "none" as const : "none" as const)
    : getRequiredGate(subStatus, trialStatus, isAuthenticated);

  // ── No gate — render content ───────────────────────────────────────────
  if (gate === "none" && !purchaseCompleted) {
    return <>{children}</>;
  }

  // ── Paywall gate ───────────────────────────────────────────────────────
  if (gate === "paywall" && !purchaseCompleted) {
    return (
      <PaywallModal
        visible
        dismissable={devBypass}
        onClose={() => {
          refreshSub();
          setPurchaseCompleted(true);
        }}
      />
    );
  }

  // ── Sign-in gate ───────────────────────────────────────────────────────
  // Shown when device has entitlement but user isn't authenticated,
  // OR immediately after a purchase (purchaseCompleted === true).
  if (gate === "signin" || purchaseCompleted) {
    return (
      <SignInModal
        visible
        dismissable={devBypass}
        initialMode={gate === "signin" ? "signin" : undefined}
        onClose={() => {
          setPurchaseCompleted(false);
          refreshSub();
        }}
      />
    );
  }

  // Fallback (shouldn't reach here)
  return <>{children}</>;
};

const styles = StyleSheet.create({
  centered: {
    flex: 1,
    justifyContent: "center",
    alignItems: "center",
  },
});
