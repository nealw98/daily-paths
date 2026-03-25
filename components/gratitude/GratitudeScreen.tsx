import React, { useState, useCallback } from "react";
import {
  View,
  Text,
  TouchableOpacity,
  StyleSheet,
  Alert,
  KeyboardAvoidingView,
  Platform,
  ImageBackground,
} from "react-native";
import { SafeAreaView } from "react-native-safe-area-context";
import { Ionicons } from "@expo/vector-icons";
import { KeyboardAwareScrollView } from "react-native-keyboard-controller";
import { useTheme } from "../../hooks/useTheme";
import { fonts, typography } from "../../constants/theme";
import { useGratitude } from "../../hooks/useGratitude";
import { GratitudeEntry } from "./GratitudeEntry";
import { GratitudeHistory } from "./GratitudeHistory";
import { useAppDate } from "../../contexts/AppDateContext";

interface GratitudeScreenProps {
  onBack: () => void;
}

type GratitudeView = "today" | "history";

export const GratitudeScreen: React.FC<GratitudeScreenProps> = ({ onBack }) => {
  const { colors } = useTheme();
  const { today } = useAppDate();
  const { todayEntry, history, todayQuote, loading, saveTodayItems } =
    useGratitude();
  const [view, setView] = useState<GratitudeView>("today");
  const [saving, setSaving] = useState(false);

  const handleSave = useCallback(
    async (items: string[]): Promise<boolean> => {
      setSaving(true);
      try {
        const result = await saveTodayItems(items);
        return result;
      } finally {
        setSaving(false);
      }
    },
    [saveTodayItems]
  );

  const handleReset = useCallback(() => {
    Alert.alert("Reset List", "Clear all items from today's list?", [
      { text: "Cancel", style: "cancel" },
      {
        text: "Reset",
        style: "destructive",
        onPress: () => {
          // Reset is handled inside GratitudeEntry via onReset
        },
      },
    ]);
  }, []);

  // History sub-screen
  if (view === "history") {
    return (
      <SafeAreaView
        style={[styles.container, { backgroundColor: colors.background }]}
        edges={["top"]}
      >
        <GratitudeHistory entries={history} onBack={() => setView("today")} />
      </SafeAreaView>
    );
  }

  const dateStr = today.toLocaleDateString("en-US", {
    weekday: "long",
    month: "long",
    day: "numeric",
    year: "numeric",
  });

  const quoteText = todayQuote
    ? todayQuote.author
      ? `“${todayQuote.quote}” — ${todayQuote.author}`
      : `“${todayQuote.quote}”`
    : "";

  return (
    <SafeAreaView
      style={[styles.container, { backgroundColor: colors.surfaceContainerLow }]}
      edges={["top"]}
    >
      <KeyboardAvoidingView
        style={styles.flex}
        behavior={Platform.OS === "ios" ? "padding" : "height"}
      >
        <View style={[styles.headerRow, { backgroundColor: colors.surface }]}>
          <TouchableOpacity onPress={onBack} style={styles.backButton}>
            <Ionicons name="arrow-back" size={20} color={colors.primary} />
            <Text style={[styles.backText, { color: colors.primary }]}>Back</Text>
          </TouchableOpacity>
          <Text style={[styles.headerTitle, { color: colors.onSurface }]}>Gratitude</Text>
          <TouchableOpacity
            onPress={() => setView("history")}
            style={styles.historyButton}
          >
            <Ionicons name="time-outline" size={18} color={colors.primary} />
            <Text style={[styles.historyText, { color: colors.primary }]}>
              History
            </Text>
          </TouchableOpacity>
        </View>

        <ImageBackground
          source={require("../../assets/gratitude.jpg")}
          style={styles.heroImage}
          resizeMode="cover"
        />

        <KeyboardAwareScrollView
          style={styles.scrollView}
          showsVerticalScrollIndicator={false}
          bottomOffset={24}
          extraKeyboardSpace={24}
          keyboardShouldPersistTaps="handled"
          keyboardDismissMode="on-drag"
          contentContainerStyle={styles.scrollContent}
        >
          <View
            style={[
              styles.overlayCard,
              {
                backgroundColor: colors.surfaceContainerLowest,
                shadowColor: "#163531",
              },
            ]}
          >
            {/* Date */}
            <Text style={[styles.dateText, { color: colors.onSurfaceVariant }]}>
              {dateStr}
            </Text>

            {/* Daily Quote from gratitude_quotes */}
            {!!quoteText && (
              <Text style={[styles.quoteText, { color: colors.onSurfaceVariant }]}>
                {quoteText}
              </Text>
            )}

            {/* Entry Input + List */}
            <GratitudeEntry
              initialItems={todayEntry?.items || []}
              onSave={handleSave}
              onReset={handleReset}
              saving={saving}
            />
          </View>
        </KeyboardAwareScrollView>
      </KeyboardAvoidingView>
    </SafeAreaView>
  );
};

const styles = StyleSheet.create({
  container: {
    flex: 1,
  },
  flex: {
    flex: 1,
  },
  headerRow: {
    flexDirection: "row",
    justifyContent: "space-between",
    alignItems: "center",
    paddingLeft: 18,
    paddingRight: 16,
    paddingVertical: 10,
  },
  backButton: {
    flexDirection: "row",
    alignItems: "center",
    gap: 4,
  },
  headerTitle: {
    fontFamily: fonts.bodyFamilyRegular,
    fontSize: 18,
    fontWeight: "600",
  },
  backText: {
    fontFamily: fonts.bodyFamilyRegular,
    fontSize: 14,
  },
  historyButton: {
    flexDirection: "row",
    alignItems: "center",
    gap: 4,
  },
  historyText: {
    fontFamily: fonts.bodyFamilyRegular,
    fontSize: 13,
  },
  heroImage: {
    height: 230,
    width: "100%",
  },
  scrollView: {
    flex: 1,
  },
  scrollContent: {
    paddingTop: 0,
    paddingBottom: 40,
  },
  overlayCard: {
    marginTop: -96,
    marginHorizontal: 16,
    borderRadius: 16,
    paddingTop: 20,
    paddingBottom: 14,
    shadowOffset: { width: 0, height: 24 },
    shadowOpacity: 0.06,
    shadowRadius: 48,
    elevation: 8,
  },
  dateText: {
    fontFamily: fonts.bodyFamilyRegular,
    fontSize: 13,
    paddingHorizontal: 20,
    marginBottom: 12,
    textTransform: "uppercase",
    letterSpacing: 0.6,
  },
  quoteText: {
    fontFamily: typography.quoteBox.fontFamily,
    fontSize: typography.quoteBox.fontSize,
    lineHeight: typography.quoteBox.lineHeight,
    textAlign: "center",
    paddingHorizontal: 24,
    marginBottom: 18,
  },
});
