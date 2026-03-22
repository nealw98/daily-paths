import React, { useMemo } from "react";
import { View, Text, TouchableOpacity, StyleSheet, Modal } from "react-native";
import { useTheme } from "../../hooks/useTheme";
import { useSettings, getTextSizeMetrics } from "../../hooks/useSettings";
import { fonts } from "../../constants/theme";
import {
  JOURNAL_CATEGORIES,
  type EntryType,
} from "../../constants/journalCategories";
import { EntryTypeIcon } from "../../utils/entryTypeIcon";
import { SanctuaryCard } from "../ui/Sanctuary";

interface JournalCategoryPickerProps {
  visible: boolean;
  onSelect: (entryType: EntryType) => void;
  onClose: () => void;
}

export const JournalCategoryPicker: React.FC<JournalCategoryPickerProps> = ({
  visible,
  onSelect,
  onClose,
}) => {
  const { colors } = useTheme();
  const { settings } = useSettings();
  const typography = useMemo(() => getTextSizeMetrics(settings.textSize), [settings.textSize]);

  return (
    <Modal
      visible={visible}
      transparent
      animationType="slide"
      onRequestClose={onClose}
    >
      <TouchableOpacity
        style={[styles.backdrop, { backgroundColor: colors.backdrop }]}
        activeOpacity={1}
        onPress={onClose}
      >
        <View
          style={[styles.sheet, { backgroundColor: colors.surface }]}
          onStartShouldSetResponder={() => true}
        >
          {/* Handle bar */}
          <View style={styles.handleBar}>
            <View
              style={[styles.handle, { backgroundColor: colors.border }]}
            />
          </View>

          <Text style={[styles.title, { color: colors.primaryContainer, fontSize: typography.bodyFontSize + 1 }]}>
            What would you like to do?
          </Text>

          {/* 2x2 Grid */}
          <View style={styles.grid}>
            {JOURNAL_CATEGORIES.map((category) => (
              <TouchableOpacity
                key={category.id}
                onPress={() => onSelect(category.id)}
                activeOpacity={0.6}
              >
                <SanctuaryCard
                  tone={category.id === "spot_check" || category.id === "nightly_review" ? "high" : "lowest"}
                  style={[styles.card, { backgroundColor: category.id === "spot_check" || category.id === "nightly_review" ? colors.surfaceContainerHigh : colors.surfaceContainerLowest }]}
                  contentStyle={styles.cardContent}
                >
                  <View style={styles.iconWrapper}>
                    <EntryTypeIcon svgIcon={category.svgIcon} size={28} color={category.color} />
                  </View>
                  <Text style={[styles.cardName, { color: colors.text, fontSize: typography.bodyFontSize - 2 }]}>
                    {category.label}
                  </Text>
                  <Text
                    style={[styles.cardDesc, { color: colors.textSecondary, fontSize: typography.bodyFontSize - 4, lineHeight: (typography.bodyFontSize - 4) * 1.35 }]}
                  >
                    {category.description}
                  </Text>
                </SanctuaryCard>
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
    // backgroundColor set inline via colors.backdrop for dark mode
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
    fontFamily: fonts.headerFamily,
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
    borderRadius: 16,
  },
  cardContent: {
    alignItems: "center",
    paddingTop: 18,
    paddingBottom: 16,
    paddingHorizontal: 12,
  },
  iconWrapper: {
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
