import React, { useEffect, useRef, useState, useCallback, useMemo } from "react";
import {
  View,
  Text,
  ScrollView,
  TouchableOpacity,
  StyleSheet,
  ActivityIndicator,
  Pressable,
  Alert,
  LayoutChangeEvent,
  Platform,
} from "react-native";
import { Ionicons } from "@expo/vector-icons";
import { useTheme } from "../../hooks/useTheme";
import { useTypography } from "../../hooks/useTypography";
import { useSettings, getTextSizeMetrics } from "../../hooks/useSettings";
import { useAnalytics } from "../../utils/analytics";
import { fonts, layout, shadows, typography } from "../../constants/theme";
import { QuoteWatermarkPattern } from "../shared/QuoteWatermarkPattern";
import { SanctuaryCard } from "../ui/Sanctuary";
// EqualizerBars removed — status indicator moved to browse list
import { getSpeakerAudioUrl } from "../../hooks/useSpeakers";
import { useSpeakerDownload, resolveAudioUri } from "../../hooks/useSpeakerDownload";
import type { Speaker } from "../../types/speakers";
import type { AudioPlayer } from "../../hooks/useAudioPlayer";

// ─── Types ─────────────────────────────────────────────────────────────────

interface SpeakerDetailProps {
  speaker: Speaker;
  autoPlay: boolean;
  onBack: () => void;
  onStop: () => void;
  player: AudioPlayer;
  canDownload: boolean;
}

// ─── Helpers ───────────────────────────────────────────────────────────────

function formatTime(ms: number): string {
  const totalSeconds = Math.floor(ms / 1000);
  const minutes = Math.floor(totalSeconds / 60);
  const seconds = totalSeconds % 60;
  return `${minutes}:${seconds.toString().padStart(2, "0")}`;
}

function formatDate(dateStr: string): string {
  const date = new Date(dateStr + "T12:00:00"); // noon to avoid timezone shifts
  return date.toLocaleDateString("en-US", {
    month: "long",
    day: "numeric",
    year: "numeric",
  });
}

function normalizeQuoteText(text: string): string {
  return text.trim().replace(/^["“”'']+|["“”'']+$/g, "");
}

const SPEED_OPTIONS = [0.75, 1, 1.25, 1.5];

// ─── Component ─────────────────────────────────────────────────────────────

export const SpeakerDetail: React.FC<SpeakerDetailProps> = ({
  speaker,
  autoPlay,
  onBack,
  onStop,
  player,
  canDownload,
}) => {
  const { colors } = useTheme();
  const { typography: typ } = useTypography();
  const { settings } = useSettings();
  const { trackSpeakerAudioPlayed, trackSpeakerAudioPaused } = useAnalytics();
  const [trackWidth, setTrackWidth] = useState(0);

  // Scale factor: medium bodyFontSize (18) is the baseline (1.0)
  const textMetrics = useMemo(() => getTextSizeMetrics(settings.textSize), [settings.textSize]);
  const scale = textMetrics.bodyFontSize / 18;
  const hasLoadedRef = useRef(false);

  const audioUrl = getSpeakerAudioUrl(speaker);
  const download = useSpeakerDownload(speaker.id, audioUrl);

  // Load audio on mount (or when speaker changes), preferring local file
  useEffect(() => {
    if (!hasLoadedRef.current) {
      hasLoadedRef.current = true;
      resolveAudioUri(speaker.id, audioUrl).then((uri) => {
        player.load(uri, autoPlay);
      });
    }
  }, [speaker.id]); // eslint-disable-line react-hooks/exhaustive-deps

  // Reset load tracking when speaker changes
  useEffect(() => {
    hasLoadedRef.current = false;
  }, [speaker.id]);

  // ─── Download Actions ────────────────────────────────────────────────────

  const handleDownloadPress = useCallback(() => {
    if (download.downloadStatus === "not_downloaded") {
      download.startDownload();
    } else if (download.downloadStatus === "downloaded") {
      Alert.alert(
        "Remove Download",
        "Remove this download from your device?",
        [
          { text: "Cancel", style: "cancel" },
          {
            text: "Delete",
            style: "destructive",
            onPress: () => download.deleteDownload(),
          },
        ],
      );
    }
  }, [download]);

  // ─── Progress Bar Seek ──────────────────────────────────────────────────

  const handleTrackLayout = (e: LayoutChangeEvent) => {
    setTrackWidth(e.nativeEvent.layout.width);
  };

  const handleSeek = (locationX: number) => {
    if (trackWidth > 0 && player.durationMs > 0) {
      const ratio = Math.max(0, Math.min(1, locationX / trackWidth));
      player.seekTo(ratio * player.durationMs);
    }
  };

  const progress = player.durationMs > 0 ? player.positionMs / player.durationMs : 0;

  // ─── Render: Download Indicator (inline, top-right of player card) ───────

  const renderDownloadIndicator = () => {
    // Users without premium entitlement don't see download controls.
    if (!canDownload) return null;

    if (download.downloadStatus === "downloading") {
      return (
        <View style={styles.dlInlineRow}>
          <ActivityIndicator size="small" color={colors.secondary} />
          <Text style={[styles.dlInlineText, { color: colors.textSecondary, fontSize: typ.label.fontSize }]}>
            {download.downloadProgress}%
          </Text>
          <TouchableOpacity
            onPress={download.cancelDownload}
            hitSlop={{ top: 8, bottom: 8, left: 8, right: 8 }}
          >
            <Ionicons name="close-circle" size={Math.round(18 * scale)} color={colors.danger} />
          </TouchableOpacity>
        </View>
      );
    }

    if (download.downloadStatus === "downloaded") {
      return (
        <TouchableOpacity
          style={styles.dlInlineRow}
          onPress={handleDownloadPress}
          activeOpacity={0.6}
          hitSlop={{ top: 8, bottom: 8, left: 8, right: 8 }}
        >
          <Ionicons name="checkmark-circle" size={Math.round(14 * scale)} color={colors.secondary} />
          <Text style={[styles.dlInlineText, { color: colors.secondary, fontWeight: "600", fontSize: typ.label.fontSize }]}>
            Downloaded
          </Text>
        </TouchableOpacity>
      );
    }

    // Not downloaded
    const sizeLabel = "Download";

    return (
      <TouchableOpacity
        style={[styles.dlButton, { backgroundColor: colors.secondaryContainer, borderColor: colors.ghostBorder }]}
        onPress={handleDownloadPress}
        activeOpacity={0.6}
        hitSlop={{ top: 4, bottom: 4, left: 4, right: 4 }}
      >
        <Ionicons name="download-outline" size={Math.round(14 * scale)} color={colors.onSecondaryContainer} />
        <Text
          style={[
            styles.dlButtonText,
            {
              color: colors.onSecondaryContainer,
              fontSize: typ.label.fontSize,
              lineHeight: typ.label.lineHeight,
            },
          ]}
        >
          {sizeLabel}
        </Text>
      </TouchableOpacity>
    );
  };

  // ─── Render ─────────────────────────────────────────────────────────────

  return (
    <View style={styles.container}>
      <ScrollView
        style={styles.scrollView}
        contentContainerStyle={styles.scrollContent}
        showsVerticalScrollIndicator={false}
      >
        {/* Speaker info section */}
        <View style={styles.infoSection}>
          <TouchableOpacity
            style={styles.backButton}
            onPress={onBack}
            activeOpacity={0.7}
            hitSlop={{ top: 8, bottom: 8, left: 8, right: 8 }}
          >
            <Ionicons name="chevron-back" size={18} color={colors.primaryContainer} />
            <Text style={[styles.backLabel, { color: colors.primaryContainer }]}>Back</Text>
          </TouchableOpacity>

          <Text
            style={[
              styles.title,
              {
                color: colors.primaryContainer,
              },
            ]}
          >
            {speaker.title}
          </Text>
          <Text
            style={[
              styles.speakerMeta,
              typ.body,
              {
                color: colors.textSecondary,
              },
            ]}
          >
            {speaker.speaker}
            {speaker.hometown ? ` • ${speaker.hometown}` : ""}
          </Text>

          {speaker.subtitle && (
            <Text
              style={[
                styles.subtitle,
                typ.body,
                {
                  color: colors.text,
                },
              ]}
            >
              {speaker.subtitle}
            </Text>
          )}
        </View>

        {/* Player card */}
        <View
          style={[
            styles.playerCard,
            {
              backgroundColor: colors.surfaceContainerLowest,
              borderColor: colors.ghostBorder,
            },
          ]}
        >
          {/* Stop + Download indicator */}
          <View style={styles.nowPlayingRow}>
            <TouchableOpacity
              onPress={onStop}
              style={styles.stopButton}
              activeOpacity={0.6}
              hitSlop={{ top: 8, bottom: 8, left: 8, right: 8 }}
            >
              <Ionicons name="stop" size={Math.round(14 * scale)} color={colors.textSecondary} />
              <Text
                style={[
                  styles.nowPlayingLabel,
                  {
                    color: colors.textSecondary,
                    fontSize: typ.label.fontSize,
                    lineHeight: typ.label.lineHeight,
                  },
                ]}
              >
                Stop
              </Text>
            </TouchableOpacity>
            {renderDownloadIndicator()}
          </View>

          {/* Loading / Error states */}
          {player.isBuffering && !player.isLoaded && (
            <View style={styles.loadingRow}>
              <ActivityIndicator size="small" color={colors.secondary} />
              <Text
                style={[
                  styles.loadingText,
                  {
                    color: colors.textSecondary,
                    fontSize: typ.bodySmall.fontSize,
                    lineHeight: typ.bodySmall.lineHeight,
                  },
                ]}
              >
                Loading audio...
              </Text>
            </View>
          )}

          {player.loadError && (
            <View style={styles.errorRow}>
              <Ionicons name="alert-circle-outline" size={Math.round(18 * scale)} color={colors.danger} />
              <Text
                style={[
                  styles.errorText,
                  {
                    color: colors.danger,
                    fontSize: typ.bodySmall.fontSize,
                    lineHeight: typ.bodySmall.lineHeight,
                  },
                ]}
              >
                Failed to load audio. Please try again.
              </Text>
            </View>
          )}

          {/* Progress bar */}
          <Pressable
            onPress={(e) => handleSeek(e.nativeEvent.locationX)}
            style={styles.progressContainer}
          >
            <View
              style={[styles.progressTrack, { backgroundColor: colors.border }]}
              onLayout={handleTrackLayout}
            >
              <View
                style={[
                  styles.progressFill,
                  {
                    backgroundColor: colors.secondary,
                    width: `${progress * 100}%`,
                  },
                ]}
              />
              {/* Thumb */}
              <View
                style={[
                  styles.progressThumb,
                  {
                    backgroundColor: colors.secondary,
                    left: `${progress * 100}%`,
                  },
                ]}
              />
            </View>
          </Pressable>

          {/* Time labels */}
          <View style={styles.timeRow}>
            <Text
              style={[
                styles.timeText,
                {
                  color: colors.textSecondary,
                  fontSize: typ.label.fontSize,
                  lineHeight: typ.label.lineHeight,
                },
              ]}
            >
              {formatTime(player.positionMs)}
            </Text>
            <Text
              style={[
                styles.timeText,
                {
                  color: colors.textSecondary,
                  fontSize: typ.label.fontSize,
                  lineHeight: typ.label.lineHeight,
                },
              ]}
            >
              {formatTime(player.durationMs)}
            </Text>
          </View>

          {/* Transport controls */}
          <View style={styles.transportRow}>
            {/* Skip back 15s */}
            <TouchableOpacity
              style={styles.skipButton}
              onPress={() => player.seekBy(-15)}
              activeOpacity={0.6}
            >
              <Ionicons name="play-back" size={Math.round(24 * scale)} color={colors.text} />
              <Text
                style={[
                  styles.skipLabel,
                  {
                    color: colors.textSecondary,
                    fontSize: typ.label.fontSize,
                    lineHeight: typ.label.lineHeight,
                  },
                ]}
              >
                15s
              </Text>
            </TouchableOpacity>

            {/* Play/Pause */}
            <TouchableOpacity
              style={[styles.playPauseButton, { backgroundColor: colors.secondary, width: Math.round(64 * scale), height: Math.round(64 * scale), borderRadius: Math.round(32 * scale) }]}
              onPress={() => {
                if (player.isPlaying) {
                  trackSpeakerAudioPaused(speaker.id, speaker.speaker, player.positionMs, player.durationMs);
                  player.pause();
                } else {
                  trackSpeakerAudioPlayed(speaker.id, speaker.speaker, speaker.title);
                  player.play();
                }
              }}
              activeOpacity={0.7}
            >
              <Ionicons
                name={player.isPlaying ? "pause" : "play"}
                size={Math.round(32 * scale)}
                color={colors.onSecondary}
                style={!player.isPlaying ? styles.playIconOffset : undefined}
              />
            </TouchableOpacity>

            {/* Skip forward 30s */}
            <TouchableOpacity
              style={styles.skipButton}
              onPress={() => player.seekBy(30)}
              activeOpacity={0.6}
            >
              <Ionicons name="play-forward" size={Math.round(24 * scale)} color={colors.text} />
              <Text
                style={[
                  styles.skipLabel,
                  {
                    color: colors.textSecondary,
                    fontSize: typ.label.fontSize,
                    lineHeight: typ.label.lineHeight,
                  },
                ]}
              >
                30s
              </Text>
            </TouchableOpacity>
          </View>

          {/* Speed selector */}
          <View style={styles.speedRow}>
            {SPEED_OPTIONS.map((speed) => {
              const isActive = player.rate === speed;
              return (
                <TouchableOpacity
                  key={speed}
                  style={[
                    styles.speedPill,
                    {
                      backgroundColor: isActive ? colors.secondary : "transparent",
                      borderColor: isActive ? colors.secondary : colors.border,
                    },
                  ]}
                  onPress={() => player.setRate(speed)}
                  activeOpacity={0.7}
                >
                  <Text
                    style={[
                      styles.speedLabel,
                      {
                        color: isActive ? colors.onSecondary : colors.textSecondary,
                        fontWeight: isActive ? "700" : "400",
                        fontSize: typ.bodySmall.fontSize,
                        lineHeight: typ.bodySmall.lineHeight,
                      },
                    ]}
                  >
                    {speed}×
                  </Text>
                </TouchableOpacity>
              );
            })}
          </View>

        </View>

        {/* Quote block */}
        {speaker.quote && (
          <SanctuaryCard
            tone="lowest"
            style={styles.quoteCard}
            contentStyle={[styles.quoteCardInner, { backgroundColor: colors.primary }]}
            elevated
          >
            <View style={styles.quoteCardContent}>
              <View pointerEvents="none" style={styles.quotePatternLayer}>
                <QuoteWatermarkPattern />
              </View>
              <View style={styles.quoteWrap}>
                <Text
                  style={[
                    styles.quoteText,
                    {
                      color: colors.onPrimary,
                      fontSize: typ.quoteBox.fontSize,
                      lineHeight: typ.quoteBox.lineHeight,
                    },
                  ]}
                >
                  &ldquo;{normalizeQuoteText(speaker.quote)}&rdquo;
                </Text>
              </View>
            </View>
          </SanctuaryCard>
        )}

        {/* Meta row */}
        <View style={styles.metaRow}>
          {speaker.date && (
            <Text
              style={[
                styles.metaText,
                {
                  color: colors.textSecondary,
                  fontSize: typ.label.fontSize,
                  lineHeight: typ.label.lineHeight,
                },
              ]}
            >
              {formatDate(speaker.date)}
            </Text>
          )}
          {speaker.explicit && (
            <View style={[styles.explicitBadge, { backgroundColor: colors.danger + "15" }]}>
              <Text
                style={[
                  styles.explicitText,
                  { color: colors.danger, fontSize: typ.label.fontSize },
                ]}
              >
                EXPLICIT
              </Text>
            </View>
          )}
        </View>
      </ScrollView>
    </View>
  );
};

// ─── Styles ──────────────────────────────────────────────────────────────────

const styles = StyleSheet.create({
  container: {
    flex: 1,
  },

  // ─── Scroll ────────────────────────────────────────────────────────────────
  scrollView: {
    flex: 1,
  },
  scrollContent: {
    paddingTop: layout.spacing.lg,
    paddingHorizontal: layout.spacing.xl,
    paddingBottom: layout.spacing.xxl,
  },

  // ─── Info Section ──────────────────────────────────────────────────────────
  infoSection: {
    marginBottom: layout.spacing.md,
  },
  backButton: {
    flexDirection: "row",
    alignItems: "center",
    alignSelf: "flex-start",
    gap: 4,
    marginBottom: layout.spacing.sm,
  },
  backLabel: {
    fontFamily: fonts.bodyFamilyRegular,
    fontSize: 14,
    lineHeight: 20,
  },
  title: {
    fontFamily: fonts.headerFamilyLight,
    fontSize: 36 + (Platform.OS === "android" ? 2 : 0),
    lineHeight: 44 + (Platform.OS === "android" ? 2 : 0),
    fontWeight: "300",
    letterSpacing: -0.9,
    marginBottom: 6,
  },
  speakerMeta: {
    marginBottom: layout.spacing.sm + 2,
  },
  subtitle: {
  },

  // ─── Quote Block ───────────────────────────────────────────────────────────
  quoteCard: {
    marginBottom: layout.spacing.md,
    borderRadius: 12,
  },
  quoteCardInner: {
    borderRadius: 12,
    overflow: "hidden",
  },
  quoteCardContent: {
    position: "relative",
    overflow: "hidden",
    borderRadius: 12,
  },
  quoteWrap: {
    paddingHorizontal: 20,
    paddingTop: 18,
    paddingBottom: 18,
    position: "relative",
  },
  quoteText: {
    ...typography.quoteBox,
    textAlign: "left",
    paddingHorizontal: 14,
    position: "relative",
    zIndex: 2,
  },
  quotePatternLayer: {
    ...StyleSheet.absoluteFillObject,
    overflow: "hidden",
    zIndex: 0,
  },

  // ─── Meta Row ──────────────────────────────────────────────────────────────
  metaRow: {
    flexDirection: "row",
    alignItems: "center",
    gap: layout.spacing.sm + 4,
    marginBottom: layout.spacing.lgPlus,
  },
  metaText: {
    ...typography.label,
    textTransform: "uppercase",
    letterSpacing: 0.8,
  },
  explicitBadge: {
    paddingHorizontal: layout.spacing.sm,
    paddingVertical: 3,
    borderRadius: layout.spacing.xs,
  },
  explicitText: {
    ...typography.label,
    fontWeight: "800",
    letterSpacing: 0.8,
  },

  // ─── Player Card ───────────────────────────────────────────────────────────
  playerCard: {
    borderRadius: layout.borderRadiusLarge,
    padding: layout.spacing.lgPlus,
    marginBottom: layout.spacing.lgPlus,
    borderWidth: 1,
    ...shadows.ambient,
  },

  // ─── Stop / Status Row ────────────────────────────────────────────────────
  nowPlayingRow: {
    flexDirection: "row",
    alignItems: "center",
    justifyContent: "space-between",
    marginBottom: layout.spacing.md,
    minHeight: layout.spacing.lgPlus,
  },
  stopButton: {
    flexDirection: "row",
    alignItems: "center",
    gap: layout.spacing.sm,
  },
  nowPlayingLabel: {
    ...typography.label,
    fontWeight: "600",
    textTransform: "uppercase",
    letterSpacing: 0.8,
  },

  // ─── Loading / Error ───────────────────────────────────────────────────────
  loadingRow: {
    flexDirection: "row",
    alignItems: "center",
    gap: layout.spacing.sm + 2,
    marginBottom: layout.spacing.sm + 4,
  },
  loadingText: {
    ...typography.bodySmall,
  },
  errorRow: {
    flexDirection: "row",
    alignItems: "center",
    gap: layout.spacing.sm,
    marginBottom: layout.spacing.sm + 4,
  },
  errorText: {
    ...typography.bodySmall,
    flex: 1,
  },

  // ─── Progress Bar ──────────────────────────────────────────────────────────
  progressContainer: {
    paddingVertical: layout.spacing.sm,
  },
  progressTrack: {
    height: layout.spacing.xs,
    borderRadius: layout.borderRadiusFull,
    position: "relative",
  },
  progressFill: {
    position: "absolute",
    left: 0,
    top: 0,
    bottom: 0,
    borderRadius: layout.borderRadiusFull,
  },
  progressThumb: {
    position: "absolute",
    top: -5,
    width: 14,
    height: 14,
    borderRadius: 7,
    marginLeft: -7,
  },

  // ─── Time Row ──────────────────────────────────────────────────────────────
  timeRow: {
    flexDirection: "row",
    justifyContent: "space-between",
    marginBottom: layout.spacing.md,
  },
  timeText: {
    ...typography.label,
  },

  // ─── Transport Controls ────────────────────────────────────────────────────
  transportRow: {
    flexDirection: "row",
    alignItems: "center",
    justifyContent: "center",
    gap: layout.spacing.xl,
    marginBottom: layout.spacing.lgPlus,
  },
  skipButton: {
    alignItems: "center",
    gap: 2,
  },
  skipLabel: {
    ...typography.label,
  },
  playPauseButton: {
    width: 64,
    height: 64,
    borderRadius: 32,
    alignItems: "center",
    justifyContent: "center",
  },
  playIconOffset: {
    marginLeft: 4, // optical center for play triangle
  },

  // ─── Speed Selector ────────────────────────────────────────────────────────
  speedRow: {
    flexDirection: "row",
    justifyContent: "center",
    gap: layout.spacing.sm + 2,
  },
  speedPill: {
    paddingHorizontal: layout.spacing.md,
    paddingVertical: layout.spacing.sm,
    borderRadius: layout.borderRadiusFull,
    borderWidth: 1,
  },
  speedLabel: {
    ...typography.bodySmall,
  },

  // ─── Download Indicator (inline, top-right) ──────────────────────────────────
  dlInlineRow: {
    flexDirection: "row",
    alignItems: "center",
    gap: layout.spacing.xs + 2,
  },
  dlInlineText: {
    ...typography.label,
    textTransform: "uppercase",
    letterSpacing: 0.8,
  },
  dlButton: {
    flexDirection: "row",
    alignItems: "center",
    gap: layout.spacing.xs + 2,
    paddingHorizontal: layout.spacing.sm + 4,
    paddingVertical: layout.spacing.xs + 2,
    borderRadius: layout.borderRadiusLarge,
    borderWidth: 1,
  },
  dlButtonText: {
    ...typography.label,
    textTransform: "uppercase",
    letterSpacing: 0.8,
  },
});
