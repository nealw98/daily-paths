import React from "react";
import { View, Text, StyleSheet, Modal, TouchableOpacity, Pressable } from "react-native";
import { Ionicons } from "@expo/vector-icons";
import { useTheme } from "../../hooks/useTheme";
import { fonts, rule } from "../../constants/theme";

export type SortMode = "newest" | "oldest" | "az";

interface AnchorRect {
  x: number;
  y: number;
  width: number;
  height: number;
}

interface SortSheetProps {
  visible: boolean;
  sortMode: SortMode;
  anchor: AnchorRect | null;
  onSelect: (mode: SortMode) => void;
  onClose: () => void;
}

const OPTIONS: { key: SortMode; label: string }[] = [
  { key: "newest", label: "Newest" },
  { key: "oldest", label: "Oldest" },
  { key: "az", label: "A\u2013Z" },
];

const MENU_WIDTH = 140;
const GAP = 6;

export const SortSheet: React.FC<SortSheetProps> = ({
  visible,
  sortMode,
  anchor,
  onSelect,
  onClose,
}) => {
  const { colors } = useTheme();

  if (!anchor) return null;

  const top = anchor.y + anchor.height + GAP;
  const left = Math.max(8, anchor.x + anchor.width - MENU_WIDTH);

  return (
    <Modal
      visible={visible}
      transparent
      animationType="fade"
      onRequestClose={onClose}
    >
      <Pressable style={styles.backdrop} onPress={onClose}>
        <View
          style={[
            styles.menu,
            {
              top,
              left,
              width: MENU_WIDTH,
              backgroundColor: "#ffffff",
              borderColor: rule,
            },
          ]}
        >
          {OPTIONS.map(({ key, label }) => {
            const isActive = sortMode === key;
            return (
              <TouchableOpacity
                key={key}
                style={styles.row}
                onPress={() => {
                  onSelect(key);
                  onClose();
                }}
                activeOpacity={0.7}
              >
                <Text style={[styles.rowLabel, { color: colors.text }]}>{label}</Text>
                {isActive && (
                  <Ionicons name="checkmark" size={16} color={colors.accent} />
                )}
              </TouchableOpacity>
            );
          })}
        </View>
      </Pressable>
    </Modal>
  );
};

const styles = StyleSheet.create({
  backdrop: {
    flex: 1,
  },
  menu: {
    position: "absolute",
    borderRadius: 10,
    borderWidth: 1,
    paddingVertical: 4,
    shadowColor: "#000000",
    shadowOpacity: 0.15,
    shadowRadius: 16,
    shadowOffset: { width: 0, height: 6 },
    elevation: 6,
  },
  row: {
    flexDirection: "row",
    alignItems: "center",
    justifyContent: "space-between",
    paddingVertical: 10,
    paddingHorizontal: 14,
  },
  rowLabel: {
    fontFamily: fonts.bodyFamilyMedium,
    fontSize: 14,
  },
});
