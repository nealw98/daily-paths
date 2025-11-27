import React, { useMemo } from "react";
import {
  View,
  Text,
  StyleSheet,
  ScrollView,
  TouchableOpacity,
  Switch,
  Linking,
} from "react-native";
import Constants from "expo-constants";
import { Ionicons } from "@expo/vector-icons";
import { colors, fonts } from "../constants/theme";
import { useSettings, TextSize } from "../hooks/useSettings";

const textSizeLabels: { key: TextSize; label: string; description: string }[] =
  [
    { key: "small", label: "Small", description: "More text on screen" },
    { key: "medium", label: "Medium", description: "Balanced for most" },
    { key: "large", label: "Large", description: "Easier to read" },
    { key: "extraLarge", label: "Extra large", description: "Maximum size" },
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

  const appVersion =
    Constants.expoConfig?.version ?? Constants.nativeAppVersion ?? "dev";
  const buildNumber = Constants.nativeBuildVersion ?? "dev";

  const reminderDate = useMemo(
    () => parseTimeToDate(settings.dailyReminderTime),
    [settings.dailyReminderTime]
  );

  const handleTextSizePress = async (size: TextSize) => {
    if (settings.textSize === size) return;
    await setTextSize(size);
  };

  const handleReminderToggle = async (enabled: boolean) => {
    await setDailyReminderEnabled(enabled);
  };

  const adjustReminderTime = async (deltaMinutes: number) => {
    const next = new Date(reminderDate);
    // Apply raw delta
    next.setMinutes(next.getMinutes() + deltaMinutes);

    // Snap minutes to nearest 15-minute increment: 00, 15, 30, 45
    const minutes = next.getMinutes();
    const snapped = Math.round(minutes / 15) * 15;

    if (snapped === 60) {
      // Roll over to next hour at :00
      next.setHours(next.getHours() + 1, 0, 0, 0);
    } else {
      next.setMinutes(snapped, 0, 0);
    }

    await setDailyReminderTime(formatTimeStorage(next));
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

            <View style={styles.chipRow}>
              {textSizeLabels.map((item) => {
                const selected = settings.textSize === item.key;
                return (
                  <TouchableOpacity
                    key={item.key}
                    style={[
                      styles.chip,
                      selected && styles.chipSelected,
                    ]}
                    activeOpacity={0.8}
                    onPress={() => handleTextSizePress(item.key)}
                  >
                    <Text
                      style={[
                        styles.chipLabel,
                        selected && styles.chipLabelSelected,
                      ]}
                    >
                      {item.label}
                    </Text>
                    <Text
                      style={[
                        styles.chipDescription,
                        selected && styles.chipDescriptionSelected,
                      ]}
                      numberOfLines={1}
                    >
                      {item.description}
                    </Text>
                  </TouchableOpacity>
                );
              })}
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
                <Text style={styles.rowHelper}>
                  You can change this anytime.
                </Text>
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
                onPress={() => adjustReminderTime(-15)}
                disabled={!settings.dailyReminderEnabled}
                style={styles.timeStepperButton}
                activeOpacity={0.7}
              >
                <Ionicons
                  name="chevron-back"
                  size={18}
                  color={
                    settings.dailyReminderEnabled ? colors.ocean : colors.mist
                  }
                />
              </TouchableOpacity>

              <Text
                style={[
                  styles.timeValue,
                  !settings.dailyReminderEnabled && styles.timeValueDisabled,
                ]}
              >
                {formatTimeDisplay(reminderDate)}
              </Text>

              <TouchableOpacity
                onPress={() => adjustReminderTime(15)}
                disabled={!settings.dailyReminderEnabled}
                style={styles.timeStepperButton}
                activeOpacity={0.7}
              >
                <Ionicons
                  name="chevron-forward"
                  size={18}
                  color={
                    settings.dailyReminderEnabled ? colors.ocean : colors.mist
                  }
                />
              </TouchableOpacity>
            </View>
          </View>
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
            <Text style={styles.versionText}>
              Version {appVersion} (build {buildNumber})
            </Text>
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
    fontSize: 18,
    color: colors.deepTeal,
    marginBottom: 4,
  },
  sectionSubtitle: {
    fontFamily: fonts.bodyFamilyRegular,
    fontSize: 15,
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
    fontSize: 15,
    color: colors.ink,
  },
  rowHelper: {
    fontFamily: fonts.bodyFamily,
    fontSize: 12,
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
  timeStepperButton: {
    paddingHorizontal: 4,
    paddingVertical: 4,
  },
  timeValue: {
    fontFamily: fonts.bodyFamilyRegular,
    fontSize: 15,
    color: colors.deepTeal,
  },
  timeValueDisabled: {
    color: colors.mist,
  },
  footerSpacer: {
    height: 12,
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


