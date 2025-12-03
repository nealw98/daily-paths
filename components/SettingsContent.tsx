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

export const SettingsContent: React.FC = () => {
  const { settings, setTextSize, setDailyReminderEnabled, setDailyReminderTime } =
    useSettings();

  const [showTimePicker, setShowTimePicker] = useState(false);
   // Local working copy while the wheel is open so we don't commit
   // changes until the user confirms.
  const [tempReminderDate, setTempReminderDate] = useState<Date | null>(null);
  const router = useRouter();

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

  const handleReminderToggle = async (enabled: boolean) => {
    await setDailyReminderEnabled(enabled);
  };

  return (
    <View style={styles.container}>
      <ScrollView
        contentContainerStyle={styles.contentContainer}
        showsVerticalScrollIndicator={false}
      >
        <View style={styles.mainContent}>
          <View style={styles.section}>
            <Text style={styles.sectionTitle}>Reading text size</Text>
            <Text style={styles.sectionSubtitle}>
              Adjust how large the daily reading appears.
            </Text>

            <View style={styles.sliderRow}>
              <Text style={styles.sliderEdgeLabel}>Smaller</Text>
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
                          isActive && styles.sliderStopActive,
                          isSelected && styles.sliderStopSelected,
                        ]}
                      />
                    </TouchableOpacity>
                  );
                })}
              </View>
              <Text style={styles.sliderEdgeLabel}>Larger</Text>
            </View>

            <View style={styles.textPreviewContainer}>
              <Text
                style={[
                  styles.textPreview,
                  {
                    fontSize: typography.bodyFontSize,
                    lineHeight: typography.bodyLineHeight,
                  },
                ]}
              >
                Sample text size preview
              </Text>
            </View>
          </View>

          <View style={styles.section}>
            <Text style={styles.sectionTitle}>Daily reminder</Text>
            <Text style={styles.sectionSubtitle}>
              Get a gentle nudge to read each day.
            </Text>

            <View style={styles.row}>
              <View style={styles.rowText}>
                <Text style={styles.rowLabel}>Enable reminder</Text>
              </View>
              <Switch
                value={settings.dailyReminderEnabled}
                onValueChange={handleReminderToggle}
                trackColor={{ false: colors.mist, true: colors.seafoam }}
                thumbColor={settings.dailyReminderEnabled ? colors.deepTeal : "#fff"}
              />
            </View>

          <View
            style={[
              styles.timeRow,
              !settings.dailyReminderEnabled && styles.timeRowDisabled,
            ]}
          >
            <View style={styles.rowText}>
              <Text style={styles.rowLabel}>Reminder time</Text>
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
                  // Just update the working value; don't commit yet.
                  setTempReminderDate(selectedDate);
                }}
              />
              <View style={styles.timePickerActions}>
                <TouchableOpacity
                  style={styles.timePickerButtonSecondary}
                  onPress={() => {
                    setShowTimePicker(false);
                    setTempReminderDate(null);
                  }}
                >
                  <Text style={styles.timePickerButtonSecondaryText}>Cancel</Text>
                </TouchableOpacity>
                <TouchableOpacity
                  style={styles.timePickerButtonPrimary}
                  onPress={() => {
                    const finalDate = tempReminderDate ?? reminderDate;
                    setShowTimePicker(false);
                    setTempReminderDate(null);
                    setDailyReminderTime(formatTimeStorage(finalDate));
                  }}
                >
                  <Text style={styles.timePickerButtonPrimaryText}>Set time</Text>
                </TouchableOpacity>
              </View>
            </View>
          )}
          </View>
        </View>

        <View style={styles.divider} />

        <View style={styles.legalSection}>
          <View style={styles.legalRow}>
            <TouchableOpacity
              activeOpacity={0.7}
              onPress={() => Linking.openURL("https://dailypaths.org/privacy")}
            >
              <Text style={styles.linkLabel}>Privacy Policy</Text>
            </TouchableOpacity>

            <TouchableOpacity
              activeOpacity={0.7}
              onPress={() => Linking.openURL("https://dailypaths.org/terms")}
            >
              <Text style={styles.linkLabel}>Terms of Use</Text>
            </TouchableOpacity>
          </View>

          <View style={styles.versionContainer}>
          <TouchableOpacity
            activeOpacity={0.7}
            onLongPress={() => {
              router.push("/qa-logs");
            }}
          >
            <Text style={styles.versionText}>
              Version {appVersion} (build {iosBuildNumber})
            </Text>
          </TouchableOpacity>
          </View>
        </View>
      </ScrollView>
    </View>
  );
};

const styles = StyleSheet.create({
  container: {
  },
  contentContainer: {
    paddingHorizontal: 0,
    paddingTop: 24,
    paddingBottom: 16,
    flexGrow: 1,
  },
  mainContent: {
    flexGrow: 1,
  },
  section: {
    marginBottom: 40,
  },
  sectionTitle: {
    fontFamily: fonts.bodyFamilyRegular,
    fontSize: 20,
    color: colors.deepTeal,
    marginBottom: 4,
  },
  sectionSubtitle: {
    fontFamily: fonts.bodyFamilyRegular,
    fontSize: 16,
    color: "#5B8B89",
    marginBottom: 16,
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
  sliderRow: {
    flexDirection: "row",
    alignItems: "center",
    marginTop: 4,
  },
  sliderEdgeLabel: {
    fontFamily: fonts.bodyFamilyRegular,
    fontSize: 12,
    color: "#6b7280",
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
    marginTop: 16,
  },
  textPreview: {
    fontFamily: fonts.loraRegular,
    color: "#4b5563",
  },
  row: {
    flexDirection: "row",
    alignItems: "center",
    justifyContent: "space-between",
    paddingVertical: 12,
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
    paddingVertical: 16,
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


