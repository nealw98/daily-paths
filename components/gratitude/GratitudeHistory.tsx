import React from "react";
import {
  View,
  Text,
  StyleSheet,
  FlatList,
  TouchableOpacity,
} from "react-native";
import { Ionicons } from "@expo/vector-icons";
import { useTheme } from "../../hooks/useTheme";
import { fonts } from "../../constants/theme";
import type { GratitudeEntry } from "../../hooks/useGratitude";

interface GratitudeHistoryProps {
  entries: GratitudeEntry[];
  onBack: () => void;
}

export const GratitudeHistory: React.FC<GratitudeHistoryProps> = ({
  entries,
  onBack,
}) => {
  const { colors } = useTheme();

  const renderEntry = ({ item }: { item: GratitudeEntry }) => {
    const date = new Date(item.date + "T12:00:00"); // Avoid timezone issues
    const dateStr = date.toLocaleDateString("en-US", {
      weekday: "short",
      month: "short",
      day: "numeric",
    });

    return (
      <View
        style={[
          styles.entryCard,
          { backgroundColor: colors.cardBackground, borderColor: colors.border },
        ]}
      >
        <Text style={[styles.entryDate, { color: colors.accent }]}>
          {dateStr}
        </Text>
        {item.items.map((gratitudeItem, idx) => (
          <View key={idx} style={styles.gratitudeRow}>
            <Ionicons name="heart" size={12} color={colors.accent + "60"} />
            <Text style={[styles.gratitudeText, { color: colors.text }]}>
              {gratitudeItem}
            </Text>
          </View>
        ))}
      </View>
    );
  };

  return (
    <View style={styles.container}>
      {/* Header */}
      <View style={[styles.header, { borderBottomColor: colors.border }]}>
        <TouchableOpacity onPress={onBack} style={styles.backButton}>
          <Ionicons name="arrow-back" size={24} color={colors.accent} />
          <Text style={[styles.backText, { color: colors.accent }]}>Back</Text>
        </TouchableOpacity>
        <Text style={[styles.headerTitle, { color: colors.text }]}>
          Gratitude History
        </Text>
        <View style={{ width: 60 }} />
      </View>

      <FlatList
        data={entries}
        renderItem={renderEntry}
        keyExtractor={(item) => item.id}
        contentContainerStyle={styles.listContent}
        showsVerticalScrollIndicator={false}
        ListEmptyComponent={
          <View style={styles.emptyContainer}>
            <Ionicons name="heart-outline" size={48} color={colors.textSecondary + "60"} />
            <Text style={[styles.emptyText, { color: colors.textSecondary }]}>
              No entries yet
            </Text>
          </View>
        }
      />
    </View>
  );
};

const styles = StyleSheet.create({
  container: {
    flex: 1,
  },
  header: {
    flexDirection: "row",
    alignItems: "center",
    justifyContent: "space-between",
    paddingHorizontal: 16,
    paddingVertical: 12,
    borderBottomWidth: 1,
  },
  backButton: {
    flexDirection: "row",
    alignItems: "center",
    gap: 4,
    width: 60,
  },
  backText: {
    fontFamily: fonts.bodyFamilyRegular,
    fontSize: 16,
  },
  headerTitle: {
    fontFamily: fonts.headerFamily,
    fontSize: 18,
    fontWeight: "600",
  },
  listContent: {
    paddingHorizontal: 16,
    paddingTop: 12,
    paddingBottom: 100,
  },
  entryCard: {
    borderRadius: 14,
    borderWidth: 1,
    padding: 16,
    marginBottom: 12,
  },
  entryDate: {
    fontFamily: fonts.bodyFamilyRegular,
    fontSize: 14,
    fontWeight: "600",
    marginBottom: 10,
  },
  gratitudeRow: {
    flexDirection: "row",
    alignItems: "flex-start",
    gap: 8,
    marginBottom: 6,
  },
  gratitudeText: {
    fontFamily: fonts.loraRegular,
    fontSize: 15,
    lineHeight: 22,
    flex: 1,
  },
  emptyContainer: {
    alignItems: "center",
    paddingTop: 60,
  },
  emptyText: {
    fontFamily: fonts.bodyFamilyRegular,
    fontSize: 16,
    marginTop: 16,
  },
});
