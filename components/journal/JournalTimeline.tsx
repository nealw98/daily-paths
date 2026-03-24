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
import { FocusPill, SanctuaryCard } from "../ui/Sanctuary";

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
        style={styles.entryCardTouchable}
        onPress={() => onSelectEntry(entry)}
        activeOpacity={0.7}
      >
        <SanctuaryCard tone="lowest" style={styles.entryCard} contentStyle={styles.entryInner} elevated>
          <View style={styles.entryHeader}>
            <FocusPill
              label={catLabel}
              icon={(() => {
                const cat = getCategoryById(entry.entry_type);
                return cat ? (
                  <EntryTypeIcon svgIcon={cat.svgIcon} size={14} color={catColor} />
                ) : null;
              })()}
              style={styles.entryTypeBadge}
              labelStyle={[styles.entryTypeLabel, { color: catColor }]}
            />
            <Text style={[styles.entryTime, { color: colors.onSurfaceVariant }]}>
              {timeStr}
            </Text>
          </View>

          {preview ? (
            <Text
              style={[styles.entryPreview, { color: colors.onSurface, fontSize: typography.bodyFontSize - 1, lineHeight: (typography.bodyFontSize - 1) * 1.6 }]}
              numberOfLines={3}
            >
              {preview}
            </Text>
          ) : null}
        </SanctuaryCard>
      </TouchableOpacity>
    );
  };

  // ─── Render: Date Divider ───────────────────────────────────────────────

  const renderDateDivider = (dateKey: string, index: number) => {
    const label = formatDateHeader(dateKey);
    return (
      <View style={styles.dateDivider}>
        <View style={styles.timelineLineColumn}>
          <View style={[styles.timelineDot, { backgroundColor: colors.primary }]} />
        </View>
        <Text style={[styles.dateLabel, { color: colors.primary }]}>
          {label}
        </Text>
      </View>
    );
  };

  // ─── Render: Timeline Item ──────────────────────────────────────────────

  const renderItem = ({ item, index }: { item: TimelineItem; index: number }) => {
    if (item.type === "header") {
      return renderDateDivider(item.date, index);
    }
    return (
      <View style={styles.timelineEntryRow}>
        <View style={styles.timelineLineColumn} />
        <View style={styles.timelineEntryContent}>
          {renderEntryCard(item.data)}
        </View>
      </View>
    );
  };

  const keyExtractor = (item: TimelineItem, index: number) => {
    if (item.type === "header") return `header-${item.date}`;
    return item.data.id;
  };

  // ─── Render: Segmented Filter ───────────────────────────────────────────

  // Short labels for filter icons
  const filterLabels: Record<string, string> = {
    journal: "Journal",
    gratitude: "Gratitude",
    spot_check: "Spot Check",
    nightly_review: "Nightly",
  };

  const SegmentedFilter = () => (
    <View style={styles.segmentedWrapper}>
      <ScrollView
        horizontal
        showsHorizontalScrollIndicator={false}
        contentContainerStyle={styles.segmentedContainer}
      >
        <FocusPill
          label="All"
          selected={categoryFilter === "all"}
          onPress={() => onFilterChange("all")}
          icon={<FourSquares size={14} color={colors.onSurfaceVariant} strokeWidth={2.2} />}
          style={styles.filterPill}
          labelStyle={styles.filterLabel}
        />

        {JOURNAL_CATEGORIES.map((cat) => {
          const isActive = categoryFilter === cat.id;
          const catColor = getCategoryColor(cat.id);
          return (
            <FocusPill
              key={cat.id}
              style={styles.filterPill}
              labelStyle={[styles.filterLabel, isActive ? { color: catColor } : null]}
              icon={
                <EntryTypeIcon
                  svgIcon={cat.svgIcon}
                  size={14}
                  color={isActive ? catColor : colors.onSurfaceVariant}
                  strokeWidth={isActive ? 2.4 : 2.1}
                />
              }
              label={filterLabels[cat.id] ?? cat.label}
              selected={isActive}
              onPress={() => onFilterChange(cat.id as CategoryFilter)}
            />
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
            style={[styles.retryButton, { borderColor: colors.ghostBorder, backgroundColor: colors.surfaceContainerLowest }]}
            onPress={onRefresh}
            activeOpacity={0.8}
          >
            <Text style={[styles.retryText, { color: colors.secondary }]}>Retry</Text>
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
              style={[styles.retryButton, { borderColor: colors.ghostBorder, backgroundColor: colors.surfaceContainerLowest }]}
              onPress={onRefresh}
              activeOpacity={0.8}
            >
              <Text style={[styles.retryText, { color: colors.secondary }]}>Retry</Text>
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
      {/* Continuous vertical timeline line */}
      {timelineItems.length > 0 && (
        <View style={[styles.timelineAbsoluteLine, { backgroundColor: '#D1D5DB' }]} pointerEvents="none" />
      )}
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

    </View>
  );
};

// ─── Styles ─────────────────────────────────────────────────────────────────

const styles = StyleSheet.create({
  // Wrapper so FAB can be absolutely positioned over the FlatList
  wrapper: {
    flex: 1,
  },
  timelineAbsoluteLine: {
    position: "absolute",
    left: 36, // 16px padding + 20px (center of 40px column)
    top: 0,
    bottom: 0,
    width: 1,
    zIndex: 0,
  },

  // FlatList content
  listContent: {
    paddingHorizontal: 16,
    paddingBottom: 100,
  },

  // ─── List Header ──────────────────────────────────────────────────────────
  listHeader: {
    marginBottom: 12,
  },

  segmentedWrapper: {
    paddingTop: 10,
    paddingBottom: 6,
  },
  segmentedContainer: {
    flexDirection: "row",
    gap: 10,
  },
  filterPill: {
    minHeight: 38,
  },
  filterLabel: {
    fontFamily: fonts.labelFamily,
    fontSize: 11,
    lineHeight: 16,
  },

  dateDivider: {
    flexDirection: "row",
    alignItems: "center",
    minHeight: 36,
    marginTop: 6,
    marginBottom: 2,
  },
  timelineDot: {
    width: 12,
    height: 12,
    borderRadius: 6,
  },
  dateLabel: {
    fontFamily: fonts.bodyFamilyBold,
    fontSize: 24,
    marginLeft: 16,
  },

  timelineEntryRow: {
    flexDirection: "row",
  },
  timelineLineColumn: {
    width: 40,
    alignItems: "center",
    justifyContent: "center",
  },
  timelineEntryContent: {
    flex: 1,
  },

  entryCardTouchable: {
    marginBottom: 12,
  },
  entryCard: {
    borderRadius: 16,
  },
  entryInner: {
    paddingTop: 16,
    paddingBottom: 18,
    paddingLeft: 18,
    paddingRight: 18,
  },
  entryHeader: {
    flexDirection: "row",
    justifyContent: "space-between",
    alignItems: "flex-start",
    marginBottom: 10,
  },
  entryTypeBadge: {
    alignSelf: "flex-start",
  },
  entryTypeLabel: {
    fontFamily: fonts.labelFamily,
    fontSize: 12,
    lineHeight: 16,
  },
  entryTime: {
    fontFamily: fonts.bodyFamily,
    fontSize: 12,
    paddingTop: 8,
  },
  entryPreview: {
    fontFamily: fonts.bodyFamilyRegular,
    fontSize: 15,
    lineHeight: 24,
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
    borderWidth: 1,
    borderRadius: 12,
    paddingHorizontal: 16,
    paddingVertical: 10,
  },
  retryText: {
    fontFamily: fonts.bodyFamilySemiBold,
    fontSize: 14,
  },
});
