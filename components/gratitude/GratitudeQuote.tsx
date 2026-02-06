import React from "react";
import { View, Text, StyleSheet } from "react-native";
import { useTheme } from "../../hooks/useTheme";
import { fonts } from "../../constants/theme";
import type { GratitudeQuote as QuoteType } from "../../hooks/useGratitude";

interface GratitudeQuoteProps {
  quote: QuoteType | null;
}

export const GratitudeQuote: React.FC<GratitudeQuoteProps> = ({ quote }) => {
  const { colors } = useTheme();

  if (!quote) return null;

  // Build quote text with author inline
  const quoteText = quote.author
    ? `\u201C${quote.quote}\u201D \u2014 ${quote.author}`
    : `\u201C${quote.quote}\u201D`;

  return (
    <View
      style={[
        styles.container,
        { backgroundColor: colors.highlight + "30" },
      ]}
    >
      <Text style={[styles.quoteText, { color: colors.text }]}>
        {quoteText}
      </Text>
    </View>
  );
};

const styles = StyleSheet.create({
  container: {
    borderRadius: 14,
    paddingHorizontal: 24,
    paddingVertical: 24,
    marginHorizontal: 20,
    marginBottom: 24,
  },
  quoteText: {
    fontFamily: fonts.loraItalic,
    fontSize: 18,
    lineHeight: 28,
    textAlign: "center",
  },
});
