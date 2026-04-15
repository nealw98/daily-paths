import React, { useCallback, useMemo, useRef, useState } from "react";
import {
  View,
  Text,
  ScrollView,
  TouchableOpacity,
  StyleSheet,
  ActivityIndicator,
  ImageBackground,
  Platform,
} from "react-native";
import { SafeAreaView, useSafeAreaInsets } from "react-native-safe-area-context";
import { useRouter } from "expo-router";
import { LinearGradient } from "expo-linear-gradient";
import { Ionicons, MaterialIcons, MaterialCommunityIcons } from "@expo/vector-icons";
import RevenueCatUI, { PAYWALL_RESULT } from "react-native-purchases-ui";
import { useTheme } from "../../hooks/useTheme";
import { useTypography } from "../../hooks/useTypography";
import { useSettings, getTextSizeMetrics } from "../../hooks/useSettings";
import { useReading } from "../../hooks/useReading";
import { useAppDate } from "../../contexts/AppDateContext";
import { useSpeakers } from "../../hooks/useSpeakers";
import { usePersonalPrayers } from "../../hooks/usePersonalPrayers";
import { useSubscriptionContext } from "../../contexts/SubscriptionContext";
import { fonts, layout, shadows } from "../../constants/theme";
import { JOURNAL_CATEGORIES, type EntryType } from "../../constants/journalCategories";
import { JournalEntryEditor } from "../../components/journal/JournalEntryEditor";
import { useJournalStorage } from "../../hooks/useJournalStorage";
import { TealHeader } from "../../components/shared/TealHeader";
import { useFeaturedSpeaker } from "../../hooks/useFeaturedSpeaker";
import { qaLog } from "../../utils/qaLog";

function getGreeting(): string {
  const hour = new Date().getHours();
  if (hour < 12) return "Good morning";
  if (hour < 17) return "Good afternoon";
  return "Good evening";
}

export default function HomeTab() {
  const { colors } = useTheme();
  const { settings } = useSettings();
  const { typography } = useTypography();
  const textMetrics = useMemo(() => getTextSizeMetrics(settings.textSize), [settings.textSize]);
  const router = useRouter();
  const insets = useSafeAreaInsets();
  const { today } = useAppDate();
  const { reading, loading: readingLoading } = useReading(today);
  const { speakers } = useSpeakers();
  const { prayers } = usePersonalPrayers();
  const { speaker: featuredSpeaker, isStarted: speakerIsStarted, isListenAgain } = useFeaturedSpeaker(speakers);
  const { createEntry } = useJournalStorage();
  const [journalEntryType, setJournalEntryType] = useState<EntryType | null>(null);

  const { gate, refresh: refreshSub } = useSubscriptionContext();
  const isFree = gate === "paywall";
  const presentingPaywall = useRef(false);

  const greetingType = useMemo(
    () => ({
      fontFamily: fonts.headerFamilyBoldItalic,
      fontSize: Math.max(26, Math.round(textMetrics.h3FontSize * (32 / 24))),
      lineHeight: Math.max(32, Math.round(textMetrics.h3FontSize * (32 / 24) * (38 / 32))),
      letterSpacing: -0.5,
    }),
    [textMetrics.h3FontSize],
  );

  const heroLabelType = useMemo(
    () => ({
      fontFamily: fonts.labelFamily,
      fontSize: textMetrics.labelFontSize,
      lineHeight: textMetrics.labelLineHeight,
      letterSpacing: 0.4,
      textTransform: "uppercase" as const,
    }),
    [textMetrics.labelFontSize, textMetrics.labelLineHeight],
  );

  const heroTitleType = useMemo(
    () => ({
      fontFamily: fonts.headerFamily,
      fontSize: textMetrics.h3FontSize,
      lineHeight: textMetrics.h3LineHeight,
      letterSpacing: -0.3,
    }),
    [textMetrics.h3FontSize, textMetrics.h3LineHeight],
  );

  const notebookLabelType = useMemo(() => {
    const fontSize = Math.max(14, Math.round(textMetrics.bodyFontSize * (17 / 18)));
    return {
      fontFamily: fonts.bodyFamilySemiBold,
      fontSize,
      lineHeight: Math.round(fontSize * (22 / 17)),
      letterSpacing: 0,
    };
  }, [textMetrics.bodyFontSize]);

  const notebookTagType = useMemo(
    () => [
      typography.bodySmall,
      styles.notebookTagExtras,
    ],
    [typography.bodySmall],
  );

  const sectionTitleType = useMemo(
    () => ({
      fontFamily: fonts.headerFamily,
      fontSize: typography.bodyLarge.fontSize,
      lineHeight: typography.bodyLarge.lineHeight,
      letterSpacing: -0.1,
    }),
    [typography.bodyLarge.fontSize, typography.bodyLarge.lineHeight],
  );

  const readMoreType = useMemo(
    () => ({
      fontFamily: fonts.bodyFamily,
      fontSize: textMetrics.labelFontSize,
      lineHeight: textMetrics.labelLineHeight,
      letterSpacing: 0.1,
    }),
    [textMetrics.labelFontSize, textMetrics.labelLineHeight],
  );

  const speakerNameType = useMemo(
    () => ({
      fontFamily: fonts.headerFamily,
      fontSize: textMetrics.h3FontSize,
      lineHeight: textMetrics.h3LineHeight,
      letterSpacing: -0.3,
    }),
    [textMetrics.h3FontSize, textMetrics.h3LineHeight],
  );

  const speakerTitleType = useMemo(
    () => ({
      ...typography.bodySmall,
      fontFamily: fonts.bodyFamilyMedium,
      letterSpacing: 0,
    }),
    [typography.bodySmall],
  );

  const exploreTextType = useMemo(
    () => ({
      fontFamily: fonts.bodyFamilySemiBold,
      fontSize: typography.bodySmall.fontSize,
      lineHeight: typography.bodySmall.lineHeight,
      letterSpacing: 0.1,
    }),
    [typography.bodySmall.fontSize, typography.bodySmall.lineHeight],
  );

  const unlockPillTextType = useMemo(() => {
    const fontSize = Math.max(12, Math.round(textMetrics.bodySmallFontSize * (14 / 15)));
    return {
      fontFamily: fonts.bodyFamilyMedium,
      fontSize,
      lineHeight: Math.round(fontSize * (20 / 14)),
    };
  }, [textMetrics.bodySmallFontSize]);

  const unlockPillButtonTextType = useMemo(() => {
    const fontSize = Math.max(12, Math.round(textMetrics.bodySmallFontSize * (14 / 15)));
    return {
      fontFamily: fonts.bodyFamilySemiBold,
      fontSize,
      lineHeight: Math.round(fontSize * (20 / 14)),
      fontWeight: "600" as const,
    };
  }, [textMetrics.bodySmallFontSize]);

  const presentPaywall = useCallback(async () => {
    if (presentingPaywall.current) return;
    presentingPaywall.current = true;
    qaLog("paywall", "Home free-state presenting paywall");
    try {
      const result = await RevenueCatUI.presentPaywall();
      qaLog("paywall", "Home free-state paywall result", { result });
      if (result === PAYWALL_RESULT.PURCHASED || result === PAYWALL_RESULT.RESTORED) {
        await refreshSub();
        await new Promise((resolve) => setTimeout(resolve, 350));
        await refreshSub();
      }
    } catch (err) {
      qaLog("paywall", "Home free-state paywall error", { error: String(err) });
    } finally {
      presentingPaywall.current = false;
    }
  }, [refreshSub]);

  // The home tab's container is rendered inside the tab content area, so
  // bottom: 0 is already flush with the top edge of the tab bar.

  // If user picked a journal type, show the editor full-screen
  if (journalEntryType) {
    return (
      <JournalEntryEditor
        key={journalEntryType}
        entryType={journalEntryType}
        navigateToNotebookAfterSave
        onSave={async (entryType, content, structuredContent) => {
          await createEntry(entryType, content, structuredContent);
          setJournalEntryType(null);
        }}
        onCancel={() => setJournalEntryType(null)}
        onSwitchEntryType={setJournalEntryType}
      />
    );
  }

  return (
    <SafeAreaView style={[styles.safe, { backgroundColor: colors.surface }]} edges={["top"]}>
      <TealHeader
        title={new Date().toLocaleDateString("en-US", {
          weekday: "long",
          month: "long",
          day: "numeric",
          year: "numeric",
        })}
        eyebrow="Daily Paths"
        hideIcon
      />
      <ScrollView
        style={[styles.scroll, { backgroundColor: colors.surface }]}
        contentContainerStyle={styles.content}
        showsVerticalScrollIndicator={false}
      >
        {/* ── Welcome Greeting ── */}
        <Text style={[styles.greetingLayout, greetingType, { color: colors.onSurface }]}>
          {getGreeting()}
        </Text>

        {/* ── Hero Card — Daily Reflection (split view) ── */}
        <TouchableOpacity
          activeOpacity={0.85}
          onPress={() => router.push("/(tabs)/reading")}
          style={styles.heroWrapper}
        >
          <View style={styles.heroClip}>
          {/* Top half: hero image with label + title */}
          <ImageBackground
            source={require("../../assets/home-page.jpg")}
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
                <Text style={[heroLabelType, { color: "#FFFFFFBB" }]}>
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
                <Text style={[styles.heroTitleLayout, heroTitleType, { color: "#FFFFFF" }]}>
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
                  style={[...notebookTagType, styles.heroThoughtForDay, { color: colors.onSurface }]}
                  numberOfLines={3}
                >
                  {`"${reading.thoughtForDay}"`}
                </Text>
                <View style={styles.ctaRow}>
                  <Text style={[readMoreType, { color: colors.accent }]}>
                    Read more
                  </Text>
                  <MaterialIcons name="chevron-right" size={20} color={colors.accent} />
                </View>
              </>
            ) : (
              <Text style={[...notebookTagType, styles.heroThoughtForDay, { color: colors.onSurfaceVariant }]}>
                No reading available today.
              </Text>
            )}
          </View>
          </View>
        </TouchableOpacity>

        {/* ── Daily Tools List ── */}
        <Text
          style={[
            styles.sectionTitleLayout,
            sectionTitleType,
            { color: colors.onSurface, marginTop: 56 },
            isFree && styles.sectionTitleToolsFree,
          ]}
        >
          Daily Tools
        </Text>
        <View style={styles.toolsList}>
          {JOURNAL_CATEGORIES.map((cat) => (
            <TouchableOpacity
              key={cat.id}
              activeOpacity={0.8}
              onPress={() => {
                if (isFree) {
                  void presentPaywall();
                } else {
                  setJournalEntryType(cat.id);
                }
              }}
              style={[styles.toolRow, isFree && styles.toolRowFree]}
            >
              <View
                style={[
                  styles.toolRowInner,
                  { backgroundColor: colors.surfaceContainerLowest, borderColor: colors.mist },
                ]}
              >
                <View
                  style={[
                    styles.toolIconPip,
                    { backgroundColor: isFree ? colors.surfaceContainer : colors.secondary },
                  ]}
                >
                  <Ionicons
                    name={cat.icon as any}
                    size={38}
                    color={isFree ? "#aaa" : "#FFFFFF"}
                    style={{ fontWeight: "900" }}
                  />
                </View>
                <View style={styles.toolText}>
                  <Text style={[notebookLabelType, { color: colors.onSurface }]}>
                    {cat.label}
                  </Text>
                  <Text
                    style={[...notebookTagType, { color: colors.onSurfaceVariant }]}
                    numberOfLines={2}
                  >
                    {cat.description}
                  </Text>
                </View>
                <Ionicons name="chevron-forward" size={18} color={colors.onSurfaceVariant} />
              </View>
            </TouchableOpacity>
          ))}
        </View>

        {/* ── Speaker Feature Card ── */}
        <Text
          style={[
            styles.sectionTitleLayout,
            sectionTitleType,
            { color: colors.onSurface, marginTop: 56 },
            isFree && styles.sectionTitleSpeakersFree,
          ]}
        >
          Speakers
        </Text>
        {featuredSpeaker ? (
          <TouchableOpacity
            activeOpacity={0.85}
            onPress={() => {
              if (isFree) {
                void presentPaywall();
              } else {
                router.push({ pathname: "/(tabs)/speakers", params: { speakerId: featuredSpeaker.id } });
              }
            }}
            style={[styles.speakerCard, isFree && styles.speakerSectionFree]}
          >
            <LinearGradient
              colors={[colors.primary, colors.primaryContainer]}
              start={{ x: 0, y: 0 }}
              end={{ x: 1, y: 1 }}
              style={styles.speakerCardInner}
            >
              <Ionicons
                name="headset"
                size={220}
                color="rgba(255,255,255,0.05)"
                style={[styles.speakerWatermark, { transform: [{ rotate: "30deg" }] }]}
              />
              <View style={styles.heroIconRow}>
                <MaterialIcons name="record-voice-over" size={18} color="#FFFFFFCC" />
                <Text style={[heroLabelType, { color: "#FFFFFFBB" }]}>
                  Featured Speaker
                </Text>
              </View>
              <Text style={[styles.speakerNameLayout, speakerNameType, { color: colors.onPrimary, marginTop: 12 }]}>
                {featuredSpeaker.speaker}
              </Text>
              <Text
                style={[speakerTitleType, { color: colors.onPrimary + "CC" }]}
                numberOfLines={2}
              >
                {featuredSpeaker.title}
              </Text>
              <View style={styles.ctaRow}>
                <Text style={[readMoreType, { color: colors.secondaryContainer }]}>
                  {isListenAgain ? "Listen again" : speakerIsStarted ? "Continue" : "Listen"}
                </Text>
                <MaterialIcons name="chevron-right" size={20} color={colors.secondaryContainer} />
              </View>
            </LinearGradient>
          </TouchableOpacity>
        ) : null}
        <TouchableOpacity
          activeOpacity={0.7}
          onPress={() => {
            if (isFree) {
              void presentPaywall();
            } else {
              router.push("/(tabs)/speakers");
            }
          }}
          style={[styles.exploreRow, isFree && styles.speakerSectionFree]}
        >
          <Text style={[exploreTextType, { color: colors.secondary }]}>
            Explore all speakers
          </Text>
          <MaterialIcons name="arrow-forward" size={18} color={colors.secondary} />
        </TouchableOpacity>

        {/* ── Prayers Card ── */}
        <Text
          style={[
            styles.sectionTitleLayout,
            sectionTitleType,
            { color: colors.onSurface, marginTop: 56 },
            isFree && styles.sectionTitleToolsFree,
          ]}
        >
          Prayers
        </Text>
        <View style={styles.toolsList}>
          <TouchableOpacity
            activeOpacity={0.8}
            onPress={() => {
              if (isFree) {
                void presentPaywall();
              } else {
                router.push("/(tabs)/prayers");
              }
            }}
            style={[styles.toolRow, isFree && styles.toolRowFree]}
          >
            <View
              style={[
                styles.toolRowInner,
                styles.prayersTile,
                { backgroundColor: colors.surfaceContainerLowest, borderColor: colors.mist },
              ]}
            >
              <View
                style={[
                  styles.toolIconPip,
                  { backgroundColor: isFree ? colors.surfaceContainer : colors.secondary },
                ]}
              >
                <MaterialCommunityIcons
                  name="hands-pray"
                  size={38}
                  color={isFree ? "#aaa" : "#FFFFFF"}
                  style={{ fontWeight: "900" }}
                />
              </View>
              <View style={styles.toolText}>
                <Text style={[notebookLabelType, { color: colors.onSurface }]}>
                  Your Prayers
                </Text>
                <Text style={[...notebookTagType, { color: colors.onSurfaceVariant }]} numberOfLines={2}>
                  A collection of prayers — and a place to add your own.
                </Text>
              </View>
              <Ionicons name="chevron-forward" size={18} color={colors.onSurfaceVariant} />
            </View>
          </TouchableOpacity>
        </View>

        {/* Bottom spacing — extra room so the persistent pill doesn't cover content */}
        <View style={{ height: isFree ? 96 : 32 }} />
      </ScrollView>

      {/* ── Persistent unlock pill (free users only) ── */}
      {isFree ? (
        <View
          pointerEvents="box-none"
          style={styles.unlockPillWrapper}
        >
          <View style={[styles.unlockPill, { backgroundColor: colors.subscriptionBar }]}>
            <Text style={[unlockPillTextType, styles.unlockPillTextLayout, { color: colors.subscriptionOnBar }]}>
              Unlock the full experience
            </Text>
            <TouchableOpacity
              activeOpacity={0.85}
              onPress={() => void presentPaywall()}
              style={[styles.unlockPillButton, { backgroundColor: colors.subscriptionCtaCream }]}
            >
              <Text style={[unlockPillButtonTextType, { color: colors.subscriptionOnCream }]}>
                Continue
              </Text>
            </TouchableOpacity>
          </View>
        </View>
      ) : null}
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
  greetingLayout: {
    marginHorizontal: layout.spacing.lgPlus,
    marginTop: layout.spacing.lg,
    marginBottom: layout.spacing.lgPlus,
  },

  // Hero card
  heroWrapper: {
    marginHorizontal: layout.spacing.md,
    borderRadius: layout.borderRadiusLarge,
    shadowColor: "#000000",
    shadowOpacity: 0.1,
    shadowRadius: 12,
    shadowOffset: { width: 0, height: 4 },
    elevation: 4,
  },
  heroClip: {
    borderRadius: layout.borderRadiusLarge,
    overflow: "hidden",
  },
  heroTop: {
    borderTopLeftRadius: layout.borderRadiusLarge,
    borderTopRightRadius: layout.borderRadiusLarge,
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
  heroTitleLayout: {
    marginBottom: 4,
  },
  /** Centered quote; horizontal inset comes only from `heroBottom` padding (matches tool text width). */
  heroThoughtForDay: {
    textAlign: "center",
  },
  ctaRow: {
    flexDirection: "row",
    alignItems: "center",
    justifyContent: "flex-end",
    gap: 2,
    marginTop: 16,
  },
  // Section titles
  sectionTitleLayout: {
    marginBottom: layout.spacing.lg,
    marginHorizontal: layout.spacing.lgPlus,
  },

  // Daily Tools list
  toolsList: {
    paddingHorizontal: layout.spacing.md,
    gap: 24,
  },
  toolRow: {
    borderRadius: 10,
    shadowColor: "#000000",
    shadowOpacity: 0.1,
    shadowRadius: 12,
    shadowOffset: { width: 0, height: 4 },
    elevation: 4,
  },
  toolRowInner: {
    flexDirection: "row",
    alignItems: "center",
    borderWidth: 0.5,
    borderRadius: 10,
    paddingRight: 16,
    paddingLeft: 0,
    paddingVertical: 0,
    minHeight: 100,
    overflow: "hidden",
  },
  toolIconPip: {
    width: 90,
    alignSelf: "stretch",
    borderTopLeftRadius: 9,
    borderBottomLeftRadius: 9,
    borderTopRightRadius: 0,
    borderBottomRightRadius: 0,
    alignItems: "center",
    justifyContent: "center",
    marginRight: 16,
  },
  toolText: {
    flex: 1,
    gap: 3,
    paddingVertical: 16,
  },
  notebookTagExtras: {
    letterSpacing: 0,
    ...(Platform.OS === "android" ? { includeFontPadding: false } : {}),
  },

  // Prayers
  prayersTile: {
    padding: 16,
    paddingHorizontal: 16,
  },
  prayersCard: {
    marginHorizontal: layout.spacing.md,
    borderRadius: layout.borderRadius,
    padding: 16,
    gap: 4,
    shadowColor: "#000000",
    shadowOpacity: 0.1,
    shadowRadius: 12,
    shadowOffset: { width: 0, height: 4 },
    elevation: 4,
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
    fontSize: 17,
    lineHeight: 22,
    marginTop: 6,
  },
  prayersSubtitle: {
    fontFamily: fonts.bodyFamily,
    fontSize: 14,
    lineHeight: 19,
    marginTop: 2,
  },
  prayersCount: {
    fontFamily: fonts.bodyFamily,
    fontSize: 13,
    alignSelf: "flex-start",
    marginTop: 2,
  },

  // Speaker
  speakerCard: {
    marginHorizontal: layout.spacing.md,
    borderRadius: layout.borderRadius,
    shadowColor: "#000000",
    shadowOpacity: 0.1,
    shadowRadius: 12,
    shadowOffset: { width: 0, height: 4 },
    elevation: 4,
  },
  speakerWatermark: {
    position: "absolute",
    bottom: 12,
    right: -28,
    zIndex: 0,
  },
  speakerCardInner: {
    paddingHorizontal: layout.spacing.lgPlus,
    paddingBottom: layout.spacing.lgPlus,
    paddingTop: 24,
    borderRadius: layout.borderRadius,
    overflow: "hidden",
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
  speakerNameLayout: {
    marginBottom: 12,
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

  // Free-user faded states
  toolRowFree: {
    opacity: 0.5,
  },
  speakerSectionFree: {
    opacity: 0.45,
  },
  sectionTitleToolsFree: {
    opacity: 0.5,
  },
  sectionTitleSpeakersFree: {
    opacity: 0.45,
  },

  // Persistent unlock pill (free users)
  unlockPillWrapper: {
    position: "absolute",
    left: 0,
    right: 0,
    bottom: 0,
    alignItems: "stretch",
    paddingHorizontal: 8,
    paddingBottom: 8,
  },
  unlockPill: {
    flexDirection: "row",
    alignItems: "center",
    justifyContent: "space-between",
    borderRadius: 50,
    padding: 8,
    ...shadows.ambient,
  },
  unlockPillTextLayout: {
    marginLeft: 12,
  },
  unlockPillButton: {
    borderRadius: 999,
    paddingHorizontal: 16,
    paddingVertical: 8,
  },
});
