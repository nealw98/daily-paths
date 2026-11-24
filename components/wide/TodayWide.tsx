import React from "react";
import {
  ActivityIndicator,
  ImageBackground,
  Pressable,
  ScrollView,
  StyleSheet,
  Text,
  View,
} from "react-native";
import { useSafeAreaInsets } from "react-native-safe-area-context";
import { LinearGradient } from "expo-linear-gradient";
import { Ionicons, MaterialCommunityIcons, MaterialIcons } from "@expo/vector-icons";
import { fonts, layout, wideType } from "../../constants/theme";
import { useTheme } from "../../hooks/useTheme";
import { JOURNAL_CATEGORIES, type EntryType } from "../../constants/journalCategories";
import type { DailyReading } from "../../types/readings";
import type { Speaker } from "../../types/speakers";
import type { Prayer } from "../../constants/prayers";

/**
 * Today in the wide layout (docs/widescreen-2.9/01-Today): greeting and date
 * on top; the reflection card on the left; on the right the four journaling
 * tools, then the prayer and featured-speaker cards side by side. The phone
 * Today (app/(tabs)/home.tsx) owns the data and passes it in.
 */
type Props = {
  greeting: string;
  /** e.g. "Monday, November 23" */
  dateLabel: string;
  /** e.g. "Nov 23", for the reflection card's label */
  shortDateLabel: string;
  heroImage: any;
  reading: DailyReading | null;
  readingLoading: boolean;
  onOpenReading: () => void;
  onOpenTool: (type: EntryType) => void;
  prayer: Prayer | null;
  onOpenPrayer: (prayer: Prayer) => void;
  featuredSpeaker: Speaker | null;
  onOpenSpeaker: (speaker: Speaker) => void;
  /** Internal builds only: a control placed beside the date. */
  devAction?: React.ReactNode;
};

export function TodayWide({
  greeting,
  dateLabel,
  shortDateLabel,
  heroImage,
  reading,
  readingLoading,
  onOpenReading,
  onOpenTool,
  prayer,
  onOpenPrayer,
  featuredSpeaker,
  onOpenSpeaker,
  devAction,
}: Props) {
  const { colors } = useTheme();
  const insets = useSafeAreaInsets();
  const card = {
    backgroundColor: colors.surfaceContainerLowest,
    borderColor: colors.surfaceContainerHighest,
  };

  return (
    <ScrollView
      style={[styles.flex, { backgroundColor: colors.surface }]}
      contentContainerStyle={[styles.content, { paddingTop: insets.top + 8 }]}
      showsVerticalScrollIndicator={false}
    >
      <View style={styles.header}>
        <Text style={[wideType.screenTitle, { color: colors.primaryContainer }]}>{greeting}</Text>
        <View style={styles.headerRight}>
          {devAction}
          <Text style={[wideType.smallCaps, styles.caps, { color: colors.onSurfaceVariant }]}>
            {dateLabel}
          </Text>
        </View>
      </View>

      <View style={styles.columns}>
        {/* Left: today's reflection */}
        <Pressable
          onPress={onOpenReading}
          accessibilityRole="button"
          accessibilityLabel={reading ? `Today's reflection, ${reading.title}` : "Today's reflection"}
          style={({ pressed }) => [
            styles.hero,
            { backgroundColor: colors.surfaceContainerLowest },
            pressed && styles.pressed,
          ]}
        >
          <ImageBackground source={heroImage} resizeMode="cover" style={styles.heroImage}>
            <LinearGradient colors={["rgba(0,0,0,0)", "rgba(0,0,0,0.6)"]} style={styles.heroScrim}>
              <Text style={[wideType.smallCaps, styles.caps, styles.heroLabel]}>
                {`Today's Reflection · ${shortDateLabel}`}
              </Text>
              {readingLoading && !reading ? (
                <ActivityIndicator color="#FFFFFF" style={styles.heroSpinner} />
              ) : reading ? (
                <Text style={[wideType.bigTitle, styles.heroTitle]} numberOfLines={3}>
                  {reading.title}
                </Text>
              ) : null}
            </LinearGradient>
          </ImageBackground>
          <View style={styles.heroBottom}>
            {reading ? (
              <Text style={[styles.heroThought, { color: colors.primary }]} numberOfLines={3}>
                {`"${reading.thoughtForDay}"`}
              </Text>
            ) : (
              <Text style={[wideType.secondary, { color: colors.onSurfaceVariant }]}>
                No reading available today.
              </Text>
            )}
            <Text style={[wideType.link, { color: colors.secondary }]}>Read more ›</Text>
          </View>
        </Pressable>

        {/* Right: tools, then prayer + featured speaker */}
        <View style={styles.right}>
          {JOURNAL_CATEGORIES.map((cat) => (
            <Pressable
              key={cat.id}
              onPress={() => onOpenTool(cat.id)}
              accessibilityRole="button"
              accessibilityLabel={`${cat.label}. ${cat.description}`}
              style={({ pressed }) => [styles.toolRow, card, pressed && styles.pressed]}
            >
              <View style={[styles.toolIcon, { backgroundColor: colors.secondary }]}>
                <Ionicons name={cat.icon as any} size={22} color={colors.onSecondary} />
              </View>
              <View style={styles.flex}>
                <Text style={[wideType.row, { color: colors.onSurface }]}>{cat.label}</Text>
                <Text style={[wideType.secondary, { color: colors.onSurfaceVariant }]} numberOfLines={1}>
                  {cat.description}
                </Text>
              </View>
              <MaterialIcons name="chevron-right" size={22} color={colors.secondary} />
            </Pressable>
          ))}

          <View style={styles.cardPair}>
            {prayer ? (
              <Pressable
                onPress={() => onOpenPrayer(prayer)}
                accessibilityRole="button"
                accessibilityLabel={`Prayer, ${prayer.title}`}
                style={({ pressed }) => [styles.prayerCard, card, pressed && styles.pressed]}
              >
                <View style={styles.labelRow}>
                  <MaterialCommunityIcons name="hands-pray" size={14} color={colors.secondary} />
                  <Text style={[wideType.smallCaps, styles.caps, { color: colors.secondary }]}>Prayers</Text>
                </View>
                <Text style={[wideType.cardTitle, { color: colors.primaryContainer }]} numberOfLines={2}>
                  {prayer.title}
                </Text>
                <Text style={[wideType.preview, { color: colors.primary }]} numberOfLines={4}>
                  {prayer.text.replace(/\s*\n+\s*/g, " ")}
                </Text>
                <Text style={[wideType.link, styles.pushDown, { color: colors.secondary }]}>Read more ›</Text>
              </Pressable>
            ) : null}

            {featuredSpeaker ? (
              <Pressable
                onPress={() => onOpenSpeaker(featuredSpeaker)}
                accessibilityRole="button"
                accessibilityLabel={`Featured speaker, ${featuredSpeaker.title}, ${featuredSpeaker.speaker}. Listen`}
                style={({ pressed }) => [
                  styles.speakerCard,
                  { backgroundColor: colors.primaryFixed },
                  pressed && styles.pressed,
                ]}
              >
                <Text style={[wideType.smallCaps, styles.caps, styles.onDarkMuted]}>Featured speaker</Text>
                <View>
                  <Text style={[wideType.cardTitle, styles.onDark]} numberOfLines={3}>
                    {featuredSpeaker.title}
                  </Text>
                  <Text style={[wideType.secondary, styles.onDarkMuted, styles.speakerMeta]} numberOfLines={1}>
                    {[featuredSpeaker.speaker, featuredSpeaker.hometown].filter(Boolean).join(" · ")}
                  </Text>
                </View>
                <View style={styles.listenRow}>
                  <View style={[styles.playDot, { backgroundColor: colors.secondaryContainer }]}>
                    <Ionicons name="play" size={14} color={colors.onSecondaryContainer} />
                  </View>
                  <Text style={[wideType.link, styles.onDark]}>Listen</Text>
                </View>
              </Pressable>
            ) : null}
          </View>
        </View>
      </View>
    </ScrollView>
  );
}

const RADIUS = layout.borderRadiusLarge;

const styles = StyleSheet.create({
  flex: { flex: 1 },
  content: {
    flexGrow: 1,
    paddingLeft: 18,
    paddingRight: 16,
    paddingBottom: 20,
    gap: 14,
  },
  header: {
    flexDirection: "row",
    alignItems: "baseline",
    justifyContent: "space-between",
    gap: 16,
  },
  headerRight: { flexDirection: "row", alignItems: "center", gap: 12 },
  caps: { textTransform: "uppercase" },
  columns: { flex: 1, flexDirection: "row", gap: 22 },
  pressed: { opacity: 0.85 },

  hero: {
    flex: 1.05,
    minHeight: 420,
    borderRadius: RADIUS,
    overflow: "hidden",
    shadowColor: "#214743",
    shadowOpacity: 0.08,
    shadowRadius: 12,
    shadowOffset: { width: 0, height: 2 },
    elevation: 3,
  },
  heroImage: { flex: 1, minHeight: 220, justifyContent: "flex-end" },
  heroScrim: { paddingTop: 60, paddingHorizontal: 24, paddingBottom: 20 },
  heroLabel: { color: "rgba(255,255,255,0.85)" },
  heroTitle: { color: "#FFFFFF", marginTop: 6 },
  heroSpinner: { alignSelf: "flex-start", marginTop: 12 },
  heroBottom: { paddingTop: 18, paddingHorizontal: 24, paddingBottom: 20, gap: 10 },
  heroThought: { fontFamily: fonts.loraItalic, fontSize: 18, lineHeight: 26 },

  right: { flex: 1, gap: 10 },
  toolRow: {
    flexDirection: "row",
    alignItems: "center",
    gap: 14,
    padding: 14,
    borderWidth: 1,
    borderRadius: RADIUS,
  },
  toolIcon: {
    width: 44,
    height: 44,
    borderRadius: 12,
    alignItems: "center",
    justifyContent: "center",
  },

  cardPair: { flex: 1, minHeight: 200, flexDirection: "row", gap: 10, marginTop: 6 },
  prayerCard: {
    flex: 1,
    gap: 8,
    paddingVertical: 14,
    paddingHorizontal: 16,
    borderWidth: 1,
    borderRadius: RADIUS,
  },
  labelRow: { flexDirection: "row", alignItems: "center", gap: 8 },
  pushDown: { marginTop: "auto", paddingTop: 4 },
  speakerCard: {
    flex: 1,
    justifyContent: "space-between",
    gap: 12,
    padding: 16,
    borderRadius: RADIUS,
  },
  onDark: { color: "#FFFFFF" },
  onDarkMuted: { color: "rgba(255,255,255,0.8)" },
  speakerMeta: { marginTop: 4 },
  listenRow: { flexDirection: "row", alignItems: "center", gap: 8 },
  playDot: {
    width: 30,
    height: 30,
    borderRadius: 15,
    alignItems: "center",
    justifyContent: "center",
  },
});
