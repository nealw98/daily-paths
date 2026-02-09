import React from "react";
import { View, Text, StyleSheet } from "react-native";
import { LinearGradient } from "expo-linear-gradient";
import { useTheme } from "../../hooks/useTheme";
import { fonts } from "../../constants/theme";

interface TealHeaderProps {
  title: string;
  leftIcon?: React.ReactNode;
  rightAction?: React.ReactNode;
}

/**
 * Reusable teal gradient header used on Journal, Prayers, and other top-level screens.
 * Adapts automatically to the active theme's gradient colors.
 */
export const TealHeader: React.FC<TealHeaderProps> = ({ title, leftIcon, rightAction }) => {
  const { colors, themeId } = useTheme();

  const isSolid = colors.headerGradientStart === colors.headerGradientEnd;

  const content = (
    <View style={styles.inner}>
      <View style={styles.titleRow}>
        {leftIcon && <View style={styles.leftIcon}>{leftIcon}</View>}
        <Text style={[styles.title, { color: colors.textOnAccent }]}>{title}</Text>
      </View>
      {rightAction && <View style={styles.rightAction}>{rightAction}</View>}
    </View>
  );

  if (isSolid) {
    return (
      <View style={[styles.container, { backgroundColor: colors.headerGradientStart }]}>
        {content}
      </View>
    );
  }

  return (
    <LinearGradient
      colors={[colors.headerGradientStart, colors.headerGradientEnd]}
      start={{ x: 0, y: 0 }}
      end={themeId === "twilight-fire" ? { x: 0, y: 1 } : { x: 1, y: 1 }}
      style={styles.container}
    >
      {content}
    </LinearGradient>
  );
};

const styles = StyleSheet.create({
  container: {
    paddingHorizontal: 20,
    paddingTop: 14,
    paddingBottom: 18,
  },
  inner: {
    flexDirection: "row",
    justifyContent: "space-between",
    alignItems: "center",
  },
  titleRow: {
    flexDirection: "row",
    alignItems: "center",
  },
  leftIcon: {
    marginRight: 10,
  },
  title: {
    fontFamily: fonts.headerFamilyItalic,
    fontSize: 32,
    lineHeight: 38,
  },
  rightAction: {
    marginLeft: 12,
  },
});
