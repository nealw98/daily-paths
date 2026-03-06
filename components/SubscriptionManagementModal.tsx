import React, { useState, useEffect, useRef, useMemo, useCallback } from "react";
import {
  View,
  Text,
  TouchableOpacity,
  StyleSheet,
  Modal,
  ActivityIndicator,
  Animated,
  Platform,
} from "react-native";
import Purchases from "react-native-purchases";
import RevenueCatUI from "react-native-purchases-ui";
import { Ionicons } from "@expo/vector-icons";
import { fonts } from "../constants/theme";
import { useTheme } from "../hooks/useTheme";
import { useSubscription } from "../hooks/useSubscription";
import { isRevenueCatInitialized, getOfferings } from "../lib/subscription";
import type { PurchasesPackage } from "react-native-purchases";

// Must match RevenueCat dashboard
const ENTITLEMENT_ID = "unlimited";
const LIFETIME_ENTITLEMENT_ID = "lifetime";

// ─── Inline Message Types ──────────────────────────────────────────────────

type InlineMessage =
  | { type: "already"; plan: "Monthly" | "Annual" }
  | { type: "switch"; from: string; to: string; price: string; pkg: PurchasesPackage }
  | { type: "restore-success" }
  | { type: "restore-nothing" }
  | { type: "restore-error" }
  | { type: "purchase-error" };

// ─── Props ─────────────────────────────────────────────────────────────────

interface Props {
  visible: boolean;
  onClose: () => void;
  isLegacy: boolean;
  trialDaysRemaining: number;
}

// ─── Component ─────────────────────────────────────────────────────────────

export const SubscriptionManagementModal: React.FC<Props> = ({
  visible,
  onClose,
  isLegacy,
  trialDaysRemaining,
}) => {
  const { colors, isDark } = useTheme();
  const { status, packages, purchase, refresh, purchasing } = useSubscription();

  // Local state
  const [localLoading, setLocalLoading] = useState(true);
  const [loadError, setLoadError] = useState(false);
  const [inlineMessage, setInlineMessage] = useState<InlineMessage | null>(null);
  const [restoring, setRestoring] = useState(false);
  const [isLegacyLocal, setIsLegacyLocal] = useState(isLegacy);
  const [localPackages, setLocalPackages] = useState<PurchasesPackage[]>([]);

  // Animation
  const fadeAnim = useRef(new Animated.Value(0)).current;

  // Auto-dismiss timer ref
  const autoDismissTimer = useRef<ReturnType<typeof setTimeout> | null>(null);

  // ── Derived state ──────────────────────────────────────────────────────

  const effectiveIsLegacy = isLegacyLocal || status.isLegacy;

  // Use context packages if available, fall back to locally fetched
  const resolvedPackages = packages.length > 0 ? packages : localPackages;

  const monthlyPkg = resolvedPackages.find(
    (p) => p.packageType === "MONTHLY" || p.identifier === "$rc_monthly"
  );
  const annualPkg = resolvedPackages.find(
    (p) => p.packageType === "ANNUAL" || p.identifier === "$rc_annual"
  );

  const currentPlan: "monthly" | "annual" | null = useMemo(() => {
    if (!status.isSubscribed || status.isLegacy) return null;
    const pid = (status.productIdentifier ?? "").toLowerCase();
    if (pid.includes("annual") || pid.includes("yearly")) return "annual";
    if (pid.includes("monthly")) return "monthly";
    return null;
  }, [status]);

  const showTrialBanner = trialDaysRemaining > 0 && !status.isSubscribed;

  const trialBannerText = useMemo(() => {
    if (trialDaysRemaining === 0) return "Your free premium trial ends today";
    if (trialDaysRemaining === 1) return "Your free premium trial ends tomorrow";
    return `Your free premium trial ends in ${trialDaysRemaining} days`;
  }, [trialDaysRemaining]);

  // ── Load on open ───────────────────────────────────────────────────────

  useEffect(() => {
    if (!visible) {
      setInlineMessage(null);
      setLoadError(false);
      if (autoDismissTimer.current) {
        clearTimeout(autoDismissTimer.current);
        autoDismissTimer.current = null;
      }
      return;
    }

    let cancelled = false;
    setLocalLoading(true);
    setLoadError(false);
    setInlineMessage(null);
    setIsLegacyLocal(isLegacy);

    (async () => {
      try {
        await refresh();

        // Fetch packages if context hasn't loaded them yet
        if (isRevenueCatInitialized() && packages.length === 0) {
          try {
            const pkgs = await getOfferings();
            if (!cancelled) setLocalPackages(pkgs);
          } catch {
            // Non-critical — cards will show disabled
          }
        }
      } catch {
        if (!cancelled) setLoadError(true);
      }
      if (!cancelled) setLocalLoading(false);
    })();

    return () => {
      cancelled = true;
    };
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [visible]);

  // ── Inline message fade animation ──────────────────────────────────────

  useEffect(() => {
    if (inlineMessage) {
      fadeAnim.setValue(0);
      Animated.timing(fadeAnim, {
        toValue: 1,
        duration: 200,
        useNativeDriver: true,
      }).start();
    }
  }, [inlineMessage, fadeAnim]);

  // ── Cleanup timer on unmount ───────────────────────────────────────────

  useEffect(() => {
    return () => {
      if (autoDismissTimer.current) clearTimeout(autoDismissTimer.current);
    };
  }, []);

  // ── Handlers ───────────────────────────────────────────────────────────

  const handlePurchase = useCallback(
    async (pkg: PurchasesPackage) => {
      try {
        const success = await purchase(pkg);
        if (success) {
          setInlineMessage(null);
        }
        // false = user cancelled → do nothing silently
      } catch {
        // Real purchase error
        setInlineMessage({ type: "purchase-error" });
      }
    },
    [purchase]
  );

  const handleCardTap = useCallback(
    (plan: "monthly" | "annual") => {
      const pkg = plan === "annual" ? annualPkg : monthlyPkg;
      if (!pkg) return;

      // No active subscription → straight to checkout
      if (!status.isSubscribed || status.isLegacy) {
        handlePurchase(pkg);
        return;
      }

      // Already on this plan
      if (currentPlan === plan) {
        setInlineMessage({
          type: "already",
          plan: plan === "annual" ? "Annual" : "Monthly",
        });
        return;
      }

      // Switch plan
      const fromName = currentPlan === "annual" ? "Annual" : "Monthly";
      const toName = plan === "annual" ? "Annual" : "Monthly";
      const price =
        plan === "annual"
          ? `${annualPkg?.product.priceString}/year`
          : `${monthlyPkg?.product.priceString}/month`;

      setInlineMessage({ type: "switch", from: fromName, to: toName, price, pkg });
    },
    [status, currentPlan, annualPkg, monthlyPkg, handlePurchase]
  );

  const handleRestore = useCallback(async () => {
    if (!isRevenueCatInitialized()) {
      setInlineMessage({ type: "restore-error" });
      return;
    }

    setRestoring(true);
    setInlineMessage(null);

    try {
      const customerInfo = await Promise.race([
        Purchases.restorePurchases(),
        new Promise<never>((_, reject) =>
          setTimeout(() => reject(new Error("timeout")), 15000)
        ),
      ]);

      // Outcome 1: Lifetime restored
      if (customerInfo.entitlements.active[LIFETIME_ENTITLEMENT_ID]) {
        setIsLegacyLocal(true);
        await refresh();
        setRestoring(false);
        return;
      }

      // Outcome 2: Subscription restored
      if (customerInfo.entitlements.active[ENTITLEMENT_ID]) {
        await refresh();
        setInlineMessage({ type: "restore-success" });
        autoDismissTimer.current = setTimeout(() => onClose(), 2000);
        setRestoring(false);
        return;
      }

      // Outcome 3: Nothing to restore
      setInlineMessage({ type: "restore-nothing" });
    } catch {
      // Outcome 4: Error
      setInlineMessage({ type: "restore-error" });
    }

    setRestoring(false);
  }, [refresh, onClose]);

  const handleManageSubscription = useCallback(() => {
    // Close modal first — presentCustomerCenter fails when called from inside a Modal
    onClose();
    setTimeout(async () => {
      try {
        await RevenueCatUI.presentCustomerCenter({
          callbacks: {
            onRestoreCompleted: () => {
              refresh();
            },
          },
        });
        await refresh();
      } catch {
        // Customer Center failed to present — no action needed
      }
    }, 400);
  }, [refresh, onClose]);

  const handleRetryLoad = useCallback(() => {
    setLoadError(false);
    setLocalLoading(true);

    (async () => {
      try {
        await refresh();

        if (isRevenueCatInitialized() && packages.length === 0) {
          try {
            const pkgs = await getOfferings();
            setLocalPackages(pkgs);
          } catch {
            // Non-critical
          }
        }
      } catch {
        setLoadError(true);
      }
      setLocalLoading(false);
    })();
  }, [refresh, packages.length]);

  // ── Inline message renderer ────────────────────────────────────────────

  const renderInlineMessage = () => {
    if (!inlineMessage) return null;

    let content: React.ReactNode;
    let bgColor = colors.cardBackground;
    let borderClr = colors.border;

    switch (inlineMessage.type) {
      case "already":
        content = (
          <TouchableOpacity
            onPress={() => setInlineMessage(null)}
            activeOpacity={0.8}
          >
            <Text style={[styles.inlineText, { color: colors.text }]}>
              You're already on the {inlineMessage.plan} plan.
            </Text>
          </TouchableOpacity>
        );
        break;

      case "switch":
        content = (
          <>
            <Text style={[styles.inlineText, { color: colors.text }]}>
              Switch from {inlineMessage.from} to {inlineMessage.to} at{" "}
              {inlineMessage.price}?
            </Text>
            <View style={styles.inlineButtons}>
              <TouchableOpacity
                style={[styles.inlineBtnPrimary, { backgroundColor: colors.accent }]}
                onPress={() => {
                  setInlineMessage(null);
                  handlePurchase(inlineMessage.pkg);
                }}
              >
                <Text style={[styles.inlineBtnText, { color: colors.textOnAccent }]}>
                  Yes, Switch
                </Text>
              </TouchableOpacity>
              <TouchableOpacity
                style={[styles.inlineBtnGhost, { borderColor: colors.border }]}
                onPress={() => setInlineMessage(null)}
              >
                <Text style={[styles.inlineBtnText, { color: colors.text }]}>
                  Never mind
                </Text>
              </TouchableOpacity>
            </View>
          </>
        );
        break;

      case "restore-success":
        content = (
          <Text style={[styles.inlineText, { color: colors.accent }]}>
            Subscription restored!
          </Text>
        );
        break;

      case "restore-nothing":
        content = (
          <>
            <Text style={[styles.inlineText, { color: colors.text }]}>
              No purchases found to restore.
            </Text>
            <TouchableOpacity
              style={[
                styles.inlineBtnPrimary,
                { backgroundColor: colors.accent, alignSelf: "flex-start", marginTop: 8 },
              ]}
              onPress={() => setInlineMessage(null)}
            >
              <Text style={[styles.inlineBtnText, { color: colors.textOnAccent }]}>
                Got it
              </Text>
            </TouchableOpacity>
          </>
        );
        break;

      case "restore-error":
        content = (
          <>
            <Text style={[styles.inlineText, { color: colors.danger }]}>
              Something went wrong. Please try again.
            </Text>
            <TouchableOpacity
              style={[
                styles.inlineBtnPrimary,
                { backgroundColor: colors.accent, alignSelf: "flex-start", marginTop: 8 },
              ]}
              onPress={handleRestore}
            >
              <Text style={[styles.inlineBtnText, { color: colors.textOnAccent }]}>
                Try Again
              </Text>
            </TouchableOpacity>
          </>
        );
        break;

      case "purchase-error":
        content = (
          <>
            <Text style={[styles.inlineText, { color: colors.danger }]}>
              Something went wrong with your purchase. Please try again.
            </Text>
            <TouchableOpacity
              style={[
                styles.inlineBtnPrimary,
                { backgroundColor: colors.accent, alignSelf: "flex-start", marginTop: 8 },
              ]}
              onPress={() => setInlineMessage(null)}
            >
              <Text style={[styles.inlineBtnText, { color: colors.textOnAccent }]}>
                Got it
              </Text>
            </TouchableOpacity>
          </>
        );
        break;

    }

    return (
      <Animated.View
        style={[
          styles.inlineBox,
          { backgroundColor: bgColor, borderColor: borderClr, opacity: fadeAnim },
        ]}
      >
        {content}
      </Animated.View>
    );
  };

  // ── Render ─────────────────────────────────────────────────────────────

  return (
    <Modal
      visible={visible}
      transparent
      animationType="slide"
      onRequestClose={onClose}
    >
      <View style={[styles.container, { backgroundColor: colors.backdrop }]}>
        <View style={[styles.content, { backgroundColor: colors.background }]}>
          {/* Header */}
          <View style={styles.header}>
            <Text style={[styles.headerTitle, { color: colors.text }]}>
              Subscription
            </Text>
            <TouchableOpacity onPress={onClose} style={styles.closeButton}>
              <Ionicons name="close" size={24} color={colors.textSecondary} />
            </TouchableOpacity>
          </View>

          {/* Body */}
          {localLoading ? (
            <View style={styles.centerContainer}>
              <ActivityIndicator size="large" color={colors.accent} />
            </View>
          ) : loadError ? (
            <View style={styles.centerContainer}>
              <Text style={[styles.errorText, { color: colors.text }]}>
                Unable to load subscription info. Please try again.
              </Text>
              <TouchableOpacity
                style={[styles.retryButton, { backgroundColor: colors.accent }]}
                onPress={handleRetryLoad}
              >
                <Text style={[styles.retryButtonText, { color: colors.textOnAccent }]}>
                  Retry
                </Text>
              </TouchableOpacity>
            </View>
          ) : effectiveIsLegacy ? (
            /* Legacy State */
            <View style={styles.legacyContainer}>
              <Text style={styles.legacyEmoji}>⭐</Text>
              <Text style={[styles.legacyTitle, { color: colors.text }]}>
                Lifetime Access
              </Text>
              <Text style={[styles.legacyDescription, { color: colors.textSecondary }]}>
                As a founding member, you have free lifetime access to all Daily
                Paths features. Thank you for your support.
              </Text>
            </View>
          ) : (
            /* Non-legacy states */
            <View style={styles.body}>
              {/* Trial Banner */}
              {showTrialBanner && (
                <View
                  style={[
                    styles.trialBanner,
                    { backgroundColor: colors.cardBackground },
                  ]}
                >
                  <Ionicons name="time-outline" size={18} color={colors.accent} />
                  <Text style={[styles.trialText, { color: colors.text }]}>
                    {trialBannerText}
                  </Text>
                </View>
              )}

              {/* Plan Cards */}
              <View style={styles.planCards}>
                {/* Annual Card — Left */}
                <TouchableOpacity
                  style={[
                    styles.planCard,
                    {
                      borderColor: colors.accent,
                      backgroundColor: colors.background,
                    },
                  ]}
                  onPress={() => handleCardTap("annual")}
                  disabled={!annualPkg || purchasing}
                  activeOpacity={0.7}
                >
                  <View
                    style={[
                      styles.bestValuePill,
                      { backgroundColor: colors.accent },
                    ]}
                  >
                    <Text
                      style={[
                        styles.bestValueText,
                        { color: colors.textOnAccent },
                      ]}
                    >
                      BEST VALUE
                    </Text>
                  </View>
                  <Text style={[styles.planName, { color: colors.text }]}>
                    Annual
                  </Text>
                  <Text style={[styles.planPrice, { color: colors.text }]}>
                    {annualPkg
                      ? `${annualPkg.product.priceString}/year`
                      : "\u2014"}
                  </Text>
                </TouchableOpacity>

                {/* Monthly Card — Right */}
                <TouchableOpacity
                  style={[
                    styles.planCard,
                    {
                      borderColor: colors.border,
                      backgroundColor: colors.background,
                    },
                  ]}
                  onPress={() => handleCardTap("monthly")}
                  disabled={!monthlyPkg || purchasing}
                  activeOpacity={0.7}
                >
                  <Text style={[styles.planName, { color: colors.text }]}>
                    Monthly
                  </Text>
                  <Text style={[styles.planPrice, { color: colors.text }]}>
                    {monthlyPkg
                      ? `${monthlyPkg.product.priceString}/month`
                      : "\u2014"}
                  </Text>
                </TouchableOpacity>
              </View>

              {/* Inline Message */}
              {renderInlineMessage()}

              {/* Bottom Row */}
              <View style={styles.bottomRow}>
                <TouchableOpacity
                  onPress={handleRestore}
                  disabled={restoring}
                  activeOpacity={0.7}
                >
                  <Text
                    style={[styles.restoreText, { color: colors.textSecondary }]}
                  >
                    {restoring ? "Restoring..." : "Restore Purchases"}
                  </Text>
                </TouchableOpacity>
                <TouchableOpacity onPress={handleManageSubscription} activeOpacity={0.7}>
                  <Text style={[styles.cancelText, { color: colors.danger }]}>
                    Cancel Subscription
                  </Text>
                </TouchableOpacity>
              </View>
            </View>
          )}
        </View>
      </View>
    </Modal>
  );
};

// ─── Styles ──────────────────────────────────────────────────────────────────

const styles = StyleSheet.create({
  container: {
    flex: 1,
    justifyContent: "flex-end",
  },
  content: {
    borderTopLeftRadius: 20,
    borderTopRightRadius: 20,
    paddingBottom: 34,
  },
  header: {
    flexDirection: "row",
    alignItems: "center",
    justifyContent: "space-between",
    paddingHorizontal: 24,
    paddingTop: 20,
    paddingBottom: 16,
  },
  headerTitle: {
    fontFamily: fonts.headerFamily,
    fontSize: 20,
  },
  closeButton: {
    width: 36,
    height: 36,
    borderRadius: 18,
    alignItems: "center",
    justifyContent: "center",
  },

  /* Loading / Error */
  centerContainer: {
    alignItems: "center",
    justifyContent: "center",
    paddingVertical: 60,
    paddingHorizontal: 24,
  },
  errorText: {
    fontFamily: fonts.bodyFamilyRegular,
    fontSize: 15,
    textAlign: "center",
    marginBottom: 16,
  },
  retryButton: {
    paddingHorizontal: 24,
    paddingVertical: 10,
    borderRadius: 10,
  },
  retryButtonText: {
    fontFamily: fonts.bodyFamilyRegular,
    fontSize: 15,
    fontWeight: "600",
  },

  /* Legacy */
  legacyContainer: {
    alignItems: "center",
    paddingHorizontal: 24,
    paddingVertical: 40,
  },
  legacyEmoji: {
    fontSize: 40,
    marginBottom: 12,
  },
  legacyTitle: {
    fontFamily: fonts.headerFamily,
    fontSize: 24,
    marginBottom: 12,
  },
  legacyDescription: {
    fontFamily: fonts.bodyFamilyRegular,
    fontSize: 15,
    textAlign: "center",
    lineHeight: 22,
  },

  /* Body */
  body: {
    paddingHorizontal: 24,
  },

  /* Trial Banner */
  trialBanner: {
    flexDirection: "row",
    alignItems: "center",
    justifyContent: "center",
    gap: 8,
    paddingVertical: 10,
    paddingHorizontal: 16,
    borderRadius: 12,
    marginBottom: 20,
  },
  trialText: {
    fontFamily: fonts.bodyFamilyRegular,
    fontSize: 14,
    fontWeight: "600",
  },

  /* Plan Cards */
  planCards: {
    flexDirection: "row",
    gap: 12,
    marginBottom: 16,
  },
  planCard: {
    flex: 1,
    borderWidth: 2,
    borderRadius: 16,
    padding: 16,
    alignItems: "center",
  },
  bestValuePill: {
    paddingHorizontal: 10,
    paddingVertical: 4,
    borderRadius: 12,
    marginBottom: 8,
  },
  bestValueText: {
    fontSize: 11,
    fontWeight: "700",
    textTransform: "uppercase",
  },
  planName: {
    fontFamily: fonts.headerFamily,
    fontSize: 22,
    marginBottom: 4,
  },
  planPrice: {
    fontFamily: fonts.bodyFamilyRegular,
    fontSize: 14,
    fontWeight: "700",
  },

  /* Inline Message */
  inlineBox: {
    borderWidth: 1,
    borderRadius: 12,
    padding: 16,
    marginBottom: 16,
  },
  inlineText: {
    fontFamily: fonts.bodyFamilyRegular,
    fontSize: 14,
    lineHeight: 20,
  },
  inlineButtons: {
    flexDirection: "row",
    gap: 12,
    marginTop: 12,
  },
  inlineBtnPrimary: {
    paddingHorizontal: 16,
    paddingVertical: 10,
    borderRadius: 10,
  },
  inlineBtnGhost: {
    paddingHorizontal: 16,
    paddingVertical: 10,
    borderRadius: 10,
    borderWidth: 1,
  },
  inlineBtnText: {
    fontFamily: fonts.bodyFamilyRegular,
    fontSize: 14,
    fontWeight: "600",
  },

  /* Bottom Row */
  bottomRow: {
    flexDirection: "row",
    justifyContent: "space-between",
    alignItems: "center",
    paddingTop: 8,
  },
  restoreText: {
    fontFamily: fonts.bodyFamilyRegular,
    fontSize: 14,
  },
  cancelText: {
    fontFamily: fonts.bodyFamilyRegular,
    fontSize: 14,
  },
});
