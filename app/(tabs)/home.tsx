import React, { useCallback, useEffect, useMemo, useState } from "react";
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
import Svg, { Circle } from "react-native-svg";
import { useTheme } from "../../hooks/useTheme";
import { useTypography } from "../../hooks/useTypography";
import { useSettings, getTextSizeMetrics } from "../../hooks/useSettings";
import { useReading } from "../../hooks/useReading";
import { useAppDate } from "../../contexts/AppDateContext";
import { useSpeakers } from "../../hooks/useSpeakers";
import { usePersonalPrayers } from "../../hooks/usePersonalPrayers";
import { fonts, layout } from "../../constants/theme";
import { JOURNAL_CATEGORIES, type EntryType } from "../../constants/journalCategories";
import { JournalEntryEditor } from "../../components/journal/JournalEntryEditor";
import { useJournalStorage } from "../../hooks/useJournalStorage";
import { TealHeader } from "../../components/shared/TealHeader";
import { CollectionLinkRow } from "../../components/shared/CollectionLinkRow";
import { NativePaywall } from "../../components/onboarding/NativePaywall";
import { useFeaturedSpeaker } from "../../hooks/useFeaturedSpeaker";
import { computeJournalStreak } from "../../utils/journalStreak";
import { getScheduledDayOfYear } from "../../utils/dateUtils";
import { isDeveloperDevice } from "../../utils/deviceIdentity";

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

// Speaker card ripple decoration: 6 concentric circles emanating from the
// top-right corner, behind the title/label. Radii spaced 30px apart.
const SPEAKER_RIPPLES = [
  { r: 50, opacity: 0.45 },
  { r: 80, opacity: 0.32 },
  { r: 110, opacity: 0.22 },
  { r: 140, opacity: 0.15 },
  { r: 170, opacity: 0.1 },
  { r: 200, opacity: 0.06 },
];

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
  const featuredSpeaker = useFeaturedSpeaker(speakers);
  const { entries: journalEntries, createEntry } = useJournalStorage();
  const [journalEntryType, setJournalEntryType] = useState<EntryType | null>(null);
  const [reflectionImageOverride, setReflectionImageOverride] = useState<number | null>(null);
  const [isDeveloper, setIsDeveloper] = useState(__DEV__);
  const [devPaywallVisible, setDevPaywallVisible] = useState(false);

  useEffect(() => {
    let active = true;
    void isDeveloperDevice().then((developer) => {
      if (active) setIsDeveloper(developer);
    });
    return () => {
      active = false;
    };
  }, []);

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
        eyebrow="Daily Paths"
        hideIcon
        rightAction={isDeveloper ? (
          <TouchableOpacity
            activeOpacity={0.75}
            onPress={() => setDevPaywallVisible(true)}
            style={styles.devPaywallButton}
            accessibilityRole="button"
            accessibilityLabel="Open paywall for testing"
          >
            <Text style={styles.devPaywallText}>Paywall</Text>
          </TouchableOpacity>
        ) : null}
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
          ]}
        >
          Daily Tools
        </Text>
        <View style={[styles.toolsList, { gap: sectionRhythm.betweenCards }]}>
          {JOURNAL_CATEGORIES.map((cat) => (
            <TouchableOpacity
              key={cat.id}
              activeOpacity={0.8}
              onPress={() => setJournalEntryType(cat.id)}
              style={styles.toolRow}
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
                    { backgroundColor: colors.secondary },
                  ]}
                >
                  <Ionicons
                    name={cat.icon as any}
                    size={38}
                    color="#FFFFFF"
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
          onPress={() => router.push("/(tabs)/journal")}
          style={[
            styles.notebookLinkRow,
            { marginTop: sectionRhythm.cardToUtility },
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
          ]}
        >
          Prayers
        </Text>
        <View style={[styles.toolsList, { gap: sectionRhythm.betweenCards }]}>
          <TouchableOpacity
            activeOpacity={0.8}
            onPress={() => router.push("/(tabs)/prayers")}
            style={styles.toolRow}
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
                  { backgroundColor: colors.secondary },
                ]}
              >
                <MaterialCommunityIcons
                  name="hands-pray"
                  size={38}
                  color="#FFFFFF"
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
          ]}
        >
          Speakers
        </Text>
        {featuredSpeaker ? (
          <TouchableOpacity
            activeOpacity={0.85}
            onPress={() =>
              router.push({ pathname: "/(tabs)/speakers", params: { speakerId: featuredSpeaker.id } })
            }
            style={styles.heroWrapper}
          >
            <View style={styles.heroClip}>
              <View style={[styles.heroTopTeal, { backgroundColor: colors.secondary }]}>
                <Svg
                  width={400}
                  height={400}
                  viewBox="0 0 400 400"
                  style={styles.heroRipples}
                  pointerEvents="none"
                >
                  {SPEAKER_RIPPLES.map(({ r, opacity }) => (
                    <Circle
                      key={r}
                      cx={200}
                      cy={200}
                      r={r}
                      stroke="#FFFFFF"
                      strokeWidth={0.75}
                      fill="none"
                      opacity={opacity}
                    />
                  ))}
                </Svg>
                <View style={styles.heroTealContent}>
                  <View style={styles.heroIconRow}>
                    <MaterialIcons name="record-voice-over" size={18} color="#FFFFFFCC" />
                    <Text style={[heroLabelType, { color: "#FFFFFFBB" }]}>
                      Featured Speaker
                    </Text>
                  </View>
                  <Text style={[styles.heroTitleLayout, heroTitleType, { color: "#FFFFFF" }]}>
                    {featuredSpeaker.title}
                  </Text>
                </View>
              </View>

              <View style={[styles.heroBottom, { backgroundColor: colors.surfaceContainerLowest }]}>
                {featuredSpeaker.quote ? (
                  <>
                    <View style={styles.speakerQuoteRow}>
                      <Text style={[styles.speakerQuoteGlyph, { color: colors.outlineVariant }]}>
                        {"“"}
                      </Text>
                      <Text
                        style={[
                          ...notebookTagType,
                          styles.speakerQuoteText,
                          {
                            color: colors.onSurface,
                            fontFamily: fonts.loraRegular,
                            fontSize: typography.body.fontSize - 2,
                            lineHeight: Math.round(
                              (typography.body.fontSize - 2) *
                                (typography.body.lineHeight / typography.body.fontSize)
                            ),
                          },
                        ]}
                        numberOfLines={3}
                      >
                        {featuredSpeaker.quote.replace(/^["“”'‘’]+|["“”'‘’]+$/g, "").trim()}
                      </Text>
                    </View>
                    <View style={[styles.speakerDivider, { backgroundColor: colors.outlineVariant }]} />
                  </>
                ) : null}
                <View style={styles.speakerListenRow}>
                  <Text
                    style={[styles.speakerNameText, { color: colors.onSurface }]}
                    numberOfLines={1}
                  >
                    {featuredSpeaker.speaker}
                  </Text>
                  <View style={styles.speakerListenCta}>
                    <Ionicons name="play" size={20} color={colors.accent} />
                    <Text style={[readMoreType, { color: colors.accent }]}>
                      Listen
                    </Text>
                  </View>
                </View>
              </View>
            </View>
          </TouchableOpacity>
        ) : null}
        <CollectionLinkRow
          metadata={speakersNewThisWeekLabel}
          linkLabel="Explore all speakers →"
          onPress={() => router.push("/(tabs)/speakers")}
          style={[
            styles.speakersLinkRow,
            { marginTop: sectionRhythm.cardToUtility },
          ]}
        />

        {/* Bottom spacing */}
        <View style={{ height: 32 }} />
      </ScrollView>
      <NativePaywall
        visible={devPaywallVisible}
        origin="toolkit"
        onClose={() => setDevPaywallVisible(false)}
        onAccessGranted={() => setDevPaywallVisible(false)}
      />
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
  devPaywallButton: {
    minHeight: 34,
    paddingHorizontal: 12,
    borderRadius: 999,
    borderWidth: 1,
    borderColor: "rgba(255,255,255,0.55)",
    alignItems: "center",
    justifyContent: "center",
  },
  devPaywallText: {
    fontFamily: fonts.bodyFamilySemiBold,
    fontSize: 12,
    lineHeight: 17,
    color: "rgba(255,255,255,0.95)",
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
    overflow: "hidden",
  },
  heroTopImage: {
    borderTopLeftRadius: layout.borderRadiusLarge,
    borderTopRightRadius: layout.borderRadiusLarge,
  },
  heroTopTeal: {
    borderTopLeftRadius: layout.borderRadiusLarge,
    borderTopRightRadius: layout.borderRadiusLarge,
    overflow: "hidden",
  },
  heroRipples: {
    position: "absolute",
    right: -200,
    top: -200,
  },
  heroSpacer: {
    flex: 1,
  },
  heroOverlay: {
    padding: layout.spacing.lgPlus,
    paddingTop: layout.spacing.xxl,
    paddingBottom: layout.spacing.md,
  },
  heroTealContent: {
    padding: layout.spacing.lgPlus,
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
  speakerQuoteRow: {
    flexDirection: "row",
    alignItems: "flex-start",
    gap: layout.spacing.sm,
  },
  speakerQuoteGlyph: {
    fontFamily: fonts.cormorantGaramondMedium,
    fontSize: 44,
    lineHeight: 44,
    marginTop: -4,
  },
  speakerQuoteText: {
    flex: 1,
    textAlign: "left",
  },
  speakerDivider: {
    height: StyleSheet.hairlineWidth,
    marginTop: 16,
  },
  speakerListenRow: {
    flexDirection: "row",
    alignItems: "center",
    justifyContent: "space-between",
    gap: layout.spacing.sm,
    marginTop: 12,
  },
  speakerNameText: {
    flex: 1,
    minWidth: 0,
    fontFamily: fonts.bodyFamilySemiBold,
    fontSize: 17,
    lineHeight: 22,
  },
  speakerListenCta: {
    flexDirection: "row",
    alignItems: "center",
    gap: 2,
  },
  // Utility link rows — marginTop comes from sectionRhythm (dynamic).
  notebookLinkRow: {},
  speakersLinkRow: {},
});
