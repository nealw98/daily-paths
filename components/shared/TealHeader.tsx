import React from "react";
import { View, Text, StyleSheet, TouchableOpacity } from "react-native";
import { useTheme } from "../../hooks/useTheme";
import { fonts, layout, typography as staticTypography } from "../../constants/theme";

interface TealHeaderProps {
  title: string;
  leftIcon?: React.ReactNode;
  onPress?: () => void;
  rightAction?: React.ReactNode;
}

/**
 * Shared structural header for top-level screens.
 * Keeps the legacy export name so existing imports do not change.
 */
export const TealHeader: React.FC<TealHeaderProps> = ({ title, leftIcon, onPress, rightAction }) => {
  const { colors } = useTheme();

  return (
    <View
      style={[
        styles.container,
        {
          backgroundColor: colors.primary,
        },
      ]}
    >
      <View style={styles.row}>
        <TouchableOpacity
          disabled={!onPress}
          onPress={onPress}
          activeOpacity={onPress ? 0.8 : 1}
          style={styles.inner}
        >
          {leftIcon ? (
            <View
              style={[
                styles.iconShell,
                {
                  backgroundColor: colors.onPrimary + "1A",
                },
              ]}
            >
              {leftIcon}
            </View>
          ) : null}
          <View style={styles.textBlock}>
            <Text style={[styles.eyebrow, { color: colors.secondaryContainer }]}>
              Daily Paths
            </Text>
            <Text style={[styles.title, { color: colors.onPrimary }]}>{title}</Text>
          </View>
        </TouchableOpacity>
        {rightAction ?? null}
      </View>
    </View>
  );
};

const styles = StyleSheet.create({
  container: {
    paddingHorizontal: 20,
    paddingTop: 16,
    paddingBottom: 18,
  },
  row: {
    flexDirection: "row",
    alignItems: "center",
  },
  inner: {
    flex: 1,
    flexDirection: "row",
    alignItems: "center",
    gap: 12,
  },
  iconShell: {
    width: 44,
    height: 44,
    borderRadius: layout.borderRadius,
    alignItems: "center",
    justifyContent: "center",
  },
  textBlock: {
    flex: 1,
  },
  eyebrow: {
    ...staticTypography.label,
    letterSpacing: 0.5,
    textTransform: "uppercase",
    marginBottom: 2,
  },
  title: {
    ...staticTypography.h2,
    fontFamily: fonts.headerFamilyBoldItalic,
  },
});
