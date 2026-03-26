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
import { useSettings, getTextSizeMetrics } from "../../hooks/useSettings";
import { useTypography } from "../../hooks/useTypography";
import { fonts, layout, typography } from "../../constants/theme";
import type { Speaker } from "../../types/speakers";
import { FieldShell, FocusPill, SanctuaryCard } from "../ui/Sanctuary";

// ─── Types ─────────────────────────────────────────────────────────────────

type SortMode = "newest" | "oldest" | "az";

interface SpeakersBrowseProps {
  speakers: Speaker[];
  loading: boolean;
  error: string | null;
  onSelectSpeaker: (speaker: Speaker, autoPlay: boolean) => void;
  onRefresh: () => void;
  downloadedIds: Set<string>;
}

// ─── Component ─────────────────────────────────────────────────────────────

export const SpeakersBrowse: React.FC<SpeakersBrowseProps> = ({
  speakers,
  loading,
  error,
  onSelectSpeaker,
  onRefresh,
  downloadedIds,
}) => {
  const { colors } = useTheme();
  const { settings } = useSettings();
  const [searchQuery, setSearchQuery] = useState("");
  const [sortMode, setSortMode] = useState<SortMode>("newest");
  const [refreshing, setRefreshing] = useState(false);
  const handleRefresh = async () => {
    setRefreshing(true);
    try {
      await Promise.resolve(onRefresh());
    } finally {
      setRefreshing(false);
    }
  };


  // Scale factor: medium bodyFontSize (18) is the baseline (1.0)
  const textMetrics = useMemo(() => getTextSizeMetrics(settings.textSize), [settings.textSize]);
  const scale = textMetrics.bodyFontSize / 18;
  const { typography: dynamicTypography } = useTypography();

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

  const sortOptions: { key: SortMode; label: string }[] = [
    { key: "newest", label: "Newest" },
    { key: "oldest", label: "Oldest" },
    { key: "az", label: "A\u2013Z" },
  ];

  // ─── Render: Speaker Card ───────────────────────────────────────────────

  const renderCard = ({ item: speaker }: { item: Speaker }) => (
    <TouchableOpacity
      style={styles.cardTouchable}
      onPress={() => onSelectSpeaker(speaker, false)}
      activeOpacity={0.7}
    >
      <SanctuaryCard tone="lowest" style={styles.card} contentStyle={styles.cardContent} elevated>
        <View style={styles.cardBody}>
          {/* Speaker name */}
          <Text style={[styles.speakerName, { color: colors.text, fontSize: Math.round(24 * scale) }]}>{speaker.speaker}</Text>

          {/* Hometown */}
          {speaker.hometown && (
            <Text
              style={[
                styles.hometown,
                {
                  color: colors.accent,
                  fontSize: dynamicTypography.caption.fontSize,
                  lineHeight: dynamicTypography.caption.lineHeight,
                },
              ]}
            >
              {speaker.hometown.toUpperCase()}
            </Text>
          )}

          {/* Title */}
          <Text
            style={[
              styles.title,
              {
                color: colors.text,
                fontSize: textMetrics.bodyFontSize,
                lineHeight: textMetrics.bodyLineHeight,
              },
            ]}
            numberOfLines={2}
          >
            {speaker.title}
          </Text>

          {/* Badges row */}
          <View style={styles.badgesRow}>
            {speaker.explicit && (
              <View style={[styles.explicitBadge, { backgroundColor: colors.danger + "15" }]}>
                <Text
                  style={[
                    styles.explicitText,
                    { color: colors.danger, fontSize: Math.round(typography.labelMedium.fontSize * scale) },
                  ]}
                >
                  E
                </Text>
              </View>
            )}
            {downloadedIds.has(speaker.id) && (
              <View style={[styles.downloadedBadge, { backgroundColor: colors.secondary + "24" }]}>
                <Ionicons name="checkmark-circle" size={Math.round(12 * scale)} color={colors.secondary} />
                <Text
                  style={[
                    styles.downloadedText,
                    { color: colors.secondary, fontSize: Math.round(typography.labelMedium.fontSize * scale) },
                  ]}
                >
                  Downloaded
                </Text>
              </View>
            )}
          </View>
        </View>

        {/* Play button */}
        <TouchableOpacity
          onPress={() => onSelectSpeaker(speaker, true)}
          style={styles.playButton}
          hitSlop={{ top: 8, bottom: 8, left: 8, right: 8 }}
          activeOpacity={0.6}
        >
          <View style={[styles.playCircle, { backgroundColor: colors.secondaryContainer, width: Math.round(44 * scale), height: Math.round(44 * scale), borderRadius: Math.round(22 * scale) }]}>
            <Ionicons name="play" size={Math.round(20 * scale)} color={colors.onSecondaryContainer} style={styles.playIcon} />
          </View>
        </TouchableOpacity>
      </SanctuaryCard>
    </TouchableOpacity>
  );

  // ─── Render: Empty State ────────────────────────────────────────────────

  const ListEmpty = () => {
    if (loading) return null;

    if (error) {
      return (
        <View style={styles.emptyContainer}>
          <Ionicons name="cloud-offline-outline" size={Math.round(48 * scale)} color={colors.danger + "80"} />
          <Text style={[styles.emptyTitle, { color: colors.text, fontSize: Math.round(18 * scale) }]}>
            Unable to load speakers
          </Text>
          <Text style={[styles.emptySubtitle, { color: colors.textSecondary, fontSize: Math.round(14 * scale), lineHeight: Math.round(20 * scale) }]}>
            Pull down to try again.
          </Text>
        </View>
      );
    }

    return (
      <View style={styles.emptyContainer}>
        <Ionicons name="mic-off-outline" size={Math.round(48 * scale)} color={colors.textSecondary + "60"} />
        <Text style={[styles.emptyTitle, { color: colors.textSecondary, fontSize: Math.round(18 * scale) }]}>
          {searchQuery ? "No speakers found" : "No speakers yet"}
        </Text>
        <Text style={[styles.emptySubtitle, { color: colors.textSecondary + "80", fontSize: Math.round(14 * scale), lineHeight: Math.round(20 * scale) }]}>
          {searchQuery
            ? "Try adjusting your search terms."
            : "Speaker recordings will appear here."}
        </Text>
      </View>
    );
  };

  // ─── Render: List Header ────────────────────────────────────────────────

  const listHeader = (
    <View style={styles.listHeader}>
      <FieldShell style={styles.searchContainer}>
        <Ionicons
          name="search"
          size={Math.round(18 * scale)}
          color={colors.textSecondary}
          style={styles.searchIcon}
        />
        <TextInput
          style={[
            styles.searchInput,
            {
              color: colors.text,
              fontFamily: fonts.bodyFamilyRegular,
              fontSize: Math.round(15 * scale),
            },
          ]}
          placeholder="Search speakers..."
          placeholderTextColor={colors.textSecondary + "80"}
          value={searchQuery}
          onChangeText={setSearchQuery}
          returnKeyType="search"
          autoCorrect={false}
        />
        {searchQuery.length > 0 && (
          <TouchableOpacity
            onPress={() => setSearchQuery("")}
            hitSlop={{ top: 8, bottom: 8, left: 8, right: 8 }}
          >
            <Ionicons
              name="close-circle"
              size={Math.round(18 * scale)}
              color={colors.textSecondary}
            />
          </TouchableOpacity>
        )}
      </FieldShell>

      <View style={styles.sortRow}>
        {sortOptions.map(({ key, label }) => {
          const isActive = sortMode === key;
          return (
            <FocusPill
              key={key}
              label={label}
              selected={isActive}
              onPress={() => setSortMode(key)}
              style={styles.sortButton}
              labelStyle={[styles.sortLabel, { fontSize: Math.round(13 * scale) }]}
            />
          );
        })}
      </View>
    </View>
  );

  // ─── Main Render ────────────────────────────────────────────────────────

  return (
    <View style={styles.wrapper}>
      <FlatList
        data={filteredAndSorted}
        renderItem={renderCard}
        keyExtractor={(item) => item.id}
        ListHeaderComponent={listHeader}
        ListEmptyComponent={ListEmpty}
        contentContainerStyle={styles.listContent}
        keyboardDismissMode="on-drag"
        keyboardShouldPersistTaps="handled"
        refreshControl={
          <RefreshControl
            refreshing={refreshing}
            onRefresh={handleRefresh}
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
    paddingHorizontal: layout.spacing.md,
    paddingTop: layout.spacing.sm,
    paddingBottom: 100,
  },
  listHeader: {
    marginBottom: layout.spacing.sm,
  },

  // ─── Search ────────────────────────────────────────────────────────────────
  searchContainer: {
    flexDirection: "row",
    alignItems: "center",
    marginBottom: layout.spacing.sm,
  },
  searchIcon: {
    marginRight: layout.spacing.sm,
  },
  searchInput: {
    flex: 1,
    fontSize: 15,
    lineHeight: 22,
    padding: 0,
  },

  // ─── Sort ──────────────────────────────────────────────────────────────────
  sortRow: {
    flexDirection: "row",
    justifyContent: "center",
    gap: layout.spacing.sm,
    paddingVertical: layout.spacing.sm,
    marginBottom: layout.spacing.xs,
  },
  sortButton: {
    minHeight: 36,
  },
  sortLabel: {
    fontFamily: fonts.labelFamily,
    letterSpacing: 0.3,
  },

  cardTouchable: {
    marginBottom: layout.spacing.sm + layout.spacing.xs,
  },
  card: {
    borderRadius: layout.borderRadiusLarge,
  },
  cardContent: {
    flexDirection: "row",
    paddingVertical: layout.spacing.md,
    paddingLeft: layout.spacing.md,
    paddingRight: layout.spacing.md - 2,
  },
  cardBody: {
    flex: 1,
    marginRight: layout.spacing.sm + layout.spacing.xs,
  },

  // ─── Speaker Info ──────────────────────────────────────────────────────────
  speakerName: {
    fontFamily: fonts.bodyFamilyBold,
    fontSize: 24,
    includeFontPadding: false,
    marginBottom: 2,
  },
  hometown: {
    fontFamily: fonts.bodyFamily,
    fontSize: typography.label.fontSize,
    lineHeight: typography.label.lineHeight,
    letterSpacing: 0.5,
    marginBottom: layout.spacing.xs,
  },
  title: {
    fontFamily: fonts.bodyFamilyRegular,
    fontSize: 17,
    lineHeight: 28,
    letterSpacing: -0.1,
  },
  // ─── Badges Row ──────────────────────────────────────────────────────────
  badgesRow: {
    flexDirection: "row",
    alignItems: "center",
    gap: layout.spacing.xs + 2,
    marginTop: layout.spacing.xs + 2,
  },
  explicitBadge: {
    paddingHorizontal: 6,
    paddingVertical: 2,
    borderRadius: layout.spacing.xs,
  },
  explicitText: {
    fontFamily: fonts.bodyFamilyRegular,
    fontSize: 10,
    fontWeight: "800",
    letterSpacing: 0.5,
  },
  downloadedBadge: {
    flexDirection: "row",
    alignItems: "center",
    gap: layout.spacing.xs,
    paddingHorizontal: 8,
    paddingVertical: 3,
    borderRadius: 10,
  },
  downloadedText: {
    fontFamily: fonts.bodyFamilyRegular,
    fontSize: 11,
    fontWeight: "700",
    letterSpacing: 0.3,
  },

  // ─── Play Button ───────────────────────────────────────────────────────────
  playButton: {
    alignSelf: "center",
  },
  playCircle: {
    width: 44,
    height: 44,
    borderRadius: 22,
    alignItems: "center",
    justifyContent: "center",
  },
  playIcon: {
    marginLeft: 3, // Optical centering for play triangle.
  },

  // ─── Empty State ───────────────────────────────────────────────────────────
  emptyContainer: {
    alignItems: "center",
    paddingTop: layout.spacing.xl + layout.spacing.lgPlus,
    paddingHorizontal: layout.spacing.xl + layout.spacing.sm,
  },
  emptyTitle: {
    fontFamily: typography.titleLarge.fontFamily,
    fontSize: typography.titleLarge.fontSize,
    lineHeight: typography.titleLarge.lineHeight,
    fontWeight: "600",
    marginTop: layout.spacing.md,
    marginBottom: layout.spacing.sm,
  },
  emptySubtitle: {
    fontFamily: typography.bodyMedium.fontFamily,
    fontSize: typography.bodyMedium.fontSize,
    lineHeight: typography.bodyMedium.lineHeight,
    textAlign: "center",
  },
});
