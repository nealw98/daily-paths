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
import { useAnalytics } from "../../utils/analytics";
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
  const { trackPrayerViewed } = useAnalytics();
  const typography = useMemo(() => getTextSizeMetrics(settings.textSize), [settings.textSize]);
  const [expandedPrayer, setExpandedPrayer] = useState<string | null>(null);

  /** Render prayer text with bold phrases (e.g. "Just for today", "Just for tonight") */
  const renderPrayerText = (text: string, boldPhrases: string[]) => {
    if (boldPhrases.length === 0) return text;

    const pattern = new RegExp(`(${boldPhrases.map(p => p.replace(/[.*+?^${}()|[\]\\]/g, "\\$&")).join("|")})`, "gi");
    const parts = text.split(pattern);

    return parts.map((part, i) => {
      const isBold = boldPhrases.some(p => p.toLowerCase() === part.toLowerCase());
      if (isBold) {
        return (
          <Text key={i} style={{ fontFamily: fonts.loraBold, fontWeight: "700" }}>
            {part}
          </Text>
        );
      }
      return part;
    });
  };

  const renderPrayer = (prayer: Prayer) => {
    const isExpanded = expandedPrayer === prayer.id;

    // Determine which phrases to bold in this prayer
    const boldPhrases: string[] = [];
    if (prayer.id === "just-for-today") boldPhrases.push("Just for today");
    if (prayer.id === "just-for-tonight") boldPhrases.push("Just for tonight");

    return (
      <View key={prayer.id} style={styles.prayerSection}>
        <TouchableOpacity
          style={styles.prayerHeader}
          onPress={() => {
            const expanding = !isExpanded;
            setExpandedPrayer(expanding ? prayer.id : null);
            if (expanding) {
              trackPrayerViewed(prayer.id, prayer.title);
            }
          }}
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
              {renderPrayerText(prayer.text, boldPhrases)}
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
        keyboardDismissMode="on-drag"
        keyboardShouldPersistTaps="handled"
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
