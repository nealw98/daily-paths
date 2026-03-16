import React, { useState, useCallback, useMemo, useEffect, useRef } from "react";
import { View, Text, StyleSheet, Alert } from "react-native";
import { SafeAreaView } from "react-native-safe-area-context";
import { useNavigation } from "expo-router";
import { useTheme } from "../../hooks/useTheme";
import { useJournalStorage, type JournalEntry, type EntryType } from "../../hooks/useJournalStorage";
import { useJournalStats } from "../../hooks/useJournalStats";
import { useAnalytics } from "../../utils/analytics";
import { useFeatureTimeTracker } from "../../hooks/useFeatureTimeTracker";
import { JournalTimeline, type CategoryFilter } from "../../components/journal/JournalTimeline";
import { JournalEntryEditor } from "../../components/journal/JournalEntryEditor";
import { JournalEntryDetail } from "../../components/journal/JournalEntryDetail";
import { JournalCategoryPicker } from "../../components/journal/JournalCategoryPicker";
import { TealHeader } from "../../components/shared/TealHeader";
import { PremiumGate } from "../../components/PremiumGate";
import { fonts } from "../../constants/theme";
import { getCategoryById, getCategoryLabel } from "../../constants/journalCategories";
import { EntryTypeIcon } from "../../utils/entryTypeIcon";
import { FourSquares } from "../../components/icons";

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
  const stats = useJournalStats(entries);

  const [view, setView] = useState<JournalView>("timeline");
  const viewRef = useRef(view);
  useEffect(() => { viewRef.current = view; }, [view]);
  const [selectedEntry, setSelectedEntry] = useState<JournalEntry | null>(null);
  const [selectedIndex, setSelectedIndex] = useState(0);
  const [selectedEntryType, setSelectedEntryType] = useState<EntryType>("journal");
  const [showCategoryPicker, setShowCategoryPicker] = useState(false);
  const [categoryFilter, setCategoryFilter] = useState<CategoryFilter>("all");

  // Header title and icon reflect the active filter
  const headerTitle = categoryFilter === "all"
    ? "Notebook"
    : getCategoryLabel(categoryFilter);

  const headerIcon = useMemo(() => {
    if (categoryFilter === "all") {
      return <FourSquares size={28} color={colors.textOnAccent} />;
    }
    const cat = getCategoryById(categoryFilter);
    if (!cat) return undefined;
    return <EntryTypeIcon svgIcon={cat.svgIcon} size={28} color={colors.textOnAccent} />;
  }, [categoryFilter, colors.textOnAccent]);

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
      if (viewRef.current !== "timeline") {
        e.preventDefault();
        setSelectedEntry(null);
        setCategoryFilter("all");
        setView("timeline");
      }
    });
    return unsubscribe;
  }, [navigation]);

  // ─── Navigation ──────────────────────────────────────────

  const handleNewEntry = useCallback(() => {
    // Smart FAB: when filtered to a specific type, skip the picker
    if (categoryFilter !== "all") {
      setSelectedEntryType(categoryFilter);
      setView("editor");
    } else {
      setShowCategoryPicker(true);
    }
  }, [categoryFilter]);

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

  const handleFilterChange = useCallback((filter: CategoryFilter) => {
    setCategoryFilter(filter);
  }, []);

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
        entryType={selectedEntryType}
        onSave={handleSaveNew}
        onCancel={handleBackToTimeline}
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
        onPrev={handlePrev}
        onNext={handleNext}
        hasPrev={selectedIndex < entries.length - 1}
        hasNext={selectedIndex > 0}
      />
    );
  }

  // Default: Timeline view
  return (
    <SafeAreaView
      style={[styles.container, { backgroundColor: colors.background }]}
      edges={["top"]}
    >
      <TealHeader
        title={headerTitle}
        leftIcon={headerIcon}
      />
      <JournalTimeline
        entries={entries}
        stats={stats}
        loading={loading}
        error={error}
        categoryFilter={categoryFilter}
        onFilterChange={handleFilterChange}
        onNewEntry={handleNewEntry}
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
