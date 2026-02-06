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
  const debounceRef = useRef<ReturnType<typeof setTimeout>>();

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

    // Show a snippet around the match
    const preview = item.content.length > 150
      ? item.content.substring(0, 150).trim() + "..."
      : item.content;

    return (
      <TouchableOpacity
        style={[styles.resultCard, { backgroundColor: colors.cardBackground, borderColor: colors.border }]}
        onPress={() => onSelectEntry(item)}
        activeOpacity={0.7}
      >
        <Text style={[styles.resultDate, { color: colors.accent }]}>{dateStr}</Text>
        <Text style={[styles.resultText, { color: colors.text }]} numberOfLines={3}>
          {highlightText(preview, query)}
        </Text>
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
    borderRadius: 14,
    borderWidth: 1,
    padding: 16,
    marginBottom: 12,
  },
  resultDate: {
    fontFamily: fonts.bodyFamilyRegular,
    fontSize: 13,
    fontWeight: "600",
    marginBottom: 8,
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
