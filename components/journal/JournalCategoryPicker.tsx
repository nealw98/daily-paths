import React, { useMemo } from "react";
import { View, Text, TouchableOpacity, StyleSheet, Modal } from "react-native";
import { useTheme } from "../../hooks/useTheme";
import { fonts, typography as staticTypography } from "../../constants/theme";
import {
  JOURNAL_CATEGORIES,
  type EntryType,
} from "../../constants/journalCategories";
import { Ionicons } from "@expo/vector-icons";
import { SanctuaryCard } from "../ui/Sanctuary";

const CATEGORY_ICONS: Record<string, keyof typeof Ionicons.glyphMap> = {
  journal: "document-text-outline",
  gratitude: "leaf-outline",
  spot_check: "pulse-outline",
  nightly_review: "moon-outline",
};

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
              style={[styles.handle, { backgroundColor: colors.outlineVariant }]}
            />
          </View>

          <Text style={[styles.title, { color: colors.primary }]}>
            What would you like to add?
          </Text>

          {/* Vertical list */}
          <View style={styles.list}>
            {JOURNAL_CATEGORIES.map((category) => (
              <TouchableOpacity
                key={category.id}
                onPress={() => onSelect(category.id)}
                activeOpacity={0.6}
              >
                <SanctuaryCard
                  tone="lowest"
                  style={[
                    styles.card,
                    {
                      backgroundColor: colors.surfaceContainerLowest,
                    },
                    {
                      shadowColor: "#191C1C",
                      shadowOpacity: 0.08,
                      shadowRadius: 12,
                      shadowOffset: { width: 0, height: 3 },
                    },
                  ]}
                  contentStyle={styles.cardContent}
                >
                  <View style={styles.iconWrapper}>
                    <Ionicons name={CATEGORY_ICONS[category.id] || "document-text-outline"} size={24} color={category.color} />
                  </View>
                  <View style={styles.cardText}>
                    <Text style={[styles.cardName, { color: colors.onSurface }]}>
                      {category.label}
                    </Text>
                    <Text
                      style={[styles.cardDesc, { color: colors.onSurfaceVariant }]}
                    >
                      {category.description}
                    </Text>
                  </View>
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
    ...staticTypography.h2,
    fontFamily: fonts.cormorantGaramondSemiBold,
    fontSize: 24,
    lineHeight: 30,
    textAlign: "center",
    marginBottom: 18,
  },
  list: {
    gap: 10,
  },
  card: {
    borderRadius: 14,
  },
  cardContent: {
    flexDirection: "row",
    alignItems: "center",
    paddingVertical: 16,
    paddingHorizontal: 16,
  },
  iconWrapper: {
    marginRight: 14,
  },
  cardText: {
    flex: 1,
  },
  cardName: {
    fontFamily: fonts.bodyFamilyMedium,
    fontSize: 16,
    lineHeight: 21,
    letterSpacing: 0,
    marginBottom: 2,
  },
  cardDesc: {
    ...staticTypography.caption,
  },
});
