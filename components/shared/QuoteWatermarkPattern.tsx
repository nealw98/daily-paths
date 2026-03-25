import React from "react";
import { StyleSheet, Text, View } from "react-native";

interface QuoteWatermarkPatternProps {
  colorPrimary?: string;
  colorSecondary?: string;
  colorTertiary?: string;
}

export const QuoteWatermarkPattern: React.FC<QuoteWatermarkPatternProps> = ({
  colorPrimary = "rgba(255, 255, 255, 0.05)",
  colorSecondary = "rgba(255, 255, 255, 0.035)",
  colorTertiary = "rgba(255, 255, 255, 0.07)",
}) => {
  return (
    <View pointerEvents="none" style={styles.fill}>
      <Text style={[styles.row, styles.rowTop, { color: colorTertiary }]}>
        quote   quote   quote
      </Text>
      <Text style={[styles.row, styles.rowBottom, { color: colorTertiary }]}>
        quote   quote   quote
      </Text>

      <Text style={[styles.largeWordA, { color: colorPrimary }]}>quote</Text>
      <Text style={[styles.largeWordB, { color: colorSecondary }]}>quote</Text>
      <Text style={[styles.largeWordC, { color: colorPrimary }]}>quote</Text>
      <Text style={[styles.largeWordD, { color: colorPrimary }]}>quote</Text>
    </View>
  );
};

const styles = StyleSheet.create({
  fill: {
    ...StyleSheet.absoluteFillObject,
  },
  row: {
    position: "absolute",
    left: -36,
    right: -36,
    fontFamily: "Manrope_600SemiBold",
    fontSize: 28,
    lineHeight: 32,
    letterSpacing: 1.4,
  },
  rowTop: {
    top: 10,
  },
  rowBottom: {
    bottom: 12,
  },
  largeWordA: {
    position: "absolute",
    right: -34,
    top: -10,
    fontFamily: "Manrope_700Bold",
    fontSize: 148,
    lineHeight: 148,
    transform: [{ rotate: "-8deg" }],
  },
  largeWordB: {
    position: "absolute",
    left: -18,
    bottom: -42,
    fontFamily: "Manrope_700Bold",
    fontSize: 164,
    lineHeight: 164,
    transform: [{ rotate: "10deg" }],
  },
  largeWordC: {
    position: "absolute",
    right: -6,
    top: "28%",
    fontFamily: "Manrope_600SemiBold",
    fontSize: 92,
    lineHeight: 92,
    transform: [{ rotate: "-90deg" }],
  },
  largeWordD: {
    position: "absolute",
    right: -20,
    bottom: -24,
    fontFamily: "Manrope_700Bold",
    fontSize: 132,
    lineHeight: 132,
    transform: [{ rotate: "-14deg" }],
  },
});
