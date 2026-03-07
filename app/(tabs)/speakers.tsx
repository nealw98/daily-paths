import React, { useState, useCallback, useEffect, useRef } from "react";
import { View, StyleSheet } from "react-native";
import { SafeAreaView } from "react-native-safe-area-context";
import { useNavigation } from "expo-router";
import { useTheme } from "../../hooks/useTheme";
import { useSpeakers, getSpeakerAudioUrl } from "../../hooks/useSpeakers";
import { useAudioPlayer } from "../../hooks/useAudioPlayer";
import { useAnalytics } from "../../utils/analytics";
import { useFeatureTimeTracker } from "../../hooks/useFeatureTimeTracker";
import { TealHeader } from "../../components/shared/TealHeader";
import { Microphone } from "../../components/icons";
import { SpeakersBrowse } from "../../components/speakers/SpeakersBrowse";
import { SpeakerDetail } from "../../components/speakers/SpeakerDetail";
import { PremiumGate } from "../../components/PremiumGate";
import type { Speaker } from "../../types/speakers";

type SpeakerView = "browse" | "detail";

export default function SpeakersTab() {
  return (
    <PremiumGate>
      <SpeakersTabContent />
    </PremiumGate>
  );
}

function SpeakersTabContent() {
  const { colors } = useTheme();
  const navigation = useNavigation();
  const { speakers, loading, error, refresh } = useSpeakers();
  const { trackSpeakerAudioCompleted } = useAnalytics();

  // Audio player lives at the tab level so playback persists across views and tabs
  const player = useAudioPlayer();

  const [view, setView] = useState<SpeakerView>("browse");
  const viewRef = useRef(view);
  useEffect(() => {
    viewRef.current = view;
  }, [view]);

  const [selectedSpeaker, setSelectedSpeaker] = useState<Speaker | null>(null);
  const [autoPlay, setAutoPlay] = useState(false);

  // Track speaker audio completion
  useEffect(() => {
    if (player.didJustFinish && selectedSpeaker) {
      trackSpeakerAudioCompleted(
        selectedSpeaker.id,
        selectedSpeaker.speaker,
        player.durationMs,
      );
    }
  }, [player.didJustFinish]); // eslint-disable-line react-hooks/exhaustive-deps

  // Re-fetch speakers on tab focus if the initial mount-time fetch returned empty.
  // All tabs mount simultaneously on app launch, so the initial fetch can race with
  // Supabase session restoration and return 0 rows.
  useEffect(() => {
    const unsubscribe = navigation.addListener("focus" as any, () => {
      if (speakers.length === 0 && !loading) {
        refresh();
      }
    });
    return unsubscribe;
  }, [navigation, speakers.length, loading, refresh]);

  // Track cumulative time in the speakers tab for rate prompt
  const [tabFocused, setTabFocused] = useState(false);
  useEffect(() => {
    const unFocus = navigation.addListener("focus" as any, () => {
      setTabFocused(true);
    });
    const unBlur = navigation.addListener("blur" as any, () => {
      setTabFocused(false);
    });
    return () => { unFocus(); unBlur(); };
  }, [navigation]);
  useFeatureTimeTracker("speaker", tabFocused);

  // Tab press resets to browse (audio keeps playing)
  useEffect(() => {
    const unsubscribe = navigation.addListener("tabPress" as any, (e: any) => {
      if (viewRef.current !== "browse") {
        e.preventDefault();
        setSelectedSpeaker(null);
        setView("browse");
      }
    });
    return unsubscribe;
  }, [navigation]);

  const handleSelectSpeaker = useCallback(
    (speaker: Speaker, shouldAutoPlay: boolean) => {
      setSelectedSpeaker(speaker);
      setAutoPlay(shouldAutoPlay);
      setView("detail");
    },
    []
  );

  const handleBack = useCallback(() => {
    setSelectedSpeaker(null);
    setView("browse");
  }, []);

  // ─── Detail View ──────────────────────────────────────────────────────

  if (view === "detail" && selectedSpeaker) {
    return (
      <SafeAreaView
        style={[styles.container, { backgroundColor: colors.background }]}
        edges={["top"]}
      >
        <TealHeader
          title="Speakers"
          leftIcon={<Microphone size={28} color={colors.textOnAccent} />}
        />
        <SpeakerDetail
          speaker={selectedSpeaker}
          autoPlay={autoPlay}
          onBack={handleBack}
          player={player}
        />
      </SafeAreaView>
    );
  }

  // ─── Browse View (default) ────────────────────────────────────────────

  return (
    <SafeAreaView
      style={[styles.container, { backgroundColor: colors.background }]}
      edges={["top"]}
    >
      <TealHeader
        title="Speakers"
        leftIcon={<Microphone size={28} color={colors.textOnAccent} />}
      />
      <SpeakersBrowse
        speakers={speakers}
        loading={loading}
        error={error}
        onSelectSpeaker={handleSelectSpeaker}
        onRefresh={refresh}
      />
    </SafeAreaView>
  );
}

const styles = StyleSheet.create({
  container: {
    flex: 1,
  },
});
