import React from "react";
import { Pressable, StyleSheet, Text, View } from "react-native";
import { useSafeAreaInsets } from "react-native-safe-area-context";
import { Ionicons } from "@expo/vector-icons";
import { layout, wideType } from "../../constants/theme";
import { useTheme } from "../../hooks/useTheme";
import { useFeaturedSpeaker } from "../../hooks/useFeaturedSpeaker";
import type { AudioPlayer } from "../../hooks/useAudioPlayer";
import type { Speaker } from "../../types/speakers";
import { SpeakersBrowse } from "../speakers/SpeakersBrowse";
import { SpeakerDetail } from "../speakers/SpeakerDetail";

/**
 * Speakers in the wide layout (docs/widescreen-2.9/03): the phone list on
 * the left (search, sort, play icon in each card); the phone player for
 * the open talk on the right. With no talk open, the right side suggests
 * the featured speaker rather than opening one by itself, because opening
 * a talk loads its audio and would interrupt anything already playing.
 * The Speakers tab owns the player and the selection and passes them in.
 */
type Props = {
  speakers: Speaker[];
  loading: boolean;
  error: string | null;
  onRefresh: () => void;
  downloadedIds: Set<string>;
  selectedSpeaker: Speaker | null;
  autoPlay: boolean;
  onSelectSpeaker: (speaker: Speaker, autoPlay: boolean) => void;
  onStop: () => void;
  player: AudioPlayer;
  canDownload: boolean;
};

export function SpeakersWide({
  speakers,
  loading,
  error,
  onRefresh,
  downloadedIds,
  selectedSpeaker,
  autoPlay,
  onSelectSpeaker,
  onStop,
  player,
  canDownload,
}: Props) {
  const { colors } = useTheme();
  const insets = useSafeAreaInsets();
  const featured = useFeaturedSpeaker(speakers);

  return (
    <View style={[styles.root, { backgroundColor: colors.surface, paddingTop: insets.top + 6 }]}>
      {/* Left: the speaker library */}
      <View style={styles.left}>
        <View style={styles.titleBlock}>
          <Text style={[wideType.screenTitle, { color: colors.primaryContainer }]}>Speakers</Text>
          <Text style={[wideType.secondary, { color: colors.onSurfaceVariant }]}>Browse the speaker library</Text>
        </View>
        <SpeakersBrowse
          speakers={speakers}
          loading={loading}
          error={error}
          onSelectSpeaker={onSelectSpeaker}
          onRefresh={onRefresh}
          downloadedIds={downloadedIds}
          nowPlayingSpeakerId={player.isLoaded ? selectedSpeaker?.id ?? null : null}
          isPlaying={player.isPlaying}
          selectedSpeakerId={selectedSpeaker?.id ?? null}
        />
      </View>

      <View style={[styles.divider, { backgroundColor: colors.surfaceContainerHighest }]} />

      {/* Right: the player, or a suggestion */}
      <View style={styles.right}>
        {selectedSpeaker ? (
          <SpeakerDetail
            speaker={selectedSpeaker}
            autoPlay={autoPlay}
            onBack={() => {}}
            onStop={onStop}
            player={player}
            canDownload={canDownload}
          />
        ) : (
          <View style={styles.empty}>
            <Ionicons name="headset-outline" size={36} color={colors.secondary} />
            <Text style={[wideType.paneTitle, styles.center, { color: colors.onSurface }]}>Choose a talk</Text>
            <Text style={[wideType.secondary, styles.center, { color: colors.onSurfaceVariant }]}>
              Pick a speaker from the list to listen here.
            </Text>
            {featured ? (
              <Pressable
                onPress={() => onSelectSpeaker(featured, false)}
                accessibilityRole="button"
                accessibilityLabel={`Featured speaker, ${featured.title}, ${featured.speaker}`}
                style={({ pressed }) => [
                  styles.featured,
                  { backgroundColor: colors.primaryFixed },
                  pressed && styles.pressed,
                ]}
              >
                <Text style={[wideType.smallCaps, styles.caps, styles.onDarkMuted]}>Featured speaker</Text>
                <Text style={[wideType.cardTitle, styles.onDark]} numberOfLines={2}>
                  {featured.title}
                </Text>
                <Text style={[wideType.secondary, styles.onDarkMuted]} numberOfLines={1}>
                  {[featured.speaker, featured.hometown].filter(Boolean).join(" · ")}
                </Text>
              </Pressable>
            ) : null}
          </View>
        )}
      </View>
    </View>
  );
}

const styles = StyleSheet.create({
  root: { flex: 1, flexDirection: "row", paddingLeft: 10 },
  // Fixed proportions (flexBasis 0) so content never shifts the split.
  left: { flexGrow: 0.86, flexBasis: 0, minWidth: 0 },
  right: { flexGrow: 1, flexBasis: 0, minWidth: 0 },
  divider: { width: StyleSheet.hairlineWidth, marginHorizontal: 12 },
  titleBlock: { paddingLeft: 8, paddingBottom: 6 },
  caps: { textTransform: "uppercase" },
  center: { textAlign: "center" },
  pressed: { opacity: 0.85 },
  empty: { flex: 1, alignItems: "center", justifyContent: "center", gap: 10, paddingHorizontal: 40 },
  featured: {
    alignSelf: "stretch",
    maxWidth: 420,
    marginTop: 18,
    marginHorizontal: "auto",
    padding: 18,
    gap: 6,
    borderRadius: layout.borderRadiusLarge,
  },
  onDark: { color: "#FFFFFF" },
  onDarkMuted: { color: "rgba(255,255,255,0.8)" },
});
