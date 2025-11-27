import React, { useMemo, useState, useRef } from "react";
import {
  View,
  Text,
  StyleSheet,
  ScrollView,
  TouchableOpacity,
  PanResponder,
  Animated,
  Dimensions,
  Pressable,
} from "react-native";
import { LinearGradient } from "expo-linear-gradient";
import { Ionicons } from "@expo/vector-icons";
import { SafeAreaView } from "react-native-safe-area-context";
import { BlurView } from "expo-blur";
import { colors, fonts } from "../constants/theme";
import { useSettings, getTextSizeMetrics } from "../hooks/useSettings";
import { DailyReading } from "../types/readings";
import { BookmarkToast } from "./BookmarkToast";
// Legacy instruction modal import kept for possible future use:
// import { BookmarkInstructionOverlay } from "./BookmarkInstructionOverlay";

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
  // Legacy instruction modal props kept for possible future use:
  // showInstruction?: boolean;
  // onDismissInstruction?: () => void;
  // onShowInstruction?: () => void;
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
  // showInstruction = false,
  // onDismissInstruction,
  // onShowInstruction,
}) => {
  const [localBookmarked, setLocalBookmarked] = useState(isBookmarked);
  const [toastVisible, setToastVisible] = useState(false);
  const [toastMessage, setToastMessage] = useState("");
  const scrollViewRef = useRef<ScrollView>(null);
  const translateX = useRef(new Animated.Value(0)).current;
  const screenWidth = Dimensions.get("window").width;
  const [isSwiping, setIsSwiping] = useState(false);
  const prevDateRef = useRef(onPrevDate);
  const nextDateRef = useRef(onNextDate);
  const lastTapRef = useRef<number | null>(null);

  const { settings, setTextSize } = useSettings();
  const typography = useMemo(
    () => getTextSizeMetrics(settings.textSize),
    [settings.textSize]
  );

  const headingTypography = useMemo(() => {
    const baseBody = 20;
    const scale = typography.bodyFontSize / baseBody;

    return {
      titleFontSize: 28 * scale,
      sectionHeadingFontSize: 24 * scale,
      thoughtLabelFontSize: 14 * Math.max(scale, 0.9),
      thoughtTextFontSize: 22 * scale,
      thoughtTextLineHeight: 26 * scale,
    };
  }, [typography.bodyFontSize]);

  // Keep gesture handlers pointing at the latest navigation callbacks
  React.useEffect(() => {
    prevDateRef.current = onPrevDate;
  }, [onPrevDate]);

  React.useEffect(() => {
    nextDateRef.current = onNextDate;
  }, [onNextDate]);

  // Opening and application paragraphs (support \n\n markers in text)
  const openingParagraphs = useMemo(
    () =>
      (reading.opening || "")
        .replace(/\\n/g, "\n")
        .split(/\n{2,}/)
        .map((p) => p.trim())
        .filter((p) => p.length > 0),
    [reading.opening]
  );

  const applicationParagraphs = useMemo(
    () =>
      (reading.todaysApplication || "")
        .replace(/\\n/g, "\n")
        .split(/\n{2,}/)
        .map((p) => p.trim())
        .filter((p) => p.length > 0),
    [reading.todaysApplication]
  );

  // Horizontal swipe gesture for previous/next readings
  const SWIPE_THRESHOLD = 40;
  const panResponder = useRef(
    PanResponder.create({
      onMoveShouldSetPanResponder: (_evt, gestureState) => {
        const { dx, dy } = gestureState;
        // Start handling when horizontal movement is dominant
        const shouldSet =
          Math.abs(dx) > 20 && Math.abs(dx) > Math.abs(dy);
        if (shouldSet) {
          setIsSwiping(true);
        }
        return shouldSet;
      },
      onPanResponderTerminationRequest: () => true,
      onPanResponderGrant: () => {
        // Ensure we start from the current position
        translateX.setOffset(0);
      },
      onPanResponderMove: (_evt, gestureState) => {
        const { dx, dy } = gestureState;
        if (Math.abs(dx) > Math.abs(dy)) {
          translateX.setValue(dx);
        }
      },
      onPanResponderRelease: (_evt, gestureState) => {
        const { dx } = gestureState;
        if (dx < -SWIPE_THRESHOLD) {
          // Swipe left → slide current reading out to the left, then bring next in from the right
          Animated.timing(translateX, {
            toValue: -screenWidth,
            duration: 160,
            useNativeDriver: true,
          }).start(() => {
            nextDateRef.current?.();
            // Position new reading just off-screen to the right
            translateX.setValue(screenWidth);
            Animated.timing(translateX, {
              toValue: 0,
              duration: 160,
              useNativeDriver: true,
            }).start(() => {
              setIsSwiping(false);
            });
          });
        } else if (dx > SWIPE_THRESHOLD) {
          // Swipe right → slide current reading out to the right, then bring previous in from the left
          Animated.timing(translateX, {
            toValue: screenWidth,
            duration: 160,
            useNativeDriver: true,
          }).start(() => {
            prevDateRef.current?.();
            // Position new reading just off-screen to the left
            translateX.setValue(-screenWidth);
            Animated.timing(translateX, {
              toValue: 0,
              duration: 160,
              useNativeDriver: true,
            }).start(() => {
              setIsSwiping(false);
            });
          });
        } else {
          // Not far enough: snap back to center
          Animated.spring(translateX, {
            toValue: 0,
            useNativeDriver: true,
          }).start(() => {
            setIsSwiping(false);
          });
        }
      },
      onPanResponderTerminate: () => {
        Animated.spring(translateX, {
          toValue: 0,
          useNativeDriver: true,
        }).start(() => {
          setIsSwiping(false);
        });
      },
    })
  ).current;

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

  // Legacy long-press handlers kept for possible future use:
  // const handlePressIn = () => {
  //   setIsPressing(true);
  //   longPressTimer.current = setTimeout(async () => {
  //     // Trigger haptic feedback
  //     if (Platform.OS === "ios") {
  //       await Haptics.impactAsync(Haptics.ImpactFeedbackStyle.Medium);
  //     } else {
  //       await Haptics.notificationAsync(Haptics.NotificationFeedbackType.Success);
  //     }
  //
  //     // Trigger bookmark toggle after haptic feedback
  //     await handleBookmarkToggle();
  //     setIsPressing(false);
  //
  //     // Dismiss instruction if showing
  //     if (showInstruction) {
  //       onDismissInstruction?.();
  //     }
  //   }, 600);
  // };
  //
  // const handlePressOut = () => {
  //   setIsPressing(false);
  //   if (longPressTimer.current) {
  //     clearTimeout(longPressTimer.current);
  //     longPressTimer.current = null;
  //   }
  // };
  //
  // // Cleanup timer on unmount
  // React.useEffect(() => {
  //   return () => {
  //     if (longPressTimer.current) {
  //       clearTimeout(longPressTimer.current);
  //     }
  //   };
  // }, []);

  const handleBookmarkToggle = async () => {
    if (onBookmarkToggle) {
      await onBookmarkToggle();
      const newState = !localBookmarked;
      setLocalBookmarked(newState);
      console.log("ReadingScreen: Bookmark toggled to:", newState);
    }
  };

  const handleContentPress = () => {
    const now = Date.now();
    if (lastTapRef.current && now - lastTapRef.current < 300) {
      lastTapRef.current = null;
      if (settings.textSize !== "medium") {
        // Reset to default Medium size on double-tap
        setTextSize("medium");
      }
    } else {
      lastTapRef.current = now;
    }
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
            {/* Legacy test button to trigger instruction modal kept for possible future use:
            {onShowInstruction && (
              <TouchableOpacity
                onPress={onShowInstruction}
                style={styles.testButton}
              >
                <Text style={styles.testButtonText}>?</Text>
              </TouchableOpacity>
            )}
            */}
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
              </View>
            </TouchableOpacity>

            <TouchableOpacity onPress={onNextDate} style={styles.navButton}>
              <BlurView intensity={20} tint="light" style={styles.blurNavButton}>
                <Ionicons name="chevron-forward" size={20} color="#fff" />
              </BlurView>
            </TouchableOpacity>
          </View>

        </LinearGradient>

        <Animated.View
          style={{ flex: 1, transform: [{ translateX }] }}
          {...panResponder.panHandlers}
        >
          <ScrollView
            ref={scrollViewRef}
            style={styles.content}
            contentContainerStyle={styles.contentContainer}
            showsVerticalScrollIndicator={false}
            scrollEnabled={!isSwiping}
          >
            <Pressable onPress={handleContentPress}>
              <View style={styles.titleRow}>
                <Text
                  style={[
                    styles.title,
                    { fontSize: headingTypography.titleFontSize },
                  ]}
                >
                  {reading.title}
                </Text>
                <TouchableOpacity
                  onPress={handleBookmarkToggle}
                  style={styles.inlineFavorite}
                  activeOpacity={0.8}
                >
                  <Ionicons
                    name={localBookmarked ? "heart" : "heart-outline"}
                    size={26}
                    color={colors.deepTeal}
                  />
                </TouchableOpacity>
              </View>

              {openingParagraphs.map((paragraph, index) => (
                <Text
                  key={`opening-${index}`}
                  style={[
                    styles.bodyText,
                    {
                      fontSize: typography.bodyFontSize,
                      lineHeight: typography.bodyLineHeight,
                    },
                  ]}
                >
                  {paragraph}
                </Text>
              ))}

              {reading.body.map((paragraph, index) => (
                <Text
                  key={index}
                  style={[
                    styles.bodyText,
                    {
                      fontSize: typography.bodyFontSize,
                      lineHeight: typography.bodyLineHeight,
                    },
                  ]}
                >
                  {paragraph}
                </Text>
              ))}

              <View style={styles.section}>
                <Text
                  style={[
                    styles.sectionHeading,
                    { fontSize: headingTypography.sectionHeadingFontSize },
                  ]}
                >
                  Today's Application
                </Text>
                {applicationParagraphs.map((paragraph, index) => (
                  <Text
                    key={`app-${index}`}
                    style={[
                      styles.bodyText,
                      {
                        fontSize: typography.bodyFontSize,
                        lineHeight: typography.bodyLineHeight,
                      },
                    ]}
                  >
                    {paragraph}
                  </Text>
                ))}

                <View style={styles.thoughtCardContainer}>
                  <View style={styles.thoughtCard}>
                    <BlurView
                      intensity={20}
                      tint="light"
                      style={styles.thoughtGradient}
                    >
                      <Text
                        style={[
                          styles.thoughtLabel,
                          { fontSize: headingTypography.thoughtLabelFontSize },
                        ]}
                      >
                        Thought for the Day
                      </Text>
                      <Text
                        style={[
                          styles.thoughtText,
                          {
                            fontSize: headingTypography.thoughtTextFontSize,
                            lineHeight: headingTypography.thoughtTextLineHeight,
                          },
                        ]}
                      >
                        {reading.thoughtForDay}
                      </Text>
                    </BlurView>
                  </View>
                </View>
              </View>
            </Pressable>
          </ScrollView>
        </Animated.View>

        <View style={styles.actionBar}>
          <TouchableOpacity
            onPress={onOpenBookmarks}
            style={styles.actionButton}
          >
            <Ionicons
              name="heart-outline"
              size={24}
              color={colors.deepTeal}
            />
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

        {/* Legacy first-time instruction overlay kept for possible future use:
        <BookmarkInstructionOverlay
          visible={showInstruction}
          onDismiss={() => onDismissInstruction?.()}
        />
        */}
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
    position: "relative",
    width: "100%",
  },
  logo: {
    fontFamily: fonts.headerFamilyItalic,
    fontSize: 36,
    color: "#fff",
    fontWeight: "600",
  },
  testButton: {
    position: "absolute",
    right: 0,
    top: 0,
    width: 32,
    height: 32,
    borderRadius: 16,
    backgroundColor: "rgba(255, 255, 255, 0.2)",
    alignItems: "center",
    justifyContent: "center",
    borderWidth: 1,
    borderColor: "rgba(255, 255, 255, 0.4)",
  },
  testButtonText: {
    color: "#fff",
    fontSize: 18,
    fontWeight: "bold",
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
    flex: 1,
    flexShrink: 1,
  },
  titleRow: {
    flexDirection: "row",
    alignItems: "flex-start",
    justifyContent: "space-between", // keep heart right-aligned within the card
    width: "100%",
    marginTop: 16,
    marginBottom: 16,
  },
  inlineFavorite: {
    marginLeft: 12,
    marginTop: 6, // fine-tuned to align with first line of title text
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

