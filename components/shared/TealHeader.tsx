import React from "react";
import { View, Text, StyleSheet, TouchableOpacity } from "react-native";
import { useRouter } from "expo-router";
import { Ionicons } from "@expo/vector-icons";
import { useTheme } from "../../hooks/useTheme";
import { fonts, layout, typography as staticTypography } from "../../constants/theme";

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
        {!hideIcon && (
          <TouchableOpacity
            onPress={onBack ?? (() => router.back())}
            activeOpacity={0.7}
            style={styles.backButton}
          >
            <Ionicons name="arrow-back" size={24} color={colors.onPrimary} />
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
