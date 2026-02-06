import React from "react";
import {
  View,
  Text,
  TouchableOpacity,
  StyleSheet,
  FlatList,
  RefreshControl,
} from "react-native";
import { Ionicons } from "@expo/vector-icons";
import { useTheme } from "../../hooks/useTheme";
import { fonts } from "../../constants/theme";
import type { JournalEntry } from "../../hooks/useJournalEntries";
import type { JournalStats } from "../../hooks/useJournalStats";

interface JournalTimelineProps {
  entries: JournalEntry[];
  stats: JournalStats;
  loading: boolean;
  onNewEntry: () => void;
  onSearch: () => void;
  onSelectEntry: (entry: JournalEntry) => void;
  onDeleteEntry: (entryId: string) => void;
  onRefresh: () => void;
}

export const JournalTimeline: React.FC<JournalTimelineProps> = ({
  entries,
  stats,
  loading,
  onNewEntry,
  onSearch,
  onSelectEntry,
  onDeleteEntry,
  onRefresh,
}) => {
  const { colors } = useTheme();

  const renderEntry = ({ item }: { item: JournalEntry }) => {
    const date = new Date(item.created_at);
    const dateStr = date.toLocaleDateString("en-US", {
      month: "short",
      day: "numeric",
    });
    const timeStr = date.toLocaleTimeString("en-US", {
      hour: "numeric",
      minute: "2-digit",
    });

    // Truncate content to 3 lines (~120 chars)
    const preview =
      item.content.length > 120
        ? item.content.substring(0, 120).trim() + "..."
        : item.content;

    return (
      <TouchableOpacity
        style={[
          styles.entryCard,
          { backgroundColor: colors.cardBackground, borderColor: colors.border },
        ]}
        onPress={() => onSelectEntry(item)}
        activeOpacity={0.7}
      >
        <View style={styles.entryHeader}>
          <View>
            <Text style={[styles.entryDate, { color: colors.accent }]}>
              {dateStr}
            </Text>
            <Text style={[styles.entryTime, { color: colors.textSecondary }]}>
              {timeStr}
            </Text>
          </View>
          <TouchableOpacity
            onPress={() => onDeleteEntry(item.id)}
            hitSlop={{ top: 10, bottom: 10, left: 10, right: 10 }}
          >
            <Ionicons name="trash-outline" size={18} color={colors.textSecondary} />
          </TouchableOpacity>
        </View>
        <Text style={[styles.entryPreview, { color: colors.text }]} numberOfLines={3}>
          {preview}
        </Text>
      </TouchableOpacity>
    );
  };

  const ListHeader = () => (
    <View style={styles.listHeader}>
      {/* Stats Bar */}
      <View style={[styles.statsBar, { backgroundColor: colors.cardBackground, borderColor: colors.border }]}>
        <View style={styles.statItem}>
          <Text style={[styles.statNumber, { color: colors.accent }]}>
            {stats.thisMonth}
          </Text>
          <Text style={[styles.statLabel, { color: colors.textSecondary }]}>
            this month
          </Text>
        </View>
        <View style={[styles.statDivider, { backgroundColor: colors.border }]} />
        <View style={styles.statItem}>
          <Text style={[styles.statNumber, { color: colors.accent }]}>
            {stats.thisWeek}
          </Text>
          <Text style={[styles.statLabel, { color: colors.textSecondary }]}>
            this week
          </Text>
        </View>
        <View style={[styles.statDivider, { backgroundColor: colors.border }]} />
        <View style={styles.statItem}>
          <Text style={[styles.statNumber, { color: colors.accent }]}>
            {stats.today}
          </Text>
          <Text style={[styles.statLabel, { color: colors.textSecondary }]}>
            today
          </Text>
        </View>
      </View>

      {/* Action Buttons */}
      <View style={styles.actionRow}>
        <TouchableOpacity
          style={[styles.newEntryButton, { backgroundColor: colors.buttonPrimary }]}
          onPress={onNewEntry}
        >
          <Ionicons name="add" size={20} color={colors.textOnAccent} />
          <Text style={[styles.newEntryText, { color: colors.textOnAccent }]}>
            New Entry
          </Text>
        </TouchableOpacity>

        <TouchableOpacity
          style={[styles.searchButton, { backgroundColor: colors.cardBackground, borderColor: colors.border }]}
          onPress={onSearch}
        >
          <Ionicons name="search" size={20} color={colors.accent} />
        </TouchableOpacity>
      </View>
    </View>
  );

  const ListEmpty = () => (
    <View style={styles.emptyContainer}>
      <Ionicons name="create-outline" size={48} color={colors.textSecondary + "60"} />
      <Text style={[styles.emptyTitle, { color: colors.textSecondary }]}>
        No entries yet
      </Text>
      <Text style={[styles.emptySubtitle, { color: colors.textSecondary + "80" }]}>
        Start writing to capture your thoughts and reflections.
      </Text>
    </View>
  );

  return (
    <FlatList
      data={entries}
      renderItem={renderEntry}
      keyExtractor={(item) => item.id}
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
  );
};

const styles = StyleSheet.create({
  listContent: {
    paddingHorizontal: 16,
    paddingBottom: 100,
  },
  listHeader: {
    marginBottom: 16,
  },
  statsBar: {
    flexDirection: "row",
    borderRadius: 14,
    borderWidth: 1,
    paddingVertical: 16,
    marginBottom: 16,
  },
  statItem: {
    flex: 1,
    alignItems: "center",
  },
  statNumber: {
    fontFamily: fonts.bodyFamilyRegular,
    fontSize: 24,
    fontWeight: "700",
  },
  statLabel: {
    fontFamily: fonts.bodyFamily,
    fontSize: 12,
    marginTop: 2,
  },
  statDivider: {
    width: 1,
  },
  actionRow: {
    flexDirection: "row",
    gap: 12,
  },
  newEntryButton: {
    flex: 1,
    flexDirection: "row",
    alignItems: "center",
    justifyContent: "center",
    gap: 8,
    paddingVertical: 14,
    borderRadius: 14,
  },
  newEntryText: {
    fontFamily: fonts.bodyFamilyRegular,
    fontSize: 16,
    fontWeight: "600",
  },
  searchButton: {
    width: 50,
    height: 50,
    borderRadius: 14,
    borderWidth: 1,
    alignItems: "center",
    justifyContent: "center",
  },
  entryCard: {
    borderRadius: 14,
    borderWidth: 1,
    padding: 16,
    marginBottom: 12,
  },
  entryHeader: {
    flexDirection: "row",
    justifyContent: "space-between",
    alignItems: "flex-start",
    marginBottom: 10,
  },
  entryDate: {
    fontFamily: fonts.bodyFamilyRegular,
    fontSize: 14,
    fontWeight: "600",
  },
  entryTime: {
    fontFamily: fonts.bodyFamily,
    fontSize: 12,
    marginTop: 2,
  },
  entryPreview: {
    fontFamily: fonts.loraRegular,
    fontSize: 15,
    lineHeight: 22,
  },
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
