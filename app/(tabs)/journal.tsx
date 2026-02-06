import React, { useState, useCallback } from "react";
import { View, Text, StyleSheet, Alert } from "react-native";
import { SafeAreaView } from "react-native-safe-area-context";
import { useTheme } from "../../hooks/useTheme";
import { useAuth } from "../../contexts/AuthContext";
import { useJournalEntries, type JournalEntry } from "../../hooks/useJournalEntries";
import { useJournalStats } from "../../hooks/useJournalStats";
import { JournalTimeline } from "../../components/journal/JournalTimeline";
import { JournalEntryEditor } from "../../components/journal/JournalEntryEditor";
import { JournalEntryDetail } from "../../components/journal/JournalEntryDetail";
import { JournalSearch } from "../../components/journal/JournalSearch";
import { fonts } from "../../constants/theme";

type JournalView = "timeline" | "editor" | "detail" | "search";

export default function JournalTab() {
  const { colors } = useTheme();
  const { user, isAuthenticated } = useAuth();
  const {
    entries,
    loading,
    createEntry,
    updateEntry,
    deleteEntry,
    searchEntries,
    refreshEntries,
  } = useJournalEntries(user?.id);
  const stats = useJournalStats(entries);

  const [view, setView] = useState<JournalView>("timeline");
  const [selectedEntry, setSelectedEntry] = useState<JournalEntry | null>(null);
  const [selectedIndex, setSelectedIndex] = useState(0);

  // ─── Navigation ──────────────────────────────────────────

  const handleNewEntry = useCallback(() => {
    setView("editor");
  }, []);

  const handleSearch = useCallback(() => {
    setView("search");
  }, []);

  const handleSelectEntry = useCallback(
    (entry: JournalEntry) => {
      const idx = entries.findIndex((e) => e.id === entry.id);
      setSelectedEntry(entry);
      setSelectedIndex(idx >= 0 ? idx : 0);
      setView("detail");
    },
    [entries]
  );

  const handleBackToTimeline = useCallback(() => {
    setSelectedEntry(null);
    setView("timeline");
  }, []);

  // ─── CRUD Operations ────────────────────────────────────

  const handleSaveNew = useCallback(
    async (content: string) => {
      await createEntry(content);
      setView("timeline");
    },
    [createEntry]
  );

  const handleSaveEdit = useCallback(
    async (entryId: string, content: string) => {
      const updated = await updateEntry(entryId, content);
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
        <View
          style={[styles.header, { borderBottomColor: colors.border }]}
        >
          <Text style={[styles.headerTitle, { color: colors.text }]}>Journal</Text>
        </View>
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

  if (view === "search") {
    return (
      <JournalSearch
        onSearch={searchEntries}
        onSelectEntry={handleSelectEntry}
        onClose={handleBackToTimeline}
      />
    );
  }

  // Default: Timeline view
  return (
    <SafeAreaView
      style={[styles.container, { backgroundColor: colors.background }]}
      edges={["top"]}
    >
      <View
        style={[styles.header, { borderBottomColor: colors.border }]}
      >
        <Text style={[styles.headerTitle, { color: colors.text }]}>Journal</Text>
      </View>
      <JournalTimeline
        entries={entries}
        stats={stats}
        loading={loading}
        onNewEntry={handleNewEntry}
        onSearch={handleSearch}
        onSelectEntry={handleSelectEntry}
        onDeleteEntry={handleDeleteFromTimeline}
        onRefresh={refreshEntries}
      />
    </SafeAreaView>
  );
}

const styles = StyleSheet.create({
  container: {
    flex: 1,
  },
  header: {
    paddingHorizontal: 20,
    paddingVertical: 16,
    borderBottomWidth: 1,
  },
  headerTitle: {
    fontFamily: fonts.headerFamily,
    fontSize: 28,
    fontWeight: "700",
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
