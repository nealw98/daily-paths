import React from "react";
import { View, Text, TouchableOpacity, StyleSheet, Modal } from "react-native";
import { useTheme } from "../../hooks/useTheme";
import { fonts } from "../../constants/theme";
import {
  JOURNAL_CATEGORIES,
  type EntryType,
} from "../../constants/journalCategories";

interface JournalCategoryPickerProps {
  visible: boolean;
  onSelect: (entryType: EntryType) => void;
  onClose: () => void;
}

const CARD_BORDER_COLORS: Record<EntryType, string> = {
  journal: "rgba(44, 95, 93, 0.12)",
  gratitude: "rgba(139, 110, 78, 0.12)",
  spot_check: "rgba(184, 96, 74, 0.10)",
  nightly_review: "rgba(91, 110, 138, 0.12)",
};

export const JournalCategoryPicker: React.FC<JournalCategoryPickerProps> = ({
  visible,
  onSelect,
  onClose,
}) => {
  const { colors } = useTheme();

  return (
    <Modal
      visible={visible}
      transparent
      animationType="slide"
      onRequestClose={onClose}
    >
      <TouchableOpacity
        style={styles.backdrop}
        activeOpacity={1}
        onPress={onClose}
      >
        <View
          style={[styles.sheet, { backgroundColor: colors.background }]}
          onStartShouldSetResponder={() => true}
        >
          {/* Handle bar */}
          <View style={styles.handleBar}>
            <View
              style={[styles.handle, { backgroundColor: colors.border }]}
            />
          </View>

          <Text style={[styles.title, { color: colors.accent }]}>
            What would you like to do?
          </Text>

          {/* 2x2 Grid */}
          <View style={styles.grid}>
            {JOURNAL_CATEGORIES.map((category) => (
              <TouchableOpacity
                key={category.id}
                style={[
                  styles.card,
                  {
                    backgroundColor: category.bgColor,
                    borderColor: CARD_BORDER_COLORS[category.id],
                  },
                ]}
                onPress={() => onSelect(category.id)}
                activeOpacity={0.6}
              >
                <Text style={styles.emoji}>{category.emoji}</Text>
                <Text style={[styles.cardName, { color: colors.text }]}>
                  {category.label}
                </Text>
                <Text
                  style={[styles.cardDesc, { color: colors.textSecondary }]}
                >
                  {category.description}
                </Text>
              </TouchableOpacity>
            ))}
          </View>
        </View>
      </TouchableOpacity>
    </Modal>
  );
};

const styles = StyleSheet.create({
  backdrop: {
    flex: 1,
    justifyContent: "flex-end",
    backgroundColor: "rgba(0,0,0,0.35)",
  },
  sheet: {
    borderTopLeftRadius: 24,
    borderTopRightRadius: 24,
    paddingHorizontal: 20,
    paddingBottom: 34,
  },
  handleBar: {
    alignItems: "center",
    paddingVertical: 10,
    marginBottom: 8,
  },
  handle: {
    width: 40,
    height: 4,
    borderRadius: 2,
  },
  title: {
    fontFamily: fonts.headerFamilyItalic,
    fontSize: 21,
    textAlign: "center",
    marginBottom: 18,
  },
  grid: {
    flexDirection: "row",
    flexWrap: "wrap",
    gap: 10,
  },
  card: {
    width: "48%",
    flexGrow: 1,
    flexDirection: "column",
    alignItems: "center",
    paddingTop: 18,
    paddingBottom: 16,
    paddingHorizontal: 12,
    borderRadius: 16,
    borderWidth: 1.5,
  },
  emoji: {
    fontSize: 28,
    marginBottom: 8,
  },
  cardName: {
    fontSize: 14,
    fontWeight: "600",
    marginBottom: 3,
    textAlign: "center",
  },
  cardDesc: {
    fontSize: 11,
    lineHeight: 11 * 1.35,
    textAlign: "center",
  },
});
