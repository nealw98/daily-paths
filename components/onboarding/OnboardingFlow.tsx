import React, { useCallback, useEffect, useRef, useState } from "react";
import {
  AccessibilityInfo,
  Animated,
  BackHandler,
  ImageBackground,
  Platform,
  Pressable,
  ScrollView,
  StyleSheet,
  Text,
  TouchableOpacity,
  useWindowDimensions,
  View,
} from "react-native";
import { SafeAreaView } from "react-native-safe-area-context";
import { StatusBar } from "expo-status-bar";
import { LinearGradient } from "expo-linear-gradient";
import { Ionicons } from "@expo/vector-icons";
import Purchases from "react-native-purchases";
import RevenueCatUI, { PAYWALL_RESULT } from "react-native-purchases-ui";

import { fallbackColors as colors, fonts } from "../../constants/theme";
import { ONBOARDING_SAMPLE } from "../../constants/onboardingSample";
import {
  Book,
  Feather,
  LeafOnWater,
  Microphone,
  MoonOnWater,
  Seedling,
  SoftExhale,
} from "../icons";
import { useSubscriptionContext } from "../../contexts/SubscriptionContext";
import { useAnalytics } from "../../utils/analytics";
import { getRawEntitlements, restorePurchases } from "../../lib/subscription";
import { clearSubscriptionOverride } from "../../utils/subscriptionOverride";
import { qaLog } from "../../utils/qaLog";

const TARGET_PAYWALL_OFFERING_ID = "android_unlock";
const SAMPLE_IMAGE = require("../../assets/reflections/reflections-21.webp");

type Page = "reflections" | "toolkit";
type CardRect = { top: number; left: number; width: number; height: number };
type FeatureIcon = React.ComponentType<{
  size?: number;
  color?: string;
  strokeWidth?: number;
}>;

const FEATURES: Array<{ label: string; Icon: FeatureIcon }> = [
  { label: "Private journal", Icon: Feather },
  { label: "Gratitude practice", Icon: Seedling },
  { label: "Spot check tool", Icon: SoftExhale },
  { label: "Nightly Reviews", Icon: MoonOnWater },
  { label: "Essential prayers", Icon: LeafOnWater },
  { label: "Speaker talks & downloads", Icon: Microphone },
];

export function OnboardingFlow() {
  const [page, setPage] = useState<Page>("reflections");
  const [previewVisible, setPreviewVisible] = useState(false);
  const [cardRect, setCardRect] = useState<CardRect | null>(null);
  const [reduceMotion, setReduceMotion] = useState(false);
  const [paywallBusy, setPaywallBusy] = useState(false);
  const previewProgress = useRef(new Animated.Value(0)).current;
  const cardRef = useRef<View>(null);
  const lastTrackedPage = useRef<Page | null>(null);
  const { width: windowWidth, height: windowHeight } = useWindowDimensions();
  const { refresh } = useSubscriptionContext();
  const {
    trackPaywallShown,
    trackPaywallDismissed,
    trackPaywallPurchaseCompleted,
    trackPaywallPurchaseCancelled,
    trackRestoreCompleted,
    trackOnboardingStepViewed,
    trackOnboardingSampleOpened,
    trackOnboardingSampleClosed,
    trackOnboardingCheckoutTapped,
  } = useAnalytics();

  useEffect(() => {
    if (lastTrackedPage.current === page) return;
    lastTrackedPage.current = page;
    trackOnboardingStepViewed(page);
  }, [page, trackOnboardingStepViewed]);

  useEffect(() => {
    AccessibilityInfo.isReduceMotionEnabled().then(setReduceMotion).catch(() => {});
    const subscription = AccessibilityInfo.addEventListener(
      "reduceMotionChanged",
      setReduceMotion,
    );
    return () => subscription.remove();
  }, []);

  const openPreview = useCallback(() => {
    if (!cardRef.current || previewVisible) return;
    cardRef.current.measureInWindow((left, top, width, height) => {
      setCardRect({ left, top, width, height });
      previewProgress.setValue(reduceMotion ? 1 : 0);
      setPreviewVisible(true);
      qaLog("onboarding", "Sample reflection opened");
      trackOnboardingSampleOpened();
      if (!reduceMotion) {
        requestAnimationFrame(() => {
          Animated.timing(previewProgress, {
            toValue: 1,
            duration: 300,
            useNativeDriver: false,
          }).start();
        });
      }
    });
  }, [previewProgress, previewVisible, reduceMotion, trackOnboardingSampleOpened]);

  const closePreview = useCallback(() => {
    qaLog("onboarding", "Sample reflection closed");
    trackOnboardingSampleClosed();
    if (reduceMotion) {
      setPreviewVisible(false);
      previewProgress.setValue(0);
      return;
    }
    Animated.timing(previewProgress, {
      toValue: 0,
      duration: 280,
      useNativeDriver: false,
    }).start(({ finished }) => {
      if (finished) setPreviewVisible(false);
    });
  }, [previewProgress, reduceMotion, trackOnboardingSampleClosed]);

  useEffect(() => {
    if (!previewVisible) return;
    const subscription = BackHandler.addEventListener("hardwareBackPress", () => {
      closePreview();
      return true;
    });
    return () => subscription.remove();
  }, [closePreview, previewVisible]);

  useEffect(() => {
    if (previewVisible || page !== "toolkit") return;
    const subscription = BackHandler.addEventListener("hardwareBackPress", () => {
      setPage("reflections");
      return true;
    });
    return () => subscription.remove();
  }, [page, previewVisible]);

  const presentPaywall = useCallback(
    async (origin: Page) => {
      if (Platform.OS !== "android" || paywallBusy) return;
      setPaywallBusy(true);
      qaLog("onboarding", "Opening RevenueCat paywall", { origin });
      trackOnboardingCheckoutTapped(origin);
      try {
        trackPaywallShown();
        const offerings = await Purchases.getOfferings();
        const offering = offerings.all?.[TARGET_PAYWALL_OFFERING_ID] ?? null;
        qaLog("paywall", "Onboarding offering resolved", {
          targetId: TARGET_PAYWALL_OFFERING_ID,
          found: !!offering,
          currentId: offerings.current?.identifier ?? null,
        });
        const result = offering
          ? await RevenueCatUI.presentPaywall({ offering })
          : await RevenueCatUI.presentPaywall();

        if (result === PAYWALL_RESULT.PURCHASED) {
          trackPaywallPurchaseCompleted();
          const raw = await getRawEntitlements();
          if (raw.hasLifetime || raw.hasUnlimited) {
            await clearSubscriptionOverride();
          }
          await refresh();
        } else if (result === PAYWALL_RESULT.RESTORED) {
          trackRestoreCompleted(true);
          const raw = await getRawEntitlements();
          if (raw.hasLifetime || raw.hasUnlimited) {
            await clearSubscriptionOverride();
          }
          await refresh();
        } else {
          trackPaywallPurchaseCancelled();
          trackPaywallDismissed();
          qaLog("onboarding", "Paywall closed; returning to origin", { origin, result });
        }
      } catch (error) {
        const errorText = String(error).toLowerCase();
        const alreadyOwned =
          errorText.includes("already") ||
          errorText.includes("owned") ||
          errorText.includes("itemalreadyowned");
        if (alreadyOwned) {
          try {
            await restorePurchases();
            const raw = await getRawEntitlements();
            if (raw.hasLifetime || raw.hasUnlimited) {
              await clearSubscriptionOverride();
            }
            await refresh();
            trackPaywallPurchaseCompleted();
          } catch (restoreError) {
            qaLog("onboarding", "Already-owned recovery failed", {
              error: String(restoreError),
            });
            trackPaywallPurchaseCancelled();
          }
        } else {
          qaLog("onboarding", "RevenueCat paywall failed", { error: String(error) });
          trackPaywallPurchaseCancelled();
        }
      } finally {
        setPaywallBusy(false);
      }
    },
    [
      paywallBusy,
      refresh,
      trackPaywallDismissed,
      trackPaywallPurchaseCancelled,
      trackPaywallPurchaseCompleted,
      trackPaywallShown,
      trackRestoreCompleted,
      trackOnboardingCheckoutTapped,
    ],
  );

  const rect = cardRect ?? {
    top: Math.round(windowHeight * 0.28),
    left: 16,
    width: windowWidth - 32,
    height: Math.round(windowHeight * 0.43),
  };

  return (
    <View style={styles.root}>
      <StatusBar style="light" backgroundColor={colors.secondary} />
      {page === "reflections" ? (
        <ReflectionsPage
          cardRef={cardRef}
          onOpenPreview={openPreview}
          onContinue={() => {
            qaLog("onboarding", "Advanced to toolkit page");
            setPage("toolkit");
          }}
          onSkip={() => void presentPaywall("reflections")}
          paywallBusy={paywallBusy}
        />
      ) : (
        <ToolkitPage
          onBack={() => setPage("reflections")}
          onUnlock={() => void presentPaywall("toolkit")}
          paywallBusy={paywallBusy}
        />
      )}

      {previewVisible ? (
        <Animated.View
          style={[
            styles.previewOverlay,
            {
              top: previewProgress.interpolate({
                inputRange: [0, 1],
                outputRange: [rect.top, 0],
              }),
              left: previewProgress.interpolate({
                inputRange: [0, 1],
                outputRange: [rect.left, 0],
              }),
              width: previewProgress.interpolate({
                inputRange: [0, 1],
                outputRange: [rect.width, windowWidth],
              }),
              height: previewProgress.interpolate({
                inputRange: [0, 1],
                outputRange: [rect.height, windowHeight],
              }),
              borderRadius: previewProgress.interpolate({
                inputRange: [0, 1],
                outputRange: [16, 0],
              }),
              opacity: previewProgress.interpolate({
                inputRange: [0, 0.04, 1],
                outputRange: [0, 1, 1],
              }),
            },
          ]}
        >
          <Animated.View
            style={[
              styles.previewContent,
              {
                opacity: previewProgress.interpolate({
                  inputRange: [0, 0.35, 0.7, 1],
                  outputRange: [0, 0, 1, 1],
                }),
              },
            ]}
          >
            <SampleReading onBack={closePreview} />
          </Animated.View>
        </Animated.View>
      ) : null}
    </View>
  );
}

function OnboardingBand({
  left,
  right,
}: {
  left: React.ReactNode;
  right: React.ReactNode;
}) {
  return (
    <SafeAreaView edges={["top"]} style={styles.bandSafeArea}>
      <View style={styles.bandRow}>
        <View style={styles.bandSide}>{left}</View>
        <Text style={styles.bandWordmark}>Daily Paths</Text>
        <View style={[styles.bandSide, styles.bandSideRight]}>{right}</View>
      </View>
    </SafeAreaView>
  );
}

function ReflectionsPage({
  cardRef,
  onOpenPreview,
  onContinue,
  onSkip,
  paywallBusy,
}: {
  cardRef: React.RefObject<View | null>;
  onOpenPreview: () => void;
  onContinue: () => void;
  onSkip: () => void;
  paywallBusy: boolean;
}) {
  return (
    <View style={styles.page}>
      <OnboardingBand
        left={<Text style={styles.bandMeta}>1 of 2</Text>}
        right={
          <TouchableOpacity
            onPress={onSkip}
            disabled={paywallBusy}
            style={styles.bandAction}
            accessibilityRole="button"
            accessibilityLabel="Skip onboarding and open checkout"
          >
            <Text style={styles.bandActionText}>{paywallBusy ? "Opening…" : "Skip"}</Text>
          </TouchableOpacity>
        }
      />
      <ScrollView
        style={styles.pageScroll}
        contentContainerStyle={styles.reflectionsContent}
        showsVerticalScrollIndicator={false}
      >
        <Text style={styles.pageContext}>What's inside</Text>
        <Text style={styles.pageOneHeadline}>A thoughtful reflection for every day</Text>

        <View ref={cardRef} collapsable={false} style={styles.sampleCardShadow}>
          <TouchableOpacity
            activeOpacity={0.88}
            onPress={onOpenPreview}
            style={styles.sampleCard}
            accessibilityRole="button"
            accessibilityLabel="Preview the reflection Assets Hidden in Faults"
          >
            <ImageBackground
              source={SAMPLE_IMAGE}
              resizeMode="cover"
              style={styles.sampleImage}
              imageStyle={styles.sampleImageCorners}
            >
              <View style={styles.sampleImageSpacer} />
              <LinearGradient
                colors={["transparent", "rgba(0,0,0,0.62)"]}
                style={styles.sampleImageOverlay}
              >
                <View style={styles.sampleLabelRow}>
                  <Book size={18} color="rgba(255,255,255,0.80)" />
                  <Text style={styles.sampleLabel}>Sample Reflection</Text>
                </View>
                <Text style={styles.sampleTitle}>{ONBOARDING_SAMPLE.title}</Text>
              </LinearGradient>
            </ImageBackground>
            <View style={styles.sampleCardBottom}>
              <Text style={styles.sampleThought}>“{ONBOARDING_SAMPLE.hook}”</Text>
              <View style={styles.sampleCtaRow}>
                <Text style={styles.sampleCtaText}>Preview the reflection</Text>
                <Ionicons name="chevron-forward" size={18} color={colors.accent} />
              </View>
            </View>
          </TouchableOpacity>
        </View>
      </ScrollView>
      <View style={styles.pinnedActionArea}>
        <PrimaryButton label="Continue" onPress={onContinue} />
      </View>
    </View>
  );
}

function ToolkitPage({
  onBack,
  onUnlock,
  paywallBusy,
}: {
  onBack: () => void;
  onUnlock: () => void;
  paywallBusy: boolean;
}) {
  return (
    <View style={styles.page}>
      <OnboardingBand
        left={
          <TouchableOpacity
            onPress={onBack}
            style={styles.backAction}
            accessibilityRole="button"
            accessibilityLabel="Back to daily reflections"
          >
            <Ionicons name="chevron-back" size={17} color="rgba(255,255,255,0.76)" />
            <Text style={styles.backActionText}>Back</Text>
          </TouchableOpacity>
        }
        right={<Text style={styles.bandMeta}>2 of 2</Text>}
      />
      <ScrollView
        style={styles.pageScroll}
        contentContainerStyle={styles.toolkitContent}
        showsVerticalScrollIndicator={false}
      >
        <Text style={styles.pageContext}>What's inside</Text>
        <Text style={styles.toolkitHeadline}>Practical tools to support your daily program</Text>
        <View style={styles.featureGrid}>
          {FEATURES.map(({ label, Icon }) => (
            <View key={label} style={styles.featureTile}>
              <View style={styles.featureIconBox}>
                <Icon size={20} color={colors.heroGradientStart} />
              </View>
              <Text style={styles.featureLabel}>{label}</Text>
            </View>
          ))}
        </View>
        <View style={styles.offerBlock}>
          <Text style={styles.offerTitle}>Lifetime access — $4.99</Text>
          <Text style={styles.offerCopy}>
            One payment. No subscription or recurring charges.
          </Text>
        </View>
      </ScrollView>
      <View style={styles.pinnedActionArea}>
        <PrimaryButton
          label={paywallBusy ? "Opening checkout…" : "Unlock the app"}
          onPress={onUnlock}
          disabled={paywallBusy}
        />
      </View>
    </View>
  );
}

function PrimaryButton({
  label,
  onPress,
  disabled = false,
}: {
  label: string;
  onPress: () => void;
  disabled?: boolean;
}) {
  return (
    <TouchableOpacity
      activeOpacity={0.86}
      onPress={onPress}
      disabled={disabled}
      style={[styles.primaryButtonOuter, disabled && styles.disabled]}
      accessibilityRole="button"
      accessibilityState={{ disabled }}
    >
      <LinearGradient
        colors={[colors.heroGradientStart, colors.heroGradientEnd]}
        start={{ x: 0, y: 0 }}
        end={{ x: 1, y: 1 }}
        style={styles.primaryButton}
      >
        <Text style={styles.primaryButtonText}>{label}</Text>
      </LinearGradient>
    </TouchableOpacity>
  );
}

function SampleReading({ onBack }: { onBack: () => void }) {
  return (
    <View style={styles.readingPage}>
      <SafeAreaView edges={["top"]} style={styles.readingHeaderSafeArea}>
        <View style={styles.readingHeader}>
          <TouchableOpacity
            onPress={onBack}
            style={styles.readingBack}
            accessibilityRole="button"
            accessibilityLabel="Back to introduction"
          >
            <Ionicons name="chevron-back" size={18} color="rgba(255,255,255,0.76)" />
            <Text style={styles.readingBackText}>Back</Text>
          </TouchableOpacity>
          <Text style={styles.readingWordmark}>Daily Paths</Text>
          <View style={styles.readingHeaderSpacer} />
        </View>
      </SafeAreaView>
      <ScrollView
        style={styles.readingScroll}
        contentContainerStyle={styles.readingContent}
        showsVerticalScrollIndicator={false}
      >
        <Text style={styles.readingTitle}>{ONBOARDING_SAMPLE.title}</Text>
        <View style={styles.quoteCard}>
          <Text style={styles.quoteGlyph}>“</Text>
          <View style={styles.quoteCopy}>
            <Text style={styles.quoteText}>{ONBOARDING_SAMPLE.quote}</Text>
            <Text style={styles.quoteSource}>{ONBOARDING_SAMPLE.quoteSource}</Text>
          </View>
        </View>
        {ONBOARDING_SAMPLE.body.map((paragraph, index) => (
          <Text key={paragraph} style={[styles.readingBody, index === 0 && styles.hookParagraph]}>
            {paragraph}
          </Text>
        ))}
        <View style={styles.practiceCard}>
          <View style={styles.practiceAccent} />
          <View style={styles.practiceRow}>
            <View style={styles.practiceBadge}>
              <Ionicons name="checkmark-circle-outline" size={25} color={colors.deepTeal} />
            </View>
            <View style={styles.practiceCopy}>
              <Text style={styles.practiceLabel}>Practice</Text>
              <Text style={styles.practiceText}>{ONBOARDING_SAMPLE.practice}</Text>
            </View>
          </View>
        </View>
        <View style={styles.thoughtCard}>
          <Text style={styles.thoughtLabel}>Thought for the Day</Text>
          <Text style={styles.thoughtText}>{ONBOARDING_SAMPLE.thought}</Text>
        </View>
      </ScrollView>
    </View>
  );
}

const styles = StyleSheet.create({
  root: { flex: 1, backgroundColor: colors.surface },
  page: { flex: 1, backgroundColor: colors.surface },
  pageScroll: { flex: 1, backgroundColor: colors.surface },
  bandSafeArea: { backgroundColor: colors.secondary },
  bandRow: {
    minHeight: 62,
    paddingHorizontal: 18,
    paddingBottom: 14,
    flexDirection: "row",
    alignItems: "flex-end",
  },
  bandSide: { flex: 1, minHeight: 44, justifyContent: "flex-end", alignItems: "flex-start" },
  bandSideRight: { alignItems: "flex-end" },
  bandWordmark: {
    fontFamily: fonts.cormorantGaramondSemiBoldItalic,
    fontSize: 22,
    lineHeight: 27,
    color: "rgba(255,255,255,0.96)",
    marginBottom: 3,
  },
  bandMeta: {
    fontFamily: fonts.bodyFamilyMedium,
    fontSize: 13,
    lineHeight: 20,
    color: "rgba(255,255,255,0.74)",
    marginBottom: 4,
  },
  bandAction: { minHeight: 44, justifyContent: "flex-end", paddingHorizontal: 3, paddingBottom: 3 },
  bandActionText: {
    fontFamily: fonts.bodyFamilySemiBold,
    fontSize: 15,
    lineHeight: 22,
    color: "rgba(255,255,255,0.96)",
  },
  backAction: { minHeight: 44, flexDirection: "row", alignItems: "flex-end", paddingBottom: 4 },
  backActionText: {
    fontFamily: fonts.bodyFamilyMedium,
    fontSize: 14,
    lineHeight: 20,
    color: "rgba(255,255,255,0.76)",
  },
  reflectionsContent: { flexGrow: 1, paddingHorizontal: 16, paddingTop: 26, paddingBottom: 22 },
  pageContext: {
    marginHorizontal: 4,
    marginBottom: 7,
    fontFamily: fonts.bodyFamilySemiBold,
    fontSize: 12,
    lineHeight: 18,
    letterSpacing: 1.25,
    textTransform: "uppercase",
    color: colors.accent,
  },
  pageOneHeadline: {
    marginHorizontal: 4,
    marginBottom: 20,
    fontFamily: fonts.cormorantGaramondMedium,
    fontSize: 34,
    lineHeight: 43,
    letterSpacing: -0.5,
    color: colors.onSurface,
  },
  sampleCardShadow: {
    borderRadius: 16,
    shadowColor: "#000000",
    shadowOpacity: 0.1,
    shadowRadius: 12,
    shadowOffset: { width: 0, height: 4 },
    elevation: 4,
  },
  sampleCard: { borderRadius: 16, overflow: "hidden", backgroundColor: colors.surfaceContainerLowest },
  sampleImage: { minHeight: 210, justifyContent: "flex-end" },
  sampleImageCorners: { borderTopLeftRadius: 16, borderTopRightRadius: 16 },
  sampleImageSpacer: { flex: 1 },
  sampleImageOverlay: { paddingHorizontal: 20, paddingTop: 46, paddingBottom: 16 },
  sampleLabelRow: { flexDirection: "row", alignItems: "center", gap: 7, marginBottom: 5 },
  sampleLabel: {
    fontFamily: fonts.labelFamily,
    fontSize: 13,
    lineHeight: 20,
    letterSpacing: 0.5,
    textTransform: "uppercase",
    color: "rgba(255,255,255,0.74)",
  },
  sampleTitle: {
    fontFamily: fonts.headerFamily,
    fontSize: 22,
    lineHeight: 28,
    letterSpacing: -0.2,
    color: "#FFFFFF",
  },
  sampleCardBottom: { paddingHorizontal: 20, paddingTop: 18, paddingBottom: 14 },
  sampleThought: {
    fontFamily: fonts.loraRegular,
    fontSize: 18,
    lineHeight: 26,
    color: colors.onSurface,
    textAlign: "center",
  },
  sampleCtaRow: {
    marginTop: 13,
    flexDirection: "row",
    alignItems: "center",
    justifyContent: "flex-end",
    gap: 2,
  },
  sampleCtaText: {
    fontFamily: fonts.bodyFamily,
    fontSize: 13,
    lineHeight: 20,
    color: colors.accent,
  },
  pinnedActionArea: {
    paddingHorizontal: 20,
    paddingTop: 12,
    paddingBottom: 22,
    backgroundColor: colors.surface,
    borderTopWidth: StyleSheet.hairlineWidth,
    borderTopColor: "rgba(45,76,71,0.10)",
  },
  primaryButtonOuter: { borderRadius: 12, overflow: "hidden" },
  primaryButton: { minHeight: 58, alignItems: "center", justifyContent: "center", paddingHorizontal: 18 },
  primaryButtonText: {
    fontFamily: fonts.bodyFamilySemiBold,
    fontSize: 17,
    lineHeight: 24,
    color: "#FFFFFF",
    textAlign: "center",
  },
  disabled: { opacity: 0.65 },
  toolkitContent: { paddingHorizontal: 20, paddingTop: 18, paddingBottom: 26 },
  toolkitHeadline: {
    marginBottom: 24,
    fontFamily: fonts.cormorantGaramondSemiBold,
    fontSize: 32,
    lineHeight: 39,
    letterSpacing: -0.35,
    color: colors.onSurface,
  },
  featureGrid: {
    marginBottom: 22,
    flexDirection: "row",
    flexWrap: "wrap",
    gap: 10,
  },
  featureTile: {
    width: "48%",
    minHeight: 92,
    paddingHorizontal: 14,
    paddingVertical: 13,
    borderRadius: 12,
    backgroundColor: colors.surfaceContainerLowest,
    borderWidth: StyleSheet.hairlineWidth,
    borderColor: "rgba(45,76,71,0.11)",
  },
  featureIconBox: {
    width: 38,
    height: 38,
    borderRadius: 10,
    alignItems: "center",
    justifyContent: "center",
    backgroundColor: colors.highlight,
  },
  featureLabel: {
    marginTop: 8,
    fontFamily: fonts.bodyFamilyMedium,
    fontSize: 14,
    lineHeight: 19,
    color: colors.onSurface,
  },
  offerBlock: {
    marginTop: 3,
    paddingHorizontal: 20,
    paddingVertical: 18,
    alignItems: "center",
    borderRadius: 14,
    borderWidth: StyleSheet.hairlineWidth,
    borderColor: "rgba(45,76,71,0.14)",
    backgroundColor: colors.surfaceContainerLowest,
    shadowColor: colors.heroGradientStart,
    shadowOpacity: 0.07,
    shadowRadius: 10,
    shadowOffset: { width: 0, height: 3 },
    elevation: 2,
  },
  offerTitle: {
    fontFamily: fonts.bodyFamilyBold,
    fontSize: 20,
    lineHeight: 27,
    letterSpacing: -0.2,
    color: colors.onSurface,
    textAlign: "center",
  },
  offerCopy: {
    marginTop: 5,
    fontFamily: fonts.bodyFamily,
    fontSize: 14,
    lineHeight: 22,
    color: colors.onSurfaceVariant,
    textAlign: "center",
  },
  previewOverlay: {
    position: "absolute",
    zIndex: 50,
    overflow: "hidden",
    backgroundColor: colors.surface,
    shadowColor: "#000000",
    shadowOpacity: 0.18,
    shadowRadius: 18,
    shadowOffset: { width: 0, height: 5 },
    elevation: 20,
  },
  previewContent: { flex: 1 },
  readingPage: { flex: 1, backgroundColor: colors.surface },
  readingHeaderSafeArea: { backgroundColor: colors.secondary },
  readingHeader: {
    minHeight: 62,
    paddingHorizontal: 18,
    paddingBottom: 14,
    flexDirection: "row",
    alignItems: "flex-end",
  },
  readingBack: { flex: 1, minHeight: 44, flexDirection: "row", alignItems: "flex-end", paddingBottom: 4 },
  readingBackText: {
    fontFamily: fonts.bodyFamilyMedium,
    fontSize: 14,
    lineHeight: 20,
    color: "rgba(255,255,255,0.76)",
  },
  readingWordmark: {
    fontFamily: fonts.cormorantGaramondSemiBoldItalic,
    fontSize: 22,
    lineHeight: 27,
    color: "rgba(255,255,255,0.96)",
    marginBottom: 3,
  },
  readingHeaderSpacer: { flex: 1 },
  readingScroll: { flex: 1, backgroundColor: colors.surface },
  readingContent: { paddingHorizontal: 20, paddingTop: 20, paddingBottom: 44 },
  readingTitle: {
    marginBottom: 18,
    fontFamily: fonts.loraRegular,
    fontSize: 36,
    lineHeight: 44,
    letterSpacing: -0.9,
    color: colors.accent,
  },
  quoteCard: {
    marginBottom: 20,
    padding: 22,
    borderRadius: 12,
    backgroundColor: colors.surfaceContainerLowest,
    flexDirection: "row",
    gap: 10,
    shadowColor: colors.heroGradientStart,
    shadowOpacity: 0.08,
    shadowRadius: 12,
    shadowOffset: { width: 0, height: 3 },
    elevation: 3,
  },
  quoteGlyph: {
    marginTop: -11,
    fontFamily: fonts.cormorantGaramondMedium,
    fontSize: 56,
    lineHeight: 68,
    color: "#C6D2CF",
  },
  quoteCopy: { flex: 1 },
  quoteText: {
    fontFamily: fonts.bodyFamilySemiBold,
    fontStyle: "italic",
    fontSize: 19,
    lineHeight: 26,
    color: colors.accent,
  },
  quoteSource: {
    marginTop: 8,
    fontFamily: fonts.bodyFamilyMedium,
    fontSize: 12,
    lineHeight: 18,
    color: colors.onSurfaceVariant,
  },
  readingBody: {
    marginBottom: 18,
    fontFamily: fonts.loraRegular,
    fontSize: 19,
    lineHeight: 32,
    color: colors.onSurface,
  },
  hookParagraph: { color: colors.onSurface },
  practiceCard: {
    marginTop: 7,
    marginBottom: 20,
    padding: 20,
    borderRadius: 16,
    overflow: "hidden",
    backgroundColor: colors.surfaceContainerLowest,
    shadowColor: colors.heroGradientStart,
    shadowOpacity: 0.08,
    shadowRadius: 12,
    shadowOffset: { width: 0, height: 3 },
    elevation: 3,
  },
  practiceAccent: { position: "absolute", left: 0, top: 0, bottom: 0, width: 4, backgroundColor: colors.deepTeal },
  practiceRow: { flexDirection: "row", alignItems: "flex-start", gap: 14 },
  practiceBadge: {
    width: 44,
    height: 44,
    borderRadius: 12,
    alignItems: "center",
    justifyContent: "center",
    backgroundColor: "#E0F2F1",
  },
  practiceCopy: { flex: 1 },
  practiceLabel: {
    marginBottom: 10,
    fontFamily: fonts.bodyFamilySemiBold,
    fontSize: 13,
    lineHeight: 20,
    letterSpacing: 1.2,
    textTransform: "uppercase",
    color: colors.deepTeal,
  },
  practiceText: {
    fontFamily: fonts.bodyFamilyMedium,
    fontSize: 15,
    lineHeight: 26,
    color: colors.onSurfaceVariant,
  },
  thoughtCard: {
    marginTop: 4,
    paddingHorizontal: 26,
    paddingVertical: 22,
    borderRadius: 12,
    alignItems: "center",
    backgroundColor: colors.secondary,
    shadowColor: "#000000",
    shadowOpacity: 0.1,
    shadowRadius: 12,
    shadowOffset: { width: 0, height: 4 },
    elevation: 4,
  },
  thoughtLabel: {
    marginBottom: 11,
    fontFamily: fonts.bodyFamilySemiBold,
    fontSize: 13,
    lineHeight: 20,
    letterSpacing: 1.4,
    textTransform: "uppercase",
    color: colors.highlight,
  },
  thoughtText: {
    fontFamily: fonts.bodyFamilySemiBold,
    fontSize: 21,
    lineHeight: 28,
    color: "#FFFFFF",
    textAlign: "center",
  },
});
