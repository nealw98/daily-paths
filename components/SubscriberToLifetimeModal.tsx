import React from "react";
import { Linking, Modal, View, Text, TouchableOpacity, StyleSheet } from "react-native";
import { useTheme } from "../hooks/useTheme";
import { fonts } from "../constants/theme";

// The mailto link composes a request the user can review/send from their
// email client.
const GIFT_CODES_CONTACT_EMAIL = "soberdailies@gmail.com";

interface SubscriberToLifetimeModalProps {
  visible: boolean;
  /** True for annual subscribers — shows the gift-codes thank-you offer.
   *  Monthly subscribers see the conversion message only. */
  isAnnual: boolean;
  onClose: () => void;
}

/**
 * Shown once on Android to users whose subscription has been converted to a
 * lifetime entitlement (the legacy annual subscribers + the single monthly).
 */
export const SubscriberToLifetimeModal: React.FC<SubscriberToLifetimeModalProps> = ({
  visible,
  isAnnual,
  onClose,
}) => {
  const { colors } = useTheme();

  const handleRequestGiftCodes = () => {
    const subject = encodeURIComponent("Daily Paths — gift code request");
    const body = encodeURIComponent(
      "Hi,\n\nI'd like to request my 5 gift codes to share Daily Paths.\n\nThanks!",
    );
    const url = `mailto:${GIFT_CODES_CONTACT_EMAIL}?subject=${subject}&body=${body}`;
    Linking.openURL(url).catch(() => {
      // If no email client is configured, fall through silently — the user
      // can dismiss the modal and reach out another way.
    });
  };

  return (
    <Modal visible={visible} transparent animationType="fade" onRequestClose={onClose}>
      <View style={[styles.backdrop, { backgroundColor: colors.backdrop }]}>
        <View style={[styles.card, { backgroundColor: colors.background }]}>
          <Text style={[styles.title, { color: colors.text }]}>You Own Daily Paths</Text>
          <Text style={[styles.message, { color: colors.textSecondary }]}>
            Your subscription has ended — Daily Paths is yours to keep, with no further billing.
          </Text>
          {isAnnual ? (
            <Text style={[styles.message, { color: colors.textSecondary }]}>
              As a thank-you for your support, you can request 5 gift codes to share with others.
            </Text>
          ) : null}
          {isAnnual ? (
            <TouchableOpacity
              style={[styles.secondaryButton, { borderColor: colors.buttonPrimary }]}
              onPress={handleRequestGiftCodes}
              activeOpacity={0.8}
            >
              <Text style={[styles.secondaryButtonText, { color: colors.buttonPrimary }]}>
                Request gift codes
              </Text>
            </TouchableOpacity>
          ) : null}
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
    marginBottom: 12,
  },
  secondaryButton: {
    borderRadius: 12,
    paddingVertical: 12,
    alignItems: "center",
    borderWidth: 1.5,
    marginTop: 4,
    marginBottom: 12,
  },
  secondaryButtonText: {
    fontFamily: fonts.bodyFamilyRegular,
    fontSize: 15,
    fontWeight: "600",
  },
  button: {
    borderRadius: 12,
    paddingVertical: 14,
    alignItems: "center",
    marginTop: 4,
  },
  buttonText: {
    fontFamily: fonts.bodyFamilyRegular,
    fontSize: 16,
    fontWeight: "600",
  },
});
