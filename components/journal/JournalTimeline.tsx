import React, { useEffect, useMemo, useState } from "react";
import { useSettings, getTextSizeMetrics } from "../../hooks/useSettings";
import {
  View,
  Text,
  ScrollView,
  TouchableOpacity,
  StyleSheet,
  FlatList,
  RefreshControl,
  ActivityIndicator,
} from "react-native";
import { LinearGradient } from "expo-linear-gradient";
import { Ionicons } from "@expo/vector-icons";
import { useTheme } from "../../hooks/useTheme";
import { fonts } from "../../constants/theme";
import type { JournalEntry } from "../../hooks/useJournalStorage";
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
  error?: string | null;
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
        .join("\n");
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
      const joined = items.join("\n");
      const stripped = stripMarkdown(joined);
      return stripped.length > 120
        ? stripped.substring(0, 120).trim() + "..."
        : stripped;
    }
    return "";
  }

  // Guided entries (spot_check, nightly_review): use first answered prompt in defined order
  if (
    entry.entry_type === "spot_check" ||
    entry.entry_type === "nightly_review"
  ) {
    if (entry.structured_content) {
      const cat = getCategoryById(entry.entry_type);
      const prompts = cat?.guidedPrompts ?? [];
      for (const prompt of prompts) {
        const val = entry.structured_content[prompt.id];
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
  error,
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
  const [slowLoading, setSlowLoading] = useState(false);

  useEffect(() => {
    if (!loading) {
      setSlowLoading(false);
      return;
    }
    const timer = setTimeout(() => {
      setSlowLoading(true);
    }, 8000);
    return () => clearTimeout(timer);
  }, [loading]);

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

    const catLabel = getCategoryLabel(entry.entry_type);
    const catColor = getCategoryColor(entry.entry_type);
    const preview = getEntryPreview(entry);

    return (
      <TouchableOpacity
        style={[styles.entryCard, { backgroundColor: colors.cardBackground, borderTopColor: catColor, borderTopWidth: 2.5 }]}
        onPress={() => onSelectEntry(entry)}
        activeOpacity={0.7}
      >
        <View style={styles.entryInner}>
          <View style={styles.entryHeader}>
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
            <Text style={[styles.entryTime, { color: colors.textSecondary }]}>
              {timeStr}
            </Text>
          </View>

          {preview ? (
            <Text
              style={[styles.entryPreview, { color: colors.ink, fontSize: typography.bodyFontSize - 2, lineHeight: (typography.bodyFontSize - 2) * 1.55 }]}
              numberOfLines={3}
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
    return renderEntryCard(item.data);
  };

  const keyExtractor = (item: TimelineItem, index: number) => {
    if (item.type === "header") return `header-${item.date}`;
    return item.data.id;
  };

  // ─── Render: Segmented Filter ───────────────────────────────────────────

  // Icon size scales with the user's text size; generous hit target for primary nav
  const iconSize = Math.round(typography.bodyFontSize * 1.25);
  const hitTarget = Math.round(iconSize * 1.7);

  // Short labels for filter icons
  const filterLabels: Record<string, string> = {
    journal: "Journal",
    gratitude: "Gratitude",
    spot_check: "Spot Check",
    nightly_review: "Nightly",
  };

  const SegmentedFilter = () => (
    <View
      style={[
        styles.segmentedWrapper,
        { borderBottomColor: colors.textSecondary + "A6" },
      ]}
    >
      <ScrollView
        horizontal
        showsHorizontalScrollIndicator={false}
        contentContainerStyle={styles.segmentedContainer}
      >
        {/* All icon — first position */}
        <TouchableOpacity
          style={[
            styles.filterIconWrapper,
          ]}
          onPress={() => onFilterChange("all")}
          activeOpacity={0.7}
        >
          <View
            style={[
              styles.filterIcon,
              { width: hitTarget, height: hitTarget, borderRadius: Math.round(hitTarget * 0.3) },
              categoryFilter === "all"
                ? { backgroundColor: colors.accent + "14", borderColor: colors.accent + "35", borderWidth: 1.5 }
                : { borderColor: "transparent", borderWidth: 1.5 },
            ]}
          >
            <FourSquares
              size={iconSize}
              color={colors.accent}
              strokeWidth={categoryFilter === "all" ? 2.6 : 2.2}
            />
          </View>
          <Text
            style={[
              styles.filterLabel,
              { color: colors.accent },
            ]}
            numberOfLines={1}
          >
            All
          </Text>
        </TouchableOpacity>

        {/* Category icon buttons */}
        {JOURNAL_CATEGORIES.map((cat) => {
          const isActive = categoryFilter === cat.id;
          const catColor = getCategoryColor(cat.id);
          return (
            <TouchableOpacity
              key={cat.id}
              style={[
                styles.filterIconWrapper,
              ]}
              onPress={() => onFilterChange(cat.id as CategoryFilter)}
              activeOpacity={0.7}
            >
              <View
                style={[
                  styles.filterIcon,
                  { width: hitTarget, height: hitTarget, borderRadius: Math.round(hitTarget * 0.3) },
                  isActive
                    ? { backgroundColor: catColor + "14", borderColor: catColor + "35", borderWidth: 1.5 }
                    : { borderColor: "transparent", borderWidth: 1.5 },
                ]}
              >
                <EntryTypeIcon
                  svgIcon={cat.svgIcon}
                  size={iconSize}
                  color={catColor}
                  strokeWidth={isActive ? 2.6 : 2.2}
                />
              </View>
              <Text
                style={[
                  styles.filterLabel,
                  { color: catColor },
                ]}
                numberOfLines={1}
              >
                {filterLabels[cat.id] ?? cat.label}
              </Text>
            </TouchableOpacity>
          );
        })}

      </ScrollView>
    </View>
  );

  // ─── List Header ───────────────────────────────────────────────────────

  const ListHeader = () => (
    <View style={styles.listHeader}>
      <SegmentedFilter />
    </View>
  );

  // ─── Empty State ───────────────────────────────────────────────────────

  const ListEmpty = () => (
    <View style={styles.emptyContainer}>
      {error ? (
        <>
          <Ionicons
            name="alert-circle-outline"
            size={44}
            color={colors.textSecondary + "70"}
          />
          <Text style={[styles.emptyTitle, { color: colors.textSecondary }]}>
            Unable to load entries
          </Text>
          <Text style={[styles.emptySubtitle, { color: colors.textSecondary + "80" }]}>
            Your entries may still be on this device. Try again to reload them.
          </Text>
          <TouchableOpacity
            style={[styles.retryButton, { borderColor: colors.accent }]}
            onPress={onRefresh}
            activeOpacity={0.8}
          >
            <Text style={[styles.retryText, { color: colors.accent }]}>Retry</Text>
          </TouchableOpacity>
        </>
      ) : loading ? (
        slowLoading ? (
          <>
            <Ionicons
              name="cloud-offline-outline"
              size={44}
              color={colors.textSecondary + "70"}
            />
            <Text style={[styles.emptyTitle, { color: colors.textSecondary }]}>
              Still loading entries
            </Text>
            <Text style={[styles.emptySubtitle, { color: colors.textSecondary + "80" }]}>
              This is taking longer than expected.
            </Text>
            <TouchableOpacity
              style={[styles.retryButton, { borderColor: colors.accent }]}
              onPress={onRefresh}
              activeOpacity={0.8}
            >
              <Text style={[styles.retryText, { color: colors.accent }]}>Retry</Text>
            </TouchableOpacity>
          </>
        ) : (
          <>
            <ActivityIndicator size="small" color={colors.accent} />
            <Text style={[styles.emptySubtitle, { color: colors.textSecondary + "80", marginTop: 12 }]}>
              Loading entries...
            </Text>
          </>
        )
      ) : (
        <>
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
        </>
      )}
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

      {/* FAB — New Entry */}
      <TouchableOpacity
        style={styles.fabTouchable}
        onPress={onNewEntry}
        activeOpacity={0.85}
      >
        <LinearGradient
          colors={[colors.heroGradientStart, colors.heroGradientEnd]}
          start={{ x: 0, y: 0 }}
          end={{ x: 1, y: 1 }}
          style={styles.fab}
        >
          <Ionicons name="add" size={28} color={colors.textOnAccent} />
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

  // ─── Filter Icons ─────────────────────────────────────────────────────
  segmentedWrapper: {
    paddingVertical: 10,
    paddingHorizontal: 12,
    borderBottomWidth: 1.5,
  },
  segmentedContainer: {
    flexGrow: 1,
    flexDirection: "row",
    justifyContent: "center",
    gap: 16,
  },
  filterIconWrapper: {
    alignItems: "center",
    minWidth: 52,
  },
  filterIcon: {
    alignItems: "center",
    justifyContent: "center",
  },
  filterLabel: {
    fontFamily: fonts.bodyFamilyRegular,
    fontSize: 10,
    fontWeight: "700",
    textTransform: "uppercase",
    letterSpacing: 0.8,
    marginTop: 5,
    textAlign: "center",
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
    // backgroundColor set inline via colors.cardBackground
    borderRadius: 12,
    shadowColor: "#000",
    shadowOffset: { width: 0, height: 1 },
    shadowOpacity: 0.04,
    shadowRadius: 3,
    elevation: 1,
    marginBottom: 10,
  },
  entryInner: {
    paddingTop: 14,
    paddingBottom: 16,
    paddingLeft: 18,
    paddingRight: 18,
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
  entryPreview: {
    fontFamily: fonts.bodyFamilyRegular,
    fontSize: 14,
    lineHeight: 22,
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
  retryButton: {
    marginTop: 14,
    borderWidth: 1.5,
    borderRadius: 10,
    paddingHorizontal: 16,
    paddingVertical: 8,
  },
  retryText: {
    fontFamily: fonts.bodyFamilyRegular,
    fontSize: 14,
    fontWeight: "600",
  },
});
