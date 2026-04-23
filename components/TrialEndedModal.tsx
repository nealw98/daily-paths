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
import { useTypography } from "../hooks/useTypography";
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
  const { colors, isDark } = useTheme();
  const { typography } = useTypography();
  const insets = useSafeAreaInsets();
  const slide = useRef(new Animated.Value(SHEET_ANIM_OFFSET)).current;

  // Dynamic sizes — were static (26/16/16/13). Scale proportionally from
  // bodyLargeFontSize so the baseline at medium matches the old values.
  const titleFontSize = Math.round(typography.bodyLargeFontSize * (26 / 19));
  const titleLineHeight = Math.round(titleFontSize * (32 / 26));
  const bodyFontSize = Math.round(typography.bodyLargeFontSize * (16 / 19));
  const bodyLineHeight = Math.round(bodyFontSize * (24 / 16));
  const footerFontSize = Math.round(typography.bodyLargeFontSize * (13 / 19));
  const footerLineHeight = Math.round(footerFontSize * (18 / 13));

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

          <Text
            style={[
              styles.title,
              {
                fontSize: titleFontSize,
                lineHeight: titleLineHeight,
                color: isDark ? colors.subscriptionAccent : colors.subscriptionTitle,
              },
            ]}
          >
            Continue the path
          </Text>
          <Text
            style={[
              styles.body,
              { fontSize: bodyFontSize, lineHeight: bodyLineHeight, color: colors.onSurface },
            ]}
          >
            The daily reading will always be here for free. If the tools have been useful, consider keeping them
            {" \u2014 "}they're here to support your practice.
          </Text>

          <TouchableOpacity
            style={[styles.primaryButton, { backgroundColor: "#8F5546" }]}
            onPress={onSubscribeNow}
            activeOpacity={0.85}
          >
            <Text
              style={[
                styles.primaryLabel,
                { fontSize: bodyFontSize, color: "#FFFFFF" },
              ]}
            >
              Continue
            </Text>
          </TouchableOpacity>

          <TouchableOpacity
            style={[styles.secondaryButton, { backgroundColor: colors.subscriptionSecondaryPill }]}
            onPress={onNotNow}
            activeOpacity={0.85}
          >
            <Text
              style={[
                styles.secondaryLabel,
                { fontSize: bodyFontSize, color: colors.textSecondary },
              ]}
            >
              Maybe later
            </Text>
          </TouchableOpacity>

          <Text
            style={[
              styles.footerNote,
              { fontSize: footerFontSize, lineHeight: footerLineHeight, color: colors.onSurfaceVariant },
            ]}
          >
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
    // fontSize/lineHeight applied inline (titleFontSize / titleLineHeight).
    fontFamily: fonts.headerFamilyItalic,
    letterSpacing: -0.3,
    marginBottom: layout.spacing.lg,
    textAlign: "center",
  },
  body: {
    // fontSize/lineHeight applied inline (bodyFontSize / bodyLineHeight).
    fontFamily: fonts.bodyFamily,
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
    // fontSize applied inline (bodyFontSize).
    fontFamily: fonts.bodyFamilySemiBold,
  },
  secondaryButton: {
    alignSelf: "stretch",
    borderRadius: 12,
    paddingVertical: layout.spacing.md,
    alignItems: "center",
    marginTop: layout.spacing.md,
  },
  secondaryLabel: {
    // fontSize applied inline (bodyFontSize).
    fontFamily: fonts.bodyFamilySemiBold,
  },
  footerNote: {
    // fontSize/lineHeight applied inline (footerFontSize / footerLineHeight).
    fontFamily: fonts.bodyFamily,
    textAlign: "center",
    marginTop: layout.spacing.lg,
    paddingHorizontal: layout.spacing.lg,
  },
});
