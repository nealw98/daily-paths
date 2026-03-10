import React from "react";
import { Modal, View, Text, TouchableOpacity, StyleSheet } from "react-native";
import { useTheme } from "../hooks/useTheme";
import { fonts } from "../constants/theme";

interface TrialEndedModalProps {
  visible: boolean;
  onSubscribeNow: () => void;
  onNotNow: () => void;
}

export const TrialEndedModal: React.FC<TrialEndedModalProps> = ({
  visible,
  onSubscribeNow,
  onNotNow,
}) => {
  const { colors } = useTheme();

  return (
    <Modal visible={visible} transparent animationType="fade" onRequestClose={onNotNow}>
      <View style={[styles.backdrop, { backgroundColor: colors.backdrop }]}>
        <View style={[styles.card, { backgroundColor: colors.background }]}>
          <Text style={[styles.title, { color: colors.text }]}>Trial Ended</Text>
          <Text style={[styles.message, { color: colors.textSecondary }]}>
            Your trial has ended. Subscribe to continue using premium features.
          </Text>

          <TouchableOpacity
            style={[styles.primaryButton, { backgroundColor: colors.buttonPrimary }]}
            onPress={onSubscribeNow}
            activeOpacity={0.8}
          >
            <Text style={[styles.primaryText, { color: colors.textOnAccent }]}>Subscribe Now</Text>
          </TouchableOpacity>

          <TouchableOpacity style={styles.secondaryButton} onPress={onNotNow} activeOpacity={0.8}>
            <Text style={[styles.secondaryText, { color: colors.textSecondary }]}>Not Now</Text>
          </TouchableOpacity>
        </View>
      </View>
    </Modal>
  );
};

const styles = StyleSheet.create({
  backdrop: {
    flex: 1,
    justifyContent: "center",
    paddingHorizontal: 24,
  },
  card: {
    borderRadius: 18,
    padding: 24,
  },
  title: {
    fontFamily: fonts.headerFamilyItalic,
    fontSize: 28,
    textAlign: "center",
    marginBottom: 10,
  },
  message: {
    fontFamily: fonts.bodyFamilyRegular,
    fontSize: 16,
    textAlign: "center",
    lineHeight: 22,
    marginBottom: 20,
  },
  primaryButton: {
    borderRadius: 12,
    paddingVertical: 14,
    alignItems: "center",
  },
  primaryText: {
    fontFamily: fonts.bodyFamilyRegular,
    fontSize: 16,
    fontWeight: "600",
  },
  secondaryButton: {
    paddingVertical: 12,
    alignItems: "center",
    marginTop: 4,
  },
  secondaryText: {
    fontFamily: fonts.bodyFamilyRegular,
    fontSize: 15,
  },
});
