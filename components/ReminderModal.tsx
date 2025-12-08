import React, { useMemo, useState } from "react";
import {
  View,
  Text,
  StyleSheet,
  Modal,
  TouchableOpacity,
  ScrollView,
  Switch,
  Platform,
} from "react-native";
import DateTimePicker from "@react-native-community/datetimepicker";
import { Ionicons } from "@expo/vector-icons";
import { colors, fonts } from "../constants/theme";
import { useSettings } from "../hooks/useSettings";

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
}

export const ReminderModal: React.FC<ReminderModalProps> = ({
  visible,
  onClose,
}) => {
  const { settings, setDailyReminderEnabled, setDailyReminderTime } = useSettings();
  const [showTimePicker, setShowTimePicker] = useState(false);
  const [tempReminderDate, setTempReminderDate] = useState<Date | null>(null);

  const reminderDate = useMemo(
    () => parseTimeToDate(settings.dailyReminderTime),
    [settings.dailyReminderTime]
  );

  const handleReminderToggle = async (enabled: boolean) => {
    await setDailyReminderEnabled(enabled);
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
        <View
          style={styles.modalContainer}
          onStartShouldSetResponder={() => true}
        >
          <View style={styles.header}>
            <Text style={styles.title}>Daily Reminder</Text>
            <TouchableOpacity onPress={onClose} style={styles.closeButton}>
              <Ionicons name="close" size={24} color={colors.ink} />
            </TouchableOpacity>
          </View>

          <ScrollView
            contentContainerStyle={styles.content}
            showsVerticalScrollIndicator={false}
          >
            <Text style={styles.subtitle}>
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
          </ScrollView>
        </View>
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
    backgroundColor: colors.pearl,
    borderTopLeftRadius: 20,
    borderTopRightRadius: 20,
    maxHeight: "60%",
    marginBottom: 82,
  },
  header: {
    flexDirection: "row",
    alignItems: "center",
    justifyContent: "space-between",
    paddingHorizontal: 20,
    paddingVertical: 16,
    borderBottomWidth: 1,
    borderBottomColor: "#f3f4f6",
  },
  title: {
    fontFamily: fonts.headerFamilyItalic,
    fontSize: 28,
    color: colors.deepTeal,
  },
  closeButton: {
    padding: 4,
  },
  content: {
    padding: 20,
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
    color: colors.ink,
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
    color: colors.ink,
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
    backgroundColor: colors.deepTeal,
  },
  timePickerButtonPrimaryText: {
    fontFamily: fonts.bodyFamilyRegular,
    fontSize: 14,
    color: "#ffffff",
  },
});

