import React, { useState, useEffect } from "react";
import { View, Text, ActivityIndicator, StyleSheet, AppState } from "react-native";
import { ReadingScreen } from "../components/ReadingScreen";
import { DatePickerModal } from "../components/DatePickerModal";
import { BookmarkListModal } from "../components/BookmarkListModal";
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
  
  const { reading, loading, error } = useReading(currentDate);
  const {
    bookmarks,
    isBookmarked,
    toggleBookmark,
    refreshBookmarks,
  } = useBookmarkManager(currentDate, reading?.id || "", reading?.title || "");
  const { availableDates } = useAvailableDates();

  // Check if instruction should be shown on mount
  useEffect(() => {
    async function checkInstruction() {
      const seen = await hasSeenInstruction();
      setShowInstruction(!seen);
    }
    checkInstruction();
  }, []);

  // Reset to today's date when app comes to foreground
  useEffect(() => {
    const subscription = AppState.addEventListener("change", (nextAppState) => {
      if (nextAppState === "active") {
        // Reset to today when app becomes active
        setCurrentDate(new Date());
      }
    });

    return () => {
      subscription.remove();
    };
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

  const handleOpenBookmarks = () => {
    setShowBookmarkList(true);
  };

  const handleHighlight = () => {
    console.log("Highlight - to be implemented");
  };

  const handleShare = () => {
    console.log("Share - to be implemented");
  };

  const handleSettingsPress = () => {
    console.log("Settings - to be implemented");
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
        onHighlight={handleHighlight}
        onShare={handleShare}
        onOpenBookmarks={handleOpenBookmarks}
        showInstruction={showInstruction}
        onDismissInstruction={handleDismissInstruction}
      />
      <DatePickerModal
        visible={showDatePicker}
        selectedDate={currentDate}
        onSelectDate={handleSelectDate}
        onClose={() => setShowDatePicker(false)}
        availableDates={availableDates}
      />
      <BookmarkListModal
        visible={showBookmarkList}
        bookmarks={bookmarks}
        onClose={() => setShowBookmarkList(false)}
        onSelectBookmark={handleSelectBookmark}
      />
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
