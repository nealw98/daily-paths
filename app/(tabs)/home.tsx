import React, { useCallback, useEffect, useMemo, useRef, useState } from "react";
import AsyncStorage from "@react-native-async-storage/async-storage";
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
import { CollectionLinkRow } from "../../components/shared/CollectionLinkRow";
import { useFeaturedSpeaker } from "../../hooks/useFeaturedSpeaker";
import { computeJournalStreak } from "../../utils/journalStreak";
import { getScheduledDayOfYear } from "../../utils/dateUtils";
import { qaLog } from "../../utils/qaLog";

function getGreeting(): string {
  const hour = new Date().getHours();
  if (hour < 12) return "Good morning";
  if (hour < 17) return "Good afternoon";
  return "Good evening";
}

// Reflection hero images cycled once per day. Auto-discovered from the
// assets/reflections folder via require.context — drop in new files named
// reflections-<N>.webp and the rotation picks them up on next build. Sorted
// numerically so reflections-10 comes after reflections-9, not after -1.
const reflectionsContext = (require as any).context(
  "../../assets/reflections",
  false,
  /reflections-\d+\.webp$/
);
const REFLECTION_IMAGE_KEYS = reflectionsContext
  .keys()
  .slice()
  .sort((a: string, b: string) => {
    const numA = parseInt(a.match(/reflections-(\d+)/)?.[1] ?? "0", 10);
    const numB = parseInt(b.match(/reflections-(\d+)/)?.[1] ?? "0", 10);
    return numA - numB;
  });
const REFLECTION_IMAGES = REFLECTION_IMAGE_KEYS.map((key: string) => reflectionsContext(key));
const REFLECTION_IMAGE_BY_NUMBER: Record<number, any> = REFLECTION_IMAGE_KEYS.reduce(
  (acc: Record<number, any>, key: string) => {
    const match = key.match(/reflections-(\d+)/);
    if (match) acc[parseInt(match[1], 10)] = reflectionsContext(key);
    return acc;
  },
  {},
);

// QA-only: pin the home hero image for App Store screenshots. Value is the
// image number from the filename (e.g. "33" for reflections-33.webp).
export const QA_REFLECTION_IMAGE_OVERRIDE_KEY = "qa:reflection-image-override";

function getReflectionImageForDate(date: Date) {
  // Local-calendar day-of-year (1-366, with Feb 29 stably pinned to slot 60
  // across leap and non-leap years) so the image advances at each user's
  // local midnight and wraps after the last image.
  if (REFLECTION_IMAGES.length === 0) return null;
  const dayIndex = getScheduledDayOfYear(date);
  const idx = ((dayIndex % REFLECTION_IMAGES.length) + REFLECTION_IMAGES.length) % REFLECTION_IMAGES.length;
  return REFLECTION_IMAGES[idx];
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
  const { entries: journalEntries, createEntry } = useJournalStorage();
  const [journalEntryType, setJournalEntryType] = useState<EntryType | null>(null);
  const [reflectionImageOverride, setReflectionImageOverride] = useState<number | null>(null);

  useEffect(() => {
    AsyncStorage.getItem(QA_REFLECTION_IMAGE_OVERRIDE_KEY)
      .then((value) => {
        if (!value) return;
        const parsed = parseInt(value, 10);
        if (Number.isFinite(parsed) && REFLECTION_IMAGE_BY_NUMBER[parsed]) {
          setReflectionImageOverride(parsed);
        }
      })
      .catch(() => {});
  }, []);

  const heroImage = reflectionImageOverride != null
    ? REFLECTION_IMAGE_BY_NUMBER[reflectionImageOverride]
    : getReflectionImageForDate(today);

  // Notebook row metadata — reuses the same entries array the Notebook tab
  // renders, and the same pure streak util, so numbers are guaranteed to
  // match what the Notebook screen displays.
  const notebookRowMetadata = useMemo(() => {
    const total = journalEntries.length;
    if (total === 0) return null;
    const streak = computeJournalStreak(journalEntries);
    const entriesLabel = `${total} ${total === 1 ? "entry" : "entries"}`;
    if (streak < 2) return entriesLabel;
    return `${entriesLabel} · ${streak} day streak`;
  }, [journalEntries]);

  // Speakers row metadata — derived from the already-loaded speakers list
  // (no extra query). Blank when there are no new speakers in the last 7 days.
  const speakersNewThisWeekLabel = useMemo(() => {
    const cutoff = Date.now() - 7 * 24 * 60 * 60 * 1000;
    let count = 0;
    for (const s of speakers) {
      const ts = s.created_at ? Date.parse(s.created_at) : NaN;
      if (!Number.isNaN(ts) && ts >= cutoff) count += 1;
    }
    if (count === 0) return null;
    return `${count} new this week`;
  }, [speakers]);

  const { gate, refresh: refreshSub } = useSubscriptionContext();
  const isFree = gate === "paywall";
  const presentingPaywall = useRef(false);

  const greetingType = useMemo(() => {
    // Scale the display-size greeting off the user's body text setting so it
    // grows/shrinks with "Text size" like everything else. Medium preset
    // (bodyFontSize: 18) is the baseline that produces the original 36pt.
    const scale = textMetrics.bodyFontSize / 18;
    return {
      fontFamily: fonts.cormorantGaramondMedium,
      fontSize: Math.round(36 * scale),
      lineHeight: Math.round(44 * scale),
      letterSpacing: -0.5,
    };
  }, [textMetrics.bodyFontSize]);

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
    const fontSize = textMetrics.bodySmallFontSize + 2;
    return {
      fontFamily: fonts.bodyFamilyMedium,
      fontSize,
      lineHeight: Math.round(fontSize * (22 / 17)),
      letterSpacing: 0,
    };
  }, [textMetrics.bodySmallFontSize]);

  const notebookTagType = useMemo(
    () => [
      typography.bodySmall,
      { fontFamily: fonts.bodyFamilyMedium },
      styles.notebookTagExtras,
    ],
    [typography.bodySmall],
  );

  const sectionTitleType = useMemo(() => {
    // Cormorant Garamond reads noticeably smaller than Manrope at the same
    // point size. Bump ~30% to match the visual weight of the previous
    // Manrope_700Bold treatment at bodyLarge.
    const fontSize = Math.round(typography.bodyLarge.fontSize * 1.3);
    return {
      fontFamily: fonts.cormorantGaramondSemiBold,
      fontSize,
      lineHeight: Math.round(fontSize * 1.2),
      letterSpacing: -0.1,
    };
  }, [typography.bodyLarge.fontSize]);

  // Vertical rhythm — expressed as multiples of body line-height so spacing
  // scales proportionally with the user's text-size setting (XS → XL). Goal
  // is paragraph-break feel between sections, not chapter-break.
  const sectionRhythm = useMemo(() => {
    const lh = typography.body.lineHeight;
    return {
      betweenSections: Math.round(lh * 1.2),    // prior section's last elem → next heading
      titleToFirstCard: Math.round(lh * 0.7),    // section heading → first card beneath it
      betweenCards: Math.round(lh * 0.85),       // stacked cards inside a section
      cardToUtility: Math.round(lh * 0.35),      // last card → quiet utility row
    };
  }, [typography.body.lineHeight]);

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

  // Persistent unlock pill is a fixed-size floating element — pinned to the
  // bottom of the screen, it must stay within layout bounds regardless of
  // the user's text-size setting. Intentionally NOT dynamic.
  const unlockPillTextType = useMemo(
    () => ({
      fontFamily: fonts.bodyFamilyMedium,
      fontSize: 14,
      lineHeight: 20,
    }),
    []
  );

  const unlockPillButtonTextType = useMemo(
    () => ({
      fontFamily: fonts.bodyFamilySemiBold,
      fontSize: 14,
      lineHeight: 20,
      fontWeight: "600" as const,
    }),
    []
  );

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
    <SafeAreaView style={[styles.safe, { backgroundColor: colors.surface }]} edges={[]}>
      <TealHeader
        title={new Date().toLocaleDateString("en-US", {
          weekday: "long",
          month: "long",
          day: "numeric",
          year: "numeric",
        })}
        eyebrow="Al-Anon Daily Paths"
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
            source={heroImage}
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
                  style={[
                    ...notebookTagType,
                    styles.heroThoughtForDay,
                    {
                      color: colors.onSurface,
                      fontFamily: fonts.loraRegular,
                      fontSize: typography.body.fontSize,
                      lineHeight: typography.body.lineHeight,
                    },
                  ]}
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
            {
              color: colors.onSurface,
              marginTop: sectionRhythm.betweenSections,
              marginBottom: sectionRhythm.titleToFirstCard,
            },
            isFree && styles.sectionTitleToolsFree,
          ]}
        >
          Daily Tools
        </Text>
        <View style={[styles.toolsList, { gap: sectionRhythm.betweenCards }]}>
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
                  <View style={[styles.ctaRow, styles.toolCtaRow]}>
                    <Text style={[readMoreType, { color: colors.accent }]}>
                      Open
                    </Text>
                    <MaterialIcons name="chevron-right" size={20} color={colors.accent} />
                  </View>
                </View>
              </View>
            </TouchableOpacity>
          ))}
        </View>

        <CollectionLinkRow
          metadata={notebookRowMetadata}
          linkLabel="Open your notebook →"
          onPress={() => {
            if (isFree) {
              void presentPaywall();
            } else {
              router.push("/(tabs)/journal");
            }
          }}
          style={[
            styles.notebookLinkRow,
            { marginTop: sectionRhythm.cardToUtility },
            isFree && styles.toolRowFree,
          ]}
        />

        {/* ── Prayers Card ── */}
        <Text
          style={[
            styles.sectionTitleLayout,
            sectionTitleType,
            {
              color: colors.onSurface,
              marginTop: Math.round(sectionRhythm.betweenSections * 0.5),
              marginBottom: sectionRhythm.titleToFirstCard,
            },
            isFree && styles.sectionTitleToolsFree,
          ]}
        >
          Prayers
        </Text>
        <View style={[styles.toolsList, { gap: sectionRhythm.betweenCards }]}>
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
                <View style={[styles.ctaRow, styles.toolCtaRow]}>
                  <Text style={[readMoreType, { color: colors.accent }]}>
                    Open
                  </Text>
                  <MaterialIcons name="chevron-right" size={20} color={colors.accent} />
                </View>
              </View>
            </View>
          </TouchableOpacity>
        </View>

        {/* ── Speaker Feature Card ── */}
        <Text
          style={[
            styles.sectionTitleLayout,
            sectionTitleType,
            {
              color: colors.onSurface,
              marginTop: sectionRhythm.betweenSections,
              marginBottom: sectionRhythm.titleToFirstCard,
            },
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
            <View style={[styles.speakerCardInner, { backgroundColor: colors.secondary }]}>
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
              <Text style={[styles.speakerNameLayout, speakerNameType, { color: colors.onSecondary, marginTop: 12 }]}>
                {featuredSpeaker.speaker}
              </Text>
              <Text
                style={[speakerTitleType, { color: colors.onSecondary + "CC" }]}
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
            </View>
          </TouchableOpacity>
        ) : null}
        <CollectionLinkRow
          metadata={speakersNewThisWeekLabel}
          linkLabel="Explore all speakers →"
          onPress={() => {
            if (isFree) {
              void presentPaywall();
            } else {
              router.push("/(tabs)/speakers");
            }
          }}
          style={[
            styles.speakersLinkRow,
            { marginTop: sectionRhythm.cardToUtility },
            isFree && styles.speakerSectionFree,
          ]}
        />

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
  // Tool/prayer cards: tighter spacing so the teal icon band stays square.
  toolCtaRow: {
    marginTop: 0,
  },
  // Section titles — vertical margins come from sectionRhythm (dynamic).
  sectionTitleLayout: {
    marginHorizontal: layout.spacing.lgPlus,
  },

  // Daily Tools list — gap comes from sectionRhythm (dynamic).
  toolsList: {
    paddingHorizontal: layout.spacing.md,
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
    width: 115,
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
  // Utility link rows — marginTop comes from sectionRhythm (dynamic).
  notebookLinkRow: {},
  speakersLinkRow: {},

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
