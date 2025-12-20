import React, { useEffect, useState } from "react";
import { View, Text, StyleSheet, TouchableOpacity } from "react-native";
import { Ionicons } from "@expo/vector-icons";
import { colors, fonts } from "../constants/theme";

interface InlineTimePickerProps {
  value: Date;
  onChange: (date: Date) => void;
  onDone?: () => void;
}

const HOURS = Array.from({ length: 12 }, (_v, i) => i + 1);
const MINUTE_STEP = 5;
const MINUTES = Array.from({ length: 60 / MINUTE_STEP }, (_v, i) => i * MINUTE_STEP);

export const InlineTimePicker: React.FC<InlineTimePickerProps> = ({
  value,
  onChange,
  onDone,
}) => {
  const [hour, setHour] = useState(12);
  const [minute, setMinute] = useState(0);
  const [isPM, setIsPM] = useState(false);

  useEffect(() => {
    const current = new Date(value);
    const h24 = current.getHours();
    const m = current.getMinutes();
    const pm = h24 >= 12;
    const h12 = ((h24 + 11) % 12) + 1;

    setHour(h12);

    // Snap minutes to nearest 5-min step for cleaner UI
    const snappedMinutes = Math.round(m / MINUTE_STEP) * MINUTE_STEP;
    setMinute(snappedMinutes % 60);

    setIsPM(pm);
  }, [value]);

  const commit = (nextHour: number, nextMinute: number, nextIsPM: boolean) => {
    const base = new Date(value);

    let h = nextHour % 12;
    if (h === 0) h = 12;

    let h24: number;
    if (nextIsPM) {
      h24 = h === 12 ? 12 : h + 12;
    } else {
      h24 = h === 12 ? 0 : h;
    }

    base.setHours(h24, nextMinute, 0, 0);
    onChange(base);
  };

  const changeHour = (delta: number) => {
    const idx = HOURS.indexOf(hour);
    const next = HOURS[(idx + delta + HOURS.length) % HOURS.length];
    setHour(next);
    commit(next, minute, isPM);
  };

  const changeMinute = (delta: number) => {
    const idx = MINUTES.indexOf(minute);
    const next = MINUTES[(idx + delta + MINUTES.length) % MINUTES.length];
    setMinute(next);
    commit(hour, next, isPM);
  };

  const handleTogglePeriod = (nextIsPM: boolean) => {
    if (nextIsPM === isPM) return;
    setIsPM(nextIsPM);
    commit(hour, minute, nextIsPM);
  };

  const minuteLabel = minute.toString().padStart(2, "0");
  const hourLabel = hour.toString().padStart(2, "0");

  return (
    <View style={styles.container}>
      <View style={styles.timeRow}>
        <View style={styles.column}>
          <TouchableOpacity
            onPress={() => changeHour(1)}
            style={styles.chevronButton}
            activeOpacity={0.7}
          >
            <Ionicons name="chevron-up" size={16} color={colors.ocean} />
          </TouchableOpacity>
          <Text style={styles.valueText}>{hourLabel}</Text>
          <TouchableOpacity
            onPress={() => changeHour(-1)}
            style={styles.chevronButton}
            activeOpacity={0.7}
          >
            <Ionicons name="chevron-down" size={16} color={colors.ocean} />
          </TouchableOpacity>
        </View>

        <Text style={styles.separator}>:</Text>

        <View style={styles.column}>
          <TouchableOpacity
            onPress={() => changeMinute(1)}
            style={styles.chevronButton}
            activeOpacity={0.7}
          >
            <Ionicons name="chevron-up" size={16} color={colors.ocean} />
          </TouchableOpacity>
          <Text style={styles.valueText}>{minuteLabel}</Text>
          <TouchableOpacity
            onPress={() => changeMinute(-1)}
            style={styles.chevronButton}
            activeOpacity={0.7}
          >
            <Ionicons name="chevron-down" size={16} color={colors.ocean} />
          </TouchableOpacity>
        </View>

        <View style={styles.periodToggle}>
          <TouchableOpacity
            style={[
              styles.periodChip,
              !isPM && styles.periodChipSelected,
            ]}
            activeOpacity={0.8}
            onPress={() => handleTogglePeriod(false)}
          >
            <Text
              style={[
                styles.periodLabel,
                !isPM && styles.periodLabelSelected,
              ]}
            >
              AM
            </Text>
          </TouchableOpacity>

          <TouchableOpacity
            style={[
              styles.periodChip,
              isPM && styles.periodChipSelected,
            ]}
            activeOpacity={0.8}
            onPress={() => handleTogglePeriod(true)}
          >
            <Text
              style={[
                styles.periodLabel,
                isPM && styles.periodLabelSelected,
              ]}
            >
              PM
            </Text>
          </TouchableOpacity>
        </View>
      </View>

      {onDone && (
        <View style={styles.footerRow}>
          <TouchableOpacity
            onPress={onDone}
            style={styles.doneButton}
            activeOpacity={0.8}
          >
            <Text style={styles.doneLabel}>Done</Text>
          </TouchableOpacity>
        </View>
      )}
    </View>
  );
};

const styles = StyleSheet.create({
  container: {
    marginTop: 8,
  },
  timeRow: {
    flexDirection: "row",
    alignItems: "center",
    justifyContent: "flex-start",
    gap: 16,
  },
  column: {
    alignItems: "center",
  },
  chevronButton: {
    paddingHorizontal: 4,
    paddingVertical: 2,
  },
  valueText: {
    fontFamily: fonts.bodyFamilyRegular,
    fontSize: 18,
    color: colors.deepTeal,
    marginVertical: 2,
  },
  separator: {
    fontFamily: fonts.bodyFamilyRegular,
    fontSize: 18,
    color: colors.deepTeal,
    marginHorizontal: 2,
  },
  periodToggle: {
    flexDirection: "row",
    alignItems: "center",
    gap: 8,
    marginLeft: 4,
  },
  periodChip: {
    paddingHorizontal: 10,
    paddingVertical: 6,
    borderRadius: 999,
    borderWidth: 1,
    borderColor: colors.mist,
    backgroundColor: "#fff",
  },
  periodChipSelected: {
    backgroundColor: colors.deepTeal,
    borderColor: colors.deepTeal,
  },
  periodLabel: {
    fontFamily: fonts.bodyFamilyRegular,
    fontSize: 14,
    color: colors.deepTeal,
  },
  periodLabelSelected: {
    color: "#fff",
  },
  footerRow: {
    marginTop: 8,
    alignItems: "flex-end",
  },
  doneButton: {
    paddingHorizontal: 12,
    paddingVertical: 6,
  },
  doneLabel: {
    fontFamily: fonts.bodyFamilyRegular,
    fontSize: 14,
    color: colors.ocean,
  },
});








