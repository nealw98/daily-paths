import React from "react";
import { View, Text, StyleSheet } from "react-native";
import { SafeAreaView } from "react-native-safe-area-context";
import { useTheme } from "../../hooks/useTheme";

export default function StepsTab() {
  const { colors } = useTheme();

  return (
    <SafeAreaView style={[styles.container, { backgroundColor: colors.background }]} edges={["top"]}>
      <View style={[styles.header, { backgroundColor: colors.background, borderBottomColor: colors.border }]}>
        <Text style={[styles.headerTitle, { color: colors.text }]}>Steps</Text>
      </View>
      <View style={styles.placeholder}>
        <Text style={[styles.placeholderText, { color: colors.textSecondary }]}>
          Step Work feature coming in Phase 2...
        </Text>
        <Text style={[styles.placeholderSubtext, { color: colors.textSecondary }]}>
          Work through the 12 Steps with guided questions and progress tracking.
        </Text>
      </View>
    </SafeAreaView>
  );
}

const styles = StyleSheet.create({
  container: {
    flex: 1,
  },
  header: {
    paddingHorizontal: 20,
    paddingVertical: 16,
    borderBottomWidth: 1,
  },
  headerTitle: {
    fontSize: 28,
    fontWeight: "700",
  },
  placeholder: {
    flex: 1,
    alignItems: "center",
    justifyContent: "center",
    paddingHorizontal: 40,
  },
  placeholderText: {
    fontSize: 18,
    fontWeight: "600",
    marginBottom: 12,
    textAlign: "center",
  },
  placeholderSubtext: {
    fontSize: 14,
    textAlign: "center",
    opacity: 0.7,
  },
});
