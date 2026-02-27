import React, { useMemo, useState } from "react";
import { View, Text, StyleSheet, Modal, TouchableOpacity, ScrollView, Switch, Platform, Animated } from "react-native";
import DateTimePicker from "@react-native-community/datetimepicker";
import { fonts } from "../constants/theme";
import { useTheme } from "../hooks/useTheme";
import { useSettings } from "../hooks/useSettings";
import { updateNotificationWithThought } from "../utils/notificationSync";
import { useAnalytics } from "../utils/analytics";

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

interface ReminderModalProps {
  visible: boolean;
  onClose: () => void;
  onShowToast?: (message: string) => void;
}

export const ReminderModal: React.FC<ReminderModalProps> = ({
  visible,
  onClose,
  onShowToast,
}) => {
  const { colors, isDark } = useTheme();
  const { settings, setDailyReminderEnabled, setDailyReminderTime } = useSettings();
  const { trackReminderSet, trackReminderChanged, trackReminderDisabled } = useAnalytics();
  const [showTimePicker, setShowTimePicker] = useState(false);
  const [tempReminderDate, setTempReminderDate] = useState<Date | null>(null);
  const slideAnim = React.useRef(new Animated.Value(0)).current;

  React.useEffect(() => {
    if (visible) {
      Animated.spring(slideAnim, {
        toValue: 1,
        useNativeDriver: true,
        tension: 50,
        friction: 8,
      }).start();
    } else {
      Animated.timing(slideAnim, {
        toValue: 0,
        duration: 200,
        useNativeDriver: true,
      }).start();
    }
  }, [visible]);

  const translateY = slideAnim.interpolate({
    inputRange: [0, 1],
    outputRange: [600, 0],
  });

  const reminderDate = useMemo(
    () => parseTimeToDate(settings.dailyReminderTime),
    [settings.dailyReminderTime]
  );

  const handleReminderToggle = async (enabled: boolean) => {
    await setDailyReminderEnabled(enabled);

    // Update notification with thought if enabling
    if (enabled) {
      await updateNotificationWithThought();
      trackReminderSet(settings.dailyReminderTime);
    } else {
      trackReminderDisabled();
    }

    if (enabled && onShowToast) {
      const timeStr = formatTimeDisplay(reminderDate);
      onShowToast(`You'll receive the Thought for the Day at ${timeStr}`);
    } else if (!enabled && onShowToast) {
      onShowToast("Thought for the Day notifications turned off");
    }
  };

  return (
    <Modal
      visible={visible}
      transparent
      animationType="fade"
      onRequestClose={onClose}
    >
      <TouchableOpacity
        style={styles.backdrop}
        activeOpacity={1}
        onPress={onClose}
      >
        <Animated.View
          style={[
            styles.modalContainer,
            { transform: [{ translateY }], backgroundColor: colors.pearl },
          ]}
          onStartShouldSetResponder={() => true}
        >
          <View style={[styles.header, { borderBottomColor: colors.mist }]}>
            <Text style={[styles.title, { color: colors.deepTeal }]}>Thought for the Day</Text>
            <TouchableOpacity onPress={onClose} style={styles.doneButton}>
              <Text style={[styles.doneButtonText, { color: colors.deepTeal }]}>Done</Text>
            </TouchableOpacity>
          </View>

          <ScrollView
            contentContainerStyle={styles.content}
            showsVerticalScrollIndicator={false}
          >
            <Text style={[styles.subtitle, { color: colors.ocean }]}>
              A guiding thought to focus your day.
            </Text>

            <View style={styles.row}>
              <View style={styles.rowText}>
                <Text style={[styles.rowLabel, { color: colors.ink }]}>Enable daily notification</Text>
              </View>
              <Switch
                value={settings.dailyReminderEnabled}
                onValueChange={handleReminderToggle}
                trackColor={{ false: colors.mist, true: colors.deepTeal }}
                thumbColor={settings.dailyReminderEnabled ? colors.pearl : '#f4f3f4'}
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

            {showTimePicker && settings.dailyReminderEnabled ? (
              <View style={styles.timePickerContainer}>
                <DateTimePicker
                  value={tempReminderDate ?? reminderDate}
                  mode="time"
                  display={Platform.OS === "ios" ? "spinner" : "default"}
                  themeVariant={isDark ? "dark" : "light"}
                  onChange={(event, selectedDate) => {
                    if (Platform.OS === "android") {
                      setShowTimePicker(false);
                      setTempReminderDate(null);
                      if (event.type === "set" && selectedDate) {
                        (async () => {
                          const oldTime = settings.dailyReminderTime;
                          const newTime = formatTimeStorage(selectedDate);
                          await setDailyReminderTime(newTime);
                          await updateNotificationWithThought();
                          trackReminderChanged(oldTime, newTime);
                          if (onShowToast) {
                            onShowToast(`You'll receive the Thought for the Day at ${formatTimeDisplay(selectedDate)}`);
                          }
                        })();
                      }
                    } else {
                      if (!selectedDate) return;
                      setTempReminderDate(selectedDate);
                    }
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
                  {Platform.OS === "ios" ? (
                    <TouchableOpacity
                      style={[styles.timePickerButtonPrimary, { backgroundColor: colors.deepTeal }]}
                      onPress={async () => {
                        const finalDate = tempReminderDate ?? reminderDate;
                        const oldTime = settings.dailyReminderTime;
                        const newTime = formatTimeStorage(finalDate);
                        setShowTimePicker(false);
                        setTempReminderDate(null);
                        await setDailyReminderTime(newTime);
                        await updateNotificationWithThought();
                        trackReminderChanged(oldTime, newTime);
                        if (onShowToast) {
                          onShowToast(`You'll receive the Thought for the Day at ${formatTimeDisplay(finalDate)}`);
                        }
                      }}
                    >
                      <Text style={styles.timePickerButtonPrimaryText}>Set time</Text>
                    </TouchableOpacity>
                  ) : null}
                </View>
              </View>
            ) : null}
          </ScrollView>
        </Animated.View>
      </TouchableOpacity>
    </Modal>
  );
};

const styles = StyleSheet.create({
  backdrop: {
    flex: 1,
    backgroundColor: "rgba(0, 0, 0, 0.5)",
    justifyContent: "flex-end",
  },
  modalContainer: {
    borderTopLeftRadius: 20,
    borderTopRightRadius: 20,
    maxHeight: "80%",
    paddingBottom: 40,
  },
  header: {
    flexDirection: "row",
    alignItems: "center",
    justifyContent: "space-between",
    paddingHorizontal: 20,
    paddingVertical: 16,
    borderBottomWidth: 1,
    borderBottomColor: "#f3f4f6",
    gap: 12,
  },
  title: {
    fontFamily: fonts.headerFamilyItalic,
    fontSize: 24,
    flex: 1,
  },
  doneButton: {
    paddingHorizontal: 8,
    paddingVertical: 4,
    borderRadius: 999,
    backgroundColor: "transparent",
  },
  doneButtonText: {
    fontFamily: fonts.bodyFamilyRegular,
    fontSize: 16,
  },
  content: {
    padding: 20,
    paddingBottom: 120,
  },
  subtitle: {
    fontFamily: fonts.bodyFamilyRegular,
    fontSize: 16,
    color: "#6b7280",
    marginBottom: 24,
    lineHeight: 22,
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
  timeRow: {
    flexDirection: "row",
    alignItems: "center",
    justifyContent: "space-between",
    paddingVertical: 8,
    marginTop: 8,
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
  timePickerContainer: {
    marginTop: 16,
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
  },
  timePickerButtonPrimaryText: {
    fontFamily: fonts.bodyFamilyRegular,
    fontSize: 14,
    color: "#ffffff",
  },
});

