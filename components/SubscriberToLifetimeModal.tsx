import React from "react";
import { Modal, View, Text, TouchableOpacity, StyleSheet } from "react-native";
import { useTheme } from "../hooks/useTheme";
import { fonts } from "../constants/theme";

interface SubscriberToLifetimeModalProps {
  visible: boolean;
  onClose: () => void;
}

/**
 * Shown once on Android to users whose subscription has been converted to a
 * lifetime entitlement. Same copy regardless of monthly or annual — annual
 * subscribers are being refunded separately, so this modal only needs to
 * acknowledge the conversion and confirm renewal will be cancelled.
 */
export const SubscriberToLifetimeModal: React.FC<SubscriberToLifetimeModalProps> = ({
  visible,
  onClose,
}) => {
  const { colors } = useTheme();
  return (
    <Modal visible={visible} transparent animationType="fade" onRequestClose={onClose}>
      <View style={[styles.backdrop, { backgroundColor: colors.backdrop }]}>
        <View style={[styles.card, { backgroundColor: colors.background }]}>
          <Text style={[styles.title, { color: colors.text }]}>You Own Daily Paths</Text>
          <Text style={[styles.message, { color: colors.textSecondary }]}>
            Thank you for subscribing to Daily Paths. We've moved from subscriptions to a one-time purchase model. As a result, your subscription is now lifetime access, and the app is yours to keep.
          </Text>
          <TouchableOpacity
            style={[styles.button, { backgroundColor: colors.buttonPrimary }]}
            onPress={onClose}
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
