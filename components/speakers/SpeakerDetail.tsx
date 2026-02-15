import React, { useEffect, useRef, useState } from "react";
import {
  View,
  Text,
  ScrollView,
  TouchableOpacity,
  StyleSheet,
  ActivityIndicator,
  Pressable,
  LayoutChangeEvent,
} from "react-native";
import { Ionicons } from "@expo/vector-icons";
import { useTheme } from "../../hooks/useTheme";
import { fonts } from "../../constants/theme";
import { EqualizerBars } from "./EqualizerBars";
import { getSpeakerAudioUrl } from "../../hooks/useSpeakers";
import type { Speaker } from "../../types/speakers";
import type { AudioPlayer } from "../../hooks/useAudioPlayer";

// ─── Types ─────────────────────────────────────────────────────────────────

interface SpeakerDetailProps {
  speaker: Speaker;
  autoPlay: boolean;
  onBack: () => void;
  player: AudioPlayer;
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
}) => {
  const { colors } = useTheme();
  const [trackWidth, setTrackWidth] = useState(0);
  const hasLoadedRef = useRef(false);

  // Load audio on mount (or when speaker changes)
  useEffect(() => {
    const audioUrl = getSpeakerAudioUrl(speaker);
    // Only load if this is a new speaker or first mount
    if (!hasLoadedRef.current) {
      hasLoadedRef.current = true;
      player.load(audioUrl, autoPlay);
    }
  }, [speaker.id]); // eslint-disable-line react-hooks/exhaustive-deps

  // Reset load tracking when speaker changes
  useEffect(() => {
    hasLoadedRef.current = false;
  }, [speaker.id]);

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

  // ─── Render ─────────────────────────────────────────────────────────────

  return (
    <View style={styles.container}>
      {/* Back button header */}
      <TouchableOpacity
        style={styles.backButton}
        onPress={onBack}
        activeOpacity={0.7}
        hitSlop={{ top: 8, bottom: 8, left: 8, right: 8 }}
      >
        <Ionicons name="arrow-back" size={22} color={colors.accent} />
        <Text style={[styles.backLabel, { color: colors.accent }]}>Speakers</Text>
      </TouchableOpacity>

      <ScrollView
        style={styles.scrollView}
        contentContainerStyle={styles.scrollContent}
        showsVerticalScrollIndicator={false}
      >
        {/* Speaker info section */}
        <View style={styles.infoSection}>
          <Text style={[styles.speakerName, { color: colors.text }]}>{speaker.speaker}</Text>
          {speaker.hometown && (
            <Text style={[styles.hometown, { color: colors.textSecondary }]}>{speaker.hometown}</Text>
          )}

          {/* Accent strip */}
          <View style={[styles.accentStrip, { backgroundColor: colors.accent + "30" }]} />

          <Text style={[styles.title, { color: colors.text }]}>{speaker.title}</Text>
          {speaker.subtitle && (
            <Text style={[styles.subtitle, { color: colors.textSecondary }]}>{speaker.subtitle}</Text>
          )}
        </View>

        {/* Quote block */}
        {speaker.quote && (
          <View style={[styles.quoteBlock, { backgroundColor: colors.cardBackground, borderLeftColor: colors.accent }]}>
            <Text style={[styles.quoteText, { color: colors.text }]}>
              &ldquo;{speaker.quote}&rdquo;
            </Text>
          </View>
        )}

        {/* Meta row */}
        <View style={styles.metaRow}>
          {speaker.date && (
            <Text style={[styles.metaText, { color: colors.textSecondary }]}>
              {formatDate(speaker.date)}
            </Text>
          )}
          {speaker.explicit && (
            <View style={[styles.explicitBadge, { backgroundColor: colors.danger + "15" }]}>
              <Text style={[styles.explicitText, { color: colors.danger }]}>EXPLICIT</Text>
            </View>
          )}
        </View>

        {/* Player card */}
        <View style={[styles.playerCard, { backgroundColor: colors.cardBackground }]}>
          {/* Now Playing indicator */}
          <View style={styles.nowPlayingRow}>
            <EqualizerBars isPlaying={player.isPlaying} color={colors.accent} />
            <Text style={[styles.nowPlayingLabel, { color: colors.textSecondary }]}>
              {player.isPlaying ? "Now Playing" : player.isLoaded ? "Paused" : ""}
            </Text>
          </View>

          {/* Loading / Error states */}
          {player.isBuffering && !player.isLoaded && (
            <View style={styles.loadingRow}>
              <ActivityIndicator size="small" color={colors.accent} />
              <Text style={[styles.loadingText, { color: colors.textSecondary }]}>Loading audio...</Text>
            </View>
          )}

          {player.loadError && (
            <View style={styles.errorRow}>
              <Ionicons name="alert-circle-outline" size={18} color={colors.danger} />
              <Text style={[styles.errorText, { color: colors.danger }]}>
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
                    backgroundColor: colors.accent,
                    width: `${progress * 100}%`,
                  },
                ]}
              />
              {/* Thumb */}
              <View
                style={[
                  styles.progressThumb,
                  {
                    backgroundColor: colors.accent,
                    left: `${progress * 100}%`,
                  },
                ]}
              />
            </View>
          </Pressable>

          {/* Time labels */}
          <View style={styles.timeRow}>
            <Text style={[styles.timeText, { color: colors.textSecondary }]}>
              {formatTime(player.positionMs)}
            </Text>
            <Text style={[styles.timeText, { color: colors.textSecondary }]}>
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
              <Ionicons name="play-back" size={24} color={colors.text} />
              <Text style={[styles.skipLabel, { color: colors.textSecondary }]}>15s</Text>
            </TouchableOpacity>

            {/* Play/Pause */}
            <TouchableOpacity
              style={[styles.playPauseButton, { backgroundColor: colors.accent }]}
              onPress={player.isPlaying ? player.pause : player.play}
              activeOpacity={0.7}
            >
              <Ionicons
                name={player.isPlaying ? "pause" : "play"}
                size={32}
                color={colors.textOnAccent}
                style={!player.isPlaying ? styles.playIconOffset : undefined}
              />
            </TouchableOpacity>

            {/* Skip forward 30s */}
            <TouchableOpacity
              style={styles.skipButton}
              onPress={() => player.seekBy(30)}
              activeOpacity={0.6}
            >
              <Ionicons name="play-forward" size={24} color={colors.text} />
              <Text style={[styles.skipLabel, { color: colors.textSecondary }]}>30s</Text>
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
                      backgroundColor: isActive ? colors.accent : "transparent",
                      borderColor: isActive ? colors.accent : colors.border,
                    },
                  ]}
                  onPress={() => player.setRate(speed)}
                  activeOpacity={0.7}
                >
                  <Text
                    style={[
                      styles.speedLabel,
                      {
                        color: isActive ? colors.textOnAccent : colors.textSecondary,
                        fontWeight: isActive ? "700" : "400",
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
    gap: 6,
    paddingHorizontal: 16,
    paddingVertical: 12,
  },
  backLabel: {
    fontFamily: fonts.bodyFamilyRegular,
    fontSize: 16,
    fontWeight: "600",
  },

  // ─── Scroll ────────────────────────────────────────────────────────────────
  scrollView: {
    flex: 1,
  },
  scrollContent: {
    paddingHorizontal: 20,
    paddingBottom: 40,
  },

  // ─── Info Section ──────────────────────────────────────────────────────────
  infoSection: {
    marginBottom: 16,
  },
  speakerName: {
    fontFamily: fonts.loraBold,
    fontSize: 26,
    marginBottom: 2,
  },
  hometown: {
    fontFamily: fonts.bodyFamilyRegular,
    fontSize: 15,
    marginBottom: 10,
  },
  accentStrip: {
    height: 1,
    marginBottom: 14,
  },
  title: {
    fontFamily: fonts.loraItalic,
    fontSize: 20,
    marginBottom: 6,
  },
  subtitle: {
    fontFamily: fonts.bodyFamilyRegular,
    fontSize: 16,
    lineHeight: 24,
  },

  // ─── Quote Block ───────────────────────────────────────────────────────────
  quoteBlock: {
    borderLeftWidth: 3,
    borderRadius: 8,
    paddingVertical: 14,
    paddingLeft: 16,
    paddingRight: 14,
    marginBottom: 16,
  },
  quoteText: {
    fontFamily: fonts.loraItalic,
    fontSize: 16,
    lineHeight: 24,
  },

  // ─── Meta Row ──────────────────────────────────────────────────────────────
  metaRow: {
    flexDirection: "row",
    alignItems: "center",
    gap: 12,
    marginBottom: 20,
  },
  metaText: {
    fontFamily: fonts.bodyFamilyRegular,
    fontSize: 13,
    textTransform: "uppercase",
    letterSpacing: 0.8,
  },
  explicitBadge: {
    paddingHorizontal: 8,
    paddingVertical: 3,
    borderRadius: 4,
  },
  explicitText: {
    fontFamily: fonts.bodyFamilyRegular,
    fontSize: 10,
    fontWeight: "800",
    letterSpacing: 0.8,
  },

  // ─── Player Card ───────────────────────────────────────────────────────────
  playerCard: {
    borderRadius: 16,
    padding: 20,
    shadowColor: "#000",
    shadowOffset: { width: 0, height: 1 },
    shadowOpacity: 0.04,
    shadowRadius: 3,
    elevation: 1,
  },

  // ─── Now Playing ───────────────────────────────────────────────────────────
  nowPlayingRow: {
    flexDirection: "row",
    alignItems: "center",
    gap: 10,
    marginBottom: 16,
    minHeight: 20,
  },
  nowPlayingLabel: {
    fontFamily: fonts.bodyFamilyRegular,
    fontSize: 13,
    fontWeight: "600",
    textTransform: "uppercase",
    letterSpacing: 0.8,
  },

  // ─── Loading / Error ───────────────────────────────────────────────────────
  loadingRow: {
    flexDirection: "row",
    alignItems: "center",
    gap: 10,
    marginBottom: 12,
  },
  loadingText: {
    fontFamily: fonts.bodyFamilyRegular,
    fontSize: 14,
  },
  errorRow: {
    flexDirection: "row",
    alignItems: "center",
    gap: 8,
    marginBottom: 12,
  },
  errorText: {
    fontFamily: fonts.bodyFamilyRegular,
    fontSize: 14,
    flex: 1,
  },

  // ─── Progress Bar ──────────────────────────────────────────────────────────
  progressContainer: {
    paddingVertical: 8,
  },
  progressTrack: {
    height: 4,
    borderRadius: 2,
    position: "relative",
  },
  progressFill: {
    position: "absolute",
    left: 0,
    top: 0,
    bottom: 0,
    borderRadius: 2,
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
    marginBottom: 16,
  },
  timeText: {
    fontFamily: fonts.bodyFamily,
    fontSize: 12,
  },

  // ─── Transport Controls ────────────────────────────────────────────────────
  transportRow: {
    flexDirection: "row",
    alignItems: "center",
    justifyContent: "center",
    gap: 32,
    marginBottom: 20,
  },
  skipButton: {
    alignItems: "center",
    gap: 2,
  },
  skipLabel: {
    fontFamily: fonts.bodyFamily,
    fontSize: 11,
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
    gap: 10,
  },
  speedPill: {
    paddingHorizontal: 16,
    paddingVertical: 8,
    borderRadius: 20,
    borderWidth: 1,
  },
  speedLabel: {
    fontFamily: fonts.bodyFamilyRegular,
    fontSize: 13,
  },
});
