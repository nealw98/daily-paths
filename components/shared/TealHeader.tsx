import React from "react";
import { View, Text, Image, StyleSheet, TouchableOpacity } from "react-native";
import { useRouter } from "expo-router";
import { useTheme } from "../../hooks/useTheme";
import { fonts, layout, typography as staticTypography } from "../../constants/theme";

interface TealHeaderProps {
  title: string;
  /** @deprecated — icon is now the app logo. Kept for compat but ignored. */
  leftIcon?: React.ReactNode;
  onPress?: () => void;
  rightAction?: React.ReactNode;
  /** If true, tapping the icon navigates home. Defaults to true. */
  navigateHome?: boolean;
}

/**
 * Shared structural header for top-level screens.
 * The left icon is always the app logo; tapping it returns to the home tab.
 */
export const TealHeader: React.FC<TealHeaderProps> = ({
  title,
  onPress,
  rightAction,
  navigateHome = true,
}) => {
  const { colors } = useTheme();
  const router = useRouter();

  const handleIconPress = () => {
    if (navigateHome) {
      router.push("/(tabs)/home");
    }
  };

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
          onPress={handleIconPress}
          activeOpacity={0.7}
          style={styles.iconShell}
        >
          <Image
            source={require("../../assets/adaptive-icon.png")}
            style={styles.iconImage}
            resizeMode="cover"
          />
          <View style={styles.iconOverlay} pointerEvents="none" />
        </TouchableOpacity>
        <TouchableOpacity
          disabled={!onPress}
          onPress={onPress}
          activeOpacity={onPress ? 0.8 : 1}
          style={styles.textBlock}
        >
          <Text style={[styles.eyebrow, { color: colors.secondaryContainer }]}>
            Daily Paths
          </Text>
          <Text style={[styles.title, { color: colors.onPrimary }]}>{title}</Text>
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
    gap: 12,
  },
  iconShell: {
    width: 44,
    height: 44,
    borderRadius: 10,
    alignItems: "center",
    justifyContent: "center",
    overflow: "hidden",
  },
  iconImage: {
    width: 44,
    height: 44,
    borderRadius: 10,
  },
  iconOverlay: {
    ...StyleSheet.absoluteFillObject,
    backgroundColor: "rgba(255, 255, 255, 0.20)",
    borderRadius: 10,
  },
  textBlock: {
    flex: 1,
  },
  eyebrow: {
    fontFamily: fonts.labelFamily,
    fontSize: 10,
    lineHeight: 14,
    letterSpacing: 0.6,
    textTransform: "uppercase",
    marginBottom: 2,
  },
  title: {
    ...staticTypography.h3,
    fontFamily: fonts.bodyFamilySemiBold,
  },
});
