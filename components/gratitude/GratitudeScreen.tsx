import React, { useState, useCallback } from "react";
import {
  View,
  Text,
  TouchableOpacity,
  StyleSheet,
  ScrollView,
  Alert,
  KeyboardAvoidingView,
  Platform,
} from "react-native";
import { SafeAreaView } from "react-native-safe-area-context";
import { Ionicons } from "@expo/vector-icons";
import { useTheme } from "../../hooks/useTheme";
import { fonts } from "../../constants/theme";
import { useAuth } from "../../contexts/AuthContext";
import { useGratitude } from "../../hooks/useGratitude";
import { GratitudeQuote } from "./GratitudeQuote";
import { GratitudeEntry } from "./GratitudeEntry";
import { GratitudeHistory } from "./GratitudeHistory";

interface GratitudeScreenProps {
  onBack: () => void;
}

type GratitudeView = "today" | "history";

export const GratitudeScreen: React.FC<GratitudeScreenProps> = ({ onBack }) => {
  const { colors } = useTheme();
  const { user } = useAuth();
  const { todayEntry, history, todayQuote, loading, saveTodayItems } =
    useGratitude(user?.id);
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

  const dateStr = new Date().toLocaleDateString("en-US", {
    weekday: "long",
    month: "long",
    day: "numeric",
    year: "numeric",
  });

  return (
    <SafeAreaView
      style={[styles.container, { backgroundColor: colors.background }]}
      edges={["top"]}
    >
      <KeyboardAvoidingView
        style={styles.flex}
        behavior={Platform.OS === "ios" ? "padding" : "height"}
      >
        {/* Header */}
        <View style={[styles.header, { borderBottomColor: colors.border }]}>
          <TouchableOpacity onPress={onBack} style={styles.backButton}>
            <Ionicons name="arrow-back" size={24} color={colors.accent} />
            <Text style={[styles.backText, { color: colors.accent }]}>Back</Text>
          </TouchableOpacity>
          <TouchableOpacity
            onPress={() => setView("history")}
            style={styles.historyButton}
          >
            <Ionicons name="time-outline" size={20} color={colors.accent} />
            <Text style={[styles.historyText, { color: colors.accent }]}>
              History
            </Text>
          </TouchableOpacity>
        </View>

        <ScrollView
          style={styles.scrollView}
          showsVerticalScrollIndicator={false}
          keyboardShouldPersistTaps="handled"
          contentContainerStyle={styles.scrollContent}
        >
          {/* Title */}
          <Text style={[styles.screenTitle, { color: colors.text }]}>
            Gratitude List
          </Text>

          {/* Date */}
          <Text style={[styles.dateText, { color: colors.textSecondary }]}>
            {dateStr}
          </Text>

          {/* Daily Quote */}
          <GratitudeQuote quote={todayQuote} />

          {/* Entry Input + List */}
          <GratitudeEntry
            initialItems={todayEntry?.items || []}
            onSave={handleSave}
            onReset={handleReset}
            saving={saving}
          />
        </ScrollView>
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
  header: {
    flexDirection: "row",
    justifyContent: "space-between",
    alignItems: "center",
    paddingHorizontal: 20,
    paddingVertical: 12,
    borderBottomWidth: 1,
  },
  backButton: {
    flexDirection: "row",
    alignItems: "center",
    gap: 4,
  },
  backText: {
    fontFamily: fonts.bodyFamilyRegular,
    fontSize: 16,
  },
  historyButton: {
    flexDirection: "row",
    alignItems: "center",
    gap: 4,
  },
  historyText: {
    fontFamily: fonts.bodyFamilyRegular,
    fontSize: 14,
  },
  scrollView: {
    flex: 1,
  },
  scrollContent: {
    paddingTop: 20,
    paddingBottom: 40,
  },
  screenTitle: {
    fontFamily: fonts.headerFamily,
    fontSize: 32,
    fontWeight: "700",
    paddingHorizontal: 20,
    marginBottom: 6,
  },
  dateText: {
    fontFamily: fonts.bodyFamilyRegular,
    fontSize: 14,
    paddingHorizontal: 20,
    marginBottom: 20,
  },
});
