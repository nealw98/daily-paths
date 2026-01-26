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
import { fonts, lightColors } from "../constants/theme";
import { useTheme } from "../hooks/useTheme";
import { useSettings, TextSize } from "../hooks/useSettings";
import { useAppFeedback } from "../hooks/useAppFeedback";
import { shareApp } from "../utils/rateShareTracking";
import { qaLog } from "../utils/qaLog";
import { RateAppModal } from "./RateAppModal";

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
  const { settings, setTextSize, setDailyReminderEnabled, setDailyReminderTime } =
    useSettings();
  const { submitting: submittingFeedback, submitFeedback } = useAppFeedback();

  const [showTimePicker, setShowTimePicker] = useState(false);
   // Local working copy while the wheel is open so we don't commit
   // changes until the user confirms.
  const [tempReminderDate, setTempReminderDate] = useState<Date | null>(null);
  const [showFeedbackModal, setShowFeedbackModal] = useState(false);
  const [showRateModal, setShowRateModal] = useState(false);
  const [feedbackText, setFeedbackText] = useState("");
  const [feedbackContact, setFeedbackContact] = useState("");
  const [isSharing, setIsSharing] = useState(false);
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
            style={styles.modalBackdrop}
            activeOpacity={1}
            onPress={() => setShowFeedbackModal(false)}
          >
            <View
              style={styles.feedbackModal}
              onStartShouldSetResponder={() => true}
            >
              <Text style={styles.feedbackTitle}>We'd love your feedback</Text>
              <TextInput
                style={[styles.feedbackInput, styles.feedbackInputMultiline]}
                placeholder="Share your thoughts or suggestions..."
                placeholderTextColor="#9ca3af"
                multiline
                numberOfLines={5}
                value={feedbackText}
                onChangeText={setFeedbackText}
              />
              <TextInput
                style={styles.feedbackInput}
                placeholder="Optional: your email if you'd like a reply"
                placeholderTextColor="#9ca3af"
                value={feedbackContact}
                onChangeText={setFeedbackContact}
                keyboardType="email-address"
                autoCapitalize="none"
                autoCorrect={false}
              />
              <View style={styles.feedbackActions}>
                <TouchableOpacity
                  style={styles.feedbackSecondary}
                  onPress={() => setShowFeedbackModal(false)}
                  activeOpacity={0.8}
                >
                  <Text style={styles.feedbackSecondaryText}>Cancel</Text>
                </TouchableOpacity>
                <TouchableOpacity
                  style={[
                    styles.feedbackPrimary,
                    !feedbackText.trim() && { opacity: 0.5 },
                  ]}
                  disabled={!feedbackText.trim() || submittingFeedback}
                  onPress={handleSubmitFeedback}
                  activeOpacity={0.8}
                >
                  <Text style={styles.feedbackPrimaryText}>
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
    backgroundColor: "#fff",
    borderRadius: 12,
    marginBottom: 12,
    borderWidth: 1,
    borderColor: "#e5e7eb",
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
    borderBottomColor: "#f3f4f6",
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
    color: lightColors.deepTeal,
    marginBottom: 2,
  },
  sectionSubtitle: {
    fontFamily: fonts.bodyFamilyRegular,
    fontSize: 14,
    color: lightColors.ink,
    lineHeight: 18,
  },
  bodyText: {
    fontFamily: fonts.loraRegular,
    fontSize: 16,
    color: lightColors.ink,
    lineHeight: 24,
  },
  buttonRow: {
    flexDirection: "row",
    gap: 12,
    marginTop: 0,
  },
  themeOptions: {
    flexDirection: "row",
    gap: 12,
  },
  themeOption: {
    flex: 1,
    flexDirection: "column",
    alignItems: "center",
    justifyContent: "center",
    gap: 6,
    paddingVertical: 16,
    borderRadius: 12,
    backgroundColor: "#fff",
    borderWidth: 2,
    borderColor: lightColors.mist,
  },
  themeOptionSelected: {
    backgroundColor: lightColors.deepTeal,
    borderColor: lightColors.deepTeal,
  },
  themeOptionText: {
    fontFamily: fonts.bodyFamilyRegular,
    fontSize: 14,
    color: lightColors.deepTeal,
    fontWeight: "600",
  },
  themeOptionTextSelected: {
    color: "#fff",
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
    color: lightColors.deepTeal,
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
    borderColor: "#e5e7eb",
    backgroundColor: "#fff",
    marginHorizontal: 4,
    marginVertical: 4,
    minWidth: "45%",
  },
  chipSelected: {
    backgroundColor: lightColors.deepTeal,
    borderColor: lightColors.deepTeal,
  },
  chipLabel: {
    fontFamily: fonts.bodyFamilyRegular,
    fontSize: 15,
    color: "#374151",
  },
  chipLabelSelected: {
    color: "#fff",
  },
  chipDescription: {
    display: "none",
  },
  chipDescriptionSelected: {
    color: "#E8F3F3",
  },
  primaryButton: {
    marginTop: 16,
    paddingVertical: 12,
    borderRadius: 10,
    backgroundColor: lightColors.deepTeal,
    alignItems: "center",
  },
  primaryButtonText: {
    fontFamily: fonts.bodyFamilyRegular,
    fontSize: 16,
    color: "#fff",
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
    color: lightColors.deepTeal,
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
    borderColor: "#e5e7eb",
    backgroundColor: "#ffffff",
  },
  sliderStopActive: {
    borderColor: lightColors.seafoam,
    backgroundColor: lightColors.seafoam,
  },
  sliderStopSelected: {
    borderColor: lightColors.deepTeal,
    backgroundColor: lightColors.deepTeal,
    transform: [{ scale: 1.1 }],
  },
  textPreviewContainer: {
    marginTop: 20,
    paddingTop: 16,
    borderTopWidth: 1,
    borderTopColor: "#f3f4f6",
  },
  textPreview: {
    fontFamily: fonts.loraRegular,
    color: "#4b5563",
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
    color: lightColors.ink,
  },
  rowHelper: {
    fontFamily: fonts.bodyFamily,
    fontSize: 13,
    color: lightColors.ocean,
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
    color: lightColors.ink,
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
    backgroundColor: "#e5e7eb",
  },
  timePickerButtonSecondaryText: {
    fontFamily: fonts.bodyFamilyRegular,
    fontSize: 14,
    color: "#4b5563",
  },
  timePickerButtonPrimary: {
    paddingHorizontal: 12,
    paddingVertical: 8,
    borderRadius: 8,
    backgroundColor: lightColors.deepTeal,
  },
  timePickerButtonPrimaryText: {
    fontFamily: fonts.bodyFamilyRegular,
    fontSize: 14,
    color: "#ffffff",
  },
  divider: {
    height: 1,
    backgroundColor: "#f3f4f6",
    marginTop: 24,
    marginBottom: 0,
  },
  legalSection: {
    paddingTop: 20,
    paddingHorizontal: 0,
    paddingBottom: 8,
    borderTopWidth: 1,
    borderTopColor: "#f3f4f6",
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
    color: lightColors.deepTeal,
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
    color: "#9ca3af",
    textAlign: "center",
  },
  modalBackdrop: {
    flex: 1,
    backgroundColor: "rgba(0, 0, 0, 0.4)",
    justifyContent: "center",
    paddingHorizontal: 20,
  },
  feedbackModal: {
    backgroundColor: "#fff",
    padding: 24,
    borderRadius: 20,
    minHeight: "50%",
  },
  feedbackTitle: {
    fontFamily: fonts.headerFamilyItalic,
    fontSize: 22,
    color: lightColors.deepTeal,
    marginBottom: 16,
  },
  feedbackInput: {
    borderWidth: 1,
    borderColor: "#e5e7eb",
    borderRadius: 10,
    padding: 14,
    fontFamily: fonts.bodyFamilyRegular,
    fontSize: 16,
    color: lightColors.ink,
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
    backgroundColor: "#e5e7eb",
  },
  feedbackSecondaryText: {
    fontFamily: fonts.bodyFamilyRegular,
    color: "#4b5563",
  },
  feedbackPrimary: {
    paddingHorizontal: 16,
    paddingVertical: 10,
    borderRadius: 10,
    backgroundColor: lightColors.deepTeal,
  },
  feedbackPrimaryText: {
    fontFamily: fonts.bodyFamilyRegular,
    color: "#fff",
    fontWeight: "600",
  },
});


