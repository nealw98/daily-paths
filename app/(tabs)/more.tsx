import React, { useMemo, useState } from "react";
import {
  View,
  Text,
  StyleSheet,
  ScrollView,
  TouchableOpacity,
  Switch,
  Linking,
  Platform,
  Modal,
  TextInput,
  KeyboardAvoidingView,
  Alert,
} from "react-native";
import { SafeAreaView, useSafeAreaInsets } from "react-native-safe-area-context";
import DateTimePicker from "@react-native-community/datetimepicker";
import Constants from "expo-constants";
import { Ionicons } from "@expo/vector-icons";
import { useRouter } from "expo-router";
import { useTheme } from "../../hooks/useTheme";
import { useAuth } from "../../contexts/AuthContext";
import { useSettings, TextSize } from "../../hooks/useSettings";
import { useAppFeedback } from "../../hooks/useAppFeedback";
import { useAnalytics } from "../../utils/analytics";
import { shareApp } from "../../utils/rateShareTracking";
import { updateNotificationWithThought } from "../../utils/notificationSync";
import { qaLog } from "../../utils/qaLog";
import { fonts } from "../../constants/theme";
import { TealHeader } from "../../components/shared/TealHeader";
import { Nautilus } from "../../components/icons";
import { PaywallModal } from "../../components/PaywallModal";
import { SignInModal } from "../../components/SignInModal";
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

const textSizeStops: TextSize[] = [
  "extraSmall",
  "small",
  "medium",
  "large",
  "extraLarge",
];

function parseTimeToDate(time: string): Date {
  const [h = "8", m = "0"] = time.split(":");
  const d = new Date();
  d.setHours(Number(h), Number(m), 0, 0);
  return d;
}

function formatTimeDisplay(date: Date): string {
  const hours = date.getHours();
  const minutes = date.getMinutes();
  const suffix = hours >= 12 ? "PM" : "AM";
  const displayHour = ((hours + 11) % 12) + 1;
  const minuteStr = minutes.toString().padStart(2, "0");
  return `${displayHour}:${minuteStr} ${suffix}`;
}

function formatTimeStorage(date: Date): string {
  const h = date.getHours().toString().padStart(2, "0");
  const m = date.getMinutes().toString().padStart(2, "0");
  return `${h}:${m}`;
}

export default function MoreTab() {
  const { colors } = useTheme();
  const insets = useSafeAreaInsets();
  const { user, isAuthenticated, signOut } = useAuth();
  const { settings, setTextSize, setThemeId, setColorScheme, setDailyReminderEnabled, setDailyReminderTime } =
    useSettings();
  const { submitting: submittingFeedback, submitFeedback } = useAppFeedback();
  const { updateThemeMode } = useAnalytics();
  const router = useRouter();

  const [showPaywall, setShowPaywall] = useState(false);
  const [showSignIn, setShowSignIn] = useState(false);
  const [showTimePicker, setShowTimePicker] = useState(false);
  const [tempReminderDate, setTempReminderDate] = useState<Date | null>(null);
  const [showFeedbackModal, setShowFeedbackModal] = useState(false);
  const [showRateModal, setShowRateModal] = useState(false);
  const [feedbackText, setFeedbackText] = useState("");
  const [feedbackContact, setFeedbackContact] = useState("");
  const [isSharing, setIsSharing] = useState(false);
  const [showExtendedThemes, setShowExtendedThemes] = useState(false);

  const expoConfig: any = Constants.expoConfig ?? {};
  const appVersion =
    expoConfig.version ?? Constants.nativeAppVersion ?? "dev";
  const iosBuildNumber =
    expoConfig.ios?.buildNumber ?? Constants.nativeBuildVersion ?? "dev";

  const reminderDate = useMemo(
    () => parseTimeToDate(settings.dailyReminderTime),
    [settings.dailyReminderTime]
  );

  const handleTextSizePress = async (size: TextSize) => {
    if (settings.textSize === size) return;
    await setTextSize(size);
  };

  const handleDecrementTextSize = async () => {
    const currentIndex = textSizeStops.indexOf(settings.textSize);
    if (currentIndex > 0) {
      await setTextSize(textSizeStops[currentIndex - 1]);
    }
  };

  const handleIncrementTextSize = async () => {
    const currentIndex = textSizeStops.indexOf(settings.textSize);
    if (currentIndex < textSizeStops.length - 1) {
      await setTextSize(textSizeStops[currentIndex + 1]);
    }
  };

  const handleThemeChange = (optionId: string) => {
    if (optionId === "system") {
      setColorScheme("system");
      updateThemeMode("system");
    } else {
      setThemeId(optionId);
      updateThemeMode(DARK_THEME_IDS.has(optionId) ? "dark" : "light");
    }
  };

  const handleReminderToggle = async (enabled: boolean) => {
    await setDailyReminderEnabled(enabled);
    if (enabled) {
      await updateNotificationWithThought();
    }
  };

  const handleRateApp = () => {
    qaLog("rate", "Rate App button pressed - showing rate modal");
    setShowRateModal(true);
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

    const success = await submitFeedback(
      feedbackText.trim(),
      feedbackContact.trim() || undefined
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

  const handleSignOut = () => {
    Alert.alert(
      "Sign Out",
      "Signing out will hide your journal and premium features until you sign back in. Your data won't be lost.",
      [
        { text: "Cancel", style: "cancel" },
        {
          text: "Sign Out",
          style: "destructive",
          onPress: async () => {
            await signOut();
          },
        },
      ],
    );
  };

  return (
    <SafeAreaView
      style={[styles.container, { backgroundColor: colors.pearl }]}
      edges={["top"]}
    >
      <TealHeader
        title="Settings"
        leftIcon={<Nautilus size={28} color={colors.textOnAccent} />}
      />

      <ScrollView
        style={styles.scrollView}
        contentContainerStyle={styles.scrollContent}
        showsVerticalScrollIndicator={false}
      >
        {/* ── 1. Account Banner ────────────────────────────── */}
        {isAuthenticated && user?.email ? (
          <View style={[styles.accountBanner, { backgroundColor: colors.cloud, borderColor: colors.mist }]}>
            <View style={[styles.avatar, { backgroundColor: colors.accent }]}>
              <Ionicons name="person" size={20} color={colors.textOnAccent} />
            </View>
            <View style={styles.accountInfo}>
              <Text style={[styles.accountEmail, { color: colors.text }]}>{user.email}</Text>
              <Text style={[styles.accountStatus, { color: colors.textSecondary }]}>Signed in</Text>
            </View>
            <TouchableOpacity onPress={handleSignOut} activeOpacity={0.7}>
              <Text style={[styles.signOutLink, { color: colors.danger }]}>Sign Out</Text>
            </TouchableOpacity>
          </View>
        ) : (
          <TouchableOpacity
            style={[styles.accountBanner, { backgroundColor: colors.cloud, borderColor: colors.mist }]}
            onPress={() => setShowSignIn(true)}
            activeOpacity={0.8}
          >
            <View style={[styles.avatar, { backgroundColor: colors.accent }]}>
              <Ionicons name="person-outline" size={20} color={colors.textOnAccent} />
            </View>
            <View style={styles.accountInfo}>
              <Text style={[styles.accountEmail, { color: colors.text }]}>Sign In</Text>
              <Text style={[styles.accountStatus, { color: colors.textSecondary }]}>Sync your data across devices</Text>
            </View>
            <Ionicons name="chevron-forward" size={20} color={colors.seafoam} />
          </TouchableOpacity>
        )}

        {/* ── 2. Appearance ────────────────────────────────── */}
        <Text style={[styles.sectionLabel, { color: colors.deepTeal }]}>Appearance</Text>
        <View style={[styles.card, { backgroundColor: colors.cloud, borderColor: colors.mist }]}>
          {/* Theme row */}
          <TouchableOpacity
            activeOpacity={0.7}
            onLongPress={() => setShowExtendedThemes(true)}
            delayLongPress={600}
          >
            <Text style={[styles.cardLabel, { color: colors.deepTeal }]}>Theme</Text>
          </TouchableOpacity>
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

          {showExtendedThemes && (
            <>
              <View style={[styles.cardDivider, { backgroundColor: colors.mist }]} />
              <Text style={[styles.cardLabel, { color: colors.deepTeal }]}>Premium Colors — Thank You for Subscribing!</Text>
              <View style={styles.themeOptions}>
                {EXTENDED_THEME_OPTIONS.map((option) => {
                  const isSelected =
                    settings.themeId === option.id && settings.colorScheme !== "system";
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
            </>
          )}

          {/* Divider */}
          <View style={[styles.cardDivider, { backgroundColor: colors.mist }]} />

          {/* Text size row */}
          <Text style={[styles.cardLabel, { color: colors.deepTeal }]}>Text Size</Text>
          <View style={styles.sliderRow}>
            <TouchableOpacity
              onPress={handleDecrementTextSize}
              disabled={settings.textSize === textSizeStops[0]}
              activeOpacity={0.7}
            >
              <Text
                style={[
                  styles.sliderEdgeLabel,
                  { color: colors.deepTeal, fontSize: 14 },
                  settings.textSize === textSizeStops[0] && { opacity: 0.3 },
                ]}
              >
                A
              </Text>
            </TouchableOpacity>
            <View style={styles.sliderTrack}>
              {textSizeStops.map((size, index) => {
                const selectedIndex = textSizeStops.indexOf(settings.textSize);
                const isActive = index <= selectedIndex;
                const isSelected = size === settings.textSize;
                return (
                  <TouchableOpacity
                    key={size}
                    style={styles.sliderStopTouch}
                    activeOpacity={0.8}
                    onPress={() => handleTextSizePress(size)}
                  >
                    <View
                      style={[
                        styles.sliderStop,
                        { borderColor: colors.border, backgroundColor: colors.pearl },
                        isActive && { borderColor: colors.seafoam, backgroundColor: colors.seafoam },
                        isSelected && { borderColor: colors.deepTeal, backgroundColor: colors.deepTeal },
                      ]}
                    />
                  </TouchableOpacity>
                );
              })}
            </View>
            <TouchableOpacity
              onPress={handleIncrementTextSize}
              disabled={settings.textSize === textSizeStops[textSizeStops.length - 1]}
              activeOpacity={0.7}
            >
              <Text
                style={[
                  styles.sliderEdgeLabel,
                  { color: colors.deepTeal, fontSize: 22 },
                  settings.textSize === textSizeStops[textSizeStops.length - 1] && { opacity: 0.3 },
                ]}
              >
                A
              </Text>
            </TouchableOpacity>
          </View>
        </View>

        {/* ── 3. Daily Notification ────────────────────────── */}
        <Text style={[styles.sectionLabel, { color: colors.deepTeal }]}>Daily Notification</Text>
        <View style={[styles.card, { backgroundColor: colors.cloud, borderColor: colors.mist }]}>
          <View style={styles.row}>
            <View style={styles.rowTextWrap}>
              <Text style={[styles.rowTitle, { color: colors.ink }]}>Thought for the Day</Text>
              <Text style={[styles.rowDescription, { color: colors.textSecondary }]}>
                Receive today's reading as a notification
              </Text>
            </View>
            <Switch
              value={settings.dailyReminderEnabled}
              onValueChange={handleReminderToggle}
              trackColor={{ false: colors.mist, true: colors.deepTeal }}
              thumbColor={settings.dailyReminderEnabled ? colors.pearl : colors.mist}
            />
          </View>

          <View style={[styles.cardDivider, { backgroundColor: colors.mist }]} />

          <View
            style={[
              styles.row,
              !settings.dailyReminderEnabled && { opacity: 0.5 },
            ]}
          >
            <Text style={[styles.rowTitle, { color: colors.ink }]}>Notification time</Text>
            <TouchableOpacity
              activeOpacity={0.7}
              disabled={!settings.dailyReminderEnabled}
              onPress={() => {
                if (settings.dailyReminderEnabled) {
                  setTempReminderDate(reminderDate);
                  setShowTimePicker(true);
                }
              }}
            >
              <Text style={[styles.timeValue, { color: colors.deepTeal }]}>
                {formatTimeDisplay(reminderDate)}
              </Text>
            </TouchableOpacity>
          </View>

          {showTimePicker && settings.dailyReminderEnabled && (
            <View style={styles.timePickerContainer}>
              <DateTimePicker
                value={tempReminderDate ?? reminderDate}
                mode="time"
                display={Platform.OS === "ios" ? "spinner" : "default"}
                onChange={(_, selectedDate) => {
                  if (!selectedDate) return;
                  setTempReminderDate(selectedDate);
                }}
              />
              <View style={styles.timePickerActions}>
                <TouchableOpacity
                  style={[styles.timePickerBtn, { backgroundColor: colors.mist }]}
                  onPress={() => {
                    setShowTimePicker(false);
                    setTempReminderDate(null);
                  }}
                >
                  <Text style={[styles.timePickerBtnText, { color: colors.ink }]}>Cancel</Text>
                </TouchableOpacity>
                <TouchableOpacity
                  style={[styles.timePickerBtn, { backgroundColor: colors.deepTeal }]}
                  onPress={async () => {
                    const finalDate = tempReminderDate ?? reminderDate;
                    setShowTimePicker(false);
                    setTempReminderDate(null);
                    await setDailyReminderTime(formatTimeStorage(finalDate));
                    await updateNotificationWithThought();
                  }}
                >
                  <Text style={[styles.timePickerBtnText, { color: colors.textOnAccent }]}>Set time</Text>
                </TouchableOpacity>
              </View>
            </View>
          )}
        </View>

        {/* ── 4. Help Others Find Us ──────────────────────── */}
        <Text style={[styles.sectionLabel, { color: colors.deepTeal }]}>Help Others Find Us</Text>
        <View style={[styles.card, { backgroundColor: colors.cloud, borderColor: colors.mist }]}>
          <View style={styles.buttonRow}>
            <TouchableOpacity
              style={[styles.secondaryButton, { borderColor: colors.mist, backgroundColor: colors.pearl }]}
              onPress={handleRateApp}
              activeOpacity={0.8}
            >
              <Ionicons name="star" size={18} color={colors.deepTeal} />
              <Text style={[styles.secondaryButtonText, { color: colors.deepTeal }]}>Rate App</Text>
            </TouchableOpacity>
            <TouchableOpacity
              style={[styles.secondaryButton, { borderColor: colors.mist, backgroundColor: colors.pearl }]}
              onPress={handleShareApp}
              disabled={isSharing}
              activeOpacity={0.8}
            >
              <Ionicons name="share-social" size={18} color={colors.deepTeal} />
              <Text style={[styles.secondaryButtonText, { color: colors.deepTeal }]}>
                {isSharing ? "Sharing..." : "Share App"}
              </Text>
            </TouchableOpacity>
          </View>
        </View>

        {/* ── 5. Send Feedback ────────────────────────────── */}
        <Text style={[styles.sectionLabel, { color: colors.deepTeal }]}>Send Feedback</Text>
        <View style={[styles.card, { backgroundColor: colors.cloud, borderColor: colors.mist }]}>
          <Text style={[styles.rowDescription, { color: colors.ink, marginBottom: 12 }]}>
            Tell us what's working and what to improve
          </Text>
          <TouchableOpacity
            style={[styles.primaryButton, { backgroundColor: colors.deepTeal }]}
            onPress={() => setShowFeedbackModal(true)}
            activeOpacity={0.8}
          >
            <Text style={[styles.primaryButtonText, { color: colors.textOnAccent }]}>Send Feedback</Text>
          </TouchableOpacity>
        </View>

        {/* ── 6. Manage Subscription ──────────────────────── */}
        <TouchableOpacity
          style={[styles.subscriptionRow, { backgroundColor: colors.cloud, borderColor: colors.mist }]}
          onPress={() => setShowPaywall(true)}
          activeOpacity={0.8}
        >
          <View style={styles.subscriptionLeft}>
            <Ionicons name="card-outline" size={22} color={colors.deepTeal} />
            <Text style={[styles.subscriptionText, { color: colors.text }]}>Manage Subscription</Text>
          </View>
          <Ionicons name="chevron-forward" size={20} color={colors.seafoam} />
        </TouchableOpacity>

        {/* ── 7. About Footer ─────────────────────────────── */}
        <View style={[styles.aboutSection, { paddingBottom: 8 + insets.bottom }]}>
          <Text style={[styles.aboutText, { color: colors.ink }]}>
            Daily Paths supports your recovery with 366 original readings based on Al-Anon's Steps, Traditions, and Concepts. It is not affiliated with Al-Anon, AA or any 12-step fellowship.
          </Text>

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
      <PaywallModal visible={showPaywall} onClose={() => { setShowPaywall(false); setShowExtendedThemes(true); }} />
      <SignInModal visible={showSignIn} onClose={() => setShowSignIn(false)} />

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
            >
              <Text style={[styles.feedbackTitle, { color: colors.deepTeal }]}>We'd love your feedback</Text>
              <TextInput
                style={[styles.feedbackInput, styles.feedbackInputMultiline, { borderColor: colors.mist, color: colors.ink }]}
                placeholder="Share your thoughts or suggestions..."
                placeholderTextColor={colors.ocean}
                multiline
                numberOfLines={5}
                value={feedbackText}
                onChangeText={setFeedbackText}
              />
              <TextInput
                style={[styles.feedbackInput, { borderColor: colors.mist, color: colors.ink }]}
                placeholder="Optional: your email if you'd like a reply"
                placeholderTextColor={colors.ocean}
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
                    !feedbackText.trim() && { opacity: 0.5 },
                  ]}
                  disabled={!feedbackText.trim() || submittingFeedback}
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
    paddingHorizontal: 16,
    paddingTop: 16,
    paddingBottom: 40,
  },

  /* ── Account Banner ────────────────────────────── */
  accountBanner: {
    flexDirection: "row",
    alignItems: "center",
    padding: 16,
    borderRadius: 12,
    borderWidth: 1,
    marginBottom: 20,
    shadowColor: "#000",
    shadowOffset: { width: 0, height: 2 },
    shadowOpacity: 0.05,
    shadowRadius: 4,
    elevation: 2,
  },
  avatar: {
    width: 40,
    height: 40,
    borderRadius: 20,
    alignItems: "center",
    justifyContent: "center",
  },
  accountInfo: {
    flex: 1,
    marginLeft: 14,
  },
  accountEmail: {
    fontFamily: fonts.bodyFamilyRegular,
    fontSize: 15,
    fontWeight: "600",
  },
  accountStatus: {
    fontFamily: fonts.bodyFamily,
    fontSize: 13,
    marginTop: 2,
  },
  signOutLink: {
    fontFamily: fonts.bodyFamilyRegular,
    fontSize: 14,
    fontWeight: "500",
  },

  /* ── Section Labels ────────────────────────────── */
  sectionLabel: {
    fontFamily: fonts.headerFamilyItalic,
    fontSize: 18,
    marginBottom: 8,
    marginTop: 4,
    marginLeft: 4,
  },

  /* ── Cards ─────────────────────────────────────── */
  card: {
    borderRadius: 12,
    borderWidth: 1,
    padding: 14,
    marginBottom: 16,
    shadowColor: "#000",
    shadowOffset: { width: 0, height: 2 },
    shadowOpacity: 0.05,
    shadowRadius: 4,
    elevation: 2,
  },
  cardLabel: {
    fontFamily: fonts.headerFamilyItalic,
    fontSize: 18,
    marginBottom: 10,
  },
  cardDivider: {
    height: 1,
    marginVertical: 12,
  },

  /* ── Theme ─────────────────────────────────────── */
  themeOptions: {
    flexDirection: "row",
    flexWrap: "wrap",
    gap: 10,
    marginBottom: 4,
  },
  themeOption: {
    minWidth: 85,
    flex: 1,
    flexDirection: "column",
    alignItems: "center",
    justifyContent: "center",
    paddingVertical: 8,
    paddingHorizontal: 10,
    borderRadius: 12,
    backgroundColor: "transparent",
    borderWidth: 2,
    gap: 4,
    minHeight: 60,
  },
  themeOptionText: {
    fontFamily: fonts.bodyFamilyRegular,
    fontSize: 13,
    fontWeight: "600",
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

  /* ── Buttons ───────────────────────────────────── */
  buttonRow: {
    flexDirection: "row",
    gap: 12,
  },
  secondaryButton: {
    flex: 1,
    flexDirection: "row",
    alignItems: "center",
    justifyContent: "center",
    gap: 8,
    paddingVertical: 12,
    borderRadius: 10,
    borderWidth: 2,
  },
  secondaryButtonText: {
    fontFamily: fonts.bodyFamilyRegular,
    fontSize: 16,
    fontWeight: "600",
  },
  primaryButton: {
    paddingVertical: 12,
    borderRadius: 10,
    alignItems: "center",
  },
  primaryButtonText: {
    fontFamily: fonts.bodyFamilyRegular,
    fontSize: 16,
    fontWeight: "600",
  },

  /* ── Subscription Row ──────────────────────────── */
  subscriptionRow: {
    flexDirection: "row",
    alignItems: "center",
    justifyContent: "space-between",
    padding: 16,
    borderRadius: 12,
    borderWidth: 1,
    marginBottom: 24,
    marginTop: 8,
    shadowColor: "#000",
    shadowOffset: { width: 0, height: 2 },
    shadowOpacity: 0.05,
    shadowRadius: 4,
    elevation: 2,
  },
  subscriptionLeft: {
    flexDirection: "row",
    alignItems: "center",
    gap: 12,
  },
  subscriptionText: {
    fontFamily: fonts.bodyFamilyRegular,
    fontSize: 16,
    fontWeight: "600",
  },

  /* ── About Footer ──────────────────────────────── */
  aboutSection: {
    alignItems: "center",
    paddingHorizontal: 8,
    paddingBottom: 8,
  },
  aboutText: {
    fontFamily: fonts.loraRegular,
    fontSize: 14,
    lineHeight: 22,
    textAlign: "center",
    marginBottom: 16,
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
