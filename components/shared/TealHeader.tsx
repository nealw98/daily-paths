import React from "react";
import { View, Text, StyleSheet } from "react-native";
import { LinearGradient } from "expo-linear-gradient";
import { useTheme } from "../../hooks/useTheme";
import { fonts, getHeaderGradientPoints } from "../../constants/theme";

interface TealHeaderProps {
  title: string;
  leftIcon?: React.ReactNode;
}

/**
 * Reusable teal gradient header used on Journal, Prayers, and other top-level screens.
 * Adapts automatically to the active theme's gradient colors.
 */
export const TealHeader: React.FC<TealHeaderProps> = ({ title, leftIcon }) => {
  const { colors, themeId } = useTheme();

  const isSolid = colors.headerGradientStart === colors.headerGradientEnd;
  const { start, end } = getHeaderGradientPoints(themeId);

  const content = (
    <View style={styles.inner}>
      <View style={styles.titleRow}>
        {leftIcon && <View style={styles.leftIcon}>{leftIcon}</View>}
        <Text style={[styles.title, { color: colors.textOnAccent }]}>{title}</Text>
      </View>
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
      start={start}
      end={end}
      style={styles.container}
    >
      {content}
    </LinearGradient>
  );
};

const styles = StyleSheet.create({
  container: {
    paddingHorizontal: 20,
    paddingTop: 24,
    paddingBottom: 20,
  },
  inner: {
    alignItems: "center",
    justifyContent: "center",
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
    fontSize: 38,
    lineHeight: 46,
  },
});
