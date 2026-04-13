import React, { useEffect, useMemo, useState } from "react";
import {
  View,
  Text,
  TouchableOpacity,
  StyleSheet,
  FlatList,
  RefreshControl,
  ActivityIndicator,
} from "react-native";
import { Ionicons } from "@expo/vector-icons";
import { useTheme } from "../../hooks/useTheme";
import { useTypography } from "../../hooks/useTypography";
import { fonts, typography as staticTypography } from "../../constants/theme";
import type { JournalEntry } from "../../hooks/useJournalStorage";
import type { JournalStats } from "../../hooks/useJournalStats";
import {
  getCategoryLabel,
  getCategoryColor,
  getCategoryBadgeBgColor,
  getCategoryById,
} from "../../constants/journalCategories";
import { EntryTypeIcon } from "../../utils/entryTypeIcon";
import { SanctuaryCard } from "../ui/Sanctuary";

// ─── Timeline item union (date headers + entries) ───────────────────────────

type TimelineItem =
  | { type: "header"; date: string }
  | { type: "entry"; data: JournalEntry }
  | { type: "placeholder"; date: string };

// ─── Props ──────────────────────────────────────────────────────────────────

interface JournalTimelineProps {
  entries: JournalEntry[];
  stats: JournalStats;
  loading: boolean;
  error?: string | null;
  onSelectEntry: (entry: JournalEntry) => void;
  onDeleteEntry: (entryId: string) => void;
  onRefresh: () => void;
  onCreateEntry: () => void;
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
    return `Today, ${monthDay}`;
  }
  if (dateKey === yesterdayKey) {
    return `Yesterday, ${monthDay}`;
  }

  const weekday = date.toLocaleDateString("en-US", { weekday: "long" });
  return `${weekday}, ${monthDay}`;
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
  onSelectEntry,
  onDeleteEntry,
  onRefresh,
  onCreateEntry,
}) => {
  const { colors } = useTheme();
  const { typography } = useTypography();
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

  const todayKey = useMemo(() => toDateKey(new Date()), []);
  const currentStreak = useMemo(() => {
    if (entries.length === 0) return 0;

    const entryDays = new Set<string>(
      entries.map((entry) => toDateKey(new Date(entry.created_at)))
    );

    const cursor = new Date();
    cursor.setHours(0, 0, 0, 0);

    let streak = 0;
    while (entryDays.has(toDateKey(cursor))) {
      streak += 1;
      cursor.setDate(cursor.getDate() - 1);
    }

    return streak;
  }, [entries]);

  // Build timeline items (headers + entries), always anchored to a Today section.
  const timelineItems = useMemo(() => {
    const todayEntries: JournalEntry[] = [];
    const otherEntries: JournalEntry[] = [];

    for (const entry of entries) {
      const dateKey = toDateKey(new Date(entry.created_at));
      if (dateKey === todayKey) {
        todayEntries.push(entry);
      } else {
        otherEntries.push(entry);
      }
    }

    const grouped = groupEntriesByDate([...todayEntries, ...otherEntries]);
    if (todayEntries.length > 0) {
      return grouped;
    }

    return [
      { type: "header", date: todayKey } as TimelineItem,
      { type: "placeholder", date: todayKey } as TimelineItem,
      ...grouped,
    ];
  }, [entries, todayKey]);

  // ─── Render: Entry Card ─────────────────────────────────────────────────

  const renderEntryCard = (entry: JournalEntry) => {
    const category = getCategoryById(entry.entry_type);
    const catLabel = getCategoryLabel(entry.entry_type);
    const catColor = getCategoryColor(entry.entry_type);
    const catBadgeBg = getCategoryBadgeBgColor(entry.entry_type);
    const preview = getEntryPreview(entry);

    return (
      <TouchableOpacity
        style={styles.entryCardTouchable}
        onPress={() => onSelectEntry(entry)}
        activeOpacity={0.7}
      >
        <SanctuaryCard tone="lowest" style={styles.entryCard} contentStyle={styles.entryInner} elevated>
          <View style={styles.entryRow}>
            <View style={styles.entryTypeColumn}>
              <View
                style={[
                  styles.entryTypeIconPill,
                  { backgroundColor: catBadgeBg },
                ]}
              >
                {category ? (
                  <EntryTypeIcon svgIcon={category.svgIcon} size={22} color={catColor} />
                ) : null}
              </View>
            </View>
            <View style={styles.entryContentColumn}>
              <View style={styles.entryHeader}>
                <Text
                  style={[
                    styles.entryTypeLabel,
                    typography.bodyLarge,
                    { color: catColor, fontFamily: fonts.bodyFamilyBold, fontSize: 15, lineHeight: 20 },
                  ]}
                >
                  {catLabel}
                </Text>
              </View>

              {preview ? (
                <Text
                  style={[
                    styles.entryPreview,
                    typography.bodySmall,
                    {
                      color: colors.onSurface,
                    },
                  ]}
                  numberOfLines={3}
                  ellipsizeMode="tail"
                >
                  {preview}
                </Text>
              ) : null}
            </View>
          </View>
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
        <Text style={[styles.dateLabel, typography.h3, { color: colors.primary, fontSize: 17, lineHeight: 22 }]}>
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
    if (item.type === "placeholder") {
      return (
        <View style={styles.timelineEntryRow}>
          <View style={styles.timelineLineColumnSegment}>
            <View style={styles.timelineLineSegment} />
          </View>
          <View style={styles.timelineEntryContent}>
            <TouchableOpacity
              style={styles.entryCardTouchable}
              onPress={onCreateEntry}
              activeOpacity={0.8}
            >
              <View style={[styles.placeholderCard, { borderColor: colors.outlineVariant }]}>
                <Ionicons
                  name="calendar-outline"
                  size={22}
                  color={colors.onSurfaceVariant}
                />
                <Text style={[styles.placeholderTitle, typography.bodySmall, { color: colors.onSurface }]}>
                  Your day is a blank slate.
                </Text>
                <Text style={[styles.placeholderAction, typography.label, { color: colors.primary }]}>
                  WRITE ENTRY
                </Text>
              </View>
            </TouchableOpacity>
          </View>
        </View>
      );
    }
    return (
      <View style={styles.timelineEntryRow}>
        <View style={styles.timelineLineColumnSegment}>
          <View style={styles.timelineLineSegment} />
        </View>
        <View style={styles.timelineEntryContent}>
          {renderEntryCard(item.data)}
        </View>
      </View>
    );
  };

  const keyExtractor = (item: TimelineItem, index: number) => {
    if (item.type === "header") return `header-${item.date}`;
    if (item.type === "placeholder") return `placeholder-${item.date}`;
    return item.data.id;
  };

  const ListHeader = () => (
    <View style={styles.progressRow}>
      <View
        style={[
          styles.progressMetricBox,
          {
            backgroundColor: "#e8f4f3",
            borderColor: "#c5dedd",
          },
        ]}
      >
        <Text style={[styles.progressLabel, typography.label, { color: colors.deepTeal }]}>
          TOTAL ENTRIES
        </Text>
        <Text style={[styles.progressValue, { color: colors.deepTeal }]}>
          {stats.total}
        </Text>
      </View>
      <View
        style={[
          styles.progressMetricBox,
          {
            backgroundColor: "#e8f4f3",
            borderColor: "#c5dedd",
          },
        ]}
      >
        <Text style={[styles.progressLabel, typography.label, { color: colors.deepTeal }]}>
          CURRENT STREAK
        </Text>
        <Text style={[styles.progressValue, { color: colors.deepTeal }]}>
          {currentStreak}
        </Text>
      </View>
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
          <Text style={[styles.emptyTitle, typography.h3, { color: colors.textSecondary }]}>
            Unable to load entries
          </Text>
          <Text style={[styles.emptySubtitle, typography.bodySmall, { color: colors.textSecondary + "80" }]}>
            Your entries may still be on this device. Try again to reload them.
          </Text>
          <TouchableOpacity
            style={[styles.retryButton, { borderColor: colors.ghostBorder, backgroundColor: colors.surfaceContainerLowest }]}
            onPress={onRefresh}
            activeOpacity={0.8}
          >
            <Text style={[styles.retryText, typography.label, { color: colors.secondary }]}>Retry</Text>
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
            <Text style={[styles.emptyTitle, typography.h3, { color: colors.textSecondary }]}>
              Still loading entries
            </Text>
            <Text style={[styles.emptySubtitle, typography.bodySmall, { color: colors.textSecondary + "80" }]}>
              This is taking longer than expected.
            </Text>
            <TouchableOpacity
              style={[styles.retryButton, { borderColor: colors.ghostBorder, backgroundColor: colors.surfaceContainerLowest }]}
              onPress={onRefresh}
              activeOpacity={0.8}
            >
              <Text style={[styles.retryText, typography.label, { color: colors.secondary }]}>Retry</Text>
            </TouchableOpacity>
          </>
        ) : (
          <>
            <ActivityIndicator size="small" color={colors.accent} />
            <Text style={[styles.emptySubtitle, typography.bodySmall, { color: colors.textSecondary + "80", marginTop: 12 }]}>
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
          <Text style={[styles.emptyTitle, typography.h3, { color: colors.textSecondary }]}>
            No entries yet
          </Text>
          <Text
            style={[styles.emptySubtitle, typography.bodySmall, { color: colors.textSecondary + "80" }]}
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
  progressRow: {
    flexDirection: "row",
    gap: 20,
    justifyContent: "center",
    marginTop: 14,
    marginBottom: 16,
    paddingHorizontal: 22,
  },
  progressMetricBox: {
    width: "42%",
    borderWidth: 1,
    borderRadius: 14,
    paddingVertical: 8,
    paddingHorizontal: 8,
    alignItems: "center",
  },
  progressValue: {
    ...staticTypography.h2,
    fontSize: 24,
    lineHeight: 30,
  },
  progressLabel: {
    marginBottom: 4,
    textAlign: "center",
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
  timelineLineColumnSegment: {
    width: 40,
    alignItems: "center",
    justifyContent: "stretch",
  },
  timelineLineSegment: {
    width: 1,
    flex: 1,
    backgroundColor: "#D1D5DB",
  },
  timelineEntryContent: {
    flex: 1,
    paddingLeft: 16,
    paddingRight: 24,
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
  entryRow: {
    flexDirection: "row",
    alignItems: "flex-start",
    gap: 12,
  },
  entryTypeColumn: {
    width: 44,
    alignItems: "center",
    paddingTop: 2,
  },
  entryContentColumn: {
    flex: 1,
  },
  entryHeader: {
    flexDirection: "row",
    justifyContent: "space-between",
    alignItems: "center",
    marginBottom: 6,
  },
  entryTypeIconPill: {
    width: 42,
    height: 42,
    borderRadius: 12,
    alignItems: "center",
    justifyContent: "center",
  },
  entryTypeLabel: {
    alignSelf: "flex-start",
  },
  entryPreview: {
  },
  placeholderCard: {
    borderWidth: 2,
    borderStyle: "dashed",
    borderRadius: 16,
    alignItems: "center",
    justifyContent: "center",
    paddingHorizontal: 18,
    paddingVertical: 16,
  },
  placeholderTitle: {
    marginTop: 8,
    textAlign: "center",
  },
  placeholderAction: {
    marginTop: 8,
    letterSpacing: 1.2,
  },

  // ─── Empty State ─────────────────────────────────────────────────────────
  emptyContainer: {
    alignItems: "center",
    paddingTop: 60,
    paddingHorizontal: 40,
  },
  emptyTitle: {
    marginTop: 16,
    marginBottom: 8,
  },
  emptySubtitle: {
    textAlign: "center",
  },
  retryButton: {
    marginTop: 14,
    borderWidth: 1,
    borderRadius: 12,
    paddingHorizontal: 16,
    paddingVertical: 10,
  },
  retryText: {
  },
});
