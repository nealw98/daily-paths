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
import { fonts, layout, rule, typography } from "../../constants/theme";
import type { Speaker } from "../../types/speakers";
import { FieldShell, SanctuaryCard } from "../ui/Sanctuary";
import { EqualizerBars } from "./EqualizerBars";
import { SortSheet, type SortMode as SortSheetMode } from "./SortSheet";

// ─── Types ─────────────────────────────────────────────────────────────────

type SortMode = "newest" | "oldest" | "az";

interface SpeakersBrowseProps {
  speakers: Speaker[];
  loading: boolean;
  error: string | null;
  onSelectSpeaker: (speaker: Speaker, autoPlay: boolean) => void;
  onRefresh: () => void;
  downloadedIds: Set<string>;
  nowPlayingSpeakerId?: string | null;
  isPlaying?: boolean;
}

// ─── Component ─────────────────────────────────────────────────────────────

export const SpeakersBrowse: React.FC<SpeakersBrowseProps> = ({
  speakers,
  loading,
  error,
  onSelectSpeaker,
  onRefresh,
  downloadedIds,
  nowPlayingSpeakerId,
  isPlaying,
}) => {
  const { colors } = useTheme();
  const { settings } = useSettings();
  const [searchQuery, setSearchQuery] = useState("");
  const [sortMode, setSortMode] = useState<SortMode>("newest");
  const [sortSheetOpen, setSortSheetOpen] = useState(false);
  const [sortAnchor, setSortAnchor] = useState<{ x: number; y: number; width: number; height: number } | null>(null);
  const sortButtonRef = React.useRef<View>(null);
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

  // Card title/subtitle sizing shared with the Daily Tools / Prayers cards on
  // Home: title is always subtitle + 2pt so the weight hierarchy stays
  // consistent at every text-size preset.
  const cardTitleFontSize = textMetrics.bodySmallFontSize + 2;
  const cardTitleLineHeight = Math.round(cardTitleFontSize * (22 / 17));

  // ─── Filter & Sort ──────────────────────────────────────────────────────

  const filteredAndSorted = useMemo(() => {
    let result = speakers;

    // Search filter — name only, progressive (matches as user types)
    if (searchQuery.trim()) {
      const q = searchQuery.toLowerCase().trim();
      result = result.filter((s) => s.speaker.toLowerCase().includes(q));
    }

    // Sort
    const sorted = [...result];
    switch (sortMode) {
      case "newest":
        sorted.sort((a, b) => (b.date || b.created_at || "").localeCompare(a.date || a.created_at || ""));
        break;
      case "oldest":
        sorted.sort((a, b) => (a.date || a.created_at || "").localeCompare(b.date || b.created_at || ""));
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
      style={[styles.cardTouchable]}
      onPress={() => onSelectSpeaker(speaker, false)}
      activeOpacity={0.8}
    >
      <View
        style={[
          styles.cardInner,
          { backgroundColor: colors.surfaceContainerLowest, borderColor: colors.mist },
        ]}
      >
        <View style={[styles.cardIconPip, { backgroundColor: colors.secondary }]}>
          <Ionicons name="play-circle" size={38} color={colors.onSecondary} />
        </View>
        <View style={styles.cardBody}>
          <View style={styles.nameRow}>
            <Text style={[styles.speakerName, { color: colors.onSurface, fontSize: cardTitleFontSize, lineHeight: cardTitleLineHeight }]}>
              {speaker.speaker}
            </Text>
            {nowPlayingSpeakerId === speaker.id && (
              <View style={styles.nowPlayingBadge}>
                <EqualizerBars isPlaying={!!isPlaying} color={colors.secondary} />
                <Text style={[styles.nowPlayingBadgeLabel, { color: colors.textSecondary }]}>
                  {isPlaying ? "Now Playing" : "Paused"}
                </Text>
              </View>
            )}
          </View>
          <Text style={[styles.title, { color: colors.onSurfaceVariant, fontSize: textMetrics.bodySmallFontSize, lineHeight: textMetrics.bodySmallLineHeight }]} numberOfLines={2}>
            {speaker.title}
          </Text>
          {/* Badges row */}
          <View style={styles.badgesRow}>
            {speaker.explicit && (
              <View style={[styles.explicitBadge, { backgroundColor: colors.danger + "15" }]}>
                <Text style={[styles.explicitText, { color: colors.danger }]}>E</Text>
              </View>
            )}
            {downloadedIds.has(speaker.id) && (
              <View style={[styles.downloadedBadge, { backgroundColor: colors.secondary + "24" }]}>
                <Ionicons name="checkmark-circle" size={12} color={colors.secondary} />
                <Text style={[styles.downloadedText, { color: colors.secondary }]}>Downloaded</Text>
              </View>
            )}
          </View>
        </View>
        <Ionicons name="chevron-forward" size={18} color={colors.onSurfaceVariant} />
      </View>
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

  const activeSortLabel = sortOptions.find((o) => o.key === sortMode)?.label ?? "Newest";

  const listHeader = (
    <View style={styles.listHeader}>
      <SanctuaryCard
        tone="lowest"
        style={styles.searchCard}
        contentStyle={styles.searchCardContent}
        elevated
      >
        <View style={styles.searchRow}>
          <FieldShell style={styles.searchContainer}>
            <Ionicons
              name="search"
              size={Math.round(18 * scale)}
              color={colors.deepTeal}
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
              placeholderTextColor={colors.textSecondary + "99"}
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
          <TouchableOpacity
            ref={sortButtonRef}
            activeOpacity={0.7}
            onPress={() => {
              sortButtonRef.current?.measureInWindow((x, y, width, height) => {
                setSortAnchor({ x, y, width, height });
                setSortSheetOpen(true);
              });
            }}
            style={[styles.sortButton, { borderColor: rule }]}
          >
            <Text style={[styles.sortButtonLabel, { color: colors.accent }]}>
              {activeSortLabel}
            </Text>
            <Ionicons name="chevron-down" size={12} color={colors.accent} />
          </TouchableOpacity>
        </View>
      </SanctuaryCard>
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
      <SortSheet
        visible={sortSheetOpen}
        sortMode={sortMode}
        anchor={sortAnchor}
        onSelect={(m) => setSortMode(m as SortSheetMode)}
        onClose={() => setSortSheetOpen(false)}
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
  searchRow: {
    flexDirection: "row",
    alignItems: "center",
    gap: 10,
  },
  searchCard: {
    marginBottom: layout.spacing.sm,
  },
  searchCardContent: {
    paddingHorizontal: 12,
    paddingVertical: 12,
    borderRadius: 12,
  },
  searchContainer: {
    flex: 1,
    flexShrink: 1,
    minWidth: 0,
    flexDirection: "row",
    alignItems: "center",
    backgroundColor: "#dfe8e4",
    paddingVertical: 8,
    paddingHorizontal: 10,
  },
  searchIcon: {
    marginRight: layout.spacing.sm,
  },
  searchInput: {
    flex: 1,
    minWidth: 0,
    fontSize: 15,
    padding: 0,
  },

  // ─── Sort ──────────────────────────────────────────────────────────────────
  sortButton: {
    flexDirection: "row",
    alignItems: "center",
    gap: 5,
    paddingHorizontal: 12,
    paddingVertical: 9,
    borderRadius: 10,
    borderWidth: 1,
  },
  sortButtonLabel: {
    fontFamily: fonts.bodyFamilySemiBold,
    fontSize: 12.5,
  },

  cardTouchable: {
    marginBottom: layout.spacing.lg,
    borderRadius: 10,
    shadowColor: "#000000",
    shadowOpacity: 0.1,
    shadowRadius: 12,
    shadowOffset: { width: 0, height: 4 },
    elevation: 4,
  },
  cardInner: {
    flexDirection: "row",
    alignItems: "center",
    borderWidth: 0.5,
    borderRadius: 10,
    paddingRight: 16,
    paddingLeft: 0,
    paddingVertical: 0,
    minHeight: 100,
    overflow: "hidden",
  },
  cardIconPip: {
    width: 90,
    alignSelf: "stretch",
    borderTopLeftRadius: 9,
    borderBottomLeftRadius: 9,
    borderTopRightRadius: 0,
    borderBottomRightRadius: 0,
    alignItems: "center",
    justifyContent: "center",
    marginRight: 16,
  },
  cardBody: {
    flex: 1,
    gap: 3,
    paddingVertical: 16,
  },

  // ─── Speaker Info ──────────────────────────────────────────────────────────
  speakerName: {
    fontFamily: fonts.bodyFamilyMedium,
    fontSize: 17,
    lineHeight: 22,
    includeFontPadding: false,
  },
  title: {
    fontFamily: fonts.bodyFamilyMedium,
    fontSize: 14,
    lineHeight: 19,
    letterSpacing: -0.1,
  },
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
  nameRow: {
    flexDirection: "row",
    alignItems: "center",
    justifyContent: "space-between",
  },
  nowPlayingBadge: {
    flexDirection: "row",
    alignItems: "center",
    gap: layout.spacing.sm,
    marginLeft: layout.spacing.sm,
  },
  nowPlayingBadgeLabel: {
    fontFamily: fonts.bodyFamilySemiBold,
    fontSize: 10,
    lineHeight: 14,
    textTransform: "uppercase",
    letterSpacing: 0.4,
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
