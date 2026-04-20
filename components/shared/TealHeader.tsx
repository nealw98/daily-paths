import React from "react";
import { View, Text, StyleSheet, TouchableOpacity } from "react-native";
import { useRouter } from "expo-router";
import { Ionicons } from "@expo/vector-icons";
import { useSafeAreaInsets } from "react-native-safe-area-context";
import { useTheme } from "../../hooks/useTheme";
import { fonts, typography as staticTypography } from "../../constants/theme";

interface TealHeaderProps {
  /** When provided (home screen), renders legacy eyebrow + title layout. */
  title?: string;
  /** Legacy: handler for the tappable title (home date). */
  onPress?: () => void;
  rightAction?: React.ReactNode;
  /** If true, hides the back button (used on home screen). */
  hideIcon?: boolean;
  /** When provided, renders above the title (home brand "Al-Anon Daily Paths"). */
  eyebrow?: string;
  /** Custom back handler. Falls back to router.back(). */
  onBack?: () => void;
  /** @deprecated No longer used. */
  titleSize?: number;
  /** @deprecated No longer used. */
  titleWeight?: "bold" | "semibold" | "medium" | "regular";
  /** @deprecated No longer used. */
  leftIcon?: React.ReactNode;
}

/**
 * Shared app header.
 * - Sub-page mode (no title prop): "< Back" (muted) left, centered italic brand.
 * - Home mode (title + eyebrow provided): legacy eyebrow over title layout.
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

  // Legacy home layout — eyebrow over title, no centered brand.
  if (title) {
    return (
      <View
        style={[
          styles.legacyContainer,
          {
            backgroundColor: colors.secondary,
            paddingTop: insets.top + 24,
            paddingBottom: 10,
          },
        ]}
      >
        <View style={styles.legacyRow}>
          {!hideIcon && (
            <TouchableOpacity
              onPress={onBack ?? (() => router.back())}
              activeOpacity={0.7}
              style={styles.legacyBackButton}
            >
              <Ionicons name="arrow-back" size={24} color={colors.onSecondary} />
            </TouchableOpacity>
          )}
          <TouchableOpacity
            disabled={!onPress}
            onPress={onPress}
            activeOpacity={onPress ? 0.8 : 1}
            style={styles.legacyTextBlock}
          >
            {eyebrow ? (
              <Text style={[styles.legacyEyebrow, { color: "rgba(255,255,255,0.95)" }]}>
                {eyebrow}
              </Text>
            ) : null}
            <Text
              style={[
                styles.legacyTitle,
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
  }

  // Sub-page mode — brand-centered.
  return (
    <View
      style={[
        styles.container,
        {
          backgroundColor: colors.secondary,
          paddingTop: insets.top + 8,
          paddingBottom: 16,
        },
      ]}
    >
      <View style={styles.row}>
        <View style={styles.sideLeft}>
          {!hideIcon && (
            <TouchableOpacity
              onPress={onBack ?? (() => router.back())}
              activeOpacity={0.7}
              hitSlop={{ top: 8, bottom: 8, left: 8, right: 8 }}
              style={styles.backButton}
            >
              <Ionicons name="chevron-back" size={18} color="rgba(255,255,255,0.75)" />
              <Text style={styles.backLabel}>Back</Text>
            </TouchableOpacity>
          )}
        </View>
        <Text numberOfLines={1} style={styles.brand}>
          Al-Anon Daily Paths
        </Text>
        <View style={styles.sideRight}>{rightAction ?? null}</View>
      </View>
    </View>
  );
};

const styles = StyleSheet.create({
  // Sub-page (brand-centered) layout
  container: {
    paddingHorizontal: 18,
  },
  row: {
    flexDirection: "row",
    alignItems: "flex-end",
  },
  sideLeft: {
    flex: 1,
    alignItems: "flex-start",
  },
  sideRight: {
    flex: 1,
    alignItems: "flex-end",
  },
  backButton: {
    flexDirection: "row",
    alignItems: "center",
    gap: 3,
    paddingTop: 6,
    paddingBottom: 2,
    paddingHorizontal: 4,
  },
  backLabel: {
    fontFamily: fonts.bodyFamilyMedium,
    fontSize: 14,
    color: "rgba(255,255,255,0.75)",
  },
  brand: {
    fontFamily: fonts.cormorantGaramondSemiBoldItalic,
    fontSize: 22,
    lineHeight: 27,
    color: "rgba(255,255,255,0.95)",
  },

  // Legacy (home) layout
  legacyContainer: {
    paddingHorizontal: 20,
  },
  legacyRow: {
    flexDirection: "row",
    alignItems: "center",
    gap: 12,
  },
  legacyBackButton: {
    width: 40,
    height: 40,
    alignItems: "center",
    justifyContent: "center",
  },
  legacyTextBlock: {
    flex: 1,
  },
  legacyEyebrow: {
    fontFamily: fonts.cormorantGaramondMediumItalic,
    fontSize: 15,
    lineHeight: 20,
    letterSpacing: 0.2,
    marginBottom: 2,
  },
  legacyTitle: {
    ...staticTypography.h3,
    fontFamily: fonts.bodyFamilySemiBold,
    fontSize: 24,
    lineHeight: 30,
  },
});
