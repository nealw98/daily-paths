import React, { useEffect, useMemo, useRef, useState } from "react";
import {
  View,
  Text,
  StyleSheet,
  ScrollView,
  TouchableOpacity,
  Linking,
  Platform,
  Modal,
  TextInput,
  KeyboardAvoidingView,
  Keyboard,
  Alert,
  ActivityIndicator,
  AppState,
} from "react-native";
import { SafeAreaView, useSafeAreaInsets } from "react-native-safe-area-context";
import { useFocusEffect } from "@react-navigation/native";
import Constants from "expo-constants";
import { Ionicons, MaterialIcons } from "@expo/vector-icons";
import { useRouter } from "expo-router";
import { useTheme } from "../../hooks/useTheme";
import { useTypography } from "../../hooks/useTypography";
import { useSettings, type TextSize } from "../../hooks/useSettings";
import { useAppFeedback } from "../../hooks/useAppFeedback";
import { useAnalytics } from "../../utils/analytics";
import { shareApp, openAppStoreForRating } from "../../utils/rateShareTracking";
import { qaLog } from "../../utils/qaLog";
import { fonts, typography, shadows } from "../../constants/theme";
import { TealHeader } from "../../components/shared/TealHeader";
import { useSubscription } from "../../hooks/useSubscription";
import { useSubscriptionContext } from "../../contexts/SubscriptionContext";
import RevenueCatUI from "react-native-purchases-ui";
import { RateAppModal } from "../../components/RateAppModal";

/** Default theme options (visible to all users) */
const DEFAULT_THEME_OPTIONS: { id: string; displayName: string; icon?: string }[] = [
  { id: "ocean-light", displayName: "Light", icon: "sunny" },
  { id: "ocean-dark", displayName: "Dark", icon: "moon" },
  { id: "system", displayName: "System", icon: "phone-portrait-outline" },
];

/** Extended color themes (hidden behind long-press) */
const EXTENDED_THEME_OPTIONS: { id: string; displayName: string }[] = [
  { id: "deep-sea", displayName: "Deep\nSea" },
  { id: "burgundy-rose", displayName: "Rose\nGarden" },
  { id: "twilight-fire", displayName: "Desert\nTwilight" },
  { id: "soft-mauve", displayName: "Plum" },
  { id: "champagne", displayName: "Coffee\nBreak" },
  { id: "peach-blossom", displayName: "Peach\nBlossom" },
  { id: "morning-light", displayName: "Morning\nLight" },
];

/** IDs of dark themes for analytics */
const DARK_THEME_IDS = new Set(["ocean-dark", "deep-sea", "champagne"]);

export default function MoreTab() {
  const { colors } = useTheme();
  const { typography: dynamicTypography } = useTypography();
  const insets = useSafeAreaInsets();
  const { settings, setThemeId, setColorScheme, setTextSize } =
    useSettings();

  const sectionTitleType = useMemo(() => {
    const fontSize = Math.round(dynamicTypography.bodyLarge.fontSize * 1.3);
    return {
      fontFamily: fonts.cormorantGaramondSemiBold,
      fontSize,
      lineHeight: Math.round(fontSize * 1.2),
      letterSpacing: -0.1,
    };
  }, [dynamicTypography.bodyLarge.fontSize]);

  // Dynamic sizes for card-level labels, subscription rows, daily-notification
  // rows, and the A/A slider endpoints. Scaled from bodyLargeFontSize so
  // the baseline at the "medium" tier matches the prior static values.
  const cardLabelFontSize = Math.round(dynamicTypography.bodyLargeFontSize * (16 / 19));
  const cardLabelLineHeight = Math.round(cardLabelFontSize * (22 / 16));
  const subscriptionFontSize = Math.round(dynamicTypography.bodyLargeFontSize * (16 / 19));
  const subscriptionLineHeight = Math.round(subscriptionFontSize * (20 / 16));
  const rowTitleFontSize = Math.round(dynamicTypography.bodyLargeFontSize * (16 / 19));
  const rowDescriptionFontSize = Math.round(dynamicTypography.bodyLargeFontSize * (14 / 19));
  const rowDescriptionLineHeight = Math.round(rowDescriptionFontSize * (18 / 14));
  const timePickerBtnFontSize = Math.round(dynamicTypography.bodyLargeFontSize * (14 / 19));
  const sliderSmallAFontSize = dynamicTypography.captionFontSize;
  const sliderLargeAFontSize = Math.round(dynamicTypography.bodyLargeFontSize * (18 / 19));
  const supportActionFontSize = Math.round(dynamicTypography.bodyLargeFontSize * (16 / 19));
  const supportActionLineHeight = Math.round(supportActionFontSize * (20 / 16));
  const { submitting: submittingFeedback, submitFeedback } = useAppFeedback();
  const { status, hasLifetimeAccess, loading: subLoading, refresh } = useSubscription();
  const { trialStatus } = useSubscriptionContext();
  const { updateThemeMode } = useAnalytics();
  const router = useRouter();
  const scrollRef = useRef<ScrollView>(null);

  const [showFeedbackModal, setShowFeedbackModal] = useState(false);
  const [showRateModal, setShowRateModal] = useState(false);
  const [feedbackText, setFeedbackText] = useState("");
  const [feedbackContact, setFeedbackContact] = useState("");
  const [isSharing, setIsSharing] = useState(false);
  const [openingCustomerCenter, setOpeningCustomerCenter] = useState(false);

  useFocusEffect(
    React.useCallback(() => {
      scrollRef.current?.scrollTo({ y: 0, animated: false });
    }, []),
  );

  // Collapse premium themes when entitlement lapses and reset protected theme choices.
  useEffect(() => {
    const hasPaidEntitlement = hasLifetimeAccess || status.isSubscribed || status.isLegacy;
    if (!hasPaidEntitlement && EXTENDED_THEME_OPTIONS.some((t) => t.id === settings.themeId)) {
      setThemeId("ocean-light");
      updateThemeMode("light");
    }
  }, [hasLifetimeAccess, status.isSubscribed, status.isLegacy, settings.themeId]);

  const expoConfig: any = Constants.expoConfig ?? {};
  const appVersion =
    expoConfig.version ?? Constants.nativeAppVersion ?? "dev";
  const iosBuildNumber =
    expoConfig.ios?.buildNumber ?? Constants.nativeBuildVersion ?? "dev";

  const hasPaidEntitlement = hasLifetimeAccess || status.isSubscribed || status.isLegacy;

  const handleThemeChange = (optionId: string) => {
    if (optionId === "system") {
      setColorScheme("system");
      updateThemeMode("system");
    } else {
      setThemeId(optionId);
      updateThemeMode(DARK_THEME_IDS.has(optionId) ? "dark" : "light");
    }
  };

  const handleRateApp = async () => {
    qaLog("rate", "Rate App button pressed - opening App Store directly");
    await openAppStoreForRating();
  };

  const handleShareApp = async () => {
    setIsSharing(true);
    try {
      await shareApp();
    } catch (error) {
      Alert.alert(
        "Unable to Share",
        "There was a problem sharing the app. Please try again later.",
        [{ text: "OK" }]
      );
    } finally {
      setIsSharing(false);
    }
  };

  const handleSubmitFeedback = async () => {
    if (!feedbackText.trim()) return;

    const email = feedbackContact.trim();
    const emailValid = /^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(email);
    if (!emailValid) {
      Alert.alert(
        "Email required",
        "Please enter a valid email address so we can follow up if needed.",
        [{ text: "OK" }]
      );
      return;
    }

    const success = await submitFeedback(
      feedbackText.trim(),
      email
    );

    if (success) {
      Alert.alert(
        "Thank you!",
        "Your feedback has been submitted. We appreciate you helping us improve Al-Anon Daily Paths.",
        [{ text: "OK" }]
      );
      setShowFeedbackModal(false);
      setFeedbackText("");
      setFeedbackContact("");
    } else {
      Alert.alert(
        "Unable to Submit",
        "There was a problem submitting your feedback. Please try again later.",
        [{ text: "OK" }]
      );
    }
  };

  return (
    <SafeAreaView
      style={[styles.container, { backgroundColor: colors.surface }]}
      edges={[]}
    >
      <TealHeader
        title="Settings"
      />

      <ScrollView
        ref={scrollRef}
        style={styles.scrollView}
        contentContainerStyle={styles.scrollContent}
        showsVerticalScrollIndicator={false}
      >
        {/* ── 1. Subscription ────────────────────────────────── */}
        <Text allowFontScaling={false} style={[styles.sectionLabel, styles.firstSectionLabel, sectionTitleType, { color: colors.onSurface }]}>Subscription</Text>
        {subLoading ? (
          <View style={[styles.subscriptionRow, { backgroundColor: colors.surfaceContainerLowest }]}>
            <View style={styles.subscriptionLeft}>
              <ActivityIndicator size="small" color={colors.deepTeal} />
              <Text style={[styles.subscriptionText, { fontSize: subscriptionFontSize, lineHeight: subscriptionLineHeight, color: colors.text }]}>Checking Access...</Text>
            </View>
          </View>
        ) : status.isSubscribed ? (
          <TouchableOpacity
            style={[styles.subscriptionRow, { backgroundColor: colors.surfaceContainerLowest }]}
            disabled={openingCustomerCenter}
            onPress={async () => {
              if (openingCustomerCenter) return;
              setOpeningCustomerCenter(true);
              let sawBackground = false;
              const appStateSub = AppState.addEventListener("change", (nextState) => {
                if (nextState !== "active") sawBackground = true;
              });
              try {
                await RevenueCatUI.presentCustomerCenter({
                  callbacks: {
                    onRestoreCompleted: () => refresh(),
                  },
                });
                await refresh();
              } catch (err) {
                const errorText = String(err).toLowerCase();
                const isBenignAndroidReturn =
                  Platform.OS === "android" &&
                  (sawBackground ||
                    errorText.includes("cancel") ||
                    errorText.includes("dismiss") ||
                    errorText.includes("background") ||
                    errorText.includes("activity") ||
                    errorText.includes("aborted"));

                if (isBenignAndroidReturn) {
                  qaLog("subscription", "Customer Center returned with benign Android flow error", {
                    error: String(err),
                    sawBackground,
                  });
                  await refresh();
                  return;
                }

                qaLog("subscription", "Customer Center failed to open", { error: String(err) });
                Alert.alert(
                  "Unable to Open Subscription Management",
                  "Please try again in a moment.",
                );
              } finally {
                appStateSub.remove();
                setOpeningCustomerCenter(false);
              }
            }}
            activeOpacity={openingCustomerCenter ? 1 : 0.8}
          >
            <View style={styles.subscriptionLeft}>
              <Ionicons name="card-outline" size={22} color={colors.deepTeal} />
              <Text style={[styles.subscriptionText, { fontSize: subscriptionFontSize, lineHeight: subscriptionLineHeight, color: colors.text }]}>
                {openingCustomerCenter ? "Opening..." : "Manage Subscription"}
              </Text>
            </View>
            {openingCustomerCenter ? (
              <ActivityIndicator size="small" color={colors.deepTeal} />
            ) : (
              <Ionicons name="chevron-forward" size={20} color={colors.seafoam} />
            )}
          </TouchableOpacity>
        ) : hasLifetimeAccess || status.isLegacy ? (
          <View style={[styles.subscriptionRow, { backgroundColor: colors.surfaceContainerLowest }]}>
            <View style={styles.subscriptionLeft}>
              <Ionicons name="star" size={22} color={colors.deepTeal} />
              <Text style={[styles.subscriptionText, { fontSize: subscriptionFontSize, lineHeight: subscriptionLineHeight, color: colors.deepTeal }]}>Lifetime Access</Text>
            </View>
          </View>
        ) : trialStatus.isInTrial ? (
          <TouchableOpacity
            style={[styles.subscriptionRow, { backgroundColor: colors.surfaceContainerLowest }]}
            onPress={async () => {
              try {
                const result = await RevenueCatUI.presentPaywall();
                if (result === "PURCHASED") await refresh();
              } catch (err) {
                qaLog("subscription", "Paywall failed to open from trial row", { error: String(err) });
              }
            }}
            activeOpacity={0.8}
          >
            <View style={styles.subscriptionLeft}>
              <Ionicons name="time-outline" size={22} color={colors.deepTeal} />
              <Text style={[styles.subscriptionText, { fontSize: subscriptionFontSize, lineHeight: subscriptionLineHeight, color: colors.text }]}>
                {trialStatus.daysRemaining === 0
                  ? "Free Trial \u2014 expires today"
                  : `Free Trial \u2014 ${trialStatus.daysRemaining} day${trialStatus.daysRemaining === 1 ? "" : "s"} left`}
              </Text>
            </View>
            <Ionicons name="chevron-forward" size={20} color={colors.seafoam} />
          </TouchableOpacity>
        ) : (
          <TouchableOpacity
            style={[styles.subscriptionRow, { backgroundColor: colors.surfaceContainerLowest }]}
            onPress={async () => {
              try {
                const result = await RevenueCatUI.presentPaywall();
                if (result === "PURCHASED") await refresh();
              } catch (err) {
                qaLog("subscription", "Paywall failed to open from subscribe row", { error: String(err) });
              }
            }}
            activeOpacity={0.8}
          >
            <View style={styles.subscriptionLeft}>
              <Ionicons name="card-outline" size={22} color={colors.deepTeal} />
              <Text style={[styles.subscriptionText, { fontSize: subscriptionFontSize, lineHeight: subscriptionLineHeight, color: colors.text }]}>Subscribe Now</Text>
            </View>
            <Ionicons name="chevron-forward" size={20} color={colors.seafoam} />
          </TouchableOpacity>
        )}


        {/* ── 2. Appearance ────────────────────────────────── */}
        <Text allowFontScaling={false} style={[styles.sectionLabel, sectionTitleType, { color: colors.onSurface }]}>Appearance</Text>
        <View style={[styles.card, { backgroundColor: colors.surfaceContainerLowest }]}>
          {/* Text Size */}
          <Text
            style={[
              styles.cardLabel,
              {
                fontSize: cardLabelFontSize,
                lineHeight: cardLabelLineHeight,
                color: colors.deepTeal,
              },
            ]}
          >
            Text Size
          </Text>
          <View style={styles.sliderRow}>
            <TouchableOpacity
              onPress={() => {
                const sizes: TextSize[] = ["extraSmall", "small", "medium", "large", "extraLarge"];
                const idx = sizes.indexOf(settings.textSize);
                if (idx > 0) setTextSize(sizes[idx - 1]);
              }}
              hitSlop={{ top: 8, bottom: 8, left: 8, right: 8 }}
            >
              <Text style={[styles.sliderEdgeLabel, { color: colors.textSecondary, fontSize: sliderSmallAFontSize }]}>A</Text>
            </TouchableOpacity>
            <View style={styles.sliderTrack}>
              {(["extraSmall", "small", "medium", "large", "extraLarge"] as TextSize[]).map((size) => {
                const isSelected = settings.textSize === size;
                return (
                  <TouchableOpacity
                    key={size}
                    style={styles.sliderStopTouch}
                    onPress={() => setTextSize(size)}
                    activeOpacity={0.7}
                  >
                    <View
                      style={[
                        styles.sliderStop,
                        {
                          borderColor: isSelected ? colors.deepTeal : colors.border,
                          backgroundColor: isSelected ? colors.deepTeal : "transparent",
                        },
                      ]}
                    />
                  </TouchableOpacity>
                );
              })}
            </View>
            <TouchableOpacity
              onPress={() => {
                const sizes: TextSize[] = ["extraSmall", "small", "medium", "large", "extraLarge"];
                const idx = sizes.indexOf(settings.textSize);
                if (idx < sizes.length - 1) setTextSize(sizes[idx + 1]);
              }}
              hitSlop={{ top: 8, bottom: 8, left: 8, right: 8 }}
            >
              <Text style={[styles.sliderEdgeLabel, { color: colors.textSecondary, fontSize: sliderLargeAFontSize }]}>A</Text>
            </TouchableOpacity>
          </View>

          {/* Themes */}
          <Text
            style={[
              styles.cardLabel,
              {
                fontSize: cardLabelFontSize,
                lineHeight: cardLabelLineHeight,
                color: colors.deepTeal,
                marginTop: 16,
              },
            ]}
          >
            Themes
          </Text>
          <View style={styles.themeOptions}>
            {DEFAULT_THEME_OPTIONS.map((option) => {
              const isSelected =
                option.id === "system"
                  ? settings.colorScheme === "system"
                  : settings.themeId === option.id && settings.colorScheme !== "system";
              return (
                <TouchableOpacity
                  key={option.id}
                  style={[
                    styles.themeOption,
                    { borderColor: colors.border },
                    isSelected && { backgroundColor: colors.deepTeal, borderColor: colors.deepTeal },
                  ]}
                  onPress={() => handleThemeChange(option.id)}
                  activeOpacity={0.8}
                >
                  {option.icon && (
                    <Ionicons
                      name={option.icon as any}
                      size={20}
                      color={isSelected ? colors.textOnAccent : colors.deepTeal}
                    />
                  )}
                  <Text
                    style={[
                      styles.themeOptionText,
                      { color: colors.deepTeal },
                      isSelected && { color: colors.textOnAccent },
                    ]}
                    numberOfLines={2}
                  >
                    {option.displayName}
                  </Text>
                </TouchableOpacity>
              );
            })}
          </View>

        </View>

        {/* ── 3. Support & Share ─────────────────────────── */}
        <Text allowFontScaling={false} style={[styles.sectionLabel, sectionTitleType, { color: colors.onSurface }]}>Support & Share</Text>
        <View style={[styles.card, { backgroundColor: colors.surfaceContainerLowest }]}>
          <View style={styles.supportActions}>
            <TouchableOpacity
              style={[styles.supportAction, { borderColor: colors.ghostBorder, backgroundColor: colors.surfaceContainerLowest }]}
              onPress={() => setShowFeedbackModal(true)}
              activeOpacity={0.8}
            >
              <View style={styles.supportActionLeft}>
                <Ionicons name="chatbubble-ellipses-outline" size={18} color={colors.deepTeal} />
                <Text style={[styles.supportActionText, { fontSize: supportActionFontSize, lineHeight: supportActionLineHeight, color: colors.deepTeal }]}>Send Feedback</Text>
              </View>
              <Ionicons name="chevron-forward" size={18} color={colors.seafoam} />
            </TouchableOpacity>
            <TouchableOpacity
              style={[styles.supportAction, { borderColor: colors.ghostBorder, backgroundColor: colors.surfaceContainerLowest }]}
              onPress={handleRateApp}
              activeOpacity={0.8}
            >
              <View style={styles.supportActionLeft}>
                <Ionicons name="star-outline" size={18} color={colors.deepTeal} />
                <Text style={[styles.supportActionText, { fontSize: supportActionFontSize, lineHeight: supportActionLineHeight, color: colors.deepTeal }]}>Rate App</Text>
              </View>
              <Ionicons name="chevron-forward" size={18} color={colors.seafoam} />
            </TouchableOpacity>
            <TouchableOpacity
              style={[styles.supportAction, { borderColor: colors.ghostBorder, backgroundColor: colors.surfaceContainerLowest }]}
              onPress={handleShareApp}
              disabled={isSharing}
              activeOpacity={0.8}
            >
              <View style={styles.supportActionLeft}>
                <Ionicons name="arrow-redo-outline" size={18} color={colors.deepTeal} />
                <Text style={[styles.supportActionText, { fontSize: supportActionFontSize, lineHeight: supportActionLineHeight, color: colors.deepTeal }]}>
                  {isSharing ? "Sharing..." : "Share App"}
                </Text>
              </View>
              <Ionicons name="chevron-forward" size={18} color={colors.seafoam} />
            </TouchableOpacity>
          </View>
        </View>

        {/* Spacer pushes legal links to bottom */}
        <View style={{ flex: 1 }} />

        {/* ── Footer ─────────────────────────────────────── */}
        <View style={[styles.footerSection, { paddingBottom: 4 + insets.bottom }]}>
          <View style={styles.legalRow}>
            <TouchableOpacity
              activeOpacity={0.7}
              onPress={() => Linking.openURL("https://dailypaths.org/privacy")}
            >
              <Text style={[styles.legalLink, { color: colors.deepTeal }]} allowFontScaling={false}>
                Privacy Policy
              </Text>
            </TouchableOpacity>
            <Text style={[styles.legalDot, { color: colors.textSecondary }]}>·</Text>
            <TouchableOpacity
              activeOpacity={0.7}
              onPress={() => Linking.openURL("https://dailypaths.org/support")}
            >
              <Text style={[styles.legalLink, { color: colors.deepTeal }]} allowFontScaling={false}>
                Support
              </Text>
            </TouchableOpacity>
            <Text style={[styles.legalDot, { color: colors.textSecondary }]}>·</Text>
            <TouchableOpacity
              activeOpacity={0.7}
              onPress={() => Linking.openURL("https://www.apple.com/legal/internet-services/itunes/dev/stdeula/")}
            >
              <Text style={[styles.legalLink, { color: colors.deepTeal }]} allowFontScaling={false}>
                Terms of Service
              </Text>
            </TouchableOpacity>
          </View>

          <Text style={[styles.legalLink, { color: colors.textSecondary, textAlign: 'center', marginTop: 4 }]} allowFontScaling={false}>
            Not affiliated with Al-Anon, AA, or any 12-step fellowship.
          </Text>

          <TouchableOpacity
            activeOpacity={0.7}
            onLongPress={() => router.push("/qa-logs")}
          >
            <Text style={[styles.versionText, { color: colors.ocean }]} allowFontScaling={false}>
              Version {appVersion} (build {iosBuildNumber})
            </Text>
          </TouchableOpacity>
        </View>
      </ScrollView>

      {/* ── Modals ──────────────────────────────────────── */}
      <Modal
        visible={showFeedbackModal}
        transparent
        animationType="slide"
        onRequestClose={() => setShowFeedbackModal(false)}
      >
        <KeyboardAvoidingView
          behavior={Platform.OS === "ios" ? "padding" : "height"}
          style={{ flex: 1 }}
        >
          <TouchableOpacity
            style={[styles.modalBackdrop, { backgroundColor: colors.backdrop }]}
            activeOpacity={1}
            onPress={() => setShowFeedbackModal(false)}
          >
            <View
              style={[styles.feedbackModal, { backgroundColor: colors.pearl }]}
              onStartShouldSetResponder={() => true}
              onResponderRelease={() => Keyboard.dismiss()}
            >
              <Text style={[styles.feedbackTitle, { color: colors.deepTeal }]}>We'd love your feedback</Text>
              <TextInput
                style={[styles.feedbackInput, styles.feedbackInputMultiline, { borderColor: colors.mist, color: colors.ink }]}
                placeholder="Share your thoughts or suggestions..."
                placeholderTextColor={colors.textSecondary + "50"}
                multiline
                numberOfLines={5}
                value={feedbackText}
                onChangeText={setFeedbackText}
              />
              <TextInput
                style={[styles.feedbackInput, { borderColor: colors.mist, color: colors.ink }]}
                placeholder="Your email (required)"
                placeholderTextColor={colors.textSecondary + "50"}
                value={feedbackContact}
                onChangeText={setFeedbackContact}
                keyboardType="email-address"
                autoCapitalize="none"
                autoCorrect={false}
              />
              <View style={styles.feedbackActions}>
                <TouchableOpacity
                  style={[styles.feedbackSecondary, { backgroundColor: colors.mist }]}
                  onPress={() => setShowFeedbackModal(false)}
                  activeOpacity={0.8}
                >
                  <Text style={[styles.feedbackSecondaryText, { color: colors.ink }]}>Cancel</Text>
                </TouchableOpacity>
                <TouchableOpacity
                  style={[
                    styles.feedbackPrimary,
                    { backgroundColor: colors.deepTeal },
                    (!feedbackText.trim() || !feedbackContact.trim()) && { opacity: 0.5 },
                  ]}
                  disabled={!feedbackText.trim() || !feedbackContact.trim() || submittingFeedback}
                  onPress={handleSubmitFeedback}
                  activeOpacity={0.8}
                >
                  <Text style={[styles.feedbackPrimaryText, { color: colors.textOnAccent }]}>
                    {submittingFeedback ? "Sending..." : "Submit"}
                  </Text>
                </TouchableOpacity>
              </View>
            </View>
          </TouchableOpacity>
        </KeyboardAvoidingView>
      </Modal>

      <RateAppModal
        visible={showRateModal}
        onClose={() => setShowRateModal(false)}
        trigger="settings_button"
      />
    </SafeAreaView>
  );
}

const styles = StyleSheet.create({
  container: {
    flex: 1,
  },
  scrollView: {
    flex: 1,
  },
  scrollContent: {
    flexGrow: 1,
    paddingHorizontal: 20,
    paddingTop: 14,
    paddingBottom: 4,
  },

  /* ── Section Labels ────────────────────────────── */
  sectionLabel: {
    marginBottom: 8,
    marginTop: 22,
    marginLeft: 4,
  },
  firstSectionLabel: {
    marginTop: 12,
  },

  /* ── Cards ─────────────────────────────────────── */
  card: {
    ...shadows.homeSurface,
    padding: 16,
    marginBottom: 18,
  },
  cardLabel: {
    fontFamily: fonts.bodyFamilySemiBold,
    fontSize: typography.titleMedium.fontSize,
    lineHeight: typography.titleMedium.lineHeight,
    marginBottom: 12,
  },
  cardDivider: {
    height: 1,
    marginVertical: 12,
  },

  /* ── Theme ─────────────────────────────────────── */
  themeOptions: {
    flexDirection: "row",
    flexWrap: "wrap",
    alignContent: "flex-start",
    gap: 12,
    marginBottom: 4,
  },
  themeSectionHeader: {
    flexDirection: "row",
    alignItems: "center",
    justifyContent: "space-between",
    paddingVertical: 2,
    marginBottom: 10,
  },
  themeOption: {
    flexBasis: "29%",
    flexGrow: 1,
    flexShrink: 0,
    maxWidth: "32%",
    flexDirection: "column",
    alignItems: "center",
    justifyContent: "center",
    paddingVertical: 10,
    paddingHorizontal: 10,
    borderRadius: 14,
    backgroundColor: "transparent",
    borderWidth: 1.5,
    gap: 6,
    minHeight: 66,
  },
  themeOptionText: {
    fontFamily: fonts.bodyFamilySemiBold,
    fontSize: 13,
    textAlign: "center",
  },

  /* ── Text Size Slider ──────────────────────────── */
  sliderRow: {
    flexDirection: "row",
    alignItems: "center",
    marginTop: 4,
  },
  sliderEdgeLabel: {
    fontFamily: fonts.bodyFamilyRegular,
    fontWeight: "600",
  },
  sliderTrack: {
    flex: 1,
    flexDirection: "row",
    alignItems: "center",
    paddingHorizontal: 12,
    gap: 4,
  },
  sliderStopTouch: {
    flex: 1,
    alignItems: "center",
  },
  sliderStop: {
    width: 10,
    height: 10,
    borderRadius: 5,
    borderWidth: 2,
  },

  /* ── Rows ──────────────────────────────────────── */
  row: {
    flexDirection: "row",
    alignItems: "center",
    justifyContent: "space-between",
    paddingVertical: 4,
  },
  rowTextWrap: {
    flex: 1,
    paddingRight: 12,
  },
  rowTitle: {
    fontFamily: fonts.bodyFamilyRegular,
    fontSize: 16,
  },
  rowDescription: {
    fontFamily: fonts.bodyFamily,
    fontSize: 14,
    marginTop: 2,
    lineHeight: 18,
  },
  timeValue: {
    fontFamily: fonts.bodyFamilyRegular,
    fontSize: 16,
    fontWeight: "600",
  },

  /* ── Time Picker ───────────────────────────────── */
  timePickerContainer: {
    marginTop: 8,
  },
  timePickerActions: {
    flexDirection: "row",
    justifyContent: "flex-end",
    marginTop: 8,
    gap: 12,
  },
  timePickerBtn: {
    paddingHorizontal: 12,
    paddingVertical: 8,
    borderRadius: 8,
  },
  timePickerBtnText: {
    fontFamily: fonts.bodyFamilyRegular,
    fontSize: 14,
  },

  /* ── Support Actions ───────────────────────────── */
  supportActions: {
    gap: 10,
  },
  supportAction: {
    flexDirection: "row",
    alignItems: "center",
    justifyContent: "space-between",
    paddingHorizontal: 14,
    paddingVertical: 13,
    borderRadius: 12,
    borderWidth: 1,
  },
  supportActionLeft: {
    flexDirection: "row",
    alignItems: "center",
    gap: 10,
  },
  supportActionText: {
    // fontSize/lineHeight applied inline (supportActionFontSize / supportActionLineHeight).
    fontFamily: fonts.bodyFamilySemiBold,
  },

  /* ── Subscription Row ──────────────────────────── */
  subscriptionRow: {
    ...shadows.homeSurface,
    flexDirection: "row",
    alignItems: "center",
    justifyContent: "space-between",
    padding: 14,
    marginBottom: 10,
    marginTop: 0,
  },
  subscriptionLeft: {
    flexDirection: "row",
    alignItems: "center",
    gap: 12,
  },
  subscriptionText: {
    fontFamily: fonts.bodyFamilySemiBold,
    fontSize: 16,
    lineHeight: 20,
  },

  /* ── About Footer ──────────────────────────────── */
  footerSection: {
    alignItems: "center",
    paddingHorizontal: 8,
    paddingTop: 16,
  },
  aboutText: {
    fontFamily: fonts.bodyFamilyRegular,
    fontSize: typography.bodyMedium.fontSize,
    lineHeight: typography.bodyMedium.lineHeight,
    textAlign: "left",
  },
  legalRow: {
    flexDirection: "row",
    alignItems: "center",
    gap: 8,
    marginBottom: 10,
  },
  legalLink: {
    fontFamily: fonts.bodyFamilyRegular,
    fontSize: 14,
  },
  legalDot: {
    fontSize: 14,
  },
  versionText: {
    fontFamily: fonts.bodyFamilyRegular,
    fontSize: 12,
    textAlign: "center",
    paddingVertical: 12,
  },

  /* ── Feedback Modal ────────────────────────────── */
  modalBackdrop: {
    flex: 1,
    justifyContent: "center",
    paddingHorizontal: 20,
  },
  feedbackModal: {
    padding: 24,
    borderRadius: 20,
    minHeight: "50%",
  },
  feedbackTitle: {
    fontFamily: fonts.headerFamilyItalic,
    fontSize: 22,
    marginBottom: 16,
  },
  feedbackInput: {
    borderWidth: 1,
    borderRadius: 10,
    padding: 14,
    fontFamily: fonts.bodyFamilyRegular,
    fontSize: 16,
    marginTop: 12,
  },
  feedbackInputMultiline: {
    minHeight: 120,
    textAlignVertical: "top",
  },
  feedbackActions: {
    flexDirection: "row",
    justifyContent: "flex-end",
    gap: 12,
    marginTop: 16,
  },
  feedbackSecondary: {
    paddingHorizontal: 14,
    paddingVertical: 10,
    borderRadius: 10,
  },
  feedbackSecondaryText: {
    fontFamily: fonts.bodyFamilyRegular,
  },
  feedbackPrimary: {
    paddingHorizontal: 16,
    paddingVertical: 10,
    borderRadius: 10,
  },
  feedbackPrimaryText: {
    fontFamily: fonts.bodyFamilyRegular,
    fontWeight: "600",
  },
});
