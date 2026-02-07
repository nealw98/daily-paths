import React, { useState } from "react";
import {
  View,
  Text,
  TouchableOpacity,
  StyleSheet,
  ScrollView,
} from "react-native";
import { SafeAreaView } from "react-native-safe-area-context";
import { Ionicons } from "@expo/vector-icons";
import { useTheme } from "../../hooks/useTheme";
import { fonts } from "../../constants/theme";
import { PRAYERS, type Prayer } from "../../constants/prayers";
import { PersonalNotes } from "./PersonalNotes";

interface PrayersScreenProps {
  userId: string | null;
  onBack: () => void;
}

export const PrayersScreen: React.FC<PrayersScreenProps> = ({
  userId,
  onBack,
}) => {
  const { colors } = useTheme();
  const [expandedPrayer, setExpandedPrayer] = useState<string | null>("serenity");

  const renderPrayer = (prayer: Prayer) => {
    const isExpanded = expandedPrayer === prayer.id;

    return (
      <View
        key={prayer.id}
        style={[
          styles.prayerCard,
          { backgroundColor: colors.cardBackground, borderColor: colors.border },
        ]}
      >
        <TouchableOpacity
          style={styles.prayerHeader}
          onPress={() => setExpandedPrayer(isExpanded ? null : prayer.id)}
          activeOpacity={0.7}
        >
          <Text style={[styles.prayerTitle, { color: colors.text }]}>
            {prayer.title}
          </Text>
          <Ionicons
            name={isExpanded ? "chevron-up" : "chevron-down"}
            size={18}
            color={colors.textSecondary}
          />
        </TouchableOpacity>

        {isExpanded && (
          <View style={styles.prayerBody}>
            <Text style={[styles.prayerText, { color: colors.text }]}>
              {prayer.text}
            </Text>
            {prayer.source && (
              <Text style={[styles.prayerSource, { color: colors.textSecondary }]}>
                — {prayer.source}
              </Text>
            )}
          </View>
        )}
      </View>
    );
  };

  return (
    <SafeAreaView
      style={[styles.container, { backgroundColor: colors.background }]}
      edges={["top"]}
    >
      {/* Header */}
      <View style={[styles.header, { borderBottomColor: colors.border }]}>
        <TouchableOpacity onPress={onBack} style={styles.backButton}>
          <Ionicons name="arrow-back" size={24} color={colors.accent} />
          <Text style={[styles.backText, { color: colors.accent }]}>Back</Text>
        </TouchableOpacity>
      </View>

      <ScrollView
        style={styles.scrollView}
        showsVerticalScrollIndicator={false}
        contentContainerStyle={styles.scrollContent}
      >
        <Text style={[styles.screenTitle, { color: colors.text }]}>
          Prayers
        </Text>
        <Text style={[styles.subtitle, { color: colors.textSecondary }]}>
          A collection of prayers for your recovery journey
        </Text>

        {/* Prayers List */}
        {PRAYERS.map(renderPrayer)}

        {/* Personal Notes Section */}
        <View style={styles.personalSection}>
          <PersonalNotes userId={userId} />
        </View>
      </ScrollView>
    </SafeAreaView>
  );
};

const styles = StyleSheet.create({
  container: {
    flex: 1,
  },
  header: {
    flexDirection: "row",
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
  scrollView: {
    flex: 1,
  },
  scrollContent: {
    paddingHorizontal: 20,
    paddingTop: 20,
    paddingBottom: 100,
  },
  screenTitle: {
    fontFamily: fonts.headerFamily,
    fontSize: 32,
    fontWeight: "700",
    marginBottom: 8,
  },
  subtitle: {
    fontFamily: fonts.bodyFamily,
    fontSize: 15,
    lineHeight: 22,
    marginBottom: 28,
  },
  prayerCard: {
    borderRadius: 14,
    borderWidth: 1,
    marginBottom: 12,
    overflow: "hidden",
  },
  prayerHeader: {
    flexDirection: "row",
    justifyContent: "space-between",
    alignItems: "center",
    paddingHorizontal: 18,
    paddingVertical: 16,
  },
  prayerTitle: {
    fontFamily: fonts.headerFamily,
    fontSize: 18,
    fontWeight: "600",
    flex: 1,
  },
  prayerBody: {
    paddingHorizontal: 18,
    paddingBottom: 20,
  },
  prayerText: {
    fontFamily: fonts.loraRegular,
    fontSize: 16,
    lineHeight: 26,
  },
  prayerSource: {
    fontFamily: fonts.loraItalic,
    fontSize: 14,
    marginTop: 14,
    textAlign: "right",
  },
  personalSection: {
    marginTop: 16,
  },
});
