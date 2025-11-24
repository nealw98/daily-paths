import React from "react";
import { View, Text, StyleSheet, TouchableOpacity } from "react-native";
import { BlurView } from "expo-blur";
import { colors, fonts } from "../constants/theme";

interface BookmarkInstructionOverlayProps {
  visible: boolean;
  onDismiss: () => void;
}

export const BookmarkInstructionOverlay: React.FC<
  BookmarkInstructionOverlayProps
> = ({ visible, onDismiss }) => {
  if (!visible) return null;

  return (
    <View style={styles.overlay}>
      <View style={styles.backdrop} />
      <View style={styles.instructionWrapper}>
        <BlurView intensity={20} tint="light" style={styles.instruction}>
          <Text style={styles.instructionText}>
            👆 Long press the reading to bookmark
          </Text>
          <TouchableOpacity style={styles.gotItButton} onPress={onDismiss}>
            <Text style={styles.gotItText}>Got it</Text>
          </TouchableOpacity>
        </BlurView>
      </View>
    </View>
  );
};

const styles = StyleSheet.create({
  overlay: {
    position: "absolute",
    top: 0,
    left: 0,
    right: 0,
    bottom: 0,
    justifyContent: "center",
    alignItems: "center",
    zIndex: 999,
  },
  backdrop: {
    position: "absolute",
    top: 0,
    left: 0,
    right: 0,
    bottom: 0,
    backgroundColor: "rgba(0, 0, 0, 0.3)",
  },
  instructionWrapper: {
    borderRadius: 20,
    overflow: "hidden",
    borderWidth: 1,
    borderColor: "rgba(255, 255, 255, 0.4)",
    shadowColor: "#000",
    shadowOffset: { width: 0, height: 8 },
    shadowOpacity: 0.2,
    shadowRadius: 24,
    elevation: 15,
    maxWidth: 280,
    marginHorizontal: 20,
  },
  instruction: {
    backgroundColor: "rgba(255, 255, 255, 0.25)",
    padding: 20,
    paddingHorizontal: 24,
    alignItems: "center",
  },
  instructionText: {
    fontFamily: fonts.bodyFamilyRegular,
    fontSize: 16,
    color: "#2d3748",
    textAlign: "center",
    marginBottom: 16,
    lineHeight: 22,
  },
  gotItButton: {
    backgroundColor: colors.deepTeal,
    paddingVertical: 10,
    paddingHorizontal: 24,
    borderRadius: 12,
    minWidth: 100,
    alignItems: "center",
  },
  gotItText: {
    fontFamily: fonts.bodyFamilyRegular,
    fontSize: 15,
    color: "#fff",
    fontWeight: "600",
  },
});

