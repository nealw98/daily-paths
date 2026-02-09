import React, { useMemo, useState, useCallback } from "react";
import { useSettings, getTextSizeMetrics } from "../../hooks/useSettings";
import {
  View,
  Text,
  ScrollView,
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
  getCategoryLabel,
  getCategoryColor,
  getCategoryById,
  JOURNAL_CATEGORIES,
} from "../../constants/journalCategories";
import { EntryTypeIcon } from "../../utils/entryTypeIcon";
import { FourSquares } from "../icons";

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

/**
 * Build the full (non-truncated) content for an expanded entry.
 */
function getEntryFullContent(entry: JournalEntry): string {
  if (entry.entry_type === "gratitude") {
    if (entry.structured_content?.items && Array.isArray(entry.structured_content.items)) {
      return (entry.structured_content.items as string[]).filter(Boolean).join(" \u2022 ");
    }
    if (entry.content) {
      return entry.content
        .split("\n")
        .map((line) => line.replace(/^-\s*/, "").trim())
        .filter(Boolean)
        .join(" \u2022 ");
    }
    return "";
  }

  if (entry.content) {
    return stripMarkdown(entry.content);
  }
  return "";
}

/**
 * For guided entries, build question/answer pairs.
 */
function getGuidedContent(entry: JournalEntry): Array<{ question: string; answer: string }> {
  const catConfig = getCategoryById(entry.entry_type as EntryType);
  const prompts = catConfig?.guidedPrompts ?? [];
  const responses = entry.structured_content ?? {};
  const pairs: Array<{ question: string; answer: string }> = [];

  for (const prompt of prompts) {
    const value = responses[prompt.id];
    if (value && typeof value === "string" && value.trim()) {
      pairs.push({ question: prompt.question, answer: value.trim() });
    }
  }
  return pairs;
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
  onSelectEntry,
  onDeleteEntry,
  onRefresh,
}) => {
  const { colors } = useTheme();
  const { settings } = useSettings();
  const typography = useMemo(() => getTextSizeMetrics(settings.textSize), [settings.textSize]);

  // ─── Expand/collapse state ────────────────────────────────────────────
  const [expandedIds, setExpandedIds] = useState<Set<string>>(new Set());
  const [allExpanded, setAllExpanded] = useState(false);

  const toggleEntry = useCallback((id: string) => {
    setExpandedIds((prev) => {
      const next = new Set(prev);
      if (next.has(id)) {
        next.delete(id);
      } else {
        next.add(id);
      }
      return next;
    });
  }, []);

  const toggleAll = useCallback(() => {
    if (allExpanded) {
      setExpandedIds(new Set());
      setAllExpanded(false);
    } else {
      const allIds = new Set(entries.map((e) => e.id));
      setExpandedIds(allIds);
      setAllExpanded(true);
    }
  }, [allExpanded, entries]);

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

  const renderEntryCard = (entry: JournalEntry, hideBottomLine: boolean) => {
    const date = new Date(entry.created_at);
    const timeStr = date.toLocaleTimeString("en-US", {
      hour: "numeric",
      minute: "2-digit",
    });

    const catLabel = getCategoryLabel(entry.entry_type);
    const catColor = getCategoryColor(entry.entry_type);
    const preview = getEntryPreview(entry);
    const isExpanded = expandedIds.has(entry.id);
    const isGuided = entry.entry_type === "spot_check" || entry.entry_type === "nightly_review";

    return (
      <View
        style={[
          styles.entryCard,
          !hideBottomLine && { borderBottomWidth: 1, borderBottomColor: colors.border },
        ]}
      >
        {/* Header row: tappable to expand/collapse */}
        <TouchableOpacity
          style={styles.entryInner}
          onPress={() => toggleEntry(entry.id)}
          activeOpacity={0.7}
        >
          <View style={styles.entryHeader}>
            {categoryFilter === "all" ? (
              <View style={styles.entryTypeBadge}>
                {(() => {
                  const cat = getCategoryById(entry.entry_type);
                  return cat ? (
                    <EntryTypeIcon svgIcon={cat.svgIcon} size={14} color={catColor} />
                  ) : null;
                })()}
                <Text style={[styles.entryTypeLabel, { color: catColor }]}>
                  {catLabel}
                </Text>
              </View>
            ) : (
              <View />
            )}
            <View style={styles.entryHeaderRight}>
              <Text style={[styles.entryTime, { color: colors.textSecondary }]}>
                {timeStr}
              </Text>
              <Ionicons
                name={isExpanded ? "chevron-up" : "chevron-down"}
                size={16}
                color={colors.textSecondary}
              />
            </View>
          </View>

          {/* Collapsed: preview text */}
          {!isExpanded && preview ? (
            <Text
              style={[styles.entryPreview, { color: colors.ink, fontSize: typography.bodyFontSize, lineHeight: typography.bodyFontSize * 1.55 }]}
              numberOfLines={3}
            >
              {preview}
            </Text>
          ) : null}
        </TouchableOpacity>

        {/* Expanded: full content — tappable to open detail */}
        {isExpanded && (
          <TouchableOpacity
            style={styles.expandedContent}
            onPress={() => onSelectEntry(entry)}
            activeOpacity={0.8}
          >
            {isGuided ? (
              // Show question/answer pairs for guided entries
              getGuidedContent(entry).map((pair, i) => (
                <View key={i} style={styles.guidedPair}>
                  <Text style={[styles.guidedQuestion, { color: colors.textSecondary, fontSize: typography.bodyFontSize - 2 }]}>
                    {pair.question}
                  </Text>
                  <Text style={[styles.guidedAnswer, { color: colors.ink, fontSize: typography.bodyFontSize, lineHeight: typography.bodyFontSize * 1.55 }]}>
                    {pair.answer}
                  </Text>
                </View>
              ))
            ) : (
              <Text style={[styles.entryFullText, { color: colors.ink, fontSize: typography.bodyFontSize, lineHeight: typography.bodyFontSize * 1.55 }]}>
                {getEntryFullContent(entry)}
              </Text>
            )}
            <Text style={[styles.tapToOpen, { color: colors.seafoam, fontSize: typography.bodyFontSize - 4 }]}>
              Tap to open
            </Text>
          </TouchableOpacity>
        )}
      </View>
    );
  };

  // ─── Render: Date Divider ───────────────────────────────────────────────

  const renderDateDivider = (dateKey: string) => {
    const label = formatDateHeader(dateKey);
    return (
      <View style={styles.dateDivider}>
        <View style={[styles.dateLine, { backgroundColor: colors.accent + "30" }]} />
        <Text style={[styles.dateLabel, { color: colors.accent }]}>
          {label}
        </Text>
        <View style={[styles.dateLine, { backgroundColor: colors.accent + "30" }]} />
      </View>
    );
  };

  // ─── Render: Timeline Item ──────────────────────────────────────────────

  const renderItem = ({ item, index }: { item: TimelineItem; index: number }) => {
    if (item.type === "header") {
      return renderDateDivider(item.date);
    }
    const nextItem = timelineItems[index + 1];
    const hideBottomLine = nextItem?.type === "header";
    return renderEntryCard(item.data, hideBottomLine);
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
        <Text style={[styles.statLabel, { color: colors.text }]}>
          this month
        </Text>
      </View>
      <View style={[styles.statPill, { backgroundColor: colors.background }]}>
        <Text style={[styles.statNumber, { color: colors.accent }]}>
          {stats.thisWeek}
        </Text>
        <Text style={[styles.statLabel, { color: colors.text }]}>
          this week
        </Text>
      </View>
      <View style={[styles.statPill, { backgroundColor: colors.background }]}>
        <Text style={[styles.statNumber, { color: colors.accent }]}>
          {stats.today}
        </Text>
        <Text style={[styles.statLabel, { color: colors.text }]}>
          today
        </Text>
      </View>
    </View>
  );

  // ─── Render: Segmented Filter ───────────────────────────────────────────

  // Icon size scales with the user's text size; generous hit target for primary nav
  const iconSize = Math.round(typography.bodyFontSize * 1.4);
  const hitTarget = Math.round(iconSize * 1.8);

  const SegmentedFilter = () => (
    <View style={[styles.segmentedWrapper, { borderBottomColor: colors.border }]}>
      <ScrollView
        horizontal
        showsHorizontalScrollIndicator={false}
        contentContainerStyle={styles.segmentedContainer}
      >
        {/* Category icon buttons */}
        {JOURNAL_CATEGORIES.map((cat) => {
          const isActive = categoryFilter === cat.id;
          const catColor = getCategoryColor(cat.id);
          return (
            <TouchableOpacity
              key={cat.id}
              style={[
                styles.filterIcon,
                { width: hitTarget, height: hitTarget, borderRadius: Math.round(hitTarget * 0.3) },
                isActive
                  ? { backgroundColor: catColor + "14", borderColor: catColor + "35", borderWidth: 1.5 }
                  : { borderColor: "transparent", borderWidth: 1.5 },
              ]}
              onPress={() => onFilterChange(cat.id as CategoryFilter)}
              activeOpacity={0.7}
            >
              <EntryTypeIcon
                svgIcon={cat.svgIcon}
                size={iconSize}
                color={catColor}
                strokeWidth={isActive ? 2.2 : 1.8}
              />
            </TouchableOpacity>
          );
        })}

        {/* All / Notebook icon — last position */}
        <TouchableOpacity
          style={[
            styles.filterIcon,
            { width: hitTarget, height: hitTarget, borderRadius: Math.round(hitTarget * 0.3) },
            categoryFilter === "all"
              ? { backgroundColor: colors.accent + "14", borderColor: colors.accent + "35", borderWidth: 1.5 }
              : { borderColor: "transparent", borderWidth: 1.5 },
          ]}
          onPress={() => onFilterChange("all")}
          activeOpacity={0.7}
        >
          <FourSquares
            size={iconSize}
            color={colors.accent}
            strokeWidth={categoryFilter === "all" ? 2.2 : 1.8}
          />
        </TouchableOpacity>
      </ScrollView>
    </View>
  );

  // ─── List Header ───────────────────────────────────────────────────────

  const ListHeader = () => (
    <View style={styles.listHeader}>
      <StatsBar />
      <SegmentedFilter />
      {filteredEntries.length > 0 && (
        <TouchableOpacity
          style={styles.expandAllButton}
          onPress={toggleAll}
          activeOpacity={0.7}
        >
          <Ionicons
            name={allExpanded ? "contract-outline" : "expand-outline"}
            size={14}
            color={colors.seafoam}
          />
          <Text style={[styles.expandAllText, { color: colors.seafoam }]}>
            {allExpanded ? "Collapse All" : "Expand All"}
          </Text>
        </TouchableOpacity>
      )}
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
    fontSize: 24,
    fontWeight: "600",
  },
  statLabel: {
    fontFamily: fonts.bodyFamily,
    fontSize: 12,
  },

  // ─── Filter Icons ─────────────────────────────────────────────────────
  segmentedWrapper: {
    paddingVertical: 10,
    paddingHorizontal: 12,
    borderBottomWidth: 1,
  },
  segmentedContainer: {
    flexGrow: 1,
    flexDirection: "row",
    justifyContent: "center",
    gap: 14,
  },
  filterIcon: {
    alignItems: "center",
    justifyContent: "center",
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
    fontSize: 12,
    textTransform: "uppercase",
    letterSpacing: 1.2,
  },

  // ─── Entry Card ──────────────────────────────────────────────────────────
  entryCard: {
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
  entryTypeBadge: {
    flexDirection: "row",
    alignItems: "center",
    gap: 5,
  },
  entryTypeLabel: {
    fontFamily: fonts.bodyFamilyRegular,
    fontSize: 12,
    fontWeight: "600",
    textTransform: "uppercase",
    letterSpacing: 0.8,
  },
  entryTime: {
    fontFamily: fonts.bodyFamily,
    fontSize: 12,
  },
  entryHeaderRight: {
    flexDirection: "row",
    alignItems: "center",
    gap: 8,
  },
  entryPreview: {
    fontFamily: fonts.bodyFamily,
    fontSize: 14,
    lineHeight: 22,
  },
  expandedContent: {
    paddingHorizontal: 16,
    paddingBottom: 14,
  },
  entryFullText: {
    fontFamily: fonts.bodyFamily,
    fontSize: 14,
    lineHeight: 22,
  },
  guidedPair: {
    marginBottom: 12,
  },
  guidedQuestion: {
    fontFamily: fonts.bodyFamilyRegular,
    fontWeight: "600",
    marginBottom: 4,
  },
  guidedAnswer: {
    fontFamily: fonts.bodyFamily,
    fontSize: 14,
    lineHeight: 22,
  },
  tapToOpen: {
    fontFamily: fonts.bodyFamilyRegular,
    marginTop: 10,
    textAlign: "right",
    fontStyle: "italic",
  },
  expandAllButton: {
    flexDirection: "row",
    alignItems: "center",
    justifyContent: "flex-end",
    gap: 4,
    paddingVertical: 8,
    paddingHorizontal: 4,
  },
  expandAllText: {
    fontFamily: fonts.bodyFamilyRegular,
    fontSize: 12,
    fontWeight: "500",
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
