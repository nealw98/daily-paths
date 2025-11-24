import React, { useState } from "react";
import {
  View,
  Text,
  StyleSheet,
  Modal,
  TouchableOpacity,
  Pressable,
  ScrollView,
} from "react-native";
import { BlurView } from "expo-blur";
import { Ionicons } from "@expo/vector-icons";
import { colors, fonts } from "../constants/theme";

interface DatePickerModalProps {
  visible: boolean;
  selectedDate: Date;
  onSelectDate: (date: Date) => void;
  onClose: () => void;
  availableDates?: Date[];
}

export const DatePickerModal: React.FC<DatePickerModalProps> = ({
  visible,
  selectedDate,
  onSelectDate,
  onClose,
  availableDates,
}) => {
  const [currentMonth, setCurrentMonth] = useState(
    new Date(selectedDate.getFullYear(), selectedDate.getMonth(), 1)
  );

  const getDaysInMonth = (date: Date) => {
    const year = date.getFullYear();
    const month = date.getMonth();
    const firstDay = new Date(year, month, 1);
    const lastDay = new Date(year, month + 1, 0);
    const daysInMonth = lastDay.getDate();
    const startingDayOfWeek = firstDay.getDay();

    return { daysInMonth, startingDayOfWeek };
  };

  const handlePrevMonth = () => {
    setCurrentMonth(
      new Date(currentMonth.getFullYear(), currentMonth.getMonth() - 1, 1)
    );
  };

  const handleNextMonth = () => {
    setCurrentMonth(
      new Date(currentMonth.getFullYear(), currentMonth.getMonth() + 1, 1)
    );
  };

  const handleDateSelect = (day: number) => {
    const newDate = new Date(
      currentMonth.getFullYear(),
      currentMonth.getMonth(),
      day
    );
    onSelectDate(newDate);
    onClose();
  };

  const handleGoToToday = () => {
    const today = new Date();
    setCurrentMonth(new Date(today.getFullYear(), today.getMonth(), 1));
    onSelectDate(today);
    onClose();
  };

  const isDateAvailable = (day: number) => {
    if (!availableDates || availableDates.length === 0) return true;

    const checkDate = new Date(
      currentMonth.getFullYear(),
      currentMonth.getMonth(),
      day
    );

    return availableDates.some(
      (d) =>
        d.getFullYear() === checkDate.getFullYear() &&
        d.getMonth() === checkDate.getMonth() &&
        d.getDate() === checkDate.getDate()
    );
  };

  const isSelectedDate = (day: number) => {
    return (
      selectedDate.getFullYear() === currentMonth.getFullYear() &&
      selectedDate.getMonth() === currentMonth.getMonth() &&
      selectedDate.getDate() === day
    );
  };

  const isToday = (day: number) => {
    const today = new Date();
    return (
      today.getFullYear() === currentMonth.getFullYear() &&
      today.getMonth() === currentMonth.getMonth() &&
      today.getDate() === day
    );
  };

  const { daysInMonth, startingDayOfWeek } = getDaysInMonth(currentMonth);
  const monthName = currentMonth.toLocaleDateString("en-US", {
    month: "long",
    year: "numeric",
  });

  const days = [];
  for (let i = 0; i < startingDayOfWeek; i++) {
    days.push(<View key={`empty-${i}`} style={styles.dayCell} />);
  }
  for (let day = 1; day <= daysInMonth; day++) {
    const available = isDateAvailable(day);
    const selected = isSelectedDate(day);
    const today = isToday(day);
    
    days.push(
      <View key={day} style={styles.dayCell}>
        <TouchableOpacity
          style={[
            styles.dayButton,
            selected && styles.selectedDay,
            !available && styles.unavailableDay,
            today && !selected && styles.todayDay,
          ]}
          onPress={() => available && handleDateSelect(day)}
          disabled={!available}
        >
          <Text
            style={[
              styles.dayText,
              selected && styles.selectedDayText,
              !available && styles.unavailableDayText,
              today && !selected && styles.todayDayText,
            ]}
          >
            {day}
          </Text>
        </TouchableOpacity>
      </View>
    );
  }

  return (
    <Modal
      visible={visible}
      transparent
      animationType="fade"
      onRequestClose={onClose}
    >
      <Pressable style={styles.overlay} onPress={onClose}>
        <BlurView intensity={20} tint="dark" style={styles.blurOverlay}>
          <Pressable
            style={styles.modalContent}
            onPress={(e) => e.stopPropagation()}
          >
            <View style={styles.header}>
              <TouchableOpacity
                onPress={handlePrevMonth}
                style={styles.navButton}
              >
                <Ionicons name="chevron-back" size={28} color={colors.ocean} />
              </TouchableOpacity>

              <Text style={styles.monthTitle}>{monthName}</Text>

              <TouchableOpacity
                onPress={handleNextMonth}
                style={styles.navButton}
              >
                <Ionicons
                  name="chevron-forward"
                  size={28}
                  color={colors.ocean}
                />
              </TouchableOpacity>
            </View>

            <View style={styles.weekdays}>
              {["S", "M", "T", "W", "T", "F", "S"].map((day, index) => (
                <View key={index} style={styles.weekdayCell}>
                  <Text style={styles.weekdayText}>{day}</Text>
                </View>
              ))}
            </View>

            <View style={styles.calendar}>{days}</View>

            <View style={styles.buttonContainer}>
              <TouchableOpacity
                style={styles.todayButton}
                onPress={handleGoToToday}
              >
                <Text style={styles.todayButtonText}>Today</Text>
              </TouchableOpacity>

              <TouchableOpacity style={styles.cancelButton} onPress={onClose}>
                <Text style={styles.cancelButtonText}>Cancel</Text>
              </TouchableOpacity>
            </View>
          </Pressable>
        </BlurView>
      </Pressable>
    </Modal>
  );
};

const styles = StyleSheet.create({
  overlay: {
    flex: 1,
    justifyContent: "center",
    alignItems: "center",
  },
  blurOverlay: {
    width: "100%",
    height: "100%",
    justifyContent: "center",
    alignItems: "center",
  },
  modalContent: {
    width: "90%",
    maxWidth: 380,
    backgroundColor: colors.pearl,
    borderRadius: 20,
    padding: 24,
    shadowColor: "#000",
    shadowOffset: { width: 0, height: 8 },
    shadowOpacity: 0.3,
    shadowRadius: 16,
    elevation: 12,
  },
  header: {
    flexDirection: "row",
    justifyContent: "space-between",
    alignItems: "center",
    marginBottom: 24,
  },
  navButton: {
    padding: 8,
    borderRadius: 8,
  },
  monthTitle: {
    fontFamily: fonts.headerFamily,
    fontSize: 22,
    color: colors.deepTeal,
  },
  weekdays: {
    flexDirection: "row",
    marginBottom: 12,
  },
  weekdayCell: {
    width: "14.28%",
    alignItems: "center",
    paddingVertical: 8,
  },
  weekdayText: {
    fontFamily: fonts.bodyFamilyRegular,
    fontSize: 13,
    color: colors.ocean,
    fontWeight: "600",
  },
  calendar: {
    flexDirection: "row",
    flexWrap: "wrap",
    marginBottom: 24,
  },
  dayCell: {
    width: "14.28%",
    aspectRatio: 1,
    justifyContent: "center",
    alignItems: "center",
    padding: 4,
  },
  dayButton: {
    width: "100%",
    height: "100%",
    justifyContent: "center",
    alignItems: "center",
  },
  selectedDay: {
    backgroundColor: colors.ocean,
    borderRadius: 100,
  },
  todayDay: {
    borderWidth: 2,
    borderColor: colors.seafoam,
    borderRadius: 100,
  },
  unavailableDay: {
    opacity: 0.25,
  },
  dayText: {
    fontFamily: fonts.bodyFamilyRegular,
    fontSize: 16,
    color: colors.ink,
  },
  selectedDayText: {
    color: "#fff",
    fontWeight: "700",
  },
  todayDayText: {
    color: colors.ocean,
    fontWeight: "600",
  },
  unavailableDayText: {
    color: colors.mist,
  },
  buttonContainer: {
    flexDirection: "row",
    justifyContent: "space-between",
    alignItems: "center",
    paddingTop: 12,
    borderTopWidth: 1,
    borderTopColor: colors.mist,
  },
  todayButton: {
    paddingVertical: 12,
    paddingHorizontal: 16,
    backgroundColor: "rgba(184, 216, 216, 0.2)", // mist with 20% opacity
    borderRadius: 8,
  },
  todayButtonText: {
    fontFamily: fonts.bodyFamilyRegular,
    fontSize: 17,
    color: colors.ocean,
  },
  cancelButton: {
    paddingVertical: 12,
    paddingHorizontal: 16,
    backgroundColor: "rgba(184, 216, 216, 0.2)", // mist with 20% opacity
    borderRadius: 8,
  },
  cancelButtonText: {
    fontFamily: fonts.bodyFamilyRegular,
    fontSize: 17,
    color: colors.ocean,
  },
});
