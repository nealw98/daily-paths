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
import DateTimePicker from "@react-native-community/datetimepicker";
import Constants from "expo-constants";
import { Ionicons } from "@expo/vector-icons";
import { useRouter } from "expo-router";
import { fonts } from "../constants/theme";
import { useTheme } from "../hooks/useTheme";
import { useSettings, TextSize } from "../hooks/useSettings";
import { useAppFeedback } from "../hooks/useAppFeedback";
import { useAnalytics } from "../utils/analytics";
import { shareApp } from "../utils/rateShareTracking";
import { updateNotificationWithThought } from "../utils/notificationSync";
import { qaLog } from "../utils/qaLog";
import { RateAppModal } from "./RateAppModal";

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

export const SettingsContent: React.FC<{ 
  onOpenQaLogs?: () => void;
  scrollToSection?: "textSize" | "reminder";
}> = ({
  onOpenQaLogs,
  scrollToSection,
}) => {
  const { colors } = useTheme();
  const { settings, setTextSize, setThemeId, setColorScheme, setDailyReminderEnabled, setDailyReminderTime } =
    useSettings();
  const { submitting: submittingFeedback, submitFeedback } = useAppFeedback();
  const { updateThemeMode } = useAnalytics();

  const [showTimePicker, setShowTimePicker] = useState(false);
   // Local working copy while the wheel is open so we don't commit
   // changes until the user confirms.
  const [tempReminderDate, setTempReminderDate] = useState<Date | null>(null);
  const [showFeedbackModal, setShowFeedbackModal] = useState(false);
  const [showRateModal, setShowRateModal] = useState(false);
  const [feedbackText, setFeedbackText] = useState("");
  const [feedbackContact, setFeedbackContact] = useState("");
  const [isSharing, setIsSharing] = useState(false);
  const [showExtendedThemes, setShowExtendedThemes] = useState(false);
  const router = useRouter();
  const scrollViewRef = React.useRef<ScrollView>(null);
  const textSizeRef = React.useRef<View>(null);
  const reminderRef = React.useRef<View>(null);

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

  // Scroll to specific section when requested
  React.useEffect(() => {
    if (!scrollToSection) return;

    const timer = setTimeout(() => {
      if (scrollToSection === "textSize" && textSizeRef.current) {
        textSizeRef.current.measureLayout(
          scrollViewRef.current as any,
          (x, y) => {
            scrollViewRef.current?.scrollTo({ y: y - 20, animated: true });
          },
          () => {}
        );
      } else if (scrollToSection === "reminder" && reminderRef.current) {
        reminderRef.current.measureLayout(
          scrollViewRef.current as any,
          (x, y) => {
            scrollViewRef.current?.scrollTo({ y: y - 20, animated: true });
          },
          () => {}
        );
      }
    }, 100);

    return () => clearTimeout(timer);
  }, [scrollToSection]);

  return (
    <View style={styles.container}>
      <ScrollView
        ref={scrollViewRef}
        contentContainerStyle={styles.contentContainer}
        showsVerticalScrollIndicator={false}
      >
        <View style={styles.mainContent}>
          {/* 1. Appearance: Theme + Text Size */}
          <View style={[styles.sectionCard, { backgroundColor: colors.cloud, borderColor: colors.mist }]}>
            <View style={[styles.sectionHeader, { borderBottomColor: colors.mist }]}>
              <Ionicons name="color-palette-outline" size={22} color={colors.deepTeal} />
              <View style={styles.sectionHeaderText}>
                <Text style={[styles.sectionTitle, { color: colors.deepTeal }]}>Appearance</Text>
                <Text style={[styles.sectionSubtitle, { color: colors.ink }]}>
                  Theme and text size
                </Text>
              </View>
            </View>
            <View style={styles.sectionBody}>
              {/* Theme */}
              <TouchableOpacity
                activeOpacity={0.7}
                onLongPress={() => setShowExtendedThemes(true)}
                delayLongPress={600}
              >
                <Text style={[styles.appearanceLabel, { color: colors.deepTeal }]}>Theme</Text>
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
                  <Text style={[styles.appearanceLabel, { color: colors.deepTeal }]}>Colors</Text>
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

              {/* Text Size */}
              <Text style={[styles.appearanceLabel, { color: colors.deepTeal, marginTop: 16 }]}>Text Size</Text>
              <View style={styles.sliderRow}>
                <TouchableOpacity
                  onPress={handleDecrementTextSize}
                  disabled={settings.textSize === textSizeStops[0]}
                  activeOpacity={0.7}
                >
                  <Text
                    style={[
                      styles.sliderEdgeLabel,
                      { color: colors.deepTeal },
                      settings.textSize === textSizeStops[0] && styles.sliderEdgeLabelDisabled,
                    ]}
                  >
                    Smaller
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
                      { color: colors.deepTeal },
                      settings.textSize === textSizeStops[textSizeStops.length - 1] &&
                        styles.sliderEdgeLabelDisabled,
                    ]}
                  >
                    Larger
                  </Text>
                </TouchableOpacity>
              </View>
            </View>
          </View>

          {/* 2. Daily Notification */}
          <View ref={reminderRef} style={[styles.sectionCard, { backgroundColor: colors.cloud, borderColor: colors.mist }]}>
            <View style={[styles.sectionHeader, { borderBottomColor: colors.mist }]}>
              <Ionicons name="notifications-outline" size={22} color={colors.deepTeal} />
              <View style={styles.sectionHeaderText}>
                <Text style={[styles.sectionTitle, { color: colors.deepTeal }]}>Daily Notification</Text>
                <Text style={[styles.sectionSubtitle, { color: colors.ink }]}>
                  Receive the Thought for the Day
                </Text>
              </View>
            </View>
            <View style={styles.sectionBody}>
              <View style={styles.row}>
                <View style={styles.rowText}>
                  <Text style={[styles.rowLabel, { color: colors.ink }]}>Enable daily notification</Text>
                </View>
                <Switch
                  value={settings.dailyReminderEnabled}
                  onValueChange={handleReminderToggle}
                  trackColor={{ false: colors.mist, true: colors.deepTeal }}
                  thumbColor={settings.dailyReminderEnabled ? colors.pearl : colors.mist}
                />
              </View>

              <View
                style={[
                  styles.timeRow,
                  !settings.dailyReminderEnabled && styles.timeRowDisabled,
                ]}
              >
                <View style={styles.rowText}>
                  <Text style={[styles.rowLabel, { color: colors.ink }]}>Notification time</Text>
                </View>
                <View style={styles.timeStepperContainer}>
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
                    <Text
                      style={[
                        styles.timeValue,
                        { color: colors.ink },
                        !settings.dailyReminderEnabled && styles.timeValueDisabled,
                      ]}
                    >
                      {formatTimeDisplay(reminderDate)}
                    </Text>
                  </TouchableOpacity>
                </View>
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
                      style={[styles.timePickerButtonSecondary, { backgroundColor: colors.mist }]}
                      onPress={() => {
                        setShowTimePicker(false);
                        setTempReminderDate(null);
                      }}
                    >
                      <Text style={[styles.timePickerButtonSecondaryText, { color: colors.ink }]}>Cancel</Text>
                    </TouchableOpacity>
                    <TouchableOpacity
                      style={[styles.timePickerButtonPrimary, { backgroundColor: colors.deepTeal }]}
                      onPress={async () => {
                        const finalDate = tempReminderDate ?? reminderDate;
                        setShowTimePicker(false);
                        setTempReminderDate(null);
                        await setDailyReminderTime(formatTimeStorage(finalDate));
                        await updateNotificationWithThought();
                      }}
                    >
                      <Text style={[styles.timePickerButtonPrimaryText, { color: colors.textOnAccent }]}>Set time</Text>
                    </TouchableOpacity>
                  </View>
                </View>
              )}
            </View>
          </View>

          {/* 3. Rate & Share */}
          <View style={[styles.sectionCard, { backgroundColor: colors.cloud, borderColor: colors.mist }]}>
            <View style={[styles.sectionHeader, { borderBottomColor: colors.mist }]}>
              <Ionicons name="star-outline" size={22} color={colors.deepTeal} />
              <View style={styles.sectionHeaderText}>
                <Text style={[styles.sectionTitle, { color: colors.deepTeal }]}>Rate & Share</Text>
                <Text style={[styles.sectionSubtitle, { color: colors.ink }]}>
                  Help others discover Daily Paths
                </Text>
              </View>
            </View>
            <View style={styles.sectionBody}>
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
          </View>

          {/* 4. Share Feedback */}
          <View style={[styles.sectionCard, { backgroundColor: colors.cloud, borderColor: colors.mist }]}>
            <View style={[styles.sectionHeader, { borderBottomColor: colors.mist }]}>
              <Ionicons name="chatbubbles-outline" size={22} color={colors.deepTeal} />
              <View style={styles.sectionHeaderText}>
                <Text style={[styles.sectionTitle, { color: colors.deepTeal }]}>Share Feedback</Text>
                <Text style={[styles.sectionSubtitle, { color: colors.ink }]}>
                  Tell us what's working and what to improve
                </Text>
              </View>
            </View>
            <View style={styles.sectionBody}>
              <TouchableOpacity
                style={[styles.secondaryButton, { borderColor: colors.mist, backgroundColor: colors.pearl }]}
                onPress={() => setShowFeedbackModal(true)}
                activeOpacity={0.8}
              >
                <Ionicons name="chatbubble-ellipses" size={18} color={colors.deepTeal} />
                <Text style={[styles.secondaryButtonText, { color: colors.deepTeal }]}>Send Feedback</Text>
              </TouchableOpacity>
            </View>
          </View>

          {/* 5. About */}
          <View style={[styles.sectionCard, { backgroundColor: colors.cloud, borderColor: colors.mist }]}>
            <View style={[styles.sectionHeader, { borderBottomColor: colors.mist }]}>
              <Ionicons
                name="information-circle-outline"
                size={22}
                color={colors.deepTeal}
              />
              <View style={styles.sectionHeaderText}>
                <Text style={[styles.sectionTitle, { color: colors.deepTeal }]}>About</Text>
              </View>
            </View>
            <View style={styles.sectionBody}>
              <Text
                style={{
                  fontSize: 16,
                  lineHeight: 24,
                  fontFamily: fonts.loraRegular,
                  color: colors.ink,
                }}
              >
                Daily Paths supports your recovery with 366 original readings based on Al-Anon's Steps, Traditions, and Concepts. It is not affiliated with Al-Anon, AA or any 12-step fellowship.
              </Text>
            </View>
          </View>
        </View>
      </ScrollView>

      <View style={[styles.legalSection, { borderTopColor: colors.mist }]}>
        <View style={styles.legalRow}>
          <TouchableOpacity
            activeOpacity={0.7}
            onPress={() => Linking.openURL("https://dailypaths.org/privacy")}
          >
            <Text style={[styles.linkLabel, { color: colors.deepTeal }]} allowFontScaling={false}>
              Privacy Policy
            </Text>
          </TouchableOpacity>

          <TouchableOpacity
            activeOpacity={0.7}
            onPress={() => Linking.openURL("https://dailypaths.org/support")}
          >
            <Text style={[styles.linkLabel, { color: colors.deepTeal }]} allowFontScaling={false}>
              Support
            </Text>
          </TouchableOpacity>

          <TouchableOpacity
            activeOpacity={0.7}
            onPress={() => Linking.openURL("https://www.apple.com/legal/internet-services/itunes/dev/stdeula/")}
          >
            <Text style={[styles.linkLabel, { color: colors.deepTeal }]} allowFontScaling={false}>
              Terms of Service
            </Text>
          </TouchableOpacity>
        </View>

        <View style={styles.versionContainer}>
          <TouchableOpacity
            activeOpacity={0.7}
            onLongPress={() => {
              // Close settings before navigating to QA
              onOpenQaLogs?.();
              router.push("/qa-logs");
            }}
          >
            <Text style={[styles.versionText, { color: colors.ocean }]} allowFontScaling={false}>
              Version {appVersion} (build {iosBuildNumber})
            </Text>
          </TouchableOpacity>
        </View>
      </View>

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
    </View>
  );
};

const styles = StyleSheet.create({
  container: {
    flex: 1,
  },
  contentContainer: {
    paddingHorizontal: 0,
    paddingTop: 16,
    paddingBottom: 160,
    flexGrow: 1,
  },
  mainContent: {
    flexGrow: 1,
    paddingHorizontal: 20,
  },
  sectionCard: {
    borderRadius: 12,
    marginBottom: 12,
    borderWidth: 1,
    shadowColor: "#000",
    shadowOffset: { width: 0, height: 2 },
    shadowOpacity: 0.05,
    shadowRadius: 4,
    elevation: 2,
  },
  sectionHeader: {
    flexDirection: "row",
    alignItems: "flex-start",
    padding: 14,
    paddingBottom: 10,
    gap: 12,
    borderBottomWidth: 1,
  },
  sectionHeaderText: {
    flex: 1,
  },
  sectionBody: {
    padding: 14,
    paddingTop: 10,
  },
  section: {
    marginBottom: 40,
  },
  sectionTitle: {
    fontFamily: fonts.bodyFamilyRegular,
    fontSize: 18,
    fontWeight: "600",
    marginBottom: 2,
  },
  sectionSubtitle: {
    fontFamily: fonts.bodyFamilyRegular,
    fontSize: 14,
    lineHeight: 18,
  },
  bodyText: {
    fontFamily: fonts.loraRegular,
    fontSize: 16,
    lineHeight: 24,
  },
  buttonRow: {
    flexDirection: "row",
    gap: 12,
    marginTop: 0,
  },
  appearanceLabel: {
    fontFamily: fonts.headerFamilyItalic,
    fontSize: 18,
    marginBottom: 10,
  },
  themeOptions: {
    flexDirection: "row",
    flexWrap: "wrap",
    gap: 10,
    marginBottom: 12,
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
  chipRow: {
    flexDirection: "row",
    flexWrap: "wrap",
    marginHorizontal: -4,
  },
  chip: {
    paddingVertical: 14,
    paddingHorizontal: 20,
    borderRadius: 12,
    borderWidth: 2,
    marginHorizontal: 4,
    marginVertical: 4,
    minWidth: "45%",
  },
  chipSelected: {
  },
  chipLabel: {
    fontFamily: fonts.bodyFamilyRegular,
    fontSize: 15,
  },
  chipLabelSelected: {
  },
  chipDescription: {
    display: "none",
  },
  chipDescriptionSelected: {
  },
  primaryButton: {
    marginTop: 16,
    paddingVertical: 12,
    borderRadius: 10,
    alignItems: "center",
  },
  primaryButtonText: {
    fontFamily: fonts.bodyFamilyRegular,
    fontSize: 16,
    fontWeight: "600",
  },
  sliderRow: {
    flexDirection: "row",
    alignItems: "center",
    marginTop: 8,
  },
  sliderEdgeLabel: {
    fontFamily: fonts.bodyFamilyRegular,
    fontSize: 12,
    fontWeight: "600",
  },
  sliderEdgeLabelDisabled: {
    opacity: 0.3,
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
  sliderStopActive: {
  },
  sliderStopSelected: {
    transform: [{ scale: 1.1 }],
  },
  textPreviewContainer: {
    marginTop: 20,
    paddingTop: 16,
    borderTopWidth: 1,
  },
  textPreview: {
    fontFamily: fonts.loraRegular,
  },
  row: {
    flexDirection: "row",
    alignItems: "center",
    justifyContent: "space-between",
    paddingVertical: 8,
  },
  rowText: {
    flex: 1,
    paddingRight: 12,
  },
  rowLabel: {
    fontFamily: fonts.bodyFamilyRegular,
    fontSize: 16,
  },
  rowHelper: {
    fontFamily: fonts.bodyFamily,
    fontSize: 13,
    marginTop: 2,
  },
  timeRow: {
    flexDirection: "row",
    alignItems: "center",
    justifyContent: "space-between",
    paddingVertical: 8,
  },
  timeRowDisabled: {
    opacity: 0.5,
  },
  timeStepperContainer: {
    flexDirection: "row",
    alignItems: "center",
    gap: 8,
  },
  timeValue: {
    fontFamily: fonts.bodyFamilyRegular,
    fontSize: 16,
  },
  timeValueDisabled: {
    // No extra dimming; row opacity handles the disabled look
  },
  footerSpacer: {
    height: 12,
  },
  timePickerContainer: {
    marginTop: 8,
  },
  timePickerActions: {
    flexDirection: "row",
    justifyContent: "flex-end",
    marginTop: 8,
    gap: 12,
  },
  timePickerButtonSecondary: {
    paddingHorizontal: 12,
    paddingVertical: 8,
    borderRadius: 8,
  },
  timePickerButtonSecondaryText: {
    fontFamily: fonts.bodyFamilyRegular,
    fontSize: 14,
  },
  timePickerButtonPrimary: {
    paddingHorizontal: 12,
    paddingVertical: 8,
    borderRadius: 8,
  },
  timePickerButtonPrimaryText: {
    fontFamily: fonts.bodyFamilyRegular,
    fontSize: 14,
  },
  divider: {
    height: 1,
    marginTop: 24,
    marginBottom: 0,
  },
  legalSection: {
    paddingTop: 20,
    paddingHorizontal: 0,
    paddingBottom: 8,
    borderTopWidth: 1,
  },
  legalRow: {
    flexDirection: "row",
    alignItems: "center",
    justifyContent: "space-between",
    paddingVertical: 4,
  },
  linkRow: {
  },
  linkLabel: {
    fontFamily: fonts.bodyFamilyRegular,
    fontSize: 14,
  },
  versionContainer: {
    paddingTop: 8,
    paddingHorizontal: 0,
    paddingBottom: 0,
    alignItems: "center",
  },
  versionText: {
    fontFamily: fonts.bodyFamilyRegular,
    fontSize: 12,
    textAlign: "center",
  },
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


