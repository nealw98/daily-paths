import React, { useCallback, useEffect, useMemo, useState } from "react";
import {
  View,
  Text,
  TouchableOpacity,
  StyleSheet,
  FlatList,
  RefreshControl,
  ActivityIndicator,
  Share,
  Platform,
} from "react-native";
import { Ionicons, MaterialIcons } from "@expo/vector-icons";
import { useTheme } from "../../hooks/useTheme";
import { useTypography } from "../../hooks/useTypography";
import { fonts } from "../../constants/theme";
import type { JournalEntry } from "../../hooks/useJournalStorage";
import {
  getCategoryLabel,
  getCategoryColor,
  getCategoryBadgeBgColor,
  getCategoryById,
} from "../../constants/journalCategories";
import { EntryTypeIcon } from "../../utils/entryTypeIcon";
import { SanctuaryCard } from "../ui/Sanctuary";
import { buildJournalEntryShareMessage } from "../../utils/journalShare";

// ─── Timeline item union (date headers + entries) ───────────────────────────

type TimelineItem =
  | { type: "header"; date: string }
  | { type: "entry"; data: JournalEntry }
  | { type: "placeholder"; date: string };

// ─── Props ──────────────────────────────────────────────────────────────────

interface JournalTimelineProps {
  entries: JournalEntry[];
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

/** Text-only styles (kept separate so `styles` stays `ViewStyle` for layout rows). */
const textStyles = StyleSheet.create({
  placeholderTitle: {
    marginTop: 8,
    textAlign: "center",
  },
  placeholderAction: {
    marginTop: 8,
    letterSpacing: 1.2,
  },
  emptyTitle: {
    marginTop: 16,
    marginBottom: 8,
  },
  emptySubtitle: {
    textAlign: "center",
  },
});

// ─── Component ──────────────────────────────────────────────────────────────

export const JournalTimeline: React.FC<JournalTimelineProps> = ({
  entries,
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

  const handleEntryShare = useCallback(async (entry: JournalEntry) => {
    try {
      await Share.share({ message: buildJournalEntryShareMessage(entry) });
    } catch (err) {
      console.error("Error sharing entry:", err);
    }
  }, []);

  // Build timeline items (headers + entries). Today always shows a
  // "+ New entry" CTA row right under its date header, whether or not
  // today has entries.
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

    const items: TimelineItem[] = [
      { type: "header", date: todayKey },
      { type: "placeholder", date: todayKey },
      ...todayEntries.map((entry) => ({ type: "entry" as const, data: entry })),
      ...groupEntriesByDate(otherEntries),
    ];

    return items;
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
                <View style={styles.entryHeaderTitleWrap}>
                  <Text
                    style={[
                      typography.bodySmall,
                      { color: catColor, fontFamily: fonts.bodyFamilyBold },
                    ]}
                    numberOfLines={1}
                  >
                    {catLabel}
                  </Text>
                </View>
                <TouchableOpacity
                  onPress={() => void handleEntryShare(entry)}
                  hitSlop={{ top: 10, bottom: 10, left: 10, right: 10 }}
                  style={styles.entryShareButton}
                  activeOpacity={0.6}
                >
                  {Platform.OS === "ios" ? (
                    <MaterialIcons name="ios-share" size={20} color={catColor} />
                  ) : (
                    <MaterialIcons name="share" size={20} color={catColor} />
                  )}
                </TouchableOpacity>
              </View>

              {preview ? (
                <Text
                  style={[
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
        <Text
          style={[
            styles.dateLabel,
            typography.h3,
            {
              color: colors.primary,
              fontSize: typography.bodyFontSize,
              lineHeight: Math.round(typography.bodyFontSize * (22 / 17)),
            },
          ]}
        >
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
            <SanctuaryCard
              tone="lowest"
              style={styles.newEntryCard}
              contentStyle={styles.newEntryCardContent}
              elevated
            >
              <TouchableOpacity
                style={styles.newEntryRow}
                onPress={onCreateEntry}
                activeOpacity={0.7}
              >
                <View style={styles.newEntryLeft}>
                  <Ionicons
                    name="add"
                    size={18}
                    color={colors.secondary}
                    style={{ marginRight: 8 }}
                  />
                  <Text
                    style={[
                      typography.bodyLarge,
                      {
                        color: colors.secondary,
                        fontFamily: fonts.bodyFamilySemiBold,
                        fontSize: typography.bodyFontSize,
                        lineHeight: Math.round(typography.bodyFontSize * (22 / 17)),
                      },
                    ]}
                  >
                    New entry
                  </Text>
                </View>
                <Ionicons name="chevron-forward" size={18} color={colors.secondary} />
              </TouchableOpacity>
            </SanctuaryCard>
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
          <Text style={[textStyles.emptyTitle, typography.h3, { color: colors.textSecondary }]}>
            Unable to load entries
          </Text>
          <Text style={[textStyles.emptySubtitle, typography.bodySmall, { color: colors.textSecondary + "80" }]}>
            Your entries may still be on this device. Try again to reload them.
          </Text>
          <TouchableOpacity
            style={[styles.retryButton, { borderColor: colors.ghostBorder, backgroundColor: colors.surfaceContainerLowest }]}
            onPress={onRefresh}
            activeOpacity={0.8}
          >
            <Text style={[typography.label, { color: colors.secondary }]}>Retry</Text>
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
            <Text style={[textStyles.emptyTitle, typography.h3, { color: colors.textSecondary }]}>
              Still loading entries
            </Text>
            <Text style={[textStyles.emptySubtitle, typography.bodySmall, { color: colors.textSecondary + "80" }]}>
              This is taking longer than expected.
            </Text>
            <TouchableOpacity
              style={[styles.retryButton, { borderColor: colors.ghostBorder, backgroundColor: colors.surfaceContainerLowest }]}
              onPress={onRefresh}
              activeOpacity={0.8}
            >
              <Text style={[typography.label, { color: colors.secondary }]}>Retry</Text>
            </TouchableOpacity>
          </>
        ) : (
          <>
            <ActivityIndicator size="small" color={colors.accent} />
            <Text style={[textStyles.emptySubtitle, typography.bodySmall, { color: colors.textSecondary + "80", marginTop: 12 }]}>
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
          <Text style={[textStyles.emptyTitle, typography.h3, { color: colors.textSecondary }]}>
            No entries yet
          </Text>
          <Text
            style={[textStyles.emptySubtitle, typography.bodySmall, { color: colors.textSecondary + "80" }]}
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
  newEntryCard: {
    borderRadius: 14,
    marginBottom: 12,
  },
  newEntryCardContent: {
    paddingHorizontal: 18,
    paddingVertical: 14,
    borderRadius: 14,
  },
  newEntryRow: {
    flexDirection: "row",
    alignItems: "center",
    justifyContent: "space-between",
  },
  newEntryLeft: {
    flexDirection: "row",
    alignItems: "center",
    flex: 1,
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
    justifyContent: "flex-start",
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
    alignItems: "center",
    marginBottom: 6,
    gap: 8,
  },
  entryHeaderTitleWrap: {
    flex: 1,
    minWidth: 0,
    justifyContent: "center",
  },
  entryShareButton: {
    alignItems: "center",
    justifyContent: "center",
    paddingVertical: 2,
    paddingLeft: 4,
  },
  entryTypeIconPill: {
    width: 42,
    height: 42,
    borderRadius: 12,
    alignItems: "center",
    justifyContent: "center",
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

  // ─── Empty State ─────────────────────────────────────────────────────────
  emptyContainer: {
    alignItems: "center",
    paddingTop: 60,
    paddingHorizontal: 40,
  },
  retryButton: {
    marginTop: 14,
    borderWidth: 1,
    borderRadius: 12,
    paddingHorizontal: 16,
    paddingVertical: 10,
  },
}) as any;
