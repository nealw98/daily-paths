import React, { useMemo } from "react";
import { useSettings, getTextSizeMetrics } from "../../hooks/useSettings";
import {
  View,
  Text,
  TouchableOpacity,
  StyleSheet,
  FlatList,
  RefreshControl,
} from "react-native";
import { LinearGradient } from "expo-linear-gradient";
import { Ionicons } from "@expo/vector-icons";
import { useTheme } from "../../hooks/useTheme";
import { fonts } from "../../constants/theme";
import type { JournalEntry } from "../../hooks/useJournalEntries";
import type { EntryType } from "../../constants/journalCategories";
import type { JournalStats } from "../../hooks/useJournalStats";
import {
  getCategoryById,
  getCategoryLabel,
  getCategoryColor,
  getCategoryBgColor,
  JOURNAL_CATEGORIES,
} from "../../constants/journalCategories";

// ─── Public types ───────────────────────────────────────────────────────────

export type CategoryFilter = "all" | EntryType;

// ─── Timeline item union (date headers + entries) ───────────────────────────

type TimelineItem =
  | { type: "header"; date: string }
  | { type: "entry"; data: JournalEntry };

// ─── Props ──────────────────────────────────────────────────────────────────

interface JournalTimelineProps {
  entries: JournalEntry[];
  stats: JournalStats;
  loading: boolean;
  categoryFilter: CategoryFilter;
  onFilterChange: (filter: CategoryFilter) => void;
  onNewEntry: () => void;
  onSearch: () => void;
  onSelectEntry: (entry: JournalEntry) => void;
  onDeleteEntry: (entryId: string) => void;
  onRefresh: () => void;
}

// ─── Helpers ────────────────────────────────────────────────────────────────

/**
 * Format a date string for a section header.
 * Today -> "Today — Feb 8"
 * Yesterday -> "Yesterday — Feb 7"
 * Other -> "Monday — Feb 3"
 */
function formatDateHeader(dateKey: string): string {
  const date = new Date(dateKey + "T12:00:00"); // noon to avoid timezone shifts
  const now = new Date();

  const todayKey = toDateKey(now);
  const yesterday = new Date(now);
  yesterday.setDate(yesterday.getDate() - 1);
  const yesterdayKey = toDateKey(yesterday);

  const monthDay = date.toLocaleDateString("en-US", {
    month: "short",
    day: "numeric",
  });

  if (dateKey === todayKey) {
    return `Today \u2014 ${monthDay}`;
  }
  if (dateKey === yesterdayKey) {
    return `Yesterday \u2014 ${monthDay}`;
  }

  const weekday = date.toLocaleDateString("en-US", { weekday: "long" });
  return `${weekday} \u2014 ${monthDay}`;
}

/** YYYY-MM-DD key from a Date. */
function toDateKey(d: Date): string {
  const y = d.getFullYear();
  const m = String(d.getMonth() + 1).padStart(2, "0");
  const day = String(d.getDate()).padStart(2, "0");
  return `${y}-${m}-${day}`;
}

/**
 * Group entries by date and interleave section headers.
 * Entries are assumed to be sorted newest-first.
 */
function groupEntriesByDate(entries: JournalEntry[]): TimelineItem[] {
  const items: TimelineItem[] = [];
  let lastDateKey = "";

  for (const entry of entries) {
    const entryDate = new Date(entry.created_at);
    const dateKey = toDateKey(entryDate);

    if (dateKey !== lastDateKey) {
      items.push({ type: "header", date: dateKey });
      lastDateKey = dateKey;
    }

    items.push({ type: "entry", data: entry });
  }

  return items;
}

/**
 * Build a clean preview string from an entry.
 */
function getEntryPreview(entry: JournalEntry): string {
  // Gratitude entries: prefer structured_content.items
  if (entry.entry_type === "gratitude") {
    if (
      entry.structured_content?.items &&
      Array.isArray(entry.structured_content.items)
    ) {
      const joined = (entry.structured_content.items as string[])
        .filter(Boolean)
        .join(" \u2022 ");
      if (joined) {
        return joined.length > 120
          ? joined.substring(0, 120).trim() + "..."
          : joined;
      }
    }
    // Fall back to parsing markdown list from content
    if (entry.content) {
      const items = entry.content
        .split("\n")
        .map((line) => line.replace(/^-\s*/, "").trim())
        .filter(Boolean);
      const joined = items.join(" \u2022 ");
      const stripped = stripMarkdown(joined);
      return stripped.length > 120
        ? stripped.substring(0, 120).trim() + "..."
        : stripped;
    }
    return "";
  }

  // Guided entries (spot_check, nightly_review): prefer structured_content first non-empty value
  if (
    entry.entry_type === "spot_check" ||
    entry.entry_type === "nightly_review"
  ) {
    if (entry.structured_content) {
      const values = Object.values(entry.structured_content);
      for (const val of values) {
        if (typeof val === "string" && val.trim()) {
          const cleaned = stripMarkdown(val.trim());
          return cleaned.length > 120
            ? cleaned.substring(0, 120).trim() + "..."
            : cleaned;
        }
      }
    }
    // Fall back to content
    if (entry.content) {
      const cleaned = stripMarkdown(entry.content);
      return cleaned.length > 120
        ? cleaned.substring(0, 120).trim() + "..."
        : cleaned;
    }
    return "";
  }

  // Journal entries: use content directly
  if (entry.content) {
    const cleaned = stripMarkdown(entry.content);
    return cleaned.length > 120
      ? cleaned.substring(0, 120).trim() + "..."
      : cleaned;
  }

  return "";
}

/** Strip basic markdown formatting. */
function stripMarkdown(text: string): string {
  return text
    .replace(/\*\*([^*]+)\*\*/g, "$1")
    .replace(/\*([^*]+)\*/g, "$1")
    .replace(/_([^_]+)_/g, "$1");
}

// ─── Component ──────────────────────────────────────────────────────────────

export const JournalTimeline: React.FC<JournalTimelineProps> = ({
  entries,
  stats,
  loading,
  categoryFilter,
  onFilterChange,
  onNewEntry,
  onSearch,
  onSelectEntry,
  onDeleteEntry,
  onRefresh,
}) => {
  const { colors } = useTheme();
  const { settings } = useSettings();
  const typography = useMemo(() => getTextSizeMetrics(settings.textSize), [settings.textSize]);

  // Filter entries by category
  const filteredEntries = useMemo(() => {
    if (categoryFilter === "all") return entries;
    return entries.filter((e) => e.entry_type === categoryFilter);
  }, [entries, categoryFilter]);

  // Build timeline items (headers + entries)
  const timelineItems = useMemo(
    () => groupEntriesByDate(filteredEntries),
    [filteredEntries]
  );

  // ─── Render: Entry Card ─────────────────────────────────────────────────

  const renderEntryCard = (entry: JournalEntry) => {
    const date = new Date(entry.created_at);
    const timeStr = date.toLocaleTimeString("en-US", {
      hour: "numeric",
      minute: "2-digit",
    });

    const catConfig = getCategoryById(entry.entry_type);
    const catLabel = getCategoryLabel(entry.entry_type);
    const catColor = getCategoryColor(entry.entry_type);
    const catBgColor = getCategoryBgColor(entry.entry_type);
    const preview = getEntryPreview(entry);

    return (
      <TouchableOpacity
        style={[styles.entryCard, { backgroundColor: colors.cardBackground }]}
        onPress={() => onSelectEntry(entry)}
        activeOpacity={0.7}
      >
        {/* Top color strip */}
        <View style={[styles.colorStrip, { backgroundColor: catColor }]} />

        {/* Inner content */}
        <View style={styles.entryInner}>
          {/* Header row: badge left, time right */}
          <View style={styles.entryHeader}>
            <View style={[styles.typeBadge, { backgroundColor: catBgColor }]}>
              {catConfig && (
                <Text style={styles.typeBadgeEmoji}>{catConfig.emoji}</Text>
              )}
              <Text style={[styles.typeBadgeLabel, { color: catColor }]}>
                {catLabel}
              </Text>
            </View>
            <Text style={[styles.entryTime, { color: colors.textSecondary }]}>
              {timeStr}
            </Text>
          </View>

          {/* Preview text */}
          {preview ? (
            <Text
              style={[styles.entryPreview, { color: colors.textSecondary, fontSize: typography.bodyFontSize - 4, lineHeight: (typography.bodyFontSize - 4) * 1.55 }]}
              numberOfLines={2}
            >
              {preview}
            </Text>
          ) : null}
        </View>
      </TouchableOpacity>
    );
  };

  // ─── Render: Date Divider ───────────────────────────────────────────────

  const renderDateDivider = (dateKey: string) => {
    const label = formatDateHeader(dateKey);
    return (
      <View style={styles.dateDivider}>
        <View style={[styles.dateLine, { backgroundColor: colors.border }]} />
        <Text style={[styles.dateLabel, { color: colors.textSecondary }]}>
          {label}
        </Text>
        <View style={[styles.dateLine, { backgroundColor: colors.border }]} />
      </View>
    );
  };

  // ─── Render: Timeline Item ──────────────────────────────────────────────

  const renderItem = ({ item }: { item: TimelineItem }) => {
    if (item.type === "header") {
      return renderDateDivider(item.date);
    }
    return renderEntryCard(item.data);
  };

  const keyExtractor = (item: TimelineItem, index: number) => {
    if (item.type === "header") return `header-${item.date}`;
    return item.data.id;
  };

  // ─── Render: Stats Bar ─────────────────────────────────────────────────

  const StatsBar = () => (
    <View style={styles.statsRow}>
      <View style={[styles.statPill, { backgroundColor: colors.background }]}>
        <Text style={[styles.statNumber, { color: colors.accent }]}>
          {stats.thisMonth}
        </Text>
        <Text style={[styles.statLabel, { color: colors.textSecondary }]}>
          this month
        </Text>
      </View>
      <View style={[styles.statPill, { backgroundColor: colors.background }]}>
        <Text style={[styles.statNumber, { color: colors.accent }]}>
          {stats.thisWeek}
        </Text>
        <Text style={[styles.statLabel, { color: colors.textSecondary }]}>
          this week
        </Text>
      </View>
      <View style={[styles.statPill, { backgroundColor: colors.background }]}>
        <Text style={[styles.statNumber, { color: colors.accent }]}>
          {stats.today}
        </Text>
        <Text style={[styles.statLabel, { color: colors.textSecondary }]}>
          today
        </Text>
      </View>
    </View>
  );

  // ─── Render: Segmented Filter ───────────────────────────────────────────

  const segments: { key: CategoryFilter; label: string }[] = [
    { key: "all", label: "All" },
    ...JOURNAL_CATEGORIES.map((cat) => ({
      key: cat.id as CategoryFilter,
      label: cat.emoji,
    })),
  ];

  const SegmentedFilter = () => (
    <View style={[styles.segmentedWrapper, { borderBottomColor: colors.border }]}>
      <View style={styles.segmentedContainer}>
        {segments.map((seg) => {
          const isActive = categoryFilter === seg.key;
          return (
            <TouchableOpacity
              key={seg.key}
              style={[styles.segment, isActive && styles.segmentActive]}
              onPress={() => onFilterChange(seg.key)}
              activeOpacity={0.7}
            >
              <Text
                style={[
                  styles.segmentText,
                  seg.key === "all"
                    ? styles.segmentTextAll
                    : styles.segmentTextIcon,
                  isActive
                    ? styles.segmentTextActive
                    : styles.segmentTextInactive,
                ]}
              >
                {seg.label}
              </Text>
            </TouchableOpacity>
          );
        })}
      </View>
    </View>
  );

  // ─── List Header ───────────────────────────────────────────────────────

  const ListHeader = () => (
    <View style={styles.listHeader}>
      <StatsBar />
      <SegmentedFilter />
    </View>
  );

  // ─── Empty State ───────────────────────────────────────────────────────

  const ListEmpty = () => (
    <View style={styles.emptyContainer}>
      <Ionicons
        name="create-outline"
        size={48}
        color={colors.textSecondary + "60"}
      />
      <Text style={[styles.emptyTitle, { color: colors.textSecondary }]}>
        No entries yet
      </Text>
      <Text
        style={[styles.emptySubtitle, { color: colors.textSecondary + "80" }]}
      >
        Start writing to capture your thoughts and reflections.
      </Text>
    </View>
  );

  // ─── Main Render ───────────────────────────────────────────────────────

  return (
    <View style={styles.wrapper}>
      <FlatList
        data={timelineItems}
        renderItem={renderItem}
        keyExtractor={keyExtractor}
        ListHeaderComponent={ListHeader}
        ListEmptyComponent={!loading ? ListEmpty : null}
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

      {/* FAB — New Entry */}
      <TouchableOpacity
        style={styles.fabTouchable}
        onPress={onNewEntry}
        activeOpacity={0.85}
      >
        <LinearGradient
          colors={["#2C5F5D", "#3A7573"]}
          start={{ x: 0, y: 0 }}
          end={{ x: 1, y: 1 }}
          style={styles.fab}
        >
          <Ionicons name="add" size={28} color="#FFFFFF" />
        </LinearGradient>
      </TouchableOpacity>
    </View>
  );
};

// ─── Styles ─────────────────────────────────────────────────────────────────

const styles = StyleSheet.create({
  // Wrapper so FAB can be absolutely positioned over the FlatList
  wrapper: {
    flex: 1,
  },

  // FlatList content
  listContent: {
    paddingHorizontal: 16,
    paddingBottom: 100,
  },

  // ─── List Header ──────────────────────────────────────────────────────────
  listHeader: {
    marginBottom: 8,
  },

  // ─── Stats Bar (Friendly Pills) ──────────────────────────────────────────
  statsRow: {
    flexDirection: "row",
    gap: 10,
    marginBottom: 14,
  },
  statPill: {
    flex: 1,
    flexDirection: "row",
    alignItems: "center",
    justifyContent: "center",
    gap: 6,
    paddingVertical: 10,
    paddingHorizontal: 8,
    borderRadius: 20,
  },
  statNumber: {
    fontFamily: fonts.bodyFamilyRegular,
    fontSize: 18,
    fontWeight: "600",
  },
  statLabel: {
    fontFamily: fonts.bodyFamily,
    fontSize: 11,
  },

  // ─── Segmented Filter ──────────────────────────────────────────────────
  segmentedWrapper: {
    paddingVertical: 12,
    paddingHorizontal: 16,
    borderBottomWidth: 1,
  },
  segmentedContainer: {
    flexDirection: "row",
    backgroundColor: "#F5F0EB",
    borderRadius: 12,
    padding: 3,
    gap: 2,
  },
  segment: {
    flex: 1,
    alignItems: "center",
    justifyContent: "center",
    paddingVertical: 9,
    paddingHorizontal: 4,
    borderRadius: 10,
  },
  segmentActive: {
    backgroundColor: "#FFFFFF",
    shadowColor: "#000",
    shadowOffset: { width: 0, height: 1 },
    shadowOpacity: 0.08,
    shadowRadius: 4,
    elevation: 2,
  },
  segmentText: {
    fontFamily: fonts.bodyFamilyRegular,
  },
  segmentTextAll: {
    fontSize: 12,
  },
  segmentTextIcon: {
    fontSize: 13,
  },
  segmentTextActive: {
    color: "#2C5F5D",
    fontWeight: "600",
  },
  segmentTextInactive: {
    color: "#8A8A8A",
  },

  // ─── Date Divider ────────────────────────────────────────────────────────
  dateDivider: {
    flexDirection: "row",
    alignItems: "center",
    gap: 12,
    marginTop: 8,
    marginBottom: 12,
  },
  dateLine: {
    flex: 1,
    height: 1,
  },
  dateLabel: {
    fontFamily: fonts.bodyFamilyRegular,
    fontSize: 11,
    textTransform: "uppercase",
    letterSpacing: 1,
  },

  // ─── Entry Card ──────────────────────────────────────────────────────────
  entryCard: {
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
  entryInner: {
    paddingTop: 12,
    paddingHorizontal: 16,
    paddingBottom: 14,
  },
  entryHeader: {
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
  entryTime: {
    fontFamily: fonts.bodyFamily,
    fontSize: 12,
  },
  entryPreview: {
    fontFamily: fonts.bodyFamily,
    fontSize: 14,
    lineHeight: 21.7, // 14 * 1.55
  },

  // ─── FAB ─────────────────────────────────────────────────────────────────
  fabTouchable: {
    position: "absolute",
    bottom: 24,
    right: 24,
    zIndex: 10,
    // Outer shadow layer
    shadowColor: "rgba(44, 95, 93, 1)",
    shadowOffset: { width: 0, height: 4 },
    shadowOpacity: 0.4,
    shadowRadius: 18,
    elevation: 8,
  },
  fab: {
    width: 56,
    height: 56,
    borderRadius: 28,
    alignItems: "center",
    justifyContent: "center",
  },

  // ─── Empty State ─────────────────────────────────────────────────────────
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
