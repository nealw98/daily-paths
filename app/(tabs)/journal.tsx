import React, { useState, useCallback, useMemo, useEffect, useRef } from "react";
import { StyleSheet, Alert } from "react-native";
import { SafeAreaView } from "react-native-safe-area-context";
import { useFocusEffect } from "@react-navigation/native";
import { useNavigation } from "expo-router";
import { useTheme } from "../../hooks/useTheme";
import { useJournalStorage, type JournalEntry, type EntryType } from "../../hooks/useJournalStorage";
import { computeJournalStreak } from "../../utils/journalStreak";
import { useAnalytics } from "../../utils/analytics";
import { useFeatureTimeTracker } from "../../hooks/useFeatureTimeTracker";
import { JournalTimeline } from "../../components/journal/JournalTimeline";
import { JournalEntryEditor } from "../../components/journal/JournalEntryEditor";
import { JournalEntryDetail } from "../../components/journal/JournalEntryDetail";
import { JournalCategoryPicker } from "../../components/journal/JournalCategoryPicker";
import { TealHeader } from "../../components/shared/TealHeader";
import { PageTitle } from "../../components/ui/PageTitle";
import { PremiumGate } from "../../components/PremiumGate";

type JournalView = "timeline" | "editor" | "detail";

export default function JournalTab() {
  return (
    <PremiumGate>
      <JournalTabContent />
    </PremiumGate>
  );
}

function JournalTabContent() {
  const { colors } = useTheme();
  const navigation = useNavigation();
  const { trackNotebookOpened, trackEntryViewed } = useAnalytics();
  const {
    entries,
    loading,
    error,
    createEntry,
    updateEntry,
    deleteEntry,
    refreshEntries,
  } = useJournalStorage();
  // Small subtitle shown under the "Notebook" page title — replaces the
  // former stat tiles. Always shows both count + streak (including 0).
  const notebookSubtitle = useMemo(() => {
    const total = entries.length;
    if (total === 0) return "Your journal entries";
    const streak = computeJournalStreak(entries);
    const entriesLabel = `${total} ${total === 1 ? "entry" : "entries"}`;
    return `${entriesLabel} · ${streak} day streak`;
  }, [entries]);

  // Reload from storage when the tab is focused so entries created elsewhere (e.g. Home) appear.
  useFocusEffect(
    useCallback(() => {
      void refreshEntries({ silent: true });
    }, [refreshEntries])
  );

  const [view, setView] = useState<JournalView>("timeline");
  const viewRef = useRef(view);
  useEffect(() => { viewRef.current = view; }, [view]);
  const [selectedEntry, setSelectedEntry] = useState<JournalEntry | null>(null);
  const [selectedIndex, setSelectedIndex] = useState(0);
  const [selectedEntryType, setSelectedEntryType] = useState<EntryType>("journal");
  const [showCategoryPicker, setShowCategoryPicker] = useState(false);

  // ─── Track notebook opened on tab focus ─────────────────────────
  const [tabFocused, setTabFocused] = useState(false);
  useEffect(() => {
    const unFocus = navigation.addListener("focus" as any, () => {
      trackNotebookOpened();
      setTabFocused(true);
    });
    const unBlur = navigation.addListener("blur" as any, () => {
      setTabFocused(false);
    });
    return () => { unFocus(); unBlur(); };
  }, [navigation, trackNotebookOpened]);

  // Track cumulative time in the notebook tab for rate prompt
  useFeatureTimeTracker("notebook", tabFocused);

  // ─── Tab press → always return to "all" timeline ─────────────────
  useEffect(() => {
    const unsubscribe = navigation.addListener("tabPress" as any, (e: any) => {
      if (viewRef.current === "editor") {
        // Let the editor-level guard handle save/discard + navigation.
        return;
      }
      if (viewRef.current !== "timeline") {
        e.preventDefault();
        setSelectedEntry(null);
        setView("timeline");
      }
    });
    return unsubscribe;
  }, [navigation]);

  // ─── Navigation ──────────────────────────────────────────

  const handleNewEntry = useCallback(() => {
    setShowCategoryPicker(true);
  }, []);

  const handleCategorySelected = useCallback((entryType: EntryType) => {
    setShowCategoryPicker(false);
    setSelectedEntryType(entryType);
    setView("editor");
  }, []);

  const handleSelectEntry = useCallback(
    (entry: JournalEntry) => {
      const idx = entries.findIndex((e) => e.id === entry.id);
      setSelectedEntry(entry);
      setSelectedIndex(idx >= 0 ? idx : 0);
      setView("detail");
      trackEntryViewed(entry.entry_type, entry.id);
    },
    [entries, trackEntryViewed]
  );

  const handleBackToTimeline = useCallback(() => {
    setSelectedEntry(null);
    setView("timeline");
    void refreshEntries();
  }, [refreshEntries]);

  const handleRefreshTimeline = useCallback(() => {
    void refreshEntries();
  }, [refreshEntries]);

  // ─── CRUD Operations ────────────────────────────────────

  const handleSaveNew = useCallback(
    async (
      entryType: EntryType,
      content: string | null,
      structuredContent?: Record<string, any> | null
    ) => {
      await createEntry(entryType, content, structuredContent);
      setView("timeline");
    },
    [createEntry]
  );

  const handleSaveEdit = useCallback(
    async (
      entryId: string,
      content: string | null,
      structuredContent?: Record<string, any> | null
    ) => {
      const updated = await updateEntry(entryId, content, structuredContent);
      if (updated) {
        setSelectedEntry(updated);
      }
    },
    [updateEntry]
  );

  const handleDeleteFromTimeline = useCallback(
    (entryId: string) => {
      Alert.alert("Delete Entry?", "This cannot be undone.", [
        { text: "Cancel", style: "cancel" },
        {
          text: "Delete",
          style: "destructive",
          onPress: async () => {
            await deleteEntry(entryId);
          },
        },
      ]);
    },
    [deleteEntry]
  );

  const handleDeleteFromDetail = useCallback(
    async (entryId: string) => {
      await deleteEntry(entryId);
    },
    [deleteEntry]
  );

  // ─── Prev/Next Navigation ───────────────────────────────

  const handlePrev = useCallback(() => {
    if (selectedIndex < entries.length - 1) {
      const newIndex = selectedIndex + 1;
      setSelectedIndex(newIndex);
      setSelectedEntry(entries[newIndex]);
    }
  }, [selectedIndex, entries]);

  const handleNext = useCallback(() => {
    if (selectedIndex > 0) {
      const newIndex = selectedIndex - 1;
      setSelectedIndex(newIndex);
      setSelectedEntry(entries[newIndex]);
    }
  }, [selectedIndex, entries]);

  // ─── Render Current View ─────────────────────────────────

  if (view === "editor") {
    return (
      <JournalEntryEditor
        key={selectedEntryType}
        entryType={selectedEntryType}
        onSave={handleSaveNew}
        onCancel={handleBackToTimeline}
        onSwitchEntryType={setSelectedEntryType}
      />
    );
  }

  if (view === "detail" && selectedEntry) {
    return (
      <JournalEntryDetail
        entry={selectedEntry}
        onBack={handleBackToTimeline}
        onSave={handleSaveEdit}
        onDelete={handleDeleteFromDetail}
      />
    );
  }

  // Default: Timeline view
  return (
    <SafeAreaView
      style={[styles.container, { backgroundColor: colors.surface }]}
      edges={[]}
    >
      <TealHeader />
      <PageTitle title="Notebook" subtitle={notebookSubtitle} size="lg" />
      <JournalTimeline
        entries={entries}
        loading={loading}
        error={error}
        onCreateEntry={handleNewEntry}
        onSelectEntry={handleSelectEntry}
        onDeleteEntry={handleDeleteFromTimeline}
        onRefresh={handleRefreshTimeline}
      />
      <JournalCategoryPicker
        visible={showCategoryPicker}
        onSelect={handleCategorySelected}
        onClose={() => setShowCategoryPicker(false)}
      />
    </SafeAreaView>
  );
}

const styles = StyleSheet.create({
  container: {
    flex: 1,
  },
});
