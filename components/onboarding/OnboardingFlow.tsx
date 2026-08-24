import React, { useCallback, useEffect, useRef, useState } from "react";
import {
  AccessibilityInfo,
  Animated,
  BackHandler,
  ImageBackground,
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
import { useAnalytics } from "../../utils/analytics";
import { qaLog } from "../../utils/qaLog";
import { NativePaywall } from "./NativePaywall";

const SAMPLE_IMAGE = require("../../assets/reflections/reflections-41.webp");

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

interface OnboardingFlowProps {
  initialPaywallOrigin?: Page | null;
  onAccessGranted?: () => void;
  /** Developer replay only. Consumer onboarding does not supply this. */
  onExit?: () => void;
}

export function OnboardingFlow({
  initialPaywallOrigin = null,
  onAccessGranted,
  onExit,
}: OnboardingFlowProps = {}) {
  const [page, setPage] = useState<Page>("reflections");
  const [previewVisible, setPreviewVisible] = useState(false);
  const [cardRect, setCardRect] = useState<CardRect | null>(null);
  const [reduceMotion, setReduceMotion] = useState(false);
  const [paywallOrigin, setPaywallOrigin] = useState<Page | null>(initialPaywallOrigin);
  const previewProgress = useRef(new Animated.Value(0)).current;
  const cardRef = useRef<View>(null);
  const lastTrackedPage = useRef<Page | null>(null);
  const { width: windowWidth, height: windowHeight } = useWindowDimensions();
  const {
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

  const openPaywall = useCallback(
    (origin: Page) => {
      qaLog("onboarding", "Opening native paywall", { origin });
      trackOnboardingCheckoutTapped(origin);
      setPaywallOrigin(origin);
    },
    [trackOnboardingCheckoutTapped],
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
          onExit={onExit}
          onOpenPreview={openPreview}
          onContinue={() => {
            qaLog("onboarding", "Advanced to toolkit page");
            setPage("toolkit");
          }}
          onSkip={() => openPaywall("reflections")}
        />
      ) : (
        <ToolkitPage
          onBack={() => setPage("reflections")}
          onUnlock={() => openPaywall("toolkit")}
        />
      )}

      <NativePaywall
        visible={paywallOrigin !== null}
        origin={paywallOrigin}
        onClose={() => {
          setPaywallOrigin(null);
          setPage("reflections");
        }}
        onAccessGranted={() => {
          setPaywallOrigin(null);
          onAccessGranted?.();
        }}
      />

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
  onExit,
  onOpenPreview,
  onContinue,
  onSkip,
}: {
  cardRef: React.RefObject<View | null>;
  onExit?: () => void;
  onOpenPreview: () => void;
  onContinue: () => void;
  onSkip: () => void;
}) {
  return (
    <View style={styles.page}>
      <OnboardingBand
        left={
          onExit ? (
            <TouchableOpacity
              onPress={onExit}
              style={styles.replayExitAction}
              accessibilityRole="button"
              accessibilityLabel="Close onboarding replay"
            >
              <Ionicons name="close" size={20} color="rgba(255,255,255,0.96)" />
              <Text style={styles.bandMeta}>1 of 2</Text>
            </TouchableOpacity>
          ) : (
            <Text style={styles.bandMeta}>1 of 2</Text>
          )
        }
        right={
          <TouchableOpacity
            onPress={onSkip}
            style={styles.bandAction}
            accessibilityRole="button"
            accessibilityLabel="Skip onboarding and open checkout"
          >
            <Text style={styles.bandActionText}>Skip</Text>
          </TouchableOpacity>
        }
      />
      <ScrollView
        style={styles.pageScroll}
        contentContainerStyle={styles.reflectionsContent}
        showsVerticalScrollIndicator={false}
      >
        <Text style={styles.pageOneHeadline}>Bring focus and insight to your day</Text>
        <Text style={styles.pageOneBenefit}>
          Brief, practical readings that deepen your understanding and help you put the program into practice.
        </Text>

        <View ref={cardRef} collapsable={false} style={styles.sampleCardShadow}>
          <TouchableOpacity
            activeOpacity={0.88}
            onPress={onOpenPreview}
            style={styles.sampleCard}
            accessibilityRole="button"
            accessibilityLabel="Preview the reading Assets Hidden in Faults"
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
            </View>
          </TouchableOpacity>
        </View>
        <TouchableOpacity
          activeOpacity={0.7}
          onPress={onOpenPreview}
          style={styles.sampleCtaRow}
          accessibilityRole="button"
          accessibilityLabel="Preview the reading Assets Hidden in Faults"
        >
          <Text style={styles.sampleCtaText}>Preview the reading</Text>
          <Ionicons name="chevron-forward" size={16} color={colors.heroGradientEnd} />
        </TouchableOpacity>
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
}: {
  onBack: () => void;
  onUnlock: () => void;
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
        <Text style={styles.toolkitHeadline}>Keep your program with you throughout the day</Text>
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
      </ScrollView>
      <View style={styles.pinnedActionArea}>
        <PrimaryButton
          label="Continue"
          onPress={onUnlock}
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
  replayExitAction: {
    minHeight: 44,
    flexDirection: "row",
    alignItems: "flex-end",
    gap: 7,
    paddingBottom: 4,
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
  pageOneHeadline: {
    marginHorizontal: 4,
    marginBottom: 9,
    fontFamily: fonts.cormorantGaramondMedium,
    fontSize: 34,
    lineHeight: 43,
    letterSpacing: -0.5,
    color: colors.onSurface,
  },
  pageOneBenefit: {
    marginHorizontal: 4,
    marginBottom: 20,
    fontFamily: fonts.bodyFamily,
    fontSize: 15,
    lineHeight: 23,
    color: colors.onSurfaceVariant,
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
    minHeight: 44,
    marginTop: 14,
    paddingHorizontal: 22,
    alignSelf: "center",
    flexDirection: "row",
    alignItems: "center",
    justifyContent: "center",
    gap: 4,
    borderRadius: 999,
    backgroundColor: colors.highlight,
  },
  sampleCtaText: {
    fontFamily: fonts.bodyFamilySemiBold,
    fontSize: 15,
    lineHeight: 22,
    color: colors.heroGradientEnd,
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
