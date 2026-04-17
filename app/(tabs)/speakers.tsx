import React, { useState, useCallback, useEffect, useRef } from "react";
import { AppState, AppStateStatus, StyleSheet, TouchableOpacity } from "react-native";
import { SafeAreaView } from "react-native-safe-area-context";
import { useNavigation, useLocalSearchParams, useRouter } from "expo-router";
import { Ionicons, MaterialIcons } from "@expo/vector-icons";
import { useTheme } from "../../hooks/useTheme";
import { useSpeakers } from "../../hooks/useSpeakers";
import { useAudioPlayer } from "../../hooks/useAudioPlayer";
import { useAnalytics } from "../../utils/analytics";
import { useFeatureTimeTracker } from "../../hooks/useFeatureTimeTracker";
import { useSubscription } from "../../hooks/useSubscription";
import { useTrialStatus } from "../../hooks/useTrialStatus";
import { useDownloadedSpeakerIds } from "../../hooks/useSpeakerDownload";
import { canDownloadSpeakers } from "../../utils/accessControl";
import { TealHeader } from "../../components/shared/TealHeader";
import { SpeakersBrowse } from "../../components/speakers/SpeakersBrowse";
import { SpeakerDetail } from "../../components/speakers/SpeakerDetail";
import { JournalCategoryPicker } from "../../components/journal/JournalCategoryPicker";
import { JournalEntryEditor } from "../../components/journal/JournalEntryEditor";
import { PremiumGate } from "../../components/PremiumGate";
import type { Speaker } from "../../types/speakers";
import type { EntryType } from "../../constants/journalCategories";
import { useJournalStorage } from "../../hooks/useJournalStorage";

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
  const router = useRouter();
  const params = useLocalSearchParams<{ speakerId?: string }>();
  const { speakers, loading, error, refresh } = useSpeakers();
  const { trackSpeakerAudioCompleted } = useAnalytics();
  const { status: subscriptionStatus, hasLifetimeAccess } = useSubscription();
  const trialStatus = useTrialStatus();
  const { createEntry } = useJournalStorage();

  // Download access is entitlement-driven.
  const canDownload = canDownloadSpeakers(subscriptionStatus, trialStatus, hasLifetimeAccess);

  // Track which speakers are downloaded (for browse screen badges)
  const { downloadedIds, refresh: refreshDownloads } = useDownloadedSpeakerIds();

  // Audio player lives at the tab level so playback persists across views and tabs
  const player = useAudioPlayer();

  const [view, setView] = useState<SpeakerView>("browse");
  const [showJournalPicker, setShowJournalPicker] = useState(false);
  const [journalEntryType, setJournalEntryType] = useState<EntryType | null>(null);
  const viewRef = useRef(view);
  useEffect(() => {
    viewRef.current = view;
  }, [view]);

  const [selectedSpeaker, setSelectedSpeaker] = useState<Speaker | null>(null);
  const [autoPlay, setAutoPlay] = useState(false);
  const handledSpeakerIdRef = useRef<string | null>(null);

  // Deep-link: open a specific speaker from the home page.
  //
  // Runs after paint, but the isResolvingDeepLink placeholder below swaps
  // in for the browse list during this one-frame window so the user never
  // sees the list flash. We can't use useLayoutEffect here because
  // router.setParams runs too early in expo-router's mount sequence on
  // first render and throws "Attempted to navigate before mounting the
  // Root Layout".
  //
  // The ref de-dupes against React re-firing the effect for the same param
  // before setParams clears it; we reset it the moment the param is cleared
  // so a subsequent navigation to the SAME featured speaker (common, since
  // the featured speaker is pinned for a week) still opens detail.
  useEffect(() => {
    if (!params?.speakerId) {
      handledSpeakerIdRef.current = null;
      return;
    }
    if (speakers.length === 0) return;
    if (handledSpeakerIdRef.current === params.speakerId) return;
    handledSpeakerIdRef.current = params.speakerId;
    const match = speakers.find((s) => s.id === params.speakerId);
    if (match) {
      setSelectedSpeaker(match);
      setView("detail");
    }
    router.setParams({ speakerId: undefined });
  }, [params?.speakerId, speakers]);

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
      // Refresh download state when returning to the tab
      refreshDownloads();
    });
    return unsubscribe;
  }, [navigation, speakers.length, loading, refresh, refreshDownloads]);

  // Re-fetch speakers when the app returns from background so the list doesn't go stale
  useEffect(() => {
    const handleAppStateChange = (nextAppState: AppStateStatus) => {
      if (nextAppState === "active") {
        refresh();
        refreshDownloads();
      }
    };
    const subscription = AppState.addEventListener("change", handleAppStateChange);
    return () => subscription?.remove();
  }, [refresh, refreshDownloads]);

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
    // Keep selectedSpeaker so browse list can show now-playing indicator
    setView("browse");
    // Refresh download IDs when returning to browse so badge reflects any changes
    refreshDownloads();
  }, [refreshDownloads]);

  const handleStop = useCallback(() => {
    player.unload();
    setSelectedSpeaker(null);
    setView("browse");
    refreshDownloads();
  }, [player, refreshDownloads]);

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

  // ─── Detail View ──────────────────────────────────────────────────────

  if (view === "detail" && selectedSpeaker) {
    return (
      <SafeAreaView
        style={[styles.container, { backgroundColor: colors.surface }]}
        edges={["top"]}
      >
        <TealHeader
          title="Audio Player"
          onBack={handleBack}
        />
        <SpeakerDetail
          speaker={selectedSpeaker}
          autoPlay={autoPlay}
          onBack={handleBack}
          onStop={handleStop}
          player={player}
          canDownload={canDownload}
        />
      </SafeAreaView>
    );
  }

  // ─── Browse View (default) ────────────────────────────────────────────

  return (
    <SafeAreaView
      style={[styles.container, { backgroundColor: colors.surface }]}
      edges={["top"]}
    >
      <TealHeader title="Speakers" />
      <SpeakersBrowse
        speakers={speakers}
        loading={loading}
        error={error}
        onSelectSpeaker={handleSelectSpeaker}
        onRefresh={refresh}
        downloadedIds={downloadedIds}
        nowPlayingSpeakerId={player.isLoaded ? selectedSpeaker?.id ?? null : null}
        isPlaying={player.isPlaying}
      />
      <JournalCategoryPicker
        visible={showJournalPicker}
        onSelect={(entryType) => {
          setShowJournalPicker(false);
          setJournalEntryType(entryType);
        }}
        onClose={() => setShowJournalPicker(false)}
      />
    </SafeAreaView>
  );
}

const styles = StyleSheet.create({
  container: {
    flex: 1,
  },
  headerAdd: {
    width: 40,
    height: 40,
    alignItems: "center",
    justifyContent: "center",
  },
});
