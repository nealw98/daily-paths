import React, { useState, useEffect } from "react";
import { View, Text, ActivityIndicator, StyleSheet, Share } from "react-native";
import { ReadingScreen } from "../components/ReadingScreen";
import { DatePickerModal } from "../components/DatePickerModal";
import { BookmarkListModal } from "../components/BookmarkListModal";
import { SettingsModal } from "../components/SettingsModal";
import { SettingsContent } from "../components/SettingsContent";
import { useReading } from "../hooks/useReading";
import { useBookmarkManager } from "../hooks/useBookmarkManager";
import { useAvailableDates } from "../hooks/useAvailableDates";
import { hasSeenInstruction, markInstructionSeen } from "../utils/bookmarkStorage";
import { colors } from "../constants/theme";

export default function Index() {
  // Start with today's date
  const [currentDate, setCurrentDate] = useState(new Date());
  const [showDatePicker, setShowDatePicker] = useState(false);
  const [showBookmarkList, setShowBookmarkList] = useState(false);
  const [showInstruction, setShowInstruction] = useState(false);
  const [showSettings, setShowSettings] = useState(false);
  
  const { reading, loading, error } = useReading(currentDate);
  const {
    bookmarks,
    isBookmarked,
    toggleBookmark,
    refreshBookmarks,
  } = useBookmarkManager(currentDate, reading?.id || "", reading?.title || "");
  const { availableDaysOfYear } = useAvailableDates();

  // Check if instruction should be shown on mount
  useEffect(() => {
    async function checkInstruction() {
      const seen = await hasSeenInstruction();
      setShowInstruction(!seen);
    }
    checkInstruction();
  }, []);

  const handlePrevDate = () => {
    const prevDate = new Date(currentDate);
    prevDate.setDate(prevDate.getDate() - 1);
    setCurrentDate(prevDate);
  };

  const handleNextDate = () => {
    const nextDate = new Date(currentDate);
    nextDate.setDate(nextDate.getDate() + 1);
    setCurrentDate(nextDate);
  };

  const handleOpenDatePicker = () => {
    setShowDatePicker(true);
  };

  const handleSelectDate = (date: Date) => {
    setCurrentDate(date);
  };

  const handleSelectBookmark = (dateStr: string) => {
    const date = new Date(dateStr);
    setCurrentDate(date);
  };

  const handleDismissInstruction = async () => {
    setShowInstruction(false);
    await markInstructionSeen();
  };

  const handleShowInstruction = () => {
    setShowInstruction(true);
  };

  const handleOpenBookmarks = () => {
    setShowBookmarkList(true);
  };

  const handleSettingsPress = () => {
    setShowSettings(true);
  };

  const handleShare = async () => {
    if (!reading) return;

    const dateLabel = reading.date.toLocaleDateString("en-US", {
      month: "long",
      day: "numeric",
      year: "numeric",
    });

    const bodyText = reading.body.join("\n\n");

    const message = `${reading.title}\n\n${reading.opening}\n\n${bodyText}\n\nToday's Application: ${reading.todaysApplication}\n\nThought for the Day: ${reading.thoughtForDay}\n\n---\nFrom Al-Anon Daily Paths\n${dateLabel}`;

    try {
      await Share.share({ message });
    } catch (err) {
      console.error("Error sharing reading:", err);
    }
  };

  // Show loading only on initial load, not when navigating
  if (loading && !reading) {
    return (
      <View style={styles.centerContainer}>
        <ActivityIndicator size="large" color={colors.ocean} />
        <Text style={styles.loadingText}>Loading reading...</Text>
      </View>
    );
  }

  if (error && !reading) {
    return (
      <View style={styles.centerContainer}>
        <Text style={styles.errorText}>Error loading reading</Text>
        <Text style={styles.errorDetail}>{error}</Text>
        <Text style={styles.errorHint}>
          Make sure your .env file is set up correctly
        </Text>
      </View>
    );
  }

  if (!reading) {
    return (
      <View style={styles.centerContainer}>
        <Text style={styles.errorText}>No reading found</Text>
        <Text style={styles.errorDetail}>
          No reading available for {currentDate.toLocaleDateString()}
        </Text>
        <Text style={styles.errorHint}>
          Try a different date (Dec 1-7, 2024 available)
        </Text>
      </View>
    );
  }

  return (
    <>
      <ReadingScreen
        reading={reading}
        onPrevDate={handlePrevDate}
        onNextDate={handleNextDate}
        onOpenDatePicker={handleOpenDatePicker}
        onSettingsPress={handleSettingsPress}
        isBookmarked={isBookmarked}
        onBookmarkToggle={toggleBookmark}
        onShare={handleShare}
        onOpenBookmarks={handleOpenBookmarks}
        showInstruction={showInstruction}
        onDismissInstruction={handleDismissInstruction}
        onShowInstruction={handleShowInstruction}
      />
      <DatePickerModal
        visible={showDatePicker}
        selectedDate={currentDate}
        onSelectDate={handleSelectDate}
        onClose={() => setShowDatePicker(false)}
        availableDaysOfYear={availableDaysOfYear}
      />
      <BookmarkListModal
        visible={showBookmarkList}
        bookmarks={bookmarks}
        onClose={() => setShowBookmarkList(false)}
        onSelectBookmark={handleSelectBookmark}
      />
      <SettingsModal visible={showSettings} onClose={() => setShowSettings(false)}>
        <SettingsContent />
      </SettingsModal>
    </>
  );
}

const styles = StyleSheet.create({
  centerContainer: {
    flex: 1,
    justifyContent: "center",
    alignItems: "center",
    backgroundColor: colors.pearl,
    padding: 20,
  },
  loadingText: {
    marginTop: 12,
    fontSize: 16,
    color: colors.ocean,
  },
  errorText: {
    fontSize: 18,
    fontWeight: "600",
    color: colors.ink,
    marginBottom: 8,
    textAlign: "center",
  },
  errorDetail: {
    fontSize: 14,
    color: colors.ink,
    marginBottom: 8,
    textAlign: "center",
  },
  errorHint: {
    fontSize: 14,
    color: colors.ocean,
    textAlign: "center",
    fontStyle: "italic",
  },
});
