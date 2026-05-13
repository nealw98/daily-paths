import React from "react";
import { Modal, View, Text, TouchableOpacity, StyleSheet } from "react-native";
import { useTheme } from "../hooks/useTheme";
import { fonts } from "../constants/theme";

interface FirstLaunchTrialModalProps {
  visible: boolean;
  onContinue: () => void;
}

/**
 * Onboarding modal shown once on first Android launch, explaining the
 * 3-day try-and-buy model. Single dismiss button — no separate Skip path.
 */
export const FirstLaunchTrialModal: React.FC<FirstLaunchTrialModalProps> = ({
  visible,
  onContinue,
}) => {
  const { colors } = useTheme();
  return (
    <Modal visible={visible} transparent animationType="fade" onRequestClose={onContinue}>
      <View style={[styles.backdrop, { backgroundColor: colors.backdrop }]}>
        <View style={[styles.card, { backgroundColor: colors.background }]}>
          <Text style={[styles.title, { color: colors.text }]}>Welcome to Daily Paths</Text>
          <Text style={[styles.message, { color: colors.textSecondary }]}>
            The full app is yours, free, for 3 days. After that, a one-time $4.99 keeps it yours forever — no subscription, no further billing.
          </Text>
          <TouchableOpacity
            style={[styles.button, { backgroundColor: colors.buttonPrimary }]}
            onPress={onContinue}
            activeOpacity={0.8}
          >
            <Text style={[styles.buttonText, { color: colors.textOnAccent }]}>Continue</Text>
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
    marginBottom: 12,
  },
  message: {
    fontFamily: fonts.bodyFamilyRegular,
    fontSize: 16,
    textAlign: "center",
    lineHeight: 22,
    marginBottom: 20,
  },
  button: {
    borderRadius: 12,
    paddingVertical: 14,
    alignItems: "center",
  },
  buttonText: {
    fontFamily: fonts.bodyFamilyRegular,
    fontSize: 16,
    fontWeight: "600",
  },
});
