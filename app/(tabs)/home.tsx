import React, { useState } from "react";
import {
  View,
  Text,
  ScrollView,
  TouchableOpacity,
  StyleSheet,
  ActivityIndicator,
  ImageBackground,
} from "react-native";
import { SafeAreaView } from "react-native-safe-area-context";
import { useRouter } from "expo-router";
import { LinearGradient } from "expo-linear-gradient";
import { Ionicons, MaterialIcons, MaterialCommunityIcons } from "@expo/vector-icons";
import { useTheme } from "../../hooks/useTheme";
import { useReading } from "../../hooks/useReading";
import { useSpeakers } from "../../hooks/useSpeakers";
import { usePersonalPrayers } from "../../hooks/usePersonalPrayers";
import { fonts, layout, typography, shadows } from "../../constants/theme";
import { JOURNAL_CATEGORIES } from "../../constants/journalCategories";
import { TealHeader } from "../../components/shared/TealHeader";

function getGreeting(): string {
  const hour = new Date().getHours();
  if (hour < 12) return "Good morning";
  if (hour < 17) return "Good afternoon";
  return "Good evening";
}

export default function HomeTab() {
  const { colors, isDark } = useTheme();
  const router = useRouter();
  const [today] = useState(() => new Date());
  const { reading, loading: readingLoading } = useReading(today);
  const { speakers } = useSpeakers();
  const { prayers } = usePersonalPrayers();
  const featuredSpeaker = speakers.length > 0 ? speakers[0] : null;

  return (
    <SafeAreaView style={[styles.safe, { backgroundColor: colors.background }]} edges={["top"]}>
      <TealHeader
        title="Today"
        navigateHome={false}
      />
      <ScrollView
        style={[styles.scroll, { backgroundColor: colors.surface }]}
        contentContainerStyle={styles.content}
        showsVerticalScrollIndicator={false}
      >
        {/* ── Welcome Greeting ── */}
        <Text style={[styles.greeting, { color: colors.onSurface }]}>
          {getGreeting()}
        </Text>

        {/* ── Hero Card — Daily Reflection (split view) ── */}
        <TouchableOpacity
          activeOpacity={0.85}
          onPress={() => router.push("/(tabs)/reading")}
          style={styles.heroWrapper}
        >
          {/* Top half: hero image with label + title */}
          <ImageBackground
            source={require("../../assets/steps-hero.jpg")}
            resizeMode="cover"
            style={styles.heroTop}
            imageStyle={styles.heroTopImage}
          >
            {/* Clear top area — lets the image breathe */}
            <View style={styles.heroSpacer} />
            {/* Text pinned to the lower half with a gradient scrim */}
            <LinearGradient
              colors={["transparent", "rgba(0,0,0,0.55)"]}
              style={styles.heroOverlay}
            >
              <View style={styles.heroIconRow}>
                <MaterialIcons name="menu-book" size={18} color="#FFFFFFCC" />
                <Text style={[styles.heroLabel, { color: "#FFFFFFBB" }]}>
                  Today's Reflection
                </Text>
              </View>
              {readingLoading && !reading ? (
                <ActivityIndicator
                  size="small"
                  color="#FFFFFF"
                  style={{ marginVertical: 16 }}
                />
              ) : reading ? (
                <Text style={[styles.heroTitle, { color: "#FFFFFF" }]}>
                  {reading.title}
                </Text>
              ) : null}
            </LinearGradient>
          </ImageBackground>

          {/* Bottom half: white with thought + read more */}
          <View style={[styles.heroBottom, { backgroundColor: colors.surfaceContainerLowest }]}>
            {reading ? (
              <>
                <Text
                  style={[styles.heroBody, { color: colors.onSurface }]}
                  numberOfLines={3}
                >
                  {reading.thoughtForDay}
                </Text>
                <View style={styles.ctaRow}>
                  <Text style={[styles.readMore, { color: colors.accent }]}>
                    Read more
                  </Text>
                  <MaterialIcons name="chevron-right" size={20} color={colors.accent} />
                </View>
              </>
            ) : (
              <Text style={[styles.heroBody, { color: colors.onSurfaceVariant }]}>
                No reading available today.
              </Text>
            )}
          </View>
        </TouchableOpacity>

        {/* ── Notebook 2×2 Grid ── */}
        <Text style={[styles.sectionTitle, { color: colors.onSurface }]}>
          Notebook
        </Text>
        <View style={styles.grid}>
          {JOURNAL_CATEGORIES.map((cat) => (
            <TouchableOpacity
              key={cat.id}
              activeOpacity={0.8}
              onPress={() => router.push("/(tabs)/journal")}
              style={[
                styles.notebookCard,
                {
                  backgroundColor: isDark
                    ? colors.surfaceContainerHigh
                    : cat.bgColor,
                  borderColor: isDark ? colors.outlineVariant : cat.color + "20",
                  borderWidth: 1,
                },
              ]}
            >
              <Ionicons
                name={cat.icon as any}
                size={24}
                color={cat.color}
              />
              <Text
                style={[
                  styles.notebookLabel,
                  { color: colors.onSurface },
                ]}
              >
                {cat.label}
              </Text>
              <Text
                style={[
                  styles.notebookTag,
                  { color: colors.onSurfaceVariant },
                ]}
                numberOfLines={2}
              >
                {cat.description}
              </Text>
            </TouchableOpacity>
          ))}
        </View>

        {/* ── Speaker Feature Card ── */}
        <Text style={[styles.sectionTitle, { color: colors.onSurface }]}>
          Speakers
        </Text>
        {featuredSpeaker ? (
          <TouchableOpacity
            activeOpacity={0.85}
            onPress={() => router.push({ pathname: "/(tabs)/speakers", params: { speakerId: featuredSpeaker.id } })}
            style={styles.speakerCard}
          >
            <LinearGradient
              colors={[colors.primary, colors.primaryContainer]}
              start={{ x: 0, y: 0 }}
              end={{ x: 1, y: 1 }}
              style={styles.speakerCardInner}
            >
              <Ionicons
                name="headset"
                size={90}
                color="rgba(255,255,255,0.08)"
                style={styles.speakerWatermark}
              />
              <View style={styles.heroIconRow}>
                <MaterialIcons name="record-voice-over" size={18} color="#FFFFFFCC" />
                <Text style={[styles.heroLabel, { color: "#FFFFFFBB" }]}>
                  Featured Speaker
                </Text>
              </View>
              <Text style={[styles.speakerName, { color: colors.onPrimary }]}>
                {featuredSpeaker.speaker}
              </Text>
              <Text
                style={[styles.speakerTitle, { color: colors.onPrimary + "CC" }]}
                numberOfLines={2}
              >
                {featuredSpeaker.title}
              </Text>
              <View style={styles.ctaRow}>
                <Text style={[styles.readMore, { color: colors.secondaryContainer }]}>
                  Listen
                </Text>
                <MaterialIcons name="chevron-right" size={20} color={colors.secondaryContainer} />
              </View>
            </LinearGradient>
          </TouchableOpacity>
        ) : null}
        <TouchableOpacity
          activeOpacity={0.7}
          onPress={() => router.push("/(tabs)/speakers")}
          style={styles.exploreRow}
        >
          <Text style={[styles.exploreText, { color: colors.secondary }]}>
            Explore all speakers
          </Text>
          <MaterialIcons name="arrow-forward" size={18} color={colors.secondary} />
        </TouchableOpacity>

        {/* ── Prayers Card ── */}
        <Text style={[styles.sectionTitle, { color: colors.onSurface }]}>
          Prayers
        </Text>
        <TouchableOpacity
          activeOpacity={0.85}
          onPress={() => router.push("/(tabs)/prayers")}
          style={[
            styles.prayersCard,
            {
              backgroundColor: colors.surfaceContainer,
              borderColor: colors.outlineVariant,
              borderWidth: 1,
            },
          ]}
        >
          <View style={styles.prayersIconRow}>
            <MaterialCommunityIcons
              name="hands-pray"
              size={24}
              color={colors.secondary}
            />
            <View style={styles.prayersText}>
              <Text style={[styles.prayersTitle, { color: colors.onSurface }]}>
                Your Prayers
              </Text>
              <Text style={[styles.prayersSubtitle, { color: colors.onSurfaceVariant }]}>
                {prayers.length > 0
                  ? `${prayers.length} prayer${prayers.length === 1 ? "" : "s"} saved`
                  : "Add your first prayer request"}
              </Text>
            </View>
            <MaterialIcons
              name="chevron-right"
              size={24}
              color={colors.onSurfaceVariant}
            />
          </View>
        </TouchableOpacity>

        {/* Bottom spacing */}
        <View style={{ height: 32 }} />
      </ScrollView>
    </SafeAreaView>
  );
}

const styles = StyleSheet.create({
  safe: {
    flex: 1,
  },
  scroll: {
    flex: 1,
  },
  content: {
    paddingBottom: 24,
  },

  // Welcome greeting
  greeting: {
    fontFamily: fonts.headerFamilyBoldItalic,
    fontSize: 32,
    lineHeight: 38,
    letterSpacing: -0.5,
    marginHorizontal: layout.spacing.lgPlus,
    marginTop: layout.spacing.lg,
    marginBottom: layout.spacing.lgPlus,
  },

  // Hero card
  heroWrapper: {
    marginHorizontal: layout.spacing.md,
    borderRadius: layout.borderRadiusLarge,
    overflow: "hidden",
    ...shadows.ambient,
  },
  heroTop: {
    borderTopLeftRadius: layout.borderRadiusLarge,
    borderTopRightRadius: layout.borderRadiusLarge,
    overflow: "hidden",
    minHeight: 160,
    justifyContent: "flex-end",
  },
  heroTopImage: {
    borderTopLeftRadius: layout.borderRadiusLarge,
    borderTopRightRadius: layout.borderRadiusLarge,
  },
  heroSpacer: {
    flex: 1,
  },
  heroOverlay: {
    padding: layout.spacing.lgPlus,
    paddingTop: layout.spacing.xxl,
    paddingBottom: layout.spacing.md,
  },
  heroBottom: {
    padding: layout.spacing.lgPlus,
    borderBottomLeftRadius: layout.borderRadiusLarge,
    borderBottomRightRadius: layout.borderRadiusLarge,
  },
  heroIconRow: {
    flexDirection: "row",
    alignItems: "center",
    gap: 6,
    marginBottom: 4,
  },
  heroLabel: {
    fontFamily: fonts.labelFamily,
    fontSize: 11,
    letterSpacing: 0.4,
    textTransform: "uppercase",
  },
  heroTitle: {
    fontFamily: fonts.headerFamily,
    fontSize: 24,
    lineHeight: 30,
    letterSpacing: -0.3,
    marginBottom: 4,
  },
  heroBody: {
    fontFamily: fonts.bodyFamily,
    fontSize: 16,
    lineHeight: 24,
    letterSpacing: -0.08,
  },
  ctaRow: {
    flexDirection: "row",
    alignItems: "center",
    justifyContent: "flex-end",
    gap: 2,
    marginTop: 16,
  },
  readMore: {
    fontFamily: fonts.bodyFamilySemiBold,
    fontSize: 15,
    letterSpacing: 0.1,
  },

  // Section titles
  sectionTitle: {
    fontFamily: fonts.headerFamily,
    fontSize: 19,
    lineHeight: 24,
    letterSpacing: -0.1,
    marginTop: layout.spacing.lg,
    marginBottom: layout.spacing.sm,
    marginHorizontal: layout.spacing.lgPlus,
  },

  // Notebook 2×2
  grid: {
    flexDirection: "row",
    flexWrap: "wrap",
    gap: 10,
    paddingHorizontal: layout.spacing.md,
  },
  notebookCard: {
    width: "48.5%",
    borderRadius: layout.borderRadius,
    padding: 14,
    gap: 4,
    flexGrow: 0,
    flexShrink: 0,
    flexBasis: "48%",
    ...shadows.ambient,
  },
  notebookLabel: {
    fontFamily: fonts.bodyFamilySemiBold,
    fontSize: 15,
    lineHeight: 20,
    marginTop: 6,
  },
  notebookTag: {
    fontFamily: fonts.bodyFamily,
    fontSize: 12,
    lineHeight: 16,
  },

  // Prayers
  prayersCard: {
    marginHorizontal: layout.spacing.md,
    borderRadius: layout.borderRadius,
    padding: 16,
    ...shadows.ambient,
  },
  prayersIconRow: {
    flexDirection: "row",
    alignItems: "center",
    gap: 12,
  },
  prayersText: {
    flex: 1,
  },
  prayersTitle: {
    fontFamily: fonts.bodyFamilySemiBold,
    fontSize: 16,
    lineHeight: 20,
  },
  prayersSubtitle: {
    fontFamily: fonts.bodyFamily,
    fontSize: 13,
    lineHeight: 18,
    marginTop: 2,
  },

  // Speaker
  speakerCard: {
    marginHorizontal: layout.spacing.md,
    borderRadius: layout.borderRadius,
    overflow: "hidden",
    ...shadows.ambient,
  },
  speakerWatermark: {
    position: "absolute",
    top: 12,
    right: 14,
    zIndex: 0,
  },
  speakerCardInner: {
    paddingHorizontal: layout.spacing.lgPlus,
    paddingBottom: layout.spacing.lgPlus,
    paddingTop: 24,
    borderRadius: layout.borderRadius,
  },
  speakerBadge: {
    width: 36,
    height: 36,
    borderRadius: 18,
    backgroundColor: "rgba(255, 255, 255, 0.15)",
    alignItems: "center",
    justifyContent: "center",
    marginBottom: 8,
  },
  speakerName: {
    fontFamily: fonts.headerFamily,
    fontSize: 22,
    lineHeight: 28,
    letterSpacing: -0.2,
    marginBottom: 36,
  },
  speakerTitle: {
    fontFamily: fonts.bodyFamilyMedium,
    fontSize: 16,
    lineHeight: 22,
  },
  speakerThemes: {
    fontFamily: fonts.bodyFamily,
    fontSize: 12,
    lineHeight: 16,
    fontStyle: "italic",
    marginTop: 4,
  },
  exploreRow: {
    flexDirection: "row",
    alignItems: "center",
    gap: 4,
    marginHorizontal: layout.spacing.lgPlus,
    marginTop: 10,
  },
  exploreText: {
    fontFamily: fonts.bodyFamilySemiBold,
    fontSize: 14,
    letterSpacing: 0.1,
  },
});
