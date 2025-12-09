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
} from "react-native";
import DateTimePicker from "@react-native-community/datetimepicker";
import Constants from "expo-constants";
import { Ionicons } from "@expo/vector-icons";
import { useRouter } from "expo-router";
import { colors, fonts } from "../constants/theme";
import { useSettings, TextSize, getTextSizeMetrics } from "../hooks/useSettings";

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
  const { settings, setTextSize, setDailyReminderEnabled, setDailyReminderTime } =
    useSettings();

  const [showTimePicker, setShowTimePicker] = useState(false);
   // Local working copy while the wheel is open so we don't commit
   // changes until the user confirms.
  const [tempReminderDate, setTempReminderDate] = useState<Date | null>(null);
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

  const typography = useMemo(
    () => getTextSizeMetrics(settings.textSize),
    [settings.textSize]
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

  const handleReminderToggle = async (enabled: boolean) => {
    await setDailyReminderEnabled(enabled);
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
          {(() => {
            const base = typography.bodyFontSize;
            const subtitleSize = Math.max(10, base - 2); // 2pt smaller, scaled from user size
            return (
              <Text
                style={[
                  styles.sectionSubtitle,
                  { fontSize: subtitleSize, lineHeight: subtitleSize + 6 },
                ]}
              >
                A daily reading companion inspired by the Al‑Anon daily readers, created independently for personal reflection.
              </Text>
            );
          })()}
          <Text
            style={[
              styles.bodyText,
              {
                marginTop: 10,
                fontSize: Math.max(10, typography.bodyFontSize - 2),
                lineHeight: Math.max(10, typography.bodyFontSize - 2) + 7,
              },
            ]}
          >
            Daily Paths is not affiliated with Al‑Anon, Alcoholics Anonymous, or any other 12‑step fellowship. The readings are provided for personal use and are not official literature of any organization.
          </Text>
        </View>
      </ScrollView>

      <View style={styles.legalSection}>
        <View style={styles.legalRow}>
          <TouchableOpacity
            activeOpacity={0.7}
            onPress={() => Linking.openURL("https://dailypaths.org/privacy")}
          >
            <Text style={styles.linkLabel} allowFontScaling={false}>
              Privacy Policy
            </Text>
          </TouchableOpacity>

          <TouchableOpacity
            activeOpacity={0.7}
            onPress={() => Linking.openURL("https://dailypaths.org/support")}
          >
            <Text style={styles.linkLabel} allowFontScaling={false}>
              Support
            </Text>
          </TouchableOpacity>

          <TouchableOpacity
            activeOpacity={0.7}
            onPress={() => Linking.openURL("https://dailypaths.org/terms")}
          >
            <Text style={styles.linkLabel} allowFontScaling={false}>
              Terms of Use
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
            <Text style={styles.versionText} allowFontScaling={false}>
              Version {appVersion} (build {iosBuildNumber})
            </Text>
          </TouchableOpacity>
        </View>
      </View>
    </View>
  );
};

const styles = StyleSheet.create({
  container: {
    flex: 1,
  },
  contentContainer: {
    paddingHorizontal: 0,
    paddingTop: 24,
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
    marginBottom: 16,
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
    padding: 16,
    paddingBottom: 12,
    gap: 12,
    borderBottomWidth: 1,
    borderBottomColor: "#f3f4f6",
  },
  sectionHeaderText: {
    flex: 1,
  },
  sectionBody: {
    padding: 16,
    paddingTop: 12,
  },
  section: {
    marginBottom: 40,
  },
  sectionTitle: {
    fontFamily: fonts.bodyFamilyRegular,
    fontSize: 18,
    fontWeight: "600",
    color: colors.deepTeal,
    marginBottom: 2,
  },
  sectionSubtitle: {
    fontFamily: fonts.bodyFamilyRegular,
    fontSize: 14,
    color: colors.ink,
    lineHeight: 18,
  },
  bodyText: {
    fontFamily: fonts.bodyFamilyRegular,
    fontSize: 15,
    color: colors.ink,
    lineHeight: 22,
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
    backgroundColor: colors.deepTeal,
    borderColor: colors.deepTeal,
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
    backgroundColor: colors.deepTeal,
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
    color: colors.deepTeal,
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
    borderColor: colors.seafoam,
    backgroundColor: colors.seafoam,
  },
  sliderStopSelected: {
    borderColor: colors.deepTeal,
    backgroundColor: colors.deepTeal,
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
    color: colors.ink,
  },
  rowHelper: {
    fontFamily: fonts.bodyFamily,
    fontSize: 13,
    color: colors.ocean,
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
    color: colors.ink,
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
    backgroundColor: colors.deepTeal,
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
    paddingTop: 32,
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
    color: colors.deepTeal,
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
});


