import React, { useEffect, useMemo, useRef, useState } from "react";
import {
  Linking,
  Platform,
  Pressable,
  ScrollView,
  StyleSheet,
  Text,
  View,
} from "react-native";
import { useSafeAreaInsets } from "react-native-safe-area-context";
import { LinearGradient } from "expo-linear-gradient";
import * as Haptics from "expo-haptics";
import { Ionicons, MaterialCommunityIcons, MaterialIcons } from "@expo/vector-icons";
import { fonts, layout, wideType } from "../../constants/theme";
import { useTheme } from "../../hooks/useTheme";
import { useTypography } from "../../hooks/useTypography";
import type { DailyReading } from "../../types/readings";
import { getScheduledDayOfYear } from "../../utils/dateUtils";
import { renderInlineMarkdown } from "../ReadingScreen";
import { ReadingFeedback } from "../ReadingFeedback";
import { BackLink } from "./BackLink";

/**
 * The Reading in the wide layout (docs/widescreen-2.9/02-Reading). Left: the
 * top bar (Back, previous/next day, date, favorite, share), then title,
 * quote and body, which scroll. Right: a fixed column with the Thought for
 * the Day, Today's practice, "Write about this" and the dailypaths.org link.
 * app/(tabs)/reading.tsx owns the data and actions and passes them in.
 */
type Props = {
  reading: DailyReading;
  onPreviousDay: () => void;
  onNextDay: () => void;
  canGoPrevious: boolean;
  canGoNext: boolean;
  onOpenDatePicker: () => void;
  onOpenFavorites: () => void;
  isBookmarked: boolean;
  onBookmarkToggle: () => Promise<void>;
  onShare: () => void;
  onWriteAboutThis: () => void;
};

const READING_MAX_WIDTH = 600;
const ASIDE_WIDTH = 264;
const RELATED_URL = "https://dailypaths.org";

const paragraphs = (text?: string | null) =>
  (text ?? "")
    .replace(/\\n/g, "\n")
    .split(/\n{2,}/)
    .map((p) => p.trim())
    .filter((p) => p.length > 0);

// A transparent version of a #RRGGBB color, for the fade under the reading.
const clear = (hex: string) => (/^#[0-9a-f]{6}$/i.test(hex) ? `${hex}00` : "transparent");

export function ReadingWide({
  reading,
  onPreviousDay,
  onNextDay,
  canGoPrevious,
  canGoNext,
  onOpenDatePicker,
  onOpenFavorites,
  isBookmarked,
  onBookmarkToggle,
  onShare,
  onWriteAboutThis,
}: Props) {
  const { colors } = useTheme();
  const { typography } = useTypography();
  const insets = useSafeAreaInsets();
  const scrollRef = useRef<React.ComponentRef<typeof ScrollView>>(null);
  // Kept locally so the heart flips at once, as on the phone Reading.
  const [bookmarked, setBookmarked] = useState(isBookmarked);
  useEffect(() => setBookmarked(isBookmarked), [isBookmarked]);

  // A new day starts at the top.
  useEffect(() => {
    scrollRef.current?.scrollTo({ y: 0, animated: false });
  }, [reading.id]);

  const opening = useMemo(() => paragraphs(reading.opening), [reading.opening]);
  const practice = useMemo(() => paragraphs(reading.application), [reading.application]);
  // The quote, with a trailing "(Source, p. 89)" split off as its reference.
  const { quote, reference } = useMemo(() => {
    const raw = paragraphs(reading.quote)[0] ?? "";
    const match = raw.match(/^(.*?)(\s*\(([^()]*)\))\s*$/);
    return match ? { quote: match[1].trim(), reference: match[3].trim() } : { quote: raw, reference: "" };
  }, [reading.quote]);
  const dateLabel = useMemo(
    () => reading.date.toLocaleDateString("en-US", { month: "long", day: "numeric" }),
    [reading.date],
  );

  const bodyText = {
    fontFamily: fonts.loraRegular,
    fontSize: typography.body.fontSize,
    lineHeight: Math.round(typography.body.fontSize * 1.6),
    color: colors.onSurface,
  };
  const italic = { fontFamily: fonts.loraItalic };

  const toggleBookmark = async () => {
    await onBookmarkToggle();
    setBookmarked((b) => !b);
    Haptics.impactAsync(Haptics.ImpactFeedbackStyle.Medium).catch(() => {});
  };

  const circle = [
    styles.circleButton,
    { borderColor: colors.outlineVariant, backgroundColor: colors.surfaceContainerLowest },
  ];
  const arrowColor = (enabled: boolean) => (enabled ? colors.onSurfaceVariant : colors.outlineVariant);

  return (
    <View style={[styles.root, { backgroundColor: colors.surface, paddingTop: insets.top + 6 }]}>
      {/* Left: the reading */}
      <View style={styles.article}>
        <View style={styles.topBar}>
          <BackLink />
          <View style={styles.controls}>
            <Pressable
              onPress={onPreviousDay}
              disabled={!canGoPrevious}
              accessibilityRole="button"
              accessibilityLabel="Previous day's reading"
              accessibilityState={{ disabled: !canGoPrevious }}
              style={styles.arrow}
            >
              <Ionicons name="chevron-back" size={22} color={arrowColor(canGoPrevious)} />
            </Pressable>
            <Pressable
              onPress={onOpenDatePicker}
              accessibilityRole="button"
              accessibilityLabel={`${dateLabel}. Choose a date`}
              style={[styles.datePill, { borderColor: colors.outlineVariant, backgroundColor: colors.surfaceContainerLowest }]}
            >
              <Text style={[wideType.link, { color: colors.primaryContainer }]}>{dateLabel}</Text>
            </Pressable>
            <Pressable
              onPress={onNextDay}
              disabled={!canGoNext}
              accessibilityRole="button"
              accessibilityLabel="Next day's reading"
              accessibilityState={{ disabled: !canGoNext }}
              style={styles.arrow}
            >
              <Ionicons name="chevron-forward" size={22} color={arrowColor(canGoNext)} />
            </Pressable>
            <View style={styles.controlGap} />
            <Pressable
              onPress={toggleBookmark}
              accessibilityRole="button"
              accessibilityLabel={bookmarked ? "Remove from favorites" : "Add to favorites"}
              style={circle}
            >
              <Ionicons
                name={bookmarked ? "heart" : "heart-outline"}
                size={18}
                color={colors.primaryContainer}
              />
            </Pressable>
            <Pressable onPress={onShare} accessibilityRole="button" accessibilityLabel="Share" style={circle}>
              <MaterialIcons
                name={Platform.OS === "ios" ? "ios-share" : "share"}
                size={18}
                color={colors.primaryContainer}
              />
            </Pressable>
          </View>
        </View>

        <View style={styles.flex}>
          <ScrollView ref={scrollRef} style={styles.flex} contentContainerStyle={styles.articleContent} showsVerticalScrollIndicator={false}>
            <Text style={[wideType.bigTitle, styles.title, { color: colors.primaryContainer }]}>
              {reading.title}
            </Text>

            {!!quote && (
              <View style={styles.quote}>
                <Text style={[styles.quoteGlyph, { color: colors.secondary }]}>{"“"}</Text>
                <Text style={[bodyText, { fontFamily: fonts.loraItalic, lineHeight: Math.round(typography.body.fontSize * 1.5), color: colors.primary }]}>
                  {renderInlineMarkdown(quote, { fontFamily: fonts.loraRegular })}
                </Text>
                {!!reference && (
                  <Text style={[wideType.secondary, styles.reference, { color: colors.onSurfaceVariant }]}>
                    {reference}
                  </Text>
                )}
              </View>
            )}

            <View style={styles.body}>
              {[...opening, ...reading.body].map((p, i) => (
                <Text key={i} style={bodyText}>
                  {renderInlineMarkdown(p, italic)}
                </Text>
              ))}
            </View>

            {/* Kept from the phone Reading: Favorites and the reading's feedback. */}
            <Pressable
              onPress={onOpenFavorites}
              accessibilityRole="button"
              style={({ pressed }) => [styles.favorites, pressed && styles.pressed]}
            >
              <MaterialCommunityIcons name="heart-multiple" size={20} color={colors.primaryContainer} />
              <Text style={[wideType.link, { color: colors.primaryContainer }]}>Your favorites</Text>
            </Pressable>
            <View style={styles.feedback}>
              <ReadingFeedback
                readingId={reading.id}
                dayOfYear={getScheduledDayOfYear(reading.date)}
                readingTitle={reading.title}
                readingDate={reading.date}
              />
            </View>
          </ScrollView>
          <LinearGradient
            pointerEvents="none"
            colors={[clear(colors.surface), colors.surface]}
            locations={[0, 0.88]}
            style={styles.fade}
          />
        </View>
      </View>

      {/* Right: a fixed column beside the reading */}
      <ScrollView
        style={styles.aside}
        contentContainerStyle={[styles.asideContent, { paddingBottom: Math.max(insets.bottom, 24) }]}
        showsVerticalScrollIndicator={false}
      >
        <View style={[styles.thought, { backgroundColor: colors.primaryFixed }]}>
          <Text style={[wideType.smallCaps, styles.caps, styles.thoughtLabel]}>Thought for the day</Text>
          <Text style={[wideType.quote, styles.thoughtText]}>{reading.thoughtForDay}</Text>
        </View>

        {practice.length > 0 && (
          <View style={[styles.practice, { backgroundColor: colors.surfaceContainerLowest }]}>
            <View style={[styles.practiceLine, { backgroundColor: colors.primary }]} />
            <View style={styles.labelRow}>
              <Ionicons name="checkmark-circle-outline" size={14} color={colors.secondary} />
              <Text style={[wideType.smallCaps, styles.caps, { color: colors.secondary }]}>Today's practice</Text>
            </View>
            {practice.map((p, i) => (
              <Text key={i} style={[wideType.secondary, styles.practiceText, { color: colors.onSurface }]}>
                {renderInlineMarkdown(p, { fontStyle: "italic" })}
              </Text>
            ))}
          </View>
        )}

        <Pressable
          onPress={onWriteAboutThis}
          accessibilityRole="button"
          accessibilityLabel="Write about this. Journal on today's reading"
          style={({ pressed }) => [
            styles.writeRow,
            { backgroundColor: colors.surfaceContainerLowest, borderColor: colors.surfaceContainerHighest },
            pressed && styles.pressed,
          ]}
        >
          <View style={[styles.writeIcon, { backgroundColor: colors.secondary }]}>
            <MaterialIcons name="edit" size={20} color={colors.onSecondary} />
          </View>
          <View style={styles.flex}>
            <Text style={[wideType.row, { color: colors.onSurface }]}>Write about this</Text>
            <Text style={[wideType.secondary, { color: colors.onSurfaceVariant }]}>Journal on today's reading</Text>
          </View>
          <MaterialIcons name="chevron-right" size={22} color={colors.secondary} />
        </Pressable>

        <Pressable
          onPress={() => Linking.openURL(RELATED_URL)}
          accessibilityRole="link"
          accessibilityLabel="Discover related readings and articles at dailypaths.org"
          style={({ pressed }) => [styles.related, { backgroundColor: colors.surfaceContainerHigh }, pressed && styles.pressed]}
        >
          <View style={[styles.relatedIcon, { backgroundColor: colors.surfaceContainerLowest }]}>
            <MaterialIcons name="language" size={20} color={colors.secondary} />
          </View>
          <View style={styles.flex}>
            <Text style={[wideType.row, { color: colors.primaryContainer }]}>Discover related readings and articles</Text>
            <Text style={[wideType.secondary, { color: colors.onSurfaceVariant }]}>dailypaths.org</Text>
          </View>
          <MaterialIcons name="north-east" size={14} color={colors.secondary} />
        </Pressable>
      </ScrollView>
    </View>
  );
}

const styles = StyleSheet.create({
  flex: { flex: 1 },
  root: { flex: 1, flexDirection: "row", paddingLeft: 18 },
  pressed: { opacity: 0.8 },
  caps: { textTransform: "uppercase" },

  article: { flex: 1, minWidth: 0, paddingRight: 28 },
  topBar: { flexDirection: "row", alignItems: "center", justifyContent: "space-between" },
  controls: { flexDirection: "row", alignItems: "center", gap: 4 },
  arrow: { width: 44, height: 44, alignItems: "center", justifyContent: "center" },
  datePill: {
    height: 36,
    paddingHorizontal: 14,
    borderWidth: 1,
    borderRadius: layout.borderRadiusFull,
    justifyContent: "center",
  },
  controlGap: { width: 8 },
  circleButton: {
    width: 36,
    height: 36,
    borderRadius: 18,
    borderWidth: 1,
    alignItems: "center",
    justifyContent: "center",
    marginLeft: 2,
  },

  articleContent: { paddingBottom: 64 },
  title: { marginTop: 10, marginBottom: 14 },
  quote: { paddingLeft: 34, marginBottom: 18, maxWidth: READING_MAX_WIDTH },
  quoteGlyph: {
    position: "absolute",
    left: 0,
    top: -14,
    fontFamily: fonts.cormorantGaramondMedium,
    fontSize: 64,
    lineHeight: 72,
  },
  reference: { marginTop: 6 },
  body: { maxWidth: READING_MAX_WIDTH, gap: 14 },
  favorites: {
    flexDirection: "row",
    alignItems: "center",
    gap: 8,
    marginTop: 28,
    minHeight: 44,
    alignSelf: "flex-start",
  },
  feedback: { maxWidth: READING_MAX_WIDTH, marginTop: 8 },
  fade: { position: "absolute", left: 0, right: 0, bottom: 0, height: 64 },

  aside: { width: ASIDE_WIDTH, flexGrow: 0 },
  asideContent: { paddingTop: 50, paddingRight: 16, gap: 12 },
  thought: { padding: 18, borderRadius: layout.borderRadius, gap: 6 },
  thoughtLabel: { color: "rgba(255,255,255,0.8)", textAlign: "center" },
  thoughtText: { color: "#FFFFFF", textAlign: "center" },
  practice: {
    padding: 18,
    borderRadius: layout.borderRadiusLarge,
    overflow: "hidden",
    gap: 8,
    shadowColor: "#214743",
    shadowOpacity: 0.07,
    shadowRadius: 10,
    shadowOffset: { width: 0, height: 2 },
    elevation: 2,
  },
  practiceLine: { position: "absolute", left: 0, top: 0, bottom: 0, width: 4 },
  labelRow: { flexDirection: "row", alignItems: "center", gap: 8 },
  practiceText: { lineHeight: 21 },
  writeRow: {
    flexDirection: "row",
    alignItems: "center",
    gap: 12,
    paddingVertical: 10,
    paddingHorizontal: 12,
    borderWidth: 1,
    borderRadius: layout.borderRadius,
  },
  writeIcon: {
    width: 44,
    height: 44,
    borderRadius: 9,
    alignItems: "center",
    justifyContent: "center",
  },
  related: {
    flexDirection: "row",
    alignItems: "center",
    gap: 12,
    paddingVertical: 12,
    paddingHorizontal: 14,
    marginTop: 4,
    borderRadius: layout.borderRadius,
  },
  relatedIcon: {
    width: 36,
    height: 36,
    borderRadius: 18,
    alignItems: "center",
    justifyContent: "center",
  },
});
