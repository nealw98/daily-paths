import React from "react";
import {
  View,
  Text,
  Pressable,
  StyleSheet,
  type StyleProp,
  type TextStyle,
  type ViewStyle,
} from "react-native";
import { LinearGradient } from "expo-linear-gradient";
import { useTheme } from "../../hooks/useTheme";
import { fonts, layout, shadows, typography } from "../../constants/theme";

type CardTone = "lowest" | "low" | "base" | "high" | "highest";

interface SanctuaryCardProps {
  children: React.ReactNode;
  tone?: CardTone;
  style?: StyleProp<ViewStyle>;
  contentStyle?: StyleProp<ViewStyle>;
  elevated?: boolean;
}

const toneToColor = (tone: CardTone, colors: ReturnType<typeof useTheme>["colors"]) => {
  switch (tone) {
    case "lowest":
      return colors.surfaceContainerLowest;
    case "low":
      return colors.surfaceContainerLow;
    case "high":
      return colors.surfaceContainerHigh;
    case "highest":
      return colors.surfaceContainerHighest;
    case "base":
    default:
      return colors.surfaceContainer;
  }
};

export function SanctuaryCard({
  children,
  tone = "base",
  style,
  contentStyle,
  elevated = false,
}: SanctuaryCardProps) {
  const { colors } = useTheme();

  return (
    <View
      style={[
        styles.card,
        { backgroundColor: toneToColor(tone, colors) },
        elevated ? shadows.ambient : null,
        style,
      ]}
    >
      <View style={contentStyle}>{children}</View>
    </View>
  );
}

interface SanctuaryButtonProps {
  label: string;
  onPress?: () => void;
  disabled?: boolean;
  variant?: "primary" | "secondary";
  style?: StyleProp<ViewStyle>;
  textStyle?: StyleProp<TextStyle>;
  icon?: React.ReactNode;
}

export function SanctuaryButton({
  label,
  onPress,
  disabled = false,
  variant = "primary",
  style,
  textStyle,
  icon,
}: SanctuaryButtonProps) {
  const { colors } = useTheme();
  const content = (
    <View style={[styles.buttonInner, disabled && styles.disabled]}>
      {icon ? <View style={styles.buttonIcon}>{icon}</View> : null}
      <Text
        style={[
          styles.buttonText,
          {
            color: variant === "primary" ? colors.onSecondary : colors.onSecondaryContainer,
          },
          textStyle,
        ]}
      >
        {label}
      </Text>
    </View>
  );

  if (variant === "primary") {
    return (
      <Pressable onPress={onPress} disabled={disabled} style={style}>
        <LinearGradient
          colors={[colors.primary, colors.primaryContainer]}
          start={{ x: 0, y: 0 }}
          end={{ x: 1, y: 1 }}
          style={styles.buttonShell}
        >
          {content}
        </LinearGradient>
      </Pressable>
    );
  }

  return (
    <Pressable
      onPress={onPress}
      disabled={disabled}
      style={[
        styles.buttonShell,
        { backgroundColor: colors.secondaryContainer },
        disabled && styles.disabled,
        style,
      ]}
    >
      {content}
    </Pressable>
  );
}

interface FocusPillProps {
  label: string;
  selected?: boolean;
  onPress?: () => void;
  style?: StyleProp<ViewStyle>;
  labelStyle?: StyleProp<TextStyle>;
  icon?: React.ReactNode;
}

export function FocusPill({
  label,
  selected = false,
  onPress,
  style,
  labelStyle,
  icon,
}: FocusPillProps) {
  const { colors } = useTheme();

  return (
    <Pressable
      onPress={onPress}
      style={[
        styles.pill,
        {
          backgroundColor: selected ? colors.secondaryContainer : colors.surfaceContainerHighest,
          borderWidth: selected ? 0 : 1,
          borderColor: selected ? "transparent" : colors.ghostBorder,
        },
        style,
      ]}
    >
      {icon ? <View style={styles.pillIcon}>{icon}</View> : null}
      <Text
        style={[
          styles.pillLabel,
          { color: selected ? colors.onSecondaryContainer : colors.onSurfaceVariant },
          labelStyle,
        ]}
      >
        {label}
      </Text>
    </Pressable>
  );
}

interface FieldShellProps {
  children: React.ReactNode;
  focused?: boolean;
  style?: StyleProp<ViewStyle>;
}

export function FieldShell({ children, focused = false, style }: FieldShellProps) {
  const { colors } = useTheme();

  return (
    <View
      style={[
        styles.fieldShell,
        {
          backgroundColor: colors.surfaceContainerLow,
          borderWidth: focused ? 2 : 1,
          borderColor: focused ? colors.primaryFixedDim : colors.ghostBorder,
        },
        style,
      ]}
    >
      {children}
    </View>
  );
}

interface ProgressMonolithProps {
  progress: number;
  style?: StyleProp<ViewStyle>;
}

export function ProgressMonolith({ progress, style }: ProgressMonolithProps) {
  const { colors } = useTheme();
  const clamped = Math.max(0, Math.min(1, progress));

  return (
    <View
      style={[
        styles.progressTrack,
        { backgroundColor: colors.primaryFixed, overflow: "hidden" },
        style,
      ]}
    >
      <View
        style={[
          styles.progressFill,
          { width: `${clamped * 100}%`, backgroundColor: colors.primary },
        ]}
      />
    </View>
  );
}

const styles = StyleSheet.create({
  card: {
    borderRadius: layout.borderRadiusLarge,
  },
  buttonShell: {
    minHeight: 52,
    borderRadius: layout.borderRadius,
    justifyContent: "center",
    alignItems: "center",
    overflow: "hidden",
  },
  buttonInner: {
    minHeight: 52,
    paddingHorizontal: layout.spacing.md,
    flexDirection: "row",
    alignItems: "center",
    justifyContent: "center",
  },
  buttonIcon: {
    marginRight: 8,
  },
  buttonText: {
    fontFamily: fonts.bodyFamilySemiBold,
    fontSize: typography.titleMedium.fontSize,
    lineHeight: typography.titleMedium.lineHeight,
  },
  disabled: {
    opacity: 0.55,
  },
  pill: {
    minHeight: 34,
    borderRadius: layout.borderRadiusFull,
    paddingHorizontal: 12,
    paddingVertical: 8,
    flexDirection: "row",
    alignItems: "center",
    justifyContent: "center",
  },
  pillIcon: {
    marginRight: 6,
  },
  pillLabel: {
    fontFamily: fonts.labelFamily,
    fontSize: typography.labelMedium.fontSize,
    lineHeight: typography.labelMedium.lineHeight,
  },
  fieldShell: {
    borderRadius: layout.borderRadius,
    paddingHorizontal: layout.spacing.md,
    paddingVertical: layout.spacing.md,
  },
  progressTrack: {
    height: 4,
    borderRadius: layout.borderRadiusFull,
  },
  progressFill: {
    height: "100%",
    borderRadius: layout.borderRadiusFull,
  },
});
