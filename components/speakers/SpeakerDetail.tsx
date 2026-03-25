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
} from "react-native";
import { Ionicons } from "@expo/vector-icons";
import { useTheme } from "../../hooks/useTheme";
import { useSettings, getTextSizeMetrics } from "../../hooks/useSettings";
import { useAnalytics } from "../../utils/analytics";
import { fonts, layout, shadows, typography } from "../../constants/theme";
import { EqualizerBars } from "./EqualizerBars";
import { getSpeakerAudioUrl } from "../../hooks/useSpeakers";
import { useSpeakerDownload, resolveAudioUri } from "../../hooks/useSpeakerDownload";
import type { Speaker } from "../../types/speakers";
import type { AudioPlayer } from "../../hooks/useAudioPlayer";

// ─── Types ─────────────────────────────────────────────────────────────────

interface SpeakerDetailProps {
  speaker: Speaker;
  autoPlay: boolean;
  onBack: () => void;
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

const SPEED_OPTIONS = [0.75, 1, 1.25, 1.5];

// ─── Component ─────────────────────────────────────────────────────────────

export const SpeakerDetail: React.FC<SpeakerDetailProps> = ({
  speaker,
  autoPlay,
  onBack,
  player,
  canDownload,
}) => {
  const { colors } = useTheme();
  const { settings } = useSettings();
  const { trackSpeakerAudioPlayed, trackSpeakerAudioPaused } = useAnalytics();
  const [trackWidth, setTrackWidth] = useState(0);

  // Scale factor: medium bodyFontSize (18) is the baseline (1.0)
  const textMetrics = useMemo(() => getTextSizeMetrics(settings.textSize), [settings.textSize]);
  const scale = textMetrics.bodyFontSize / 18;
  const scaled = useCallback((size: number) => Math.round(size * scale), [scale]);
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
          <Text style={[styles.dlInlineText, { color: colors.textSecondary, fontSize: Math.round(14 * scale) }]}>
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
          <Ionicons name="checkmark-circle" size={Math.round(18 * scale)} color={colors.secondary} />
          <Text style={[styles.dlInlineText, { color: colors.secondary, fontWeight: "600", fontSize: Math.round(14 * scale) }]}>
            Downloaded
          </Text>
        </TouchableOpacity>
      );
    }

    // Not downloaded
    const sizeLabel = speaker.file_size_mb
      ? `Download (~${Math.round(speaker.file_size_mb)} MB)`
      : "Download";

    return (
      <TouchableOpacity
        style={[styles.dlButton, { backgroundColor: colors.secondaryContainer, borderColor: colors.ghostBorder }]}
        onPress={handleDownloadPress}
        activeOpacity={0.6}
        hitSlop={{ top: 4, bottom: 4, left: 4, right: 4 }}
      >
        <Ionicons name="download-outline" size={Math.round(18 * scale)} color={colors.onSecondaryContainer} />
        <Text
          style={[
            styles.dlButtonText,
            {
              color: colors.onSecondaryContainer,
              fontSize: scaled(typography.bodySmall.fontSize),
              lineHeight: scaled(typography.bodySmall.lineHeight),
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
      {/* Back row */}
      <TouchableOpacity
        style={styles.backButton}
        onPress={onBack}
        activeOpacity={0.7}
        hitSlop={{ top: 8, bottom: 8, left: 8, right: 8 }}
      >
        <Ionicons name="chevron-back" size={Math.round(20 * scale)} color={colors.secondary} />
        <Text
          style={[
            styles.backLabel,
            {
              color: colors.secondary,
              fontSize: scaled(typography.titleMedium.fontSize),
              lineHeight: scaled(typography.titleMedium.lineHeight),
            },
          ]}
        >
          Back
        </Text>
      </TouchableOpacity>

      <ScrollView
        style={styles.scrollView}
        contentContainerStyle={styles.scrollContent}
        showsVerticalScrollIndicator={false}
      >
        {/* Speaker info section */}
        <View style={styles.infoSection}>
          <Text style={[styles.speakerName, { color: colors.text, fontSize: scaled(24) }]}>{speaker.speaker}</Text>
          {speaker.hometown && (
            <Text
              style={[
                styles.hometown,
                {
                  color: colors.textSecondary,
                  fontSize: scaled(typography.bodySmall.fontSize),
                  lineHeight: scaled(typography.bodySmall.lineHeight),
                },
              ]}
            >
              {speaker.hometown}
            </Text>
          )}

          {/* Accent strip */}
          <View style={[styles.accentStrip, { backgroundColor: colors.secondaryContainer }]} />

          <Text
            style={[
              styles.title,
              {
                color: colors.text,
                fontSize: scaled(typography.titleLarge.fontSize),
                lineHeight: scaled(typography.titleLarge.lineHeight),
              },
            ]}
          >
            {speaker.title}
          </Text>
          {speaker.subtitle && (
            <Text
              style={[
                styles.subtitle,
                {
                  color: colors.textSecondary,
                  fontSize: scaled(typography.bodyMedium.fontSize),
                  lineHeight: scaled(typography.bodyMedium.lineHeight),
                },
              ]}
            >
              {speaker.subtitle}
            </Text>
          )}
        </View>

        {/* Quote block */}
        {speaker.quote && (
          <View style={[styles.quoteBlock, { backgroundColor: colors.surfaceContainerLow, borderLeftColor: colors.secondary }]}>
            <Text
              style={[
                styles.quoteText,
                {
                  color: colors.text,
                  fontSize: scaled(typography.bodyLarge.fontSize),
                  lineHeight: scaled(typography.bodyLarge.lineHeight),
                },
              ]}
            >
              &ldquo;{speaker.quote}&rdquo;
            </Text>
          </View>
        )}

        {/* Meta row */}
        <View style={styles.metaRow}>
          {speaker.date && (
            <Text
              style={[
                styles.metaText,
                {
                  color: colors.textSecondary,
                  fontSize: scaled(typography.labelMedium.fontSize),
                  lineHeight: scaled(typography.labelMedium.lineHeight),
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
                  { color: colors.danger, fontSize: scaled(typography.labelMedium.fontSize) },
                ]}
              >
                EXPLICIT
              </Text>
            </View>
          )}
        </View>

        {/* Player card */}
        <View style={[styles.playerCard, { backgroundColor: colors.cardBackground }]}>
          {/* Now Playing + Download indicator */}
          <View style={styles.nowPlayingRow}>
            <View style={styles.nowPlayingLeft}>
              <EqualizerBars isPlaying={player.isPlaying} color={colors.secondary} />
              <Text
                style={[
                  styles.nowPlayingLabel,
                  {
                    color: colors.textSecondary,
                    fontSize: scaled(typography.labelMedium.fontSize),
                    lineHeight: scaled(typography.labelMedium.lineHeight),
                  },
                ]}
              >
                {player.isPlaying ? "Now Playing" : player.isLoaded ? "Paused" : ""}
              </Text>
            </View>
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
                    fontSize: scaled(typography.bodySmall.fontSize),
                    lineHeight: scaled(typography.bodySmall.lineHeight),
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
                    fontSize: scaled(typography.bodySmall.fontSize),
                    lineHeight: scaled(typography.bodySmall.lineHeight),
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
                  fontSize: scaled(typography.labelMedium.fontSize),
                  lineHeight: scaled(typography.labelMedium.lineHeight),
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
                  fontSize: scaled(typography.labelMedium.fontSize),
                  lineHeight: scaled(typography.labelMedium.lineHeight),
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
                    fontSize: scaled(typography.labelMedium.fontSize),
                    lineHeight: scaled(typography.labelMedium.lineHeight),
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
                    fontSize: scaled(typography.labelMedium.fontSize),
                    lineHeight: scaled(typography.labelMedium.lineHeight),
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
                        fontSize: scaled(typography.bodySmall.fontSize),
                        lineHeight: scaled(typography.bodySmall.lineHeight),
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
      </ScrollView>
    </View>
  );
};

// ─── Styles ──────────────────────────────────────────────────────────────────

const styles = StyleSheet.create({
  container: {
    flex: 1,
  },

  // ─── Back Button ───────────────────────────────────────────────────────────
  backButton: {
    flexDirection: "row",
    alignItems: "center",
    gap: layout.spacing.xs + 2,
    paddingHorizontal: layout.spacing.md,
    paddingVertical: layout.spacing.sm + 4,
  },
  backLabel: {
    fontFamily: typography.titleMedium.fontFamily,
    fontSize: typography.titleMedium.fontSize,
    lineHeight: typography.titleMedium.lineHeight,
    letterSpacing: typography.titleMedium.letterSpacing,
  },

  // ─── Scroll ────────────────────────────────────────────────────────────────
  scrollView: {
    flex: 1,
  },
  scrollContent: {
    paddingHorizontal: layout.spacing.lgPlus,
    paddingBottom: layout.spacing.xxl,
  },

  // ─── Info Section ──────────────────────────────────────────────────────────
  infoSection: {
    marginBottom: layout.spacing.md,
  },
  speakerName: {
    fontFamily: fonts.bodyFamilyBold,
    fontSize: 26,
    marginBottom: 2,
  },
  hometown: {
    fontFamily: typography.bodySmall.fontFamily,
    fontSize: typography.bodySmall.fontSize,
    lineHeight: typography.bodySmall.lineHeight,
    letterSpacing: typography.bodySmall.letterSpacing,
    marginBottom: layout.spacing.sm + 2,
  },
  accentStrip: {
    height: 1,
    marginBottom: layout.spacing.sm + 6,
  },
  title: {
    fontFamily: typography.titleLarge.fontFamily,
    fontSize: typography.titleLarge.fontSize,
    lineHeight: typography.titleLarge.lineHeight,
    letterSpacing: typography.titleLarge.letterSpacing,
    marginBottom: layout.spacing.xs + 2,
  },
  subtitle: {
    fontFamily: typography.bodyMedium.fontFamily,
    fontSize: typography.bodyMedium.fontSize,
    lineHeight: typography.bodyMedium.lineHeight,
    letterSpacing: typography.bodyMedium.letterSpacing,
  },

  // ─── Quote Block ───────────────────────────────────────────────────────────
  quoteBlock: {
    borderLeftWidth: 3,
    borderRadius: layout.borderRadius,
    paddingVertical: layout.spacing.sm + 6,
    paddingLeft: layout.spacing.md,
    paddingRight: layout.spacing.sm + 6,
    marginBottom: layout.spacing.md,
  },
  quoteText: {
    fontFamily: typography.bodyLarge.fontFamily,
    fontSize: typography.bodyLarge.fontSize,
    lineHeight: typography.bodyLarge.lineHeight,
    letterSpacing: typography.bodyLarge.letterSpacing,
  },

  // ─── Meta Row ──────────────────────────────────────────────────────────────
  metaRow: {
    flexDirection: "row",
    alignItems: "center",
    gap: layout.spacing.sm + 4,
    marginBottom: layout.spacing.lgPlus,
  },
  metaText: {
    fontFamily: typography.labelMedium.fontFamily,
    fontSize: typography.labelMedium.fontSize,
    lineHeight: typography.labelMedium.lineHeight,
    textTransform: "uppercase",
    letterSpacing: 0.8,
  },
  explicitBadge: {
    paddingHorizontal: layout.spacing.sm,
    paddingVertical: 3,
    borderRadius: layout.spacing.xs,
  },
  explicitText: {
    fontFamily: typography.labelMedium.fontFamily,
    fontSize: typography.labelMedium.fontSize,
    lineHeight: typography.labelMedium.lineHeight,
    fontWeight: "800",
    letterSpacing: 0.8,
  },

  // ─── Player Card ───────────────────────────────────────────────────────────
  playerCard: {
    borderRadius: layout.borderRadiusLarge,
    padding: layout.spacing.lgPlus,
    ...shadows.ambient,
  },

  // ─── Now Playing ───────────────────────────────────────────────────────────
  nowPlayingRow: {
    flexDirection: "row",
    alignItems: "center",
    justifyContent: "space-between",
    marginBottom: layout.spacing.md,
    minHeight: layout.spacing.lgPlus,
  },
  nowPlayingLeft: {
    flexDirection: "row",
    alignItems: "center",
    gap: layout.spacing.sm + 2,
  },
  nowPlayingLabel: {
    fontFamily: typography.labelMedium.fontFamily,
    fontSize: typography.labelMedium.fontSize,
    lineHeight: typography.labelMedium.lineHeight,
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
    fontFamily: typography.bodySmall.fontFamily,
    fontSize: typography.bodySmall.fontSize,
    lineHeight: typography.bodySmall.lineHeight,
    letterSpacing: typography.bodySmall.letterSpacing,
  },
  errorRow: {
    flexDirection: "row",
    alignItems: "center",
    gap: layout.spacing.sm,
    marginBottom: layout.spacing.sm + 4,
  },
  errorText: {
    fontFamily: typography.bodySmall.fontFamily,
    fontSize: typography.bodySmall.fontSize,
    lineHeight: typography.bodySmall.lineHeight,
    letterSpacing: typography.bodySmall.letterSpacing,
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
    fontFamily: typography.labelMedium.fontFamily,
    fontSize: typography.labelMedium.fontSize,
    lineHeight: typography.labelMedium.lineHeight,
    letterSpacing: typography.labelMedium.letterSpacing,
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
    fontFamily: typography.labelMedium.fontFamily,
    fontSize: typography.labelMedium.fontSize,
    lineHeight: typography.labelMedium.lineHeight,
    letterSpacing: typography.labelMedium.letterSpacing,
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
    fontFamily: typography.bodySmall.fontFamily,
    fontSize: typography.bodySmall.fontSize,
    lineHeight: typography.bodySmall.lineHeight,
    letterSpacing: typography.bodySmall.letterSpacing,
  },

  // ─── Download Indicator (inline, top-right) ──────────────────────────────────
  dlInlineRow: {
    flexDirection: "row",
    alignItems: "center",
    gap: layout.spacing.xs + 2,
  },
  dlInlineText: {
    fontFamily: typography.bodySmall.fontFamily,
    fontSize: typography.bodySmall.fontSize,
    lineHeight: typography.bodySmall.lineHeight,
    letterSpacing: typography.bodySmall.letterSpacing,
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
    fontFamily: typography.bodySmall.fontFamily,
    fontSize: typography.bodySmall.fontSize,
    lineHeight: typography.bodySmall.lineHeight,
    letterSpacing: typography.bodySmall.letterSpacing,
  },
});
