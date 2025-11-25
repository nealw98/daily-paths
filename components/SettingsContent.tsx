import React, { useMemo, useState } from "react";
import {
  View,
  Text,
  StyleSheet,
  TouchableOpacity,
  Switch,
  Alert,
} from "react-native";
import { Ionicons } from "@expo/vector-icons";
import * as Notifications from "expo-notifications";
import { colors, fonts } from "../constants/theme";
import { TextSize, useSettings, getTextSizeMetrics } from "../hooks/useSettings";

async function ensureNotificationPermissions(): Promise<boolean> {
  const { status: existingStatus } = await Notifications.getPermissionsAsync();
  if (existingStatus === "granted") {
    return true;
  }
  const { status } = await Notifications.requestPermissionsAsync();
  return status === "granted";
}

async function scheduleDailyReminder(time: string) {
  const [hourStr, minuteStr] = time.split(":");
  const hour = Number(hourStr);
  const minute = Number(minuteStr);

  // Clear any existing scheduled reminders for simplicity
  await Notifications.cancelAllScheduledNotificationsAsync();

  await Notifications.scheduleNotificationAsync({
    content: {
      title: "Daily Paths",
      body: "Take a moment for today's reading.",
    },
    trigger: {
      hour,
      minute,
      repeats: true,
    },
  });
}

export const SettingsContent: React.FC = () => {
  const { settings, setTextSize, setDailyReminderEnabled, setDailyReminderTime } =
    useSettings();
  const [isScheduling, setIsScheduling] = useState(false);

  const metrics = useMemo(() => getTextSizeMetrics(settings.textSize), [
    settings.textSize,
  ]);

  const handleTextSizePress = async (size: TextSize) => {
    if (size === settings.textSize) return;
    await setTextSize(size);
  };

  const handleToggleReminder = async (enabled: boolean) => {
    if (isScheduling) return;

    if (enabled) {
      setIsScheduling(true);
      try {
        const granted = await ensureNotificationPermissions();
        if (!granted) {
          Alert.alert(
            "Notifications not enabled",
            "To turn on daily reminders, enable notifications for Daily Paths in your device settings."
          );
          return;
        }
        await setDailyReminderEnabled(true);
        await scheduleDailyReminder(settings.dailyReminderTime);
      } catch (e) {
        console.warn("Failed to enable daily reminder", e);
        Alert.alert(
          "Could not enable reminder",
          "Something went wrong while setting up your daily reminder."
        );
      } finally {
        setIsScheduling(false);
      }
    } else {
      setIsScheduling(true);
      try {
        await setDailyReminderEnabled(false);
        await Notifications.cancelAllScheduledNotificationsAsync();
      } catch (e) {
        console.warn("Failed to disable daily reminder", e);
      } finally {
        setIsScheduling(false);
      }
    }
  };

  const handleSelectTime = async (value: string) => {
    if (value === settings.dailyReminderTime) return;
    setIsScheduling(true);
    try {
      await setDailyReminderTime(value);
      if (settings.dailyReminderEnabled) {
        await scheduleDailyReminder(value);
      }
    } catch (e) {
      console.warn("Failed to update reminder time", e);
    } finally {
      setIsScheduling(false);
    }
  };

  const formatReminderLabel = (value: string) => {
    const [hourStr, minuteStr] = value.split(":");
    const hour = Number(hourStr);
    const minute = Number(minuteStr) || 0;
    if (Number.isNaN(hour)) return "Set time";

    const isPM = hour >= 12;
    const displayHour = ((hour + 11) % 12) + 1;
    const paddedMinute = minute.toString().padStart(2, "0");
    const suffix = isPM ? "PM" : "AM";
    return `${displayHour}:${paddedMinute} ${suffix}`;
  };

  const adjustReminderTime = async (deltaMinutes: number) => {
    const [hourStr, minuteStr] = settings.dailyReminderTime.split(":");
    const hour = Number(hourStr) || 8;
    const minute = Number(minuteStr) || 0;
    const totalMinutes = (hour * 60 + minute + deltaMinutes + 24 * 60) % (24 * 60);
    const nextHour = Math.floor(totalMinutes / 60)
      .toString()
      .padStart(2, "0");
    const nextMinute = (totalMinutes % 60).toString().padStart(2, "0");
    await handleSelectTime(`${nextHour}:${nextMinute}`);
  };

  return (
    <View>
      {/* Reading section */}
      <View style={styles.section}>
        <Text style={styles.sectionTitle}>Reading</Text>
        <Text style={styles.sectionSubtitle}>
          Adjust the size of the reading and favorites text.
        </Text>
        <View style={styles.chipRow}>
          {(["small", "medium", "large", "extraLarge"] as TextSize[]).map(
            (size) => {
              const isActive = settings.textSize === size;
              const label =
                size === "small"
                  ? "Small"
                  : size === "medium"
                  ? "Medium"
                  : size === "large"
                  ? "Large"
                  : "Extra Large";
              return (
                <TouchableOpacity
                  key={size}
                  style={[styles.chip, isActive && styles.chipActive]}
                  onPress={() => handleTextSizePress(size)}
                  activeOpacity={0.85}
                >
                  <Text
                    style={[styles.chipLabel, isActive && styles.chipLabelActive]}
                  >
                    {label}
                  </Text>
                </TouchableOpacity>
              );
            }
          )}
        </View>
        <View style={styles.previewCard}>
          <Text style={styles.previewLabel}>Preview</Text>
          <Text
            style={[
              styles.previewText,
              {
                fontSize: metrics.bodyFontSize,
                lineHeight: metrics.bodyLineHeight,
              },
            ]}
          >
            This is how your daily reading and favorites will look.
          </Text>
        </View>
      </View>

      {/* Notifications section */}
      <View style={styles.section}>
        <Text style={styles.sectionTitle}>Notifications</Text>
        <View style={styles.row}>
          <View style={styles.rowTextContainer}>
            <Text style={styles.rowTitle}>Daily reminder</Text>
            <Text style={styles.rowSubtitle}>
              Get a gentle nudge to read at the same time each day.
            </Text>
          </View>
          <Switch
            value={settings.dailyReminderEnabled}
            onValueChange={handleToggleReminder}
            thumbColor="#fff"
            trackColor={{ false: colors.mist, true: colors.ocean }}
          />
        </View>
        {settings.dailyReminderEnabled && (
          <View style={styles.timeRow}>
            <Text style={styles.timeLabel}>Reminder time</Text>
            <View style={styles.timeControls}>
              <TouchableOpacity
                style={styles.timeAdjustButton}
                onPress={() => adjustReminderTime(-15)}
                activeOpacity={0.8}
              >
                <Ionicons name="remove" size={18} color={colors.ocean} />
              </TouchableOpacity>
              <Text style={styles.timeValue}>
                {formatReminderLabel(settings.dailyReminderTime)}
              </Text>
              <TouchableOpacity
                style={styles.timeAdjustButton}
                onPress={() => adjustReminderTime(15)}
                activeOpacity={0.8}
              >
                <Ionicons name="add" size={18} color={colors.ocean} />
              </TouchableOpacity>
            </View>
          </View>
        )}
      </View>

      {/* Legal section */}
      <View style={styles.section}>
        <Text style={styles.sectionTitle}>Privacy & Terms</Text>
        <View style={styles.legalCard}>
          <Ionicons
            name="lock-closed-outline"
            size={22}
            color={colors.ocean}
            style={styles.legalIcon}
          />
          <View style={{ flex: 1 }}>
            <Text style={styles.legalSummary}>
              Daily Paths does not require an account. Your favorites and
              settings are stored locally on this device and are not synced to a
              server.
            </Text>
            <Text style={styles.legalLink}>
              Privacy Policy · Terms of Use (draft)
            </Text>
          </View>
        </View>
      </View>
    </View>
  );
};

const styles = StyleSheet.create({
  section: {
    marginTop: 16,
    marginBottom: 8,
  },
  sectionTitle: {
    fontFamily: fonts.headerFamilyBoldItalic,
    fontSize: 20,
    color: colors.deepTeal,
    marginBottom: 4,
  },
  sectionSubtitle: {
    fontFamily: fonts.bodyFamilyRegular,
    fontSize: 14,
    color: colors.ocean,
    marginBottom: 12,
  },
  chipRow: {
    flexDirection: "row",
    flexWrap: "wrap",
    gap: 8,
  },
  chip: {
    paddingVertical: 8,
    paddingHorizontal: 14,
    borderRadius: 999,
    borderWidth: 1,
    borderColor: colors.mist,
    backgroundColor: "#fff",
  },
  chipActive: {
    backgroundColor: colors.ocean,
    borderColor: colors.ocean,
  },
  chipLabel: {
    fontFamily: fonts.bodyFamilyRegular,
    fontSize: 14,
    color: colors.ink,
  },
  chipLabelActive: {
    color: "#fff",
    fontWeight: "600",
  },
  previewCard: {
    marginTop: 16,
    padding: 14,
    borderRadius: 12,
    backgroundColor: colors.cloud,
  },
  previewLabel: {
    fontFamily: fonts.bodyFamilyRegular,
    fontSize: 12,
    color: colors.ocean,
    marginBottom: 6,
    textTransform: "uppercase",
    letterSpacing: 0.7,
  },
  previewText: {
    fontFamily: fonts.loraRegular,
    color: colors.ink,
  },
  row: {
    marginTop: 8,
    flexDirection: "row",
    alignItems: "center",
    justifyContent: "space-between",
    gap: 12,
  },
  rowTextContainer: {
    flex: 1,
  },
  rowTitle: {
    fontFamily: fonts.bodyFamilyRegular,
    fontSize: 16,
    color: colors.ink,
    marginBottom: 2,
  },
  rowSubtitle: {
    fontFamily: fonts.bodyFamilyRegular,
    fontSize: 13,
    color: colors.ocean,
  },
  timeRow: {
    marginTop: 12,
  },
  timeLabel: {
    fontFamily: fonts.bodyFamilyRegular,
    fontSize: 14,
    color: colors.ocean,
    marginBottom: 6,
  },
  timeControls: {
    marginTop: 4,
    flexDirection: "row",
    alignItems: "center",
    justifyContent: "flex-start",
    gap: 12,
  },
  timeAdjustButton: {
    width: 32,
    height: 32,
    borderRadius: 16,
    backgroundColor: "#fff",
    alignItems: "center",
    justifyContent: "center",
    borderWidth: 1,
    borderColor: colors.mist,
  },
  timeValue: {
    fontFamily: fonts.bodyFamilyRegular,
    fontSize: 15,
    color: colors.ink,
    minWidth: 90,
    textAlign: "center",
  },
  legalCard: {
    marginTop: 8,
    flexDirection: "row",
    alignItems: "flex-start",
    padding: 14,
    borderRadius: 12,
    backgroundColor: "#fff",
    borderWidth: 1,
    borderColor: colors.mist,
  },
  legalIcon: {
    marginRight: 10,
    marginTop: 2,
  },
  legalSummary: {
    fontFamily: fonts.bodyFamilyRegular,
    fontSize: 14,
    color: colors.ink,
    marginBottom: 6,
  },
  legalLink: {
    fontFamily: fonts.bodyFamilyRegular,
    fontSize: 13,
    color: colors.ocean,
  },
});


