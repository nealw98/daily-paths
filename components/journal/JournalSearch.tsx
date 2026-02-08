import React, { useState, useRef, useCallback } from "react";
import {
  View,
  Text,
  TextInput,
  TouchableOpacity,
  StyleSheet,
  FlatList,
} from "react-native";
import { SafeAreaView } from "react-native-safe-area-context";
import { Ionicons } from "@expo/vector-icons";
import { useTheme } from "../../hooks/useTheme";
import { fonts } from "../../constants/theme";
import type { JournalEntry } from "../../hooks/useJournalEntries";
import {
  getCategoryById,
  getCategoryLabel,
  getCategoryColor,
  getCategoryBgColor,
  type EntryType,
} from "../../constants/journalCategories";

interface JournalSearchProps {
  onSearch: (query: string) => Promise<JournalEntry[]>;
  onSelectEntry: (entry: JournalEntry) => void;
  onClose: () => void;
}

export const JournalSearch: React.FC<JournalSearchProps> = ({
  onSearch,
  onSelectEntry,
  onClose,
}) => {
  const { colors } = useTheme();
  const [query, setQuery] = useState("");
  const [results, setResults] = useState<JournalEntry[]>([]);
  const [searched, setSearched] = useState(false);
  const inputRef = useRef<TextInput>(null);
  const debounceRef = useRef<ReturnType<typeof setTimeout>>(undefined);

  const handleSearch = useCallback(
    async (text: string) => {
      setQuery(text);

      if (debounceRef.current) {
        clearTimeout(debounceRef.current);
      }

      if (text.trim().length === 0) {
        setResults([]);
        setSearched(false);
        return;
      }

      debounceRef.current = setTimeout(async () => {
        const searchResults = await onSearch(text);
        setResults(searchResults);
        setSearched(true);
      }, 300);
    },
    [onSearch]
  );

  const highlightText = (text: string, searchQuery: string) => {
    if (!searchQuery.trim()) return text;

    const parts = text.split(new RegExp(`(${searchQuery.replace(/[.*+?^${}()|[\]\\]/g, '\\$&')})`, "gi"));

    return parts.map((part, i) =>
      part.toLowerCase() === searchQuery.toLowerCase() ? (
        <Text key={i} style={{ backgroundColor: colors.highlight + "40", fontWeight: "600" }}>
          {part}
        </Text>
      ) : (
        <Text key={i}>{part}</Text>
      )
    );
  };

  const renderResult = ({ item }: { item: JournalEntry }) => {
    const date = new Date(item.created_at);
    const dateStr = date.toLocaleDateString("en-US", {
      month: "short",
      day: "numeric",
      year: "numeric",
    });

    const entryType = (item.entry_type || "journal") as EntryType;
    const catConfig = getCategoryById(entryType);
    const catLabel = getCategoryLabel(entryType);
    const catColor = getCategoryColor(entryType);
    const catBgColor = getCategoryBgColor(entryType);

    // Show a snippet around the match
    const content = item.content ?? "";
    const preview = content.length > 150
      ? content.substring(0, 150).trim() + "..."
      : content;

    return (
      <TouchableOpacity
        style={[styles.resultCard, { backgroundColor: colors.cardBackground }]}
        onPress={() => onSelectEntry(item)}
        activeOpacity={0.7}
      >
        {/* Top color strip */}
        <View style={[styles.colorStrip, { backgroundColor: catColor }]} />

        <View style={styles.resultInner}>
          {/* Header row: badge + date */}
          <View style={styles.resultHeader}>
            <View style={[styles.typeBadge, { backgroundColor: catBgColor }]}>
              {catConfig && <Text style={styles.typeBadgeEmoji}>{catConfig.emoji}</Text>}
              <Text style={[styles.typeBadgeLabel, { color: catColor }]}>
                {catLabel}
              </Text>
            </View>
            <Text style={[styles.resultDate, { color: colors.textSecondary }]}>
              {dateStr}
            </Text>
          </View>

          {/* Preview text */}
          <Text style={[styles.resultText, { color: colors.text }]} numberOfLines={3}>
            {highlightText(preview, query)}
          </Text>
        </View>
      </TouchableOpacity>
    );
  };

  return (
    <SafeAreaView
      style={[styles.container, { backgroundColor: colors.background }]}
      edges={["top"]}
    >
      {/* Search Bar */}
      <View style={[styles.searchBar, { borderBottomColor: colors.border }]}>
        <TouchableOpacity onPress={onClose} style={styles.closeButton}>
          <Ionicons name="arrow-back" size={24} color={colors.accent} />
        </TouchableOpacity>
        <View
          style={[
            styles.searchInput,
            { backgroundColor: colors.cardBackground, borderColor: colors.border },
          ]}
        >
          <Ionicons name="search" size={18} color={colors.textSecondary} />
          <TextInput
            ref={inputRef}
            style={[styles.input, { color: colors.text }]}
            placeholder="Search entries..."
            placeholderTextColor={colors.textSecondary + "80"}
            value={query}
            onChangeText={handleSearch}
            autoFocus
            autoCorrect={false}
            returnKeyType="search"
          />
          {query.length > 0 && (
            <TouchableOpacity onPress={() => handleSearch("")}>
              <Ionicons name="close-circle" size={18} color={colors.textSecondary} />
            </TouchableOpacity>
          )}
        </View>
      </View>

      {/* Results */}
      <FlatList
        data={results}
        renderItem={renderResult}
        keyExtractor={(item) => item.id}
        contentContainerStyle={styles.resultsList}
        showsVerticalScrollIndicator={false}
        ListEmptyComponent={
          searched ? (
            <View style={styles.emptyContainer}>
              <Text style={[styles.emptyText, { color: colors.textSecondary }]}>
                No entries found for "{query}"
              </Text>
            </View>
          ) : null
        }
      />
    </SafeAreaView>
  );
};

const styles = StyleSheet.create({
  container: {
    flex: 1,
  },
  searchBar: {
    flexDirection: "row",
    alignItems: "center",
    paddingHorizontal: 12,
    paddingVertical: 10,
    gap: 10,
    borderBottomWidth: 1,
  },
  closeButton: {
    padding: 4,
  },
  searchInput: {
    flex: 1,
    flexDirection: "row",
    alignItems: "center",
    gap: 8,
    paddingHorizontal: 14,
    paddingVertical: 10,
    borderRadius: 12,
    borderWidth: 1,
  },
  input: {
    flex: 1,
    fontFamily: fonts.bodyFamilyRegular,
    fontSize: 16,
  },
  resultsList: {
    paddingHorizontal: 16,
    paddingTop: 12,
    paddingBottom: 100,
  },
  resultCard: {
    borderRadius: 16,
    overflow: "hidden",
    marginBottom: 12,
    shadowColor: "#000",
    shadowOffset: { width: 0, height: 1 },
    shadowOpacity: 0.05,
    shadowRadius: 4,
    elevation: 1,
  },
  colorStrip: {
    height: 3,
  },
  resultInner: {
    padding: 16,
  },
  resultHeader: {
    flexDirection: "row",
    justifyContent: "space-between",
    alignItems: "center",
    marginBottom: 8,
  },
  typeBadge: {
    flexDirection: "row",
    alignItems: "center",
    gap: 4,
    paddingHorizontal: 10,
    paddingVertical: 4,
    borderRadius: 8,
  },
  typeBadgeEmoji: {
    fontSize: 12,
  },
  typeBadgeLabel: {
    fontFamily: fonts.bodyFamilyRegular,
    fontSize: 12,
    fontWeight: "600",
  },
  resultDate: {
    fontFamily: fonts.bodyFamilyRegular,
    fontSize: 13,
  },
  resultText: {
    fontFamily: fonts.loraRegular,
    fontSize: 15,
    lineHeight: 22,
  },
  emptyContainer: {
    alignItems: "center",
    paddingTop: 60,
  },
  emptyText: {
    fontFamily: fonts.bodyFamilyRegular,
    fontSize: 15,
    textAlign: "center",
  },
});
