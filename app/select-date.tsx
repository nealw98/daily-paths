import React, { useEffect, useMemo, useState } from "react";
import {
  View,
  Text,
  StyleSheet,
  TouchableOpacity,
  ScrollView,
} from "react-native";
import { SafeAreaView } from "react-native-safe-area-context";
import { Ionicons } from "@expo/vector-icons";
import { useLocalSearchParams, useRouter } from "expo-router";
import { useTheme } from "../hooks/useTheme";
import { useAvailableDates } from "../hooks/useAvailableDates";
import { useReading } from "../hooks/useReading";
import { fonts, layout } from "../constants/theme";
import { FieldShell, FocusPill, SanctuaryButton, SanctuaryCard } from "../components/ui/Sanctuary";
import { formatDateLocal, getScheduledDayOfYear, parseDateLocal } from "../utils/dateUtils";
import { getBookmarks, type BookmarkData } from "../utils/bookmarkStorage";

function startOfMonth(date: Date) {
  return new Date(date.getFullYear(), date.getMonth(), 1);
}

export default function SelectDateScreen() {
  const router = useRouter();
  const params = useLocalSearchParams<{ selectedDate?: string }>();
  const initialDate = params.selectedDate
    ? parseDateLocal(params.selectedDate)
    : new Date();

  const { colors } = useTheme();
  const { availableDaysOfYear } = useAvailableDates();
  const [selectedDate, setSelectedDate] = useState(initialDate);
  const [currentMonth, setCurrentMonth] = useState(startOfMonth(initialDate));
  const [bookmarks, setBookmarks] = useState<BookmarkData[]>([]);
  const { reading } = useReading(selectedDate);
  const todayKey = formatDateLocal(new Date());

  useEffect(() => {
    (async () => {
      const savedBookmarks = await getBookmarks();
      setBookmarks(savedBookmarks);
    })();
  }, []);

  const bookmarkMap = useMemo(
    () => new Map(bookmarks.map((bookmark) => [bookmark.date, bookmark])),
    [bookmarks]
  );

  useEffect(() => {
    if (!params.selectedDate) return;
    const parsed = parseDateLocal(params.selectedDate);
    setSelectedDate(parsed);
    setCurrentMonth(startOfMonth(parsed));
  }, [params.selectedDate]);

  const monthLabel = currentMonth.toLocaleDateString("en-US", {
    month: "long",
    year: "numeric",
  });

  const monthSubtitle = reading?.stepTheme?.trim() || "";

  const calendarCells = useMemo(() => {
    const year = currentMonth.getFullYear();
    const month = currentMonth.getMonth();
    const firstDay = new Date(year, month, 1);
    const start = new Date(firstDay);
    start.setDate(firstDay.getDate() - firstDay.getDay());

    return Array.from({ length: 35 }, (_, index) => {
      const date = new Date(start);
      date.setDate(start.getDate() + index);
      const inMonth = date.getMonth() === month;
      const scheduledDay = getScheduledDayOfYear(date);
      const available = availableDaysOfYear.length === 0 || availableDaysOfYear.includes(scheduledDay);
      const dateKey = formatDateLocal(date);
      const selected = dateKey === formatDateLocal(selectedDate);
      const isToday = dateKey === todayKey;
      const favorite = bookmarkMap.has(dateKey);

      return { date, inMonth, available, selected, isToday, favorite };
    });
  }, [availableDaysOfYear, bookmarkMap, currentMonth, selectedDate, todayKey]);

  const handleRevisitReading = () => {
    router.replace({
      pathname: "/(tabs)/today",
      params: {
        selectedDate: formatDateLocal(selectedDate),
        ts: String(Date.now()),
      },
    });
  };

  const selectedBookmark = bookmarkMap.get(formatDateLocal(selectedDate));

  return (
    <SafeAreaView style={[styles.safeArea, { backgroundColor: colors.surface }]} edges={["top"]}>
      <ScrollView style={styles.scrollView} contentContainerStyle={styles.content}>
        <View style={styles.topBar}>
          <TouchableOpacity onPress={() => router.back()} style={styles.iconButton}>
            <Ionicons name="close" size={28} color={colors.onSurface} />
          </TouchableOpacity>
          <Text style={[styles.topTitle, { color: colors.onSurface }]}>Select Date</Text>
          <View style={styles.iconButton} />
        </View>

        <View style={styles.monthHeader}>
          <View style={styles.monthCopy}>
            <Text style={[styles.monthTitle, { color: colors.primaryContainer }]}>{monthLabel}</Text>
            {monthSubtitle ? (
              <Text style={[styles.monthSubtitle, { color: colors.onSurfaceVariant }]}>
                {monthSubtitle}
              </Text>
            ) : null}
          </View>
          <View style={styles.monthNav}>
            <FieldShell style={styles.monthNavButton}>
              <TouchableOpacity onPress={() => setCurrentMonth(new Date(currentMonth.getFullYear(), currentMonth.getMonth() - 1, 1))}>
                <Ionicons name="chevron-back" size={22} color={colors.secondary} />
              </TouchableOpacity>
            </FieldShell>
            <FieldShell style={styles.monthNavButton}>
              <TouchableOpacity onPress={() => setCurrentMonth(new Date(currentMonth.getFullYear(), currentMonth.getMonth() + 1, 1))}>
                <Ionicons name="chevron-forward" size={22} color={colors.secondary} />
              </TouchableOpacity>
            </FieldShell>
          </View>
        </View>

        <View style={styles.weekdayRow}>
          {["SUN", "MON", "TUE", "WED", "THU", "FRI", "SAT"].map((weekday) => (
            <Text key={weekday} style={[styles.weekdayLabel, { color: colors.onSurfaceVariant }]}>
              {weekday}
            </Text>
          ))}
        </View>

        <View style={styles.calendarGrid}>
          {calendarCells.map(({ date, inMonth, available, selected, isToday, favorite }) => {
            const disabled = !available;
            return (
              <TouchableOpacity
                key={formatDateLocal(date)}
                style={styles.dayCell}
                disabled={disabled}
                onPress={() => setSelectedDate(date)}
                activeOpacity={0.8}
              >
                <View
                  style={[
                    styles.dayInner,
                    favorite
                      ? {
                          backgroundColor: colors.secondaryContainer,
                        }
                      : null,
                    selected
                      ? {
                          backgroundColor: favorite ? colors.secondaryContainer : colors.secondary,
                        }
                      : null,
                    isToday
                      ? {
                          borderWidth: 1.5,
                          borderColor: selected
                            ? (favorite ? colors.secondary : colors.onSecondary)
                            : colors.primaryContainer,
                        }
                      : null,
                    !inMonth ? { opacity: 0.28 } : null,
                    disabled ? { opacity: 0.18 } : null,
                  ]}
                >
                  <Text
                    style={[
                      styles.dayNumber,
                      {
                        color: selected
                          ? (favorite ? colors.onSecondaryContainer : colors.onSecondary)
                          : favorite
                            ? colors.primaryContainer
                            : colors.onSurface,
                      },
                    ]}
                  >
                    {date.getDate()}
                  </Text>
                  {available && !selected && !favorite ? (
                    <View style={[styles.dayDot, { backgroundColor: colors.outlineVariant }]} />
                  ) : null}
                </View>
              </TouchableOpacity>
            );
          })}
        </View>

        <SanctuaryCard tone="lowest" style={styles.previewCard} contentStyle={styles.previewCardContent} elevated>
          <View style={styles.previewHeaderRow}>
            <Text style={[styles.previewDate, { color: colors.secondary }]}>
              {selectedDate.toLocaleDateString("en-US", {
                month: "short",
                day: "numeric",
                year: "numeric",
              }).toUpperCase()}
            </Text>
            {selectedBookmark ? (
              <View style={styles.previewPillRow}>
                <FocusPill
                  label="Favorited"
                  selected
                  icon={<Ionicons name="heart" size={14} color={colors.onSecondaryContainer} />}
                />
              </View>
            ) : null}
          </View>
          <Text style={[styles.previewTitle, { color: colors.primaryContainer }]}>
            {reading?.title || "No reading available"}
          </Text>
          <Text style={[styles.previewSubtitle, { color: colors.onSurfaceVariant }]}>
            {reading?.thoughtForDay || "Select an available day to preview the Thought for the Day."}
          </Text>
          <SanctuaryButton
            label="View"
            onPress={handleRevisitReading}
            disabled={!reading}
            style={styles.previewButton}
            icon={<Ionicons name="open-outline" size={18} color={colors.onSecondary} />}
          />
        </SanctuaryCard>
      </ScrollView>
    </SafeAreaView>
  );
}

const styles = StyleSheet.create({
  safeArea: {
    flex: 1,
  },
  scrollView: {
    flex: 1,
  },
  content: {
    paddingHorizontal: 22,
    paddingBottom: 32,
  },
  topBar: {
    flexDirection: "row",
    alignItems: "center",
    justifyContent: "space-between",
    paddingTop: 8,
    paddingBottom: 20,
  },
  iconButton: {
    width: 44,
    height: 44,
    alignItems: "center",
    justifyContent: "center",
  },
  topTitle: {
    fontFamily: fonts.bodyFamilySemiBold,
    fontSize: 18,
    lineHeight: 24,
  },
  monthHeader: {
    flexDirection: "row",
    alignItems: "flex-start",
    justifyContent: "space-between",
    marginBottom: 24,
    gap: 16,
  },
  monthCopy: {
    flex: 1,
  },
  monthTitle: {
    fontFamily: fonts.headerFamilyBoldItalic,
    fontSize: 28,
    lineHeight: 34,
    marginBottom: 2,
  },
  monthSubtitle: {
    fontFamily: fonts.bodyFamilyRegular,
    fontSize: 14,
    lineHeight: 20,
  },
  monthNav: {
    flexDirection: "row",
    gap: 10,
    paddingTop: 2,
  },
  monthNavButton: {
    width: 56,
    height: 52,
    alignItems: "center",
    justifyContent: "center",
    paddingHorizontal: 0,
    paddingVertical: 0,
  },
  weekdayRow: {
    flexDirection: "row",
    justifyContent: "space-between",
    marginBottom: 14,
    paddingHorizontal: 6,
  },
  weekdayLabel: {
    width: 36,
    textAlign: "center",
    fontFamily: fonts.labelFamily,
    fontSize: 12,
    lineHeight: 16,
    letterSpacing: 0.8,
  },
  calendarGrid: {
    flexDirection: "row",
    flexWrap: "wrap",
    marginBottom: 26,
  },
  dayCell: {
    width: "14.2857%",
    paddingVertical: 4,
    alignItems: "center",
  },
  dayInner: {
    width: 44,
    minHeight: 52,
    borderRadius: 16,
    alignItems: "center",
    justifyContent: "center",
  },
  dayNumber: {
    fontFamily: fonts.bodyFamilyRegular,
    fontSize: 18,
    lineHeight: 22,
    fontWeight: "600",
  },
  dayDot: {
    width: 5,
    height: 5,
    borderRadius: 999,
    marginTop: 6,
  },
  previewCard: {
    borderRadius: 24,
  },
  previewCardContent: {
    padding: 28,
  },
  previewHeaderRow: {
    flexDirection: "row",
    alignItems: "center",
    justifyContent: "space-between",
    gap: 12,
    marginBottom: 20,
  },
  previewDate: {
    fontFamily: fonts.labelFamily,
    fontSize: 14,
    lineHeight: 18,
    letterSpacing: 1.2,
    flex: 1,
  },
  previewPillRow: {
    alignSelf: "flex-start",
  },
  previewTitle: {
    fontFamily: fonts.headerFamily,
    fontSize: 22,
    lineHeight: 30,
    marginBottom: 10,
  },
  previewSubtitle: {
    fontFamily: fonts.bodyFamilyRegular,
    fontSize: 16,
    lineHeight: 24,
  },
  previewButton: {
    marginTop: 28,
  },
});
