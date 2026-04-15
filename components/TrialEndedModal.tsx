import React, { useEffect, useRef } from "react";
import {
  Modal,
  View,
  Text,
  TouchableOpacity,
  StyleSheet,
  Animated,
  Pressable,
} from "react-native";
import { useSafeAreaInsets } from "react-native-safe-area-context";
import { useTheme } from "../hooks/useTheme";
import { fonts, layout } from "../constants/theme";

interface TrialEndedModalProps {
  visible: boolean;
  onSubscribeNow: () => void;
  onNotNow: () => void;
}

const SHEET_ANIM_OFFSET = 48;

export const TrialEndedModal: React.FC<TrialEndedModalProps> = ({
  visible,
  onSubscribeNow,
  onNotNow,
}) => {
  const { colors } = useTheme();
  const insets = useSafeAreaInsets();
  const slide = useRef(new Animated.Value(SHEET_ANIM_OFFSET)).current;

  useEffect(() => {
    if (!visible) {
      slide.setValue(SHEET_ANIM_OFFSET);
      return;
    }
    slide.setValue(SHEET_ANIM_OFFSET);
    Animated.spring(slide, {
      toValue: 0,
      damping: 26,
      stiffness: 260,
      mass: 0.9,
      useNativeDriver: true,
    }).start();
  }, [visible, slide]);

  return (
    <Modal visible={visible} transparent animationType="fade" onRequestClose={onNotNow}>
      <View style={[styles.root, { backgroundColor: colors.backdrop }]}>
        <Pressable style={StyleSheet.absoluteFill} onPress={onNotNow} accessibilityRole="button" accessibilityLabel="Dismiss" />
        <Animated.View
          style={[
            styles.sheet,
            {
              /* modalBackground — typically pure white on light themes */
              backgroundColor: colors.modalBackground,
              paddingBottom: layout.spacing.xl + insets.bottom,
              transform: [{ translateY: slide }],
            },
          ]}
        >
          <View style={styles.handleWrap} accessibilityElementsHidden>
            <View style={[styles.handle, { backgroundColor: colors.outlineVariant }]} />
          </View>

          <Text style={[styles.title, { color: colors.subscriptionTitle }]}>Continue the path</Text>
          <Text style={[styles.body, { color: colors.subscriptionSheetText }]}>
            The daily reading will always be here for free. If the tools have been useful, consider keeping them
            {" \u2014 "}they're here to support your practice.
          </Text>

          <TouchableOpacity
            style={[styles.primaryButton, { backgroundColor: colors.subscriptionBar }]}
            onPress={onSubscribeNow}
            activeOpacity={0.85}
          >
            <Text style={[styles.primaryLabel, { color: colors.subscriptionOnBar }]}>I'm ready</Text>
          </TouchableOpacity>

          <TouchableOpacity
            style={[styles.secondaryButton, { backgroundColor: colors.subscriptionSecondaryPill }]}
            onPress={onNotNow}
            activeOpacity={0.85}
          >
            <Text style={[styles.secondaryLabel, { color: colors.subscriptionAccent }]}>Maybe later</Text>
          </TouchableOpacity>

          <Text style={[styles.footerNote, { color: colors.subscriptionSheetText }]}>
            Cancel anytime. Restore on any device.
          </Text>
        </Animated.View>
      </View>
    </Modal>
  );
};

const styles = StyleSheet.create({
  root: {
    flex: 1,
    justifyContent: "flex-end",
  },
  sheet: {
    borderTopLeftRadius: 20,
    borderTopRightRadius: 20,
    paddingHorizontal: layout.spacing.xl,
    paddingTop: layout.spacing.md,
    shadowColor: "#000000",
    shadowOffset: { width: 0, height: -6 },
    shadowOpacity: 0.12,
    shadowRadius: 16,
    elevation: 24,
  },
  handleWrap: {
    alignItems: "center",
    paddingVertical: layout.spacing.sm,
    marginBottom: layout.spacing.sm,
  },
  handle: {
    width: 36,
    height: 4,
    borderRadius: 2,
  },
  title: {
    fontFamily: fonts.headerFamilyItalic,
    fontSize: 26,
    lineHeight: 32,
    letterSpacing: -0.3,
    marginBottom: layout.spacing.lg,
    textAlign: "center",
  },
  body: {
    fontFamily: fonts.bodyFamily,
    fontSize: 16,
    lineHeight: 24,
    marginBottom: layout.spacing.xl,
    marginHorizontal: layout.spacing.xl,
    textAlign: "center",
  },
  primaryButton: {
    alignSelf: "stretch",
    borderRadius: 12,
    paddingVertical: layout.spacing.md,
    alignItems: "center",
    marginTop: layout.spacing.sm,
  },
  primaryLabel: {
    fontFamily: fonts.bodyFamilySemiBold,
    fontSize: 16,
  },
  secondaryButton: {
    alignSelf: "stretch",
    borderRadius: 12,
    paddingVertical: layout.spacing.md,
    alignItems: "center",
    marginTop: layout.spacing.md,
  },
  secondaryLabel: {
    fontFamily: fonts.bodyFamilySemiBold,
    fontSize: 16,
  },
  footerNote: {
    fontFamily: fonts.bodyFamily,
    fontSize: 13,
    lineHeight: 18,
    textAlign: "center",
    marginTop: layout.spacing.lg,
    paddingHorizontal: layout.spacing.lg,
  },
});
