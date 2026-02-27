import React, { useState, useMemo } from "react";
import {
  View,
  Text,
  TextInput,
  FlatList,
  TouchableOpacity,
  StyleSheet,
  RefreshControl,
  ActivityIndicator,
} from "react-native";
import { Ionicons } from "@expo/vector-icons";
import { useTheme } from "../../hooks/useTheme";
import { fonts } from "../../constants/theme";
import { Microphone } from "../icons";
import type { Speaker } from "../../types/speakers";

// ─── Types ─────────────────────────────────────────────────────────────────

type SortMode = "newest" | "oldest" | "az";

interface SpeakersBrowseProps {
  speakers: Speaker[];
  loading: boolean;
  error: string | null;
  onSelectSpeaker: (speaker: Speaker, autoPlay: boolean) => void;
  onRefresh: () => void;
}

// ─── Component ─────────────────────────────────────────────────────────────

export const SpeakersBrowse: React.FC<SpeakersBrowseProps> = ({
  speakers,
  loading,
  error,
  onSelectSpeaker,
  onRefresh,
}) => {
  const { colors } = useTheme();
  const [searchQuery, setSearchQuery] = useState("");
  const [sortMode, setSortMode] = useState<SortMode>("newest");

  // ─── Filter & Sort ──────────────────────────────────────────────────────

  const filteredAndSorted = useMemo(() => {
    let result = speakers;

    // Search filter
    if (searchQuery.trim()) {
      const q = searchQuery.toLowerCase().trim();
      result = result.filter(
        (s) =>
          s.speaker.toLowerCase().includes(q) ||
          s.title.toLowerCase().includes(q) ||
          (s.subtitle && s.subtitle.toLowerCase().includes(q)) ||
          (s.quote && s.quote.toLowerCase().includes(q)) ||
          (s.core_themes && s.core_themes.toLowerCase().includes(q))
      );
    }

    // Sort
    const sorted = [...result];
    switch (sortMode) {
      case "newest":
        sorted.sort((a, b) => (b.created_at || "").localeCompare(a.created_at || ""));
        break;
      case "oldest":
        sorted.sort((a, b) => (a.created_at || "").localeCompare(b.created_at || ""));
        break;
      case "az":
        sorted.sort((a, b) => a.speaker.localeCompare(b.speaker));
        break;
    }

    return sorted;
  }, [speakers, searchQuery, sortMode]);

  // ─── Render: Search Bar ─────────────────────────────────────────────────

  const SearchBar = () => (
    <View style={[styles.searchContainer, { backgroundColor: colors.cardBackground, borderColor: colors.border }]}>
      <Ionicons name="search" size={18} color={colors.textSecondary} style={styles.searchIcon} />
      <TextInput
        style={[styles.searchInput, { color: colors.text, fontFamily: fonts.bodyFamilyRegular }]}
        placeholder="Search speakers..."
        placeholderTextColor={colors.textSecondary + "80"}
        value={searchQuery}
        onChangeText={setSearchQuery}
        returnKeyType="search"
        autoCorrect={false}
      />
      {searchQuery.length > 0 && (
        <TouchableOpacity onPress={() => setSearchQuery("")} hitSlop={{ top: 8, bottom: 8, left: 8, right: 8 }}>
          <Ionicons name="close-circle" size={18} color={colors.textSecondary} />
        </TouchableOpacity>
      )}
    </View>
  );

  // ─── Render: Sort Toggle ────────────────────────────────────────────────

  const SortToggle = () => {
    const options: { key: SortMode; label: string }[] = [
      { key: "newest", label: "Newest" },
      { key: "oldest", label: "Oldest" },
      { key: "az", label: "A\u2013Z" },
    ];

    return (
      <View style={styles.sortRow}>
        {options.map(({ key, label }) => {
          const isActive = sortMode === key;
          return (
            <TouchableOpacity
              key={key}
              onPress={() => setSortMode(key)}
              style={styles.sortButton}
              activeOpacity={0.7}
            >
              <Text
                style={[
                  styles.sortLabel,
                  {
                    color: isActive ? colors.accent : colors.textSecondary,
                    fontFamily: isActive ? fonts.bodyFamilyRegular : fonts.bodyFamily,
                    fontWeight: isActive ? "700" : "400",
                  },
                ]}
              >
                {label}
              </Text>
              {isActive && <View style={[styles.sortUnderline, { backgroundColor: colors.accent }]} />}
            </TouchableOpacity>
          );
        })}
      </View>
    );
  };

  // ─── Render: Speaker Card ───────────────────────────────────────────────

  const renderCard = ({ item: speaker }: { item: Speaker }) => (
    <TouchableOpacity
      style={[
        styles.card,
        {
          backgroundColor: colors.cardBackground,
          borderTopColor: colors.accent,
          borderTopWidth: 2.5,
        },
      ]}
      onPress={() => onSelectSpeaker(speaker, false)}
      activeOpacity={0.7}
    >
      <View style={styles.cardContent}>
        <View style={styles.cardBody}>
          {/* Type label row */}
          <View style={styles.typeBadge}>
            <Microphone size={12} color={colors.accent} strokeWidth={2} />
            <Text style={[styles.typeLabel, { color: colors.accent }]}>AL-ANON SPEAKER</Text>
          </View>

          {/* Speaker name */}
          <Text style={[styles.speakerName, { color: colors.text }]}>{speaker.speaker}</Text>

          {/* Hometown */}
          {speaker.hometown && (
            <Text style={[styles.hometown, { color: colors.textSecondary }]}>{speaker.hometown}</Text>
          )}

          {/* Title */}
          <Text style={[styles.title, { color: colors.text }]} numberOfLines={2}>
            {speaker.title}
          </Text>

          {/* Explicit badge */}
          {speaker.explicit && (
            <View style={[styles.explicitBadge, { backgroundColor: colors.danger + "15" }]}>
              <Text style={[styles.explicitText, { color: colors.danger }]}>E</Text>
            </View>
          )}
        </View>

        {/* Play button */}
        <TouchableOpacity
          onPress={() => onSelectSpeaker(speaker, true)}
          style={styles.playButton}
          hitSlop={{ top: 8, bottom: 8, left: 8, right: 8 }}
          activeOpacity={0.6}
        >
          <View style={[styles.playCircle, { borderColor: colors.accent }]}>
            <Ionicons name="play" size={20} color={colors.accent} style={styles.playIcon} />
          </View>
        </TouchableOpacity>
      </View>
    </TouchableOpacity>
  );

  // ─── Render: Empty State ────────────────────────────────────────────────

  const ListEmpty = () => {
    if (loading) return null;

    if (error) {
      return (
        <View style={styles.emptyContainer}>
          <Ionicons name="cloud-offline-outline" size={48} color={colors.danger + "80"} />
          <Text style={[styles.emptyTitle, { color: colors.text }]}>
            Unable to load speakers
          </Text>
          <Text style={[styles.emptySubtitle, { color: colors.textSecondary }]}>
            Pull down to try again.
          </Text>
        </View>
      );
    }

    return (
      <View style={styles.emptyContainer}>
        <Ionicons name="mic-off-outline" size={48} color={colors.textSecondary + "60"} />
        <Text style={[styles.emptyTitle, { color: colors.textSecondary }]}>
          {searchQuery ? "No speakers found" : "No speakers yet"}
        </Text>
        <Text style={[styles.emptySubtitle, { color: colors.textSecondary + "80" }]}>
          {searchQuery
            ? "Try adjusting your search terms."
            : "Speaker recordings will appear here."}
        </Text>
      </View>
    );
  };

  // ─── Render: List Header ────────────────────────────────────────────────

  const ListHeader = () => (
    <View style={styles.listHeader}>
      <SearchBar />
      <SortToggle />
    </View>
  );

  // ─── Main Render ────────────────────────────────────────────────────────

  return (
    <View style={styles.wrapper}>
      <FlatList
        data={filteredAndSorted}
        renderItem={renderCard}
        keyExtractor={(item) => item.id}
        ListHeaderComponent={ListHeader}
        ListEmptyComponent={ListEmpty}
        contentContainerStyle={styles.listContent}
        refreshControl={
          <RefreshControl
            refreshing={loading}
            onRefresh={onRefresh}
            tintColor={colors.accent}
          />
        }
        showsVerticalScrollIndicator={false}
      />
    </View>
  );
};

// ─── Styles ──────────────────────────────────────────────────────────────────

const styles = StyleSheet.create({
  wrapper: {
    flex: 1,
  },
  listContent: {
    paddingHorizontal: 16,
    paddingBottom: 100,
  },
  listHeader: {
    marginBottom: 8,
  },

  // ─── Search ────────────────────────────────────────────────────────────────
  searchContainer: {
    flexDirection: "row",
    alignItems: "center",
    borderRadius: 12,
    borderWidth: 1,
    paddingHorizontal: 14,
    paddingVertical: 10,
    marginTop: 12,
    marginBottom: 8,
  },
  searchIcon: {
    marginRight: 10,
  },
  searchInput: {
    flex: 1,
    fontSize: 15,
    padding: 0,
  },

  // ─── Sort ──────────────────────────────────────────────────────────────────
  sortRow: {
    flexDirection: "row",
    justifyContent: "center",
    gap: 32,
    paddingVertical: 8,
    marginBottom: 4,
  },
  sortButton: {
    alignItems: "center",
    paddingVertical: 4,
  },
  sortLabel: {
    fontSize: 14,
    letterSpacing: 0.3,
  },
  sortUnderline: {
    height: 2,
    width: "100%",
    borderRadius: 1,
    marginTop: 4,
  },

  // ─── Card ──────────────────────────────────────────────────────────────────
  card: {
    borderRadius: 12,
    shadowColor: "#000",
    shadowOffset: { width: 0, height: 1 },
    shadowOpacity: 0.04,
    shadowRadius: 3,
    elevation: 1,
    marginBottom: 10,
  },
  cardContent: {
    flexDirection: "row",
    paddingTop: 14,
    paddingBottom: 16,
    paddingLeft: 18,
    paddingRight: 14,
  },
  cardBody: {
    flex: 1,
    marginRight: 12,
  },

  // ─── Type Badge ────────────────────────────────────────────────────────────
  typeBadge: {
    flexDirection: "row",
    alignItems: "center",
    gap: 5,
    marginBottom: 6,
  },
  typeLabel: {
    fontFamily: fonts.bodyFamilyRegular,
    fontSize: 11,
    fontWeight: "600",
    textTransform: "uppercase",
    letterSpacing: 0.8,
  },

  // ─── Speaker Info ──────────────────────────────────────────────────────────
  speakerName: {
    fontFamily: fonts.bodyFamilyRegular,
    fontSize: 16,
    fontWeight: "600",
    marginBottom: 2,
  },
  hometown: {
    fontFamily: fonts.bodyFamily,
    fontSize: 12,
    marginBottom: 4,
  },
  title: {
    fontFamily: fonts.bodyFamilyRegular,
    fontSize: 14,
    lineHeight: 20,
  },
  // ─── Explicit Badge ────────────────────────────────────────────────────────
  explicitBadge: {
    alignSelf: "flex-start",
    paddingHorizontal: 6,
    paddingVertical: 2,
    borderRadius: 4,
    marginTop: 2,
  },
  explicitText: {
    fontFamily: fonts.bodyFamilyRegular,
    fontSize: 10,
    fontWeight: "800",
    letterSpacing: 0.5,
  },

  // ─── Play Button ───────────────────────────────────────────────────────────
  playButton: {
    alignSelf: "center",
  },
  playCircle: {
    width: 44,
    height: 44,
    borderRadius: 22,
    borderWidth: 2,
    alignItems: "center",
    justifyContent: "center",
  },
  playIcon: {
    marginLeft: 3, // optical center for play triangle
  },

  // ─── Empty State ───────────────────────────────────────────────────────────
  emptyContainer: {
    alignItems: "center",
    paddingTop: 60,
    paddingHorizontal: 40,
  },
  emptyTitle: {
    fontFamily: fonts.bodyFamilyRegular,
    fontSize: 18,
    fontWeight: "600",
    marginTop: 16,
    marginBottom: 8,
  },
  emptySubtitle: {
    fontFamily: fonts.bodyFamily,
    fontSize: 14,
    textAlign: "center",
    lineHeight: 20,
  },
});
