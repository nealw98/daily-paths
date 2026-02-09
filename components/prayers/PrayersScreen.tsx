import React, { useState, useMemo } from "react";
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
import { useSettings, getTextSizeMetrics } from "../../hooks/useSettings";
import { fonts } from "../../constants/theme";
import { PRAYERS, type Prayer } from "../../constants/prayers";
import { PersonalNotes } from "./PersonalNotes";
import { TealHeader } from "../shared/TealHeader";
import { LeafOnWater } from "../icons";

interface PrayersScreenProps {
  userId: string | null;
}

export const PrayersScreen: React.FC<PrayersScreenProps> = ({
  userId,
}) => {
  const { colors } = useTheme();
  const { settings } = useSettings();
  const typography = useMemo(() => getTextSizeMetrics(settings.textSize), [settings.textSize]);
  const [expandedPrayer, setExpandedPrayer] = useState<string | null>("serenity");

  const renderPrayer = (prayer: Prayer) => {
    const isExpanded = expandedPrayer === prayer.id;

    return (
      <View key={prayer.id} style={styles.prayerSection}>
        <TouchableOpacity
          style={styles.prayerHeader}
          onPress={() => setExpandedPrayer(isExpanded ? null : prayer.id)}
          activeOpacity={0.7}
        >
          <Text style={[styles.prayerTitle, { color: colors.ocean, fontSize: typography.bodyFontSize + 2 }]}>
            {prayer.title.toUpperCase()}
          </Text>
          <Ionicons
            name={isExpanded ? "chevron-up" : "chevron-down"}
            size={18}
            color={colors.textSecondary}
          />
        </TouchableOpacity>

        {isExpanded && (
          <View style={styles.prayerBody}>
            <Text style={[styles.prayerText, { color: colors.ink, fontSize: typography.bodyFontSize, lineHeight: typography.bodyFontSize * 1.625 }]}>
              {prayer.text}
            </Text>
            {prayer.source && (
              <Text style={[styles.prayerSource, { color: colors.seafoam, fontSize: typography.bodyFontSize - 2 }]}>
                — {prayer.source.toUpperCase()}
              </Text>
            )}
          </View>
        )}
      </View>
    );
  };

  return (
    <SafeAreaView
      style={[styles.container, { backgroundColor: colors.pearl }]}
      edges={["top"]}
    >
      {/* Teal Gradient Header */}
      <TealHeader
        title="Prayers"
        leftIcon={<LeafOnWater size={28} color={colors.textOnAccent} />}
      />

      <ScrollView
        style={styles.scrollView}
        showsVerticalScrollIndicator={false}
        contentContainerStyle={styles.scrollContent}
      >
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
  scrollView: {
    flex: 1,
  },
  scrollContent: {
    paddingHorizontal: 20,
    paddingTop: 20,
    paddingBottom: 100,
  },
  prayerSection: {
    marginBottom: 8,
  },
  prayerHeader: {
    flexDirection: "row",
    justifyContent: "space-between",
    alignItems: "center",
    paddingVertical: 14,
  },
  prayerTitle: {
    fontFamily: "Inter_500Medium",
    fontSize: 18,
    fontWeight: "600",
    flex: 1,
  },
  prayerBody: {
    paddingBottom: 16,
  },
  prayerText: {
    fontFamily: fonts.loraRegular,
    fontSize: 16,
    lineHeight: 26,
  },
  prayerSource: {
    fontFamily: "Inter_500Medium",
    fontSize: 14,
    fontWeight: "600",
    letterSpacing: 1,
    marginTop: 14,
    textAlign: "right",
  },
  personalSection: {
    marginTop: 24,
  },
});
