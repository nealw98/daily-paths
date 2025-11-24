import React, { useMemo, useState, useRef } from "react";
import {
  View,
  Text,
  StyleSheet,
  ScrollView,
  TouchableOpacity,
  Pressable,
} from "react-native";
import { LinearGradient } from "expo-linear-gradient";
import { Ionicons } from "@expo/vector-icons";
import { SafeAreaView } from "react-native-safe-area-context";
import { BlurView } from "expo-blur";
import { colors, fonts } from "../constants/theme";
import { DailyReading } from "../types/readings";
import { BookmarkToast } from "./BookmarkToast";
import { BookmarkInstructionOverlay } from "./BookmarkInstructionOverlay";

interface ReadingScreenProps {
  reading: DailyReading;
  onPrevDate: () => void;
  onNextDate: () => void;
  onOpenDatePicker: () => void;
  onSettingsPress: () => void;
  isBookmarked?: boolean;
  onBookmarkToggle?: () => Promise<void>;
  onHighlight?: () => void;
  onShare?: () => void;
  onOpenBookmarks?: () => void;
  showInstruction?: boolean;
  onDismissInstruction?: () => void;
}

export const ReadingScreen: React.FC<ReadingScreenProps> = ({
  reading,
  onPrevDate,
  onNextDate,
  onOpenDatePicker,
  onSettingsPress,
  isBookmarked = false,
  onBookmarkToggle,
  onHighlight,
  onShare,
  onOpenBookmarks,
  showInstruction = false,
  onDismissInstruction,
}) => {
  const [localBookmarked, setLocalBookmarked] = useState(isBookmarked);
  const [isPressing, setIsPressing] = useState(false);
  const [toastVisible, setToastVisible] = useState(false);
  const [toastMessage, setToastMessage] = useState("");
  const longPressTimer = useRef<NodeJS.Timeout | null>(null);
  const scrollViewRef = useRef<ScrollView>(null);

  // Update local state when prop changes
  React.useEffect(() => {
    setLocalBookmarked(isBookmarked);
    console.log("ReadingScreen: isBookmarked prop changed to:", isBookmarked);
  }, [isBookmarked]);

  const { month, day, weekday } = useMemo(() => {
    const date = new Date(reading.date);
    
    const month = date.toLocaleDateString("en-US", {
      month: "long",
    }).toUpperCase();
    
    const day = date.getDate();

    const weekday = new Intl.DateTimeFormat("en-US", {
      weekday: "long",
    }).format(date).toUpperCase();

    return { month, day, weekday };
  }, [reading.date]);

  // Long press handlers
  const handlePressIn = () => {
    setIsPressing(true);
    longPressTimer.current = setTimeout(async () => {
      // Trigger bookmark toggle after 600ms
      await handleBookmarkToggle();
      setIsPressing(false);
      
      // Dismiss instruction if showing
      if (showInstruction) {
        onDismissInstruction?.();
      }
    }, 600);
  };

  const handlePressOut = () => {
    setIsPressing(false);
    if (longPressTimer.current) {
      clearTimeout(longPressTimer.current);
      longPressTimer.current = null;
    }
  };

  // Cleanup timer on unmount
  React.useEffect(() => {
    return () => {
      if (longPressTimer.current) {
        clearTimeout(longPressTimer.current);
      }
    };
  }, []);

  const handleBookmarkToggle = async () => {
    if (onBookmarkToggle) {
      await onBookmarkToggle();
      const newState = !localBookmarked;
      setLocalBookmarked(newState);
      console.log("ReadingScreen: Bookmark toggled to:", newState);
      
      // Show toast
      setToastMessage(newState ? "Bookmark added" : "Bookmark removed");
      setToastVisible(true);
    }
  };

  const showToast = (message: string) => {
    setToastMessage(message);
    setToastVisible(true);
  };

  return (
    <SafeAreaView style={styles.safeArea} edges={["top", "left", "right"]}>
      <View style={styles.container}>
        <LinearGradient
          colors={[colors.deepTeal, colors.ocean]}
          start={{ x: 0, y: 0 }}
          end={{ x: 1, y: 1 }}
          style={styles.header}
        >
          <View style={styles.headerTop}>
            <Text style={styles.logo}>Daily Paths</Text>
          </View>

          <View style={styles.dateNav}>
            <TouchableOpacity onPress={onPrevDate} style={styles.navButton}>
              <BlurView intensity={20} tint="light" style={styles.blurNavButton}>
                <Ionicons name="chevron-back" size={20} color="#fff" />
              </BlurView>
            </TouchableOpacity>

            <TouchableOpacity
              onPress={onOpenDatePicker}
              style={styles.calendarDate}
            >
              <View style={styles.calendarCardWrapper}>
                <View style={styles.calendarCard}>
                  <View style={styles.calendarMonth}>
                    <Text style={styles.calendarMonthText}>{month}</Text>
                  </View>
                  <BlurView intensity={20} tint="light" style={styles.calendarDay}>
                    <Text style={styles.calendarDayText}>{day}</Text>
                  </BlurView>
                </View>
                {/* Bookmark ribbon indicator - outside the card for visibility */}
                {localBookmarked && (
                  <View style={styles.calendarBookmark}>
                    <Ionicons name="bookmark" size={18} color={colors.deepTeal} />
                  </View>
                )}
              </View>
            </TouchableOpacity>

            <TouchableOpacity onPress={onNextDate} style={styles.navButton}>
              <BlurView intensity={20} tint="light" style={styles.blurNavButton}>
                <Ionicons name="chevron-forward" size={20} color="#fff" />
              </BlurView>
            </TouchableOpacity>
          </View>
        </LinearGradient>

        <Pressable
          onPressIn={handlePressIn}
          onPressOut={handlePressOut}
          onLongPress={() => {}} // Required for Android
          delayLongPress={600}
          style={{ flex: 1 }}
        >
          <ScrollView
            ref={scrollViewRef}
            style={[styles.content, isPressing && styles.contentPressing]}
            contentContainerStyle={styles.contentContainer}
            showsVerticalScrollIndicator={false}
            scrollEnabled={!isPressing}
          >
            <Text style={styles.title}>{reading.title}</Text>

            <Text style={styles.bodyText}>{reading.opening}</Text>

            {reading.body.map((paragraph, index) => (
              <Text key={index} style={styles.bodyText}>
                {paragraph}
              </Text>
            ))}

            <View style={styles.section}>
              <Text style={styles.sectionHeading}>Today's Application</Text>
              <Text style={styles.bodyText}>{reading.todaysApplication}</Text>

              <View style={styles.thoughtCardContainer}>
                <View style={styles.thoughtCard}>
                  <BlurView intensity={20} tint="light" style={styles.thoughtGradient}>
                    <Text style={styles.thoughtLabel}>Thought for the Day</Text>
                    <Text style={styles.thoughtText}>{reading.thoughtForDay}</Text>
                  </BlurView>
                </View>
              </View>
            </View>
          </ScrollView>
        </Pressable>

        <View style={styles.actionBar}>
          <TouchableOpacity
            onPress={onOpenBookmarks}
            style={styles.actionButton}
          >
            <Ionicons
              name="bookmarks-outline"
              size={24}
              color={colors.deepTeal}
            />
          </TouchableOpacity>

          <TouchableOpacity onPress={onHighlight} style={styles.actionButton}>
            <Ionicons name="create-outline" size={24} color={colors.deepTeal} />
          </TouchableOpacity>

          <TouchableOpacity onPress={onShare} style={styles.actionButton}>
            <Ionicons
              name="arrow-redo-outline"
              size={24}
              color={colors.deepTeal}
            />
          </TouchableOpacity>

          <TouchableOpacity onPress={onSettingsPress} style={styles.actionButton}>
            <Ionicons name="settings-outline" size={24} color={colors.deepTeal} />
          </TouchableOpacity>
        </View>

        {/* Toast notification */}
        <BookmarkToast
          visible={toastVisible}
          message={toastMessage}
          onHide={() => setToastVisible(false)}
        />

        {/* First-time instruction overlay */}
        <BookmarkInstructionOverlay
          visible={showInstruction}
          onDismiss={() => onDismissInstruction?.()}
        />
      </View>
    </SafeAreaView>
  );
};

const styles = StyleSheet.create({
  safeArea: {
    flex: 1,
    backgroundColor: colors.pearl,
  },
  container: {
    flex: 1,
  },
  header: {
    paddingHorizontal: 20,
    paddingTop: 16,
    paddingBottom: 24,
  },
  headerTop: {
    alignItems: "center",
    marginBottom: 20,
  },
  logo: {
    fontFamily: fonts.headerFamilyItalic,
    fontSize: 36,
    color: "#fff",
    fontWeight: "600",
  },
  settingsButton: {
    width: 40,
    height: 40,
    borderRadius: 20,
    overflow: "hidden",
    borderWidth: 1.5,
    borderColor: "rgba(255, 255, 255, 0.25)",
  },
  blurButton: {
    width: "100%",
    height: "100%",
    alignItems: "center",
    justifyContent: "center",
    backgroundColor: "rgba(255, 255, 255, 0.12)",
  },
  dateNav: {
    flexDirection: "row",
    alignItems: "center",
    justifyContent: "center",
    gap: 12,
  },
  navButton: {
    width: 36,
    height: 36,
    borderRadius: 18,
    overflow: "hidden",
    borderWidth: 1.5,
    borderColor: "rgba(255, 255, 255, 0.25)",
  },
  blurNavButton: {
    width: "100%",
    height: "100%",
    alignItems: "center",
    justifyContent: "center",
    backgroundColor: "rgba(255, 255, 255, 0.12)",
  },
  calendarDate: {
    alignItems: "center",
  },
  calendarCardWrapper: {
    position: "relative",
  },
  calendarCard: {
    minWidth: 110,
    borderRadius: 8,
    overflow: "hidden",
    shadowColor: "#000",
    shadowOffset: { width: 0, height: 4 },
    shadowOpacity: 0.25,
    shadowRadius: 8,
    elevation: 6,
    borderWidth: 1.5,
    borderColor: "rgba(255, 255, 255, 0.3)",
  },
  calendarMonth: {
    backgroundColor: colors.deepTeal,
    paddingVertical: 4,
    paddingHorizontal: 8,
    alignItems: "center",
  },
  calendarMonthText: {
    fontFamily: fonts.bodyFamilyRegular,
    fontSize: 11,
    color: "#fff",
    fontWeight: "700",
    letterSpacing: 1,
  },
  calendarBookmark: {
    position: "absolute",
    top: 18,
    right: 10,
    shadowColor: "#000",
    shadowOffset: { width: 0, height: 2 },
    shadowOpacity: 0.3,
    shadowRadius: 3,
    elevation: 5,
    zIndex: 10,
  },
  calendarDay: {
    paddingVertical: 12,
    paddingHorizontal: 8,
    alignItems: "center",
    backgroundColor: "rgba(255, 255, 255, 0.65)",
  },
  calendarDayText: {
    fontFamily: fonts.headerFamily,
    fontSize: 40,
    color: colors.deepTeal,
    fontWeight: "600",
    lineHeight: 40,
  },
  content: {
    flex: 1,
    backgroundColor: colors.pearl,
  },
  contentPressing: {
    backgroundColor: "#f9fafb",
  },
  contentContainer: {
    padding: 20,
    paddingBottom: 100,
  },
  title: {
    fontFamily: fonts.headerFamilyBoldItalic,
    fontSize: 28,
    color: colors.deepTeal,
    marginBottom: 16,
  },
  bodyText: {
    fontFamily: fonts.loraRegular,
    fontSize: 19,
    lineHeight: 33,
    color: "#4A5A5B", // Lighter gray-teal for contrast with deepTeal titles
    marginBottom: 16,
  },
  section: {
    marginTop: 8,
  },
  sectionHeading: {
    fontFamily: fonts.headerFamilyBoldItalic,
    fontSize: 24,
    color: colors.deepTeal,
    marginBottom: 12,
  },
  thoughtCardContainer: {
    marginTop: 24,
    backgroundColor: colors.ocean,
    borderRadius: 12,
  },
  thoughtCard: {
    borderRadius: 12,
    overflow: "hidden",
    shadowColor: "#000",
    shadowOffset: { width: 0, height: 6 },
    shadowOpacity: 0.2,
    shadowRadius: 12,
    elevation: 8,
  },
  thoughtGradient: {
    padding: 20,
    backgroundColor: "rgba(255, 255, 255, 0.65)",
  },
  thoughtLabel: {
    fontFamily: fonts.bodyFamilyRegular,
    fontSize: 14,
    color: colors.ocean,
    textTransform: "uppercase",
    letterSpacing: 1,
    marginBottom: 8,
  },
  thoughtText: {
    fontFamily: fonts.headerFamilyItalic,
    fontSize: 22,
    color: colors.deepTeal,
    lineHeight: 26,
    fontWeight: "600",
  },
  actionBar: {
    position: "absolute",
    bottom: 0,
    left: 0,
    right: 0,
    flexDirection: "row",
    justifyContent: "space-around",
    alignItems: "center",
    paddingVertical: 16,
    paddingHorizontal: 40,
    backgroundColor: colors.pearl,
    borderTopWidth: 1,
    borderTopColor: colors.mist,
  },
  actionButton: {
    width: 48,
    height: 48,
    borderRadius: 24,
    backgroundColor: "#fff",
    alignItems: "center",
    justifyContent: "center",
    shadowColor: "#000",
    shadowOffset: { width: 0, height: 2 },
    shadowOpacity: 0.1,
    shadowRadius: 4,
    elevation: 3,
  },
  actionButtonActive: {
    backgroundColor: colors.seafoam,
  },
});

