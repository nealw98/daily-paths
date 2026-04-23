import React from "react";
import { View, Text, StyleSheet, StyleProp, ViewStyle } from "react-native";
import { useTheme } from "../../hooks/useTheme";
import { useTypography } from "../../hooks/useTypography";
import { fonts } from "../../constants/theme";

interface PageTitleProps {
  title: string;
  subtitle?: string;
  size?: "lg" | "md";
  style?: StyleProp<ViewStyle>;
}

export const PageTitle: React.FC<PageTitleProps> = ({
  title,
  subtitle,
  size = "md",
  style,
}) => {
  const { colors } = useTheme();
  const { typography } = useTypography();

  const base = typography.bodyLargeFontSize; // medium baseline = 19
  const titleSize = Math.round(base * (size === "lg" ? 32 / 19 : 30 / 19));
  const titleLineHeight = Math.round(titleSize * 1.1);
  const subtitleSize = Math.round(base * (13 / 19));
  const subtitleLineHeight = Math.round(subtitleSize * (18 / 13));

  return (
    <View style={[styles.container, style]}>
      <Text
        style={[
          styles.title,
          {
            color: colors.text,
            fontSize: titleSize,
            lineHeight: titleLineHeight,
          },
        ]}
      >
        {title}
      </Text>
      {subtitle ? (
        <Text
          style={[
            styles.subtitle,
            {
              color: colors.textSecondary,
              fontSize: subtitleSize,
              lineHeight: subtitleLineHeight,
            },
          ]}
        >
          {subtitle}
        </Text>
      ) : null}
    </View>
  );
};

const styles = StyleSheet.create({
  container: {
    paddingLeft: 28,
    paddingRight: 22,
    paddingTop: 28,
    paddingBottom: 12,
  },
  title: {
    fontFamily: fonts.cormorantGaramondSemiBold,
    letterSpacing: -0.3,
  },
  subtitle: {
    fontFamily: fonts.bodyFamily,
    marginTop: 4,
  },
});
