import React from "react";
import { View, Text, StyleSheet, TouchableOpacity } from "react-native";
import { useRouter } from "expo-router";
import { Ionicons } from "@expo/vector-icons";
import { useSafeAreaInsets } from "react-native-safe-area-context";
import { useTheme } from "../../hooks/useTheme";
import { fonts, typography as staticTypography } from "../../constants/theme";

interface TealHeaderProps {
  title: string;
  onPress?: () => void;
  rightAction?: React.ReactNode;
  /** If true, hides the back arrow (used on home screen). */
  hideIcon?: boolean;
  /** Optional eyebrow text above the title. */
  eyebrow?: string;
  /** Custom back handler. Falls back to router.back(). */
  onBack?: () => void;
  /** @deprecated No longer used. */
  leftIcon?: React.ReactNode;
}

/**
 * Shared structural header for top-level screens.
 * Shows a back arrow by default; home screen hides it via hideIcon.
 */
export const TealHeader: React.FC<TealHeaderProps> = ({
  title,
  onPress,
  rightAction,
  hideIcon = false,
  eyebrow,
  onBack,
}) => {
  const { colors } = useTheme();
  const router = useRouter();
  const insets = useSafeAreaInsets();

  return (
    <View
      style={[
        styles.container,
        {
          backgroundColor: colors.secondary,
          paddingTop: insets.top + 16,
        },
      ]}
    >
      <View style={styles.row}>
        {!hideIcon && (
          <TouchableOpacity
            onPress={onBack ?? (() => router.back())}
            activeOpacity={0.7}
            style={styles.backButton}
          >
            <Ionicons name="arrow-back" size={24} color={colors.onSecondary} />
          </TouchableOpacity>
        )}
        <TouchableOpacity
          disabled={!onPress}
          onPress={onPress}
          activeOpacity={onPress ? 0.8 : 1}
          style={styles.textBlock}
        >
          {eyebrow ? (
            <Text style={[styles.eyebrow, { color: colors.secondaryContainer }]}>
              {eyebrow}
            </Text>
          ) : null}
          <Text
            style={[
              styles.title,
              styles.titleBold,
              { color: colors.onSecondary },
            ]}
          >
            {title}
          </Text>
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
  backButton: {
    width: 40,
    height: 40,
    alignItems: "center",
    justifyContent: "center",
  },
  textBlock: {
    flex: 1,
  },
  eyebrow: {
    // Cormorant Garamond italic — softer, editorial feel for the branded
    // wordmark at the top of the home header. Only home uses an eyebrow
    // today; if another screen adds one it'll inherit this treatment.
    fontFamily: fonts.cormorantGaramondMediumItalic,
    fontSize: 15,
    lineHeight: 20,
    letterSpacing: 0.2,
    marginBottom: 2,
  },
  title: {
    ...staticTypography.h3,
    fontFamily: fonts.bodyFamilySemiBold,
  },
  titleBold: {
    fontFamily: fonts.bodyFamilyBold,
    fontSize: 28,
    lineHeight: 34,
  },
});
