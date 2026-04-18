import React, { useCallback, useEffect, useState } from "react";
import {
  View,
  Text,
  StyleSheet,
  TouchableOpacity,
  FlatList,
} from "react-native";
import { SafeAreaView } from "react-native-safe-area-context";
import { useFocusEffect, useRouter } from "expo-router";
import { Ionicons, MaterialIcons } from "@expo/vector-icons";
import { useTheme } from "../hooks/useTheme";
import { useTypography } from "../hooks/useTypography";
import { fonts } from "../constants/theme";
import { TealHeader } from "../components/shared/TealHeader";
import { SanctuaryCard } from "../components/ui/Sanctuary";
import { getBookmarks, type BookmarkData } from "../utils/bookmarkStorage";
import { parseDateLocal } from "../utils/dateUtils";

function formatDateLabel(dateKey: string): string {
  const date = parseDateLocal(dateKey);
  return date.toLocaleDateString("en-US", {
    weekday: "long",
    month: "long",
    day: "numeric",
    year: "numeric",
  });
}

export default function FavoritesScreen() {
  const router = useRouter();
  const { colors } = useTheme();
  const { typography } = useTypography();
  const [bookmarks, setBookmarks] = useState<BookmarkData[]>([]);

  useFocusEffect(
    useCallback(() => {
      let active = true;
      (async () => {
        const saved = await getBookmarks();
        if (!active) return;
        // Newest first by timestamp.
        const sorted = [...saved].sort((a, b) => b.timestamp - a.timestamp);
        setBookmarks(sorted);
      })();
      return () => {
        active = false;
      };
    }, [])
  );

  const handleOpen = (bookmark: BookmarkData) => {
    router.replace({
      pathname: "/(tabs)/reading",
      params: {
        selectedDate: bookmark.date,
        ts: String(Date.now()),
      },
    });
  };

  return (
    <SafeAreaView
      style={[styles.container, { backgroundColor: colors.surface }]}
      edges={[]}
    >
      <TealHeader title="Favorites" onBack={() => router.back()} />
      {bookmarks.length === 0 ? (
        <View style={styles.emptyContainer}>
          <Ionicons
            name="heart-outline"
            size={48}
            color={colors.textSecondary + "60"}
          />
          <Text style={[styles.emptyTitle, typography.h3, { color: colors.textSecondary }]}>
            No favorites yet
          </Text>
          <Text
            style={[
              styles.emptySubtitle,
              typography.bodySmall,
              { color: colors.textSecondary + "80" },
            ]}
          >
            Tap the heart on a reading to save it here.
          </Text>
        </View>
      ) : (
        <FlatList
          data={bookmarks}
          keyExtractor={(item) => item.date}
          contentContainerStyle={styles.listContent}
          showsVerticalScrollIndicator={false}
          renderItem={({ item }) => (
            <TouchableOpacity
              style={styles.rowTouchable}
              onPress={() => handleOpen(item)}
              activeOpacity={0.7}
            >
              <SanctuaryCard
                tone="lowest"
                style={styles.rowCard}
                contentStyle={styles.rowCardContent}
                elevated
              >
                <View style={styles.rowBody}>
                  <Text
                    style={[
                      typography.bodyLarge,
                      {
                        color: colors.onSurface,
                        fontFamily: fonts.bodyFamilySemiBold,
                      },
                    ]}
                    numberOfLines={2}
                  >
                    {item.title}
                  </Text>
                  <Text
                    style={[
                      typography.bodySmall,
                      {
                        color: colors.onSurfaceVariant,
                        marginTop: 2,
                      },
                    ]}
                  >
                    {formatDateLabel(item.date)}
                  </Text>
                  <View style={styles.openCtaRow}>
                    <Text
                      style={[
                        typography.label,
                        { color: colors.accent, letterSpacing: 0.1 },
                      ]}
                    >
                      Open
                    </Text>
                    <MaterialIcons
                      name="chevron-right"
                      size={20}
                      color={colors.accent}
                    />
                  </View>
                </View>
              </SanctuaryCard>
            </TouchableOpacity>
          )}
        />
      )}
    </SafeAreaView>
  );
}

const styles = StyleSheet.create({
  container: {
    flex: 1,
  },
  listContent: {
    paddingHorizontal: 16,
    paddingVertical: 14,
    paddingBottom: 40,
  },
  rowTouchable: {
    marginBottom: 10,
  },
  rowCard: {
    borderRadius: 10,
    overflow: "hidden",
  },
  rowCardContent: {
    borderRadius: 10,
  },
  rowBody: {
    gap: 3,
    paddingVertical: 14,
    paddingHorizontal: 16,
  },
  openCtaRow: {
    flexDirection: "row",
    alignItems: "center",
    justifyContent: "flex-end",
    gap: 2,
    marginTop: 6,
  },
  emptyContainer: {
    flex: 1,
    alignItems: "center",
    justifyContent: "center",
    paddingHorizontal: 40,
    paddingBottom: 80,
  },
  emptyTitle: {
    marginTop: 16,
    marginBottom: 8,
    textAlign: "center",
  },
  emptySubtitle: {
    textAlign: "center",
  },
});
