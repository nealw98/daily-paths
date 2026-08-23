import React, { useCallback, useEffect, useRef, useState } from "react";
import {
  ActivityIndicator,
  Linking,
  Modal,
  NativeScrollEvent,
  NativeSyntheticEvent,
  ScrollView,
  StyleSheet,
  Text,
  TouchableOpacity,
  useWindowDimensions,
  View,
} from "react-native";
import { SafeAreaView } from "react-native-safe-area-context";
import { StatusBar } from "expo-status-bar";
import { Ionicons } from "@expo/vector-icons";
import { LinearGradient } from "expo-linear-gradient";
import Purchases, { type PurchasesPackage } from "react-native-purchases";

import { fallbackColors as colors, fonts } from "../../constants/theme";
import {
  getRawEntitlements,
  purchasePackage,
  restorePurchases,
} from "../../lib/subscription";
import { clearSubscriptionOverride } from "../../utils/subscriptionOverride";
import { useSubscriptionContext } from "../../contexts/SubscriptionContext";
import { useAnalytics } from "../../utils/analytics";
import { qaLog } from "../../utils/qaLog";
import { isDeveloperDevice } from "../../utils/deviceIdentity";
import { setLifetimeOverride } from "../../utils/paidAppDetector";

const TARGET_OFFERING_ID = "android_unlock";
const FALLBACK_PRICE = "$4.99";

const REVIEWS = [
  {
    title: "Life saver",
    copy: "A little help to start your day or an anytime reminder throughout the day.",
    reviewer: "Ilww99",
  },
  {
    title: "Interesting Sharings",
    copy: "The daily readings are brief, interesting, practical, and I think about them more than once as I continue my day.",
    reviewer: "Patron of the Program",
  },
  {
    title: "Putting it all together…",
    copy: "I appreciate the space to collect my thoughts. This is really supportive of my journey.",
    reviewer: "noodleheadpig",
  },
  {
    title: "Great app",
    copy: "The daily reflections, prayers, and gratitude journal help keep me firmly planted in today.",
    reviewer: "roksteezy",
  },
] as const;

type BusyAction = "purchase" | "restore" | "dev" | null;

interface NativePaywallProps {
  visible: boolean;
  origin: "reflections" | "toolkit" | null;
  onClose: () => void;
  onAccessGranted: () => void;
}

export function NativePaywall({
  visible,
  origin,
  onClose,
  onAccessGranted,
}: NativePaywallProps) {
  const { width } = useWindowDimensions();
  const reviewWidth = Math.max(280, width - 40);
  const reviewScrollRef = useRef<ScrollView>(null);
  const shownForOpen = useRef(false);
  const [selectedPackage, setSelectedPackage] = useState<PurchasesPackage | null>(null);
  const [loadingPackage, setLoadingPackage] = useState(false);
  const [busyAction, setBusyAction] = useState<BusyAction>(null);
  const [message, setMessage] = useState<string | null>(null);
  const [reviewIndex, setReviewIndex] = useState(0);
  const [isDeveloper, setIsDeveloper] = useState(__DEV__);
  const { refresh, refreshLifetimeAccess } = useSubscriptionContext();
  const {
    trackPaywallShown,
    trackPaywallDismissed,
    trackPaywallPurchaseCompleted,
    trackPaywallPurchaseCancelled,
    trackRestoreInitiated,
    trackRestoreCompleted,
  } = useAnalytics();

  useEffect(() => {
    let active = true;
    void isDeveloperDevice().then((developer) => {
      if (active) setIsDeveloper(developer);
    });
    return () => {
      active = false;
    };
  }, []);

  const loadPackage = useCallback(async () => {
    setLoadingPackage(true);
    setMessage(null);
    try {
      const offerings = await Purchases.getOfferings();
      const offering = offerings.all?.[TARGET_OFFERING_ID] ?? null;
      const lifetimePackage =
        offering?.lifetime ??
        offering?.availablePackages.find((pkg) => pkg.packageType === "LIFETIME") ??
        null;

      qaLog("paywall", "Native paywall offering resolved", {
        origin,
        targetId: TARGET_OFFERING_ID,
        currentOfferingId: offerings.current?.identifier ?? null,
        offeringId: offering?.identifier ?? null,
        packageId: lifetimePackage?.identifier ?? null,
        productId: lifetimePackage?.product.identifier ?? null,
        price: lifetimePackage?.product.priceString ?? null,
      });

      setSelectedPackage(lifetimePackage);
      if (!lifetimePackage) {
        setMessage("Purchase is temporarily unavailable. Please try again.");
      }
    } catch (error) {
      qaLog("paywall", "Native paywall offering failed", { error: String(error) });
      setSelectedPackage(null);
      setMessage("Purchase is temporarily unavailable. Please try again.");
    } finally {
      setLoadingPackage(false);
    }
  }, [origin]);

  useEffect(() => {
    if (!visible) {
      shownForOpen.current = false;
      return;
    }
    if (shownForOpen.current) return;
    shownForOpen.current = true;
    setReviewIndex(0);
    setBusyAction(null);
    trackPaywallShown();
    void loadPackage();
  }, [loadPackage, trackPaywallShown, visible]);

  const finishAccess = useCallback(async (): Promise<boolean> => {
    const raw = await getRawEntitlements();
    const entitled = raw.hasLifetime || raw.hasUnlimited;
    if (!entitled) return false;
    await clearSubscriptionOverride();
    await refresh();
    onAccessGranted();
    return true;
  }, [onAccessGranted, refresh]);

  const restoreAccess = useCallback(async (): Promise<boolean> => {
    await restorePurchases();
    return finishAccess();
  }, [finishAccess]);

  const handlePurchase = useCallback(async () => {
    if (!selectedPackage || busyAction) return;
    setBusyAction("purchase");
    setMessage(null);
    try {
      const customerInfo = await purchasePackage(selectedPackage);
      if (!customerInfo) {
        trackPaywallPurchaseCancelled();
        return;
      }
      const entitled = await finishAccess();
      if (entitled) {
        trackPaywallPurchaseCompleted();
      } else {
        setMessage("Your purchase completed, but access is still syncing. Try Restore Purchase.");
      }
    } catch (error) {
      const errorText = String(error).toLowerCase();
      const alreadyOwned =
        errorText.includes("already") ||
        errorText.includes("owned") ||
        errorText.includes("itemalreadyowned");
      if (alreadyOwned) {
        try {
          const restored = await restoreAccess();
          if (restored) {
            trackPaywallPurchaseCompleted();
            return;
          }
        } catch (restoreError) {
          qaLog("paywall", "Native already-owned recovery failed", {
            error: String(restoreError),
          });
        }
      }
      qaLog("paywall", "Native purchase failed", { error: String(error) });
      trackPaywallPurchaseCancelled();
      setMessage("The purchase could not be completed. Please try again.");
    } finally {
      setBusyAction(null);
    }
  }, [
    busyAction,
    finishAccess,
    restoreAccess,
    selectedPackage,
    trackPaywallPurchaseCancelled,
    trackPaywallPurchaseCompleted,
  ]);

  const handleRestore = useCallback(async () => {
    if (busyAction) return;
    setBusyAction("restore");
    setMessage(null);
    trackRestoreInitiated();
    try {
      const restored = await restoreAccess();
      trackRestoreCompleted(restored);
      if (!restored) {
        setMessage("No previous purchase was found for this Google Play account.");
      }
    } catch (error) {
      qaLog("paywall", "Native restore failed", { error: String(error) });
      trackRestoreCompleted(false);
      setMessage("Your purchase could not be restored. Please try again.");
    } finally {
      setBusyAction(null);
    }
  }, [busyAction, restoreAccess, trackRestoreCompleted, trackRestoreInitiated]);

  const handleClose = useCallback(() => {
    if (busyAction) return;
    trackPaywallDismissed();
    onClose();
  }, [busyAction, onClose, trackPaywallDismissed]);

  const handleDevSkip = useCallback(async () => {
    if (!isDeveloper || busyAction) return;
    setBusyAction("dev");
    setMessage(null);
    try {
      await clearSubscriptionOverride();
      await setLifetimeOverride(true);
      await refreshLifetimeAccess();
      qaLog("paywall", "Developer skipped native paywall");
      onAccessGranted();
    } catch (error) {
      qaLog("paywall", "Developer skip failed", { error: String(error) });
      setMessage("Developer skip failed. Please try again.");
    } finally {
      setBusyAction(null);
    }
  }, [busyAction, isDeveloper, onAccessGranted, refreshLifetimeAccess]);

  const handleReviewScroll = (event: NativeSyntheticEvent<NativeScrollEvent>) => {
    const nextIndex = Math.round(event.nativeEvent.contentOffset.x / reviewWidth);
    setReviewIndex(Math.max(0, Math.min(REVIEWS.length - 1, nextIndex)));
  };

  const showReview = (index: number) => {
    setReviewIndex(index);
    reviewScrollRef.current?.scrollTo({ x: index * reviewWidth, animated: true });
  };

  const price = selectedPackage?.product.priceString ?? FALLBACK_PRICE;
  const purchaseDisabled = loadingPackage || !selectedPackage || busyAction !== null;
  const purchaseLabel =
    busyAction === "purchase"
      ? "Completing purchase…"
      : loadingPackage
        ? "Loading purchase…"
        : !selectedPackage
          ? "Purchase unavailable"
          : "Unlock everything";

  return (
    <Modal
      visible={visible}
      animationType="slide"
      presentationStyle="fullScreen"
      onRequestClose={handleClose}
    >
      <View style={styles.root}>
        <StatusBar style="light" backgroundColor={colors.secondary} />
        <SafeAreaView edges={["top"]} style={styles.headerSafeArea}>
          <View style={styles.header}>
            {isDeveloper ? (
              <TouchableOpacity
                activeOpacity={0.7}
                onPress={() => void handleDevSkip()}
                disabled={busyAction !== null}
                style={styles.headerSide}
                accessibilityRole="button"
                accessibilityLabel="Developer skip"
              >
                <Text style={styles.devSkipText}>Dev Skip</Text>
              </TouchableOpacity>
            ) : (
              <View style={styles.headerSide} />
            )}
            <Text style={styles.wordmark}>Daily Paths</Text>
            <TouchableOpacity
              activeOpacity={0.7}
              onPress={handleClose}
              disabled={busyAction !== null}
              style={[styles.headerSide, styles.headerSideRight]}
              accessibilityRole="button"
              accessibilityLabel="Close paywall"
            >
              <Ionicons name="close" size={24} color="rgba(255,255,255,0.88)" />
            </TouchableOpacity>
          </View>
        </SafeAreaView>

        <ScrollView
          style={styles.contentScroll}
          contentContainerStyle={styles.content}
          showsVerticalScrollIndicator={false}
        >
          <Text style={styles.title}>Lifetime access</Text>
          <Text style={styles.subtitle}>
            One-time payment. No subscription or recurring charges.
          </Text>

          <ScrollView
            ref={reviewScrollRef}
            horizontal
            pagingEnabled
            showsHorizontalScrollIndicator={false}
            decelerationRate="fast"
            snapToInterval={reviewWidth}
            onMomentumScrollEnd={handleReviewScroll}
            style={styles.reviewCarousel}
          >
            {REVIEWS.map((review) => (
              <View key={review.title} style={[styles.reviewSlide, { width: reviewWidth }]}>
                <View style={styles.reviewCard}>
                  <Text style={styles.stars} accessibilityLabel="5 out of 5 stars">
                    ★★★★★
                  </Text>
                  <Text style={styles.reviewTitle}>{review.title}</Text>
                  <Text style={styles.reviewCopy}>“{review.copy}”</Text>
                  <Text style={styles.reviewer}>— {review.reviewer}</Text>
                </View>
              </View>
            ))}
          </ScrollView>

          <View style={styles.dots} accessibilityRole="tablist">
            {REVIEWS.map((review, index) => (
              <TouchableOpacity
                key={review.title}
                onPress={() => showReview(index)}
                style={[styles.dot, reviewIndex === index && styles.dotActive]}
                accessibilityRole="tab"
                accessibilityLabel={`Review ${index + 1} of ${REVIEWS.length}`}
                accessibilityState={{ selected: reviewIndex === index }}
              />
            ))}
          </View>
        </ScrollView>

        <SafeAreaView edges={["bottom"]} style={styles.checkoutSafeArea}>
          <View style={styles.checkout}>
            {message ? (
              <View style={styles.messageRow} accessibilityLiveRegion="polite">
                <Text style={styles.message}>{message}</Text>
                {!selectedPackage && !loadingPackage ? (
                  <TouchableOpacity onPress={() => void loadPackage()} activeOpacity={0.7}>
                    <Text style={styles.retryText}>Try again</Text>
                  </TouchableOpacity>
                ) : null}
              </View>
            ) : null}
            <View style={styles.priceRow}>
              <Text style={styles.price}>{price}</Text>
              <Text style={styles.priceNote}>pay once</Text>
            </View>
            <TouchableOpacity
              activeOpacity={0.86}
              onPress={() => void handlePurchase()}
              disabled={purchaseDisabled}
              style={[styles.purchaseOuter, purchaseDisabled && styles.disabled]}
              accessibilityRole="button"
              accessibilityState={{ disabled: purchaseDisabled, busy: busyAction === "purchase" }}
            >
              <LinearGradient
                colors={[colors.heroGradientStart, colors.heroGradientEnd]}
                start={{ x: 0, y: 0 }}
                end={{ x: 1, y: 1 }}
                style={styles.purchaseButton}
              >
                {busyAction === "purchase" || loadingPackage ? (
                  <ActivityIndicator size="small" color="#FFFFFF" />
                ) : null}
                <Text style={styles.purchaseText}>{purchaseLabel}</Text>
              </LinearGradient>
            </TouchableOpacity>
            <View style={styles.secureRow}>
              <Ionicons name="lock-closed-outline" size={13} color={colors.onSurfaceVariant} />
              <Text style={styles.secureText}>Secure purchase through Google Play</Text>
            </View>
            <View style={styles.legalRow}>
              <TouchableOpacity
                activeOpacity={0.7}
                onPress={() => void handleRestore()}
                disabled={busyAction !== null}
              >
                <Text style={styles.legalText}>
                  {busyAction === "restore" ? "Restoring…" : "Restore Purchase"}
                </Text>
              </TouchableOpacity>
              <TouchableOpacity
                activeOpacity={0.7}
                onPress={() => Linking.openURL("https://play.google.com/intl/en_us/about/play-terms/")}
              >
                <Text style={styles.legalText}>Terms</Text>
              </TouchableOpacity>
              <TouchableOpacity
                activeOpacity={0.7}
                onPress={() => Linking.openURL("https://dailypaths.org/privacy")}
              >
                <Text style={styles.legalText}>Privacy</Text>
              </TouchableOpacity>
            </View>
          </View>
        </SafeAreaView>
      </View>
    </Modal>
  );
}

const styles = StyleSheet.create({
  root: { flex: 1, backgroundColor: colors.surface },
  headerSafeArea: { backgroundColor: colors.secondary },
  header: {
    minHeight: 62,
    paddingHorizontal: 16,
    paddingBottom: 13,
    flexDirection: "row",
    alignItems: "flex-end",
  },
  headerSide: {
    flex: 1,
    minHeight: 44,
    justifyContent: "flex-end",
    alignItems: "flex-start",
    paddingBottom: 3,
  },
  headerSideRight: { alignItems: "flex-end" },
  wordmark: {
    marginBottom: 3,
    fontFamily: fonts.cormorantGaramondSemiBoldItalic,
    fontSize: 22,
    lineHeight: 27,
    color: "rgba(255,255,255,0.96)",
  },
  devSkipText: {
    fontFamily: fonts.bodyFamilySemiBold,
    fontSize: 12,
    lineHeight: 18,
    color: "rgba(255,255,255,0.88)",
  },
  contentScroll: { flex: 1 },
  content: { paddingTop: 24, paddingBottom: 20 },
  title: {
    paddingHorizontal: 20,
    fontFamily: fonts.cormorantGaramondSemiBold,
    fontSize: 36,
    lineHeight: 43,
    letterSpacing: -0.55,
    color: colors.accent,
    textAlign: "center",
  },
  subtitle: {
    maxWidth: 320,
    marginTop: 7,
    paddingHorizontal: 20,
    alignSelf: "center",
    fontFamily: fonts.bodyFamily,
    fontSize: 14,
    lineHeight: 22,
    color: colors.onSurfaceVariant,
    textAlign: "center",
  },
  reviewCarousel: { marginTop: 22 },
  reviewSlide: { paddingHorizontal: 20 },
  reviewCard: {
    minHeight: 210,
    padding: 20,
    borderRadius: 17,
    borderWidth: StyleSheet.hairlineWidth,
    borderColor: "rgba(45,76,71,0.12)",
    backgroundColor: "#FFFFFF",
    shadowColor: colors.heroGradientStart,
    shadowOpacity: 0.09,
    shadowRadius: 12,
    shadowOffset: { width: 0, height: 4 },
    elevation: 3,
  },
  stars: {
    fontFamily: fonts.bodyFamily,
    fontSize: 17,
    lineHeight: 22,
    letterSpacing: 2,
    color: "#D6922B",
  },
  reviewTitle: {
    marginTop: 10,
    fontFamily: fonts.bodyFamilySemiBold,
    fontSize: 16,
    lineHeight: 22,
    color: colors.onSurface,
  },
  reviewCopy: {
    marginTop: 7,
    fontFamily: fonts.loraRegular,
    fontSize: 16,
    lineHeight: 25,
    color: colors.onSurface,
  },
  reviewer: {
    marginTop: 10,
    fontFamily: fonts.bodyFamily,
    fontSize: 12,
    lineHeight: 18,
    color: colors.onSurfaceVariant,
  },
  dots: {
    minHeight: 38,
    flexDirection: "row",
    justifyContent: "center",
    alignItems: "center",
    gap: 7,
  },
  dot: { width: 8, height: 8, borderRadius: 999, backgroundColor: colors.outlineVariant },
  dotActive: { width: 22, backgroundColor: colors.accent },
  checkoutSafeArea: {
    backgroundColor: colors.surface,
    borderTopWidth: StyleSheet.hairlineWidth,
    borderTopColor: "rgba(45,76,71,0.11)",
  },
  checkout: { paddingHorizontal: 20, paddingTop: 15, paddingBottom: 10 },
  messageRow: { marginBottom: 9, alignItems: "center" },
  message: {
    fontFamily: fonts.bodyFamily,
    fontSize: 12,
    lineHeight: 18,
    color: colors.danger,
    textAlign: "center",
  },
  retryText: {
    marginTop: 3,
    fontFamily: fonts.bodyFamilySemiBold,
    fontSize: 12,
    lineHeight: 18,
    color: colors.accent,
    textDecorationLine: "underline",
  },
  priceRow: { flexDirection: "row", justifyContent: "center", alignItems: "baseline", gap: 8 },
  price: {
    fontFamily: fonts.bodyFamilySemiBold,
    fontSize: 27,
    lineHeight: 32,
    color: colors.onSurface,
  },
  priceNote: {
    fontFamily: fonts.bodyFamily,
    fontSize: 13,
    lineHeight: 20,
    color: colors.onSurfaceVariant,
  },
  purchaseOuter: { marginTop: 12, borderRadius: 13, overflow: "hidden" },
  purchaseButton: {
    minHeight: 56,
    paddingHorizontal: 18,
    flexDirection: "row",
    justifyContent: "center",
    alignItems: "center",
    gap: 9,
  },
  purchaseText: {
    fontFamily: fonts.bodyFamilySemiBold,
    fontSize: 17,
    lineHeight: 24,
    color: "#FFFFFF",
    textAlign: "center",
  },
  disabled: { opacity: 0.66 },
  secureRow: {
    marginTop: 8,
    flexDirection: "row",
    justifyContent: "center",
    alignItems: "center",
    gap: 5,
  },
  secureText: {
    fontFamily: fonts.bodyFamily,
    fontSize: 11,
    lineHeight: 17,
    color: colors.onSurfaceVariant,
  },
  legalRow: {
    marginTop: 9,
    flexDirection: "row",
    justifyContent: "center",
    alignItems: "center",
    gap: 18,
  },
  legalText: {
    fontFamily: fonts.bodyFamily,
    fontSize: 11,
    lineHeight: 17,
    color: colors.onSurfaceVariant,
    textDecorationLine: "underline",
  },
});
