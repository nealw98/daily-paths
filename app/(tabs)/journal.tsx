import React, { useState, useCallback, useMemo, useEffect, useRef } from "react";
import { View, Text, StyleSheet, Alert } from "react-native";
import { SafeAreaView } from "react-native-safe-area-context";
import { useNavigation } from "expo-router";
import { useTheme } from "../../hooks/useTheme";
import { useAuth } from "../../contexts/AuthContext";
import { useJournalEntries, type JournalEntry } from "../../hooks/useJournalEntries";
import { useJournalStats } from "../../hooks/useJournalStats";
import { JournalTimeline, type CategoryFilter } from "../../components/journal/JournalTimeline";
import { JournalEntryEditor } from "../../components/journal/JournalEntryEditor";
import { JournalEntryDetail } from "../../components/journal/JournalEntryDetail";
import { JournalCategoryPicker } from "../../components/journal/JournalCategoryPicker";
import { TealHeader } from "../../components/shared/TealHeader";
import { fonts } from "../../constants/theme";
import { getCategoryById, getCategoryLabel, type EntryType } from "../../constants/journalCategories";
import { EntryTypeIcon } from "../../utils/entryTypeIcon";
import { FourSquares } from "../../components/icons";

type JournalView = "timeline" | "editor" | "detail";

export default function JournalTab() {
  const { colors } = useTheme();
  const navigation = useNavigation();
  const { user, isAuthenticated } = useAuth();
  const {
    entries,
    loading,
    createEntry,
    updateEntry,
    deleteEntry,
    refreshEntries,
  } = useJournalEntries(user?.id);
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
      // Background refresh so timeline is up-to-date with other devices
      refreshEntries();
    },
    [entries, refreshEntries]
  );

  const handleBackToTimeline = useCallback(() => {
    setSelectedEntry(null);
    setView("timeline");
  }, []);

  const handleFilterChange = useCallback((filter: CategoryFilter) => {
    setCategoryFilter(filter);
  }, []);

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

  // ─── Not Authenticated ──────────────────────────────────

  if (!isAuthenticated) {
    return (
      <SafeAreaView
        style={[styles.container, { backgroundColor: colors.background }]}
        edges={["top"]}
      >
        <TealHeader title="Journal" />
        <View style={styles.authPrompt}>
          <Text style={[styles.authTitle, { color: colors.textSecondary }]}>
            Sign in to start journaling
          </Text>
          <Text style={[styles.authSubtitle, { color: colors.textSecondary + "80" }]}>
            Your journal entries are private and synced across your devices.
          </Text>
        </View>
      </SafeAreaView>
    );
  }

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
        categoryFilter={categoryFilter}
        onFilterChange={handleFilterChange}
        onNewEntry={handleNewEntry}
        onSelectEntry={handleSelectEntry}
        onDeleteEntry={handleDeleteFromTimeline}
        onRefresh={refreshEntries}
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
  authPrompt: {
    flex: 1,
    alignItems: "center",
    justifyContent: "center",
    paddingHorizontal: 40,
  },
  authTitle: {
    fontFamily: fonts.bodyFamilyRegular,
    fontSize: 18,
    fontWeight: "600",
    marginBottom: 12,
    textAlign: "center",
  },
  authSubtitle: {
    fontFamily: fonts.bodyFamily,
    fontSize: 14,
    textAlign: "center",
    lineHeight: 20,
  },
});
