import React, { useEffect, useState } from "react";
import { Modal, View, Text, TouchableOpacity, StyleSheet } from "react-native";
import { useTheme } from "../hooks/useTheme";
import { fonts } from "../constants/theme";
import {
  isAgeConfirmed,
  recordAgeConfirmation,
} from "../utils/ageVerification";
import { trackEvent } from "../utils/trackEvent";
import { ANALYTICS_EVENTS } from "../utils/analytics";

type GateStatus = "loading" | "needed" | "done";

/**
 * One-time 13+ age confirmation, shown on first launch on every platform to
 * satisfy the Texas age-verification requirement for our 13+ rating.
 *
 * Record-only: a single acknowledgment that the user is 13 or older. It never
 * blocks access — tapping confirm persists a timestamped record and dismisses.
 * Renders an opaque full-screen surface so it sits over app content until
 * acknowledged. Returns null once confirmed (and on every subsequent launch).
 */
export const AgeConfirmationGate: React.FC = () => {
  const { colors } = useTheme();
  const [status, setStatus] = useState<GateStatus>("loading");

  useEffect(() => {
    let cancelled = false;
    (async () => {
      const confirmed = await isAgeConfirmed();
      if (cancelled) return;
      if (confirmed) {
        setStatus("done");
        return;
      }
      setStatus("needed");
      void trackEvent(ANALYTICS_EVENTS.AGE_CONFIRMATION_SHOWN, {}, true);
    })();
    return () => {
      cancelled = true;
    };
  }, []);

  const handleConfirm = () => {
    // Dismiss immediately for a responsive tap; persistence + analytics run
    // in the background. The record is best-effort and never blocks the user.
    setStatus("done");
    void recordAgeConfirmation();
    void trackEvent(ANALYTICS_EVENTS.AGE_CONFIRMATION_CONFIRMED, {}, true);
  };

  if (status !== "needed") return null;

  return (
    <Modal visible transparent animationType="fade" onRequestClose={() => {}}>
      <View style={[styles.surface, { backgroundColor: colors.background }]}>
        <View style={styles.content}>
          <Text style={[styles.title, { color: colors.text }]}>
            Before you begin
          </Text>
          <Text style={[styles.message, { color: colors.textSecondary }]}>
            Daily Paths is intended for people age 13 and older. Please confirm
            your age to continue.
          </Text>
          <TouchableOpacity
            style={[styles.button, { backgroundColor: colors.buttonPrimary }]}
            onPress={handleConfirm}
            activeOpacity={0.8}
          >
            <Text style={[styles.buttonText, { color: colors.textOnAccent }]}>
              I am 13 or older
            </Text>
          </TouchableOpacity>
        </View>
      </View>
    </Modal>
  );
};

const styles = StyleSheet.create({
  surface: {
    flex: 1,
    justifyContent: "center",
    paddingHorizontal: 24,
  },
  content: {
    alignItems: "center",
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
    marginBottom: 24,
  },
  button: {
    borderRadius: 12,
    paddingVertical: 14,
    paddingHorizontal: 32,
    alignItems: "center",
    alignSelf: "stretch",
  },
  buttonText: {
    fontFamily: fonts.bodyFamilyRegular,
    fontSize: 16,
    fontWeight: "600",
  },
});
