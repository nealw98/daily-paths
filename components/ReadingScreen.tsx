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
  Platform,
} from "react-native";
import { LinearGradient } from "expo-linear-gradient";
import { Ionicons } from "@expo/vector-icons";
import { SafeAreaView } from "react-native-safe-area-context";
import { BlurView } from "expo-blur";
import * as Haptics from "expo-haptics";
import { fonts } from "../constants/theme";
import { useTheme } from "../hooks/useTheme";
import { useSettings, getTextSizeMetrics } from "../hooks/useSettings";
import { DailyReading } from "../types/readings";
import { BookmarkToast } from "./BookmarkToast";
import { ReadingFeedback } from "./ReadingFeedback";
import { getScheduledDayOfYear } from "../utils/dateUtils";
// Legacy instruction modal import kept for possible future use:
// import { BookmarkInstructionOverlay } from "./BookmarkInstructionOverlay";

/**
 * Very small inline markdown helper.
 *
 * Supports *italic* or _italic_ spans inside a single Text block.
 * Returns an array of strings and nested <Text> nodes that can be used
 * as the children of a <Text> component.
 */
const renderInlineMarkdown = (text: string, italicStyle: any) => {
  const parts: React.ReactNode[] = [];
  const regex = /(\*([^*]+)\*|_([^_]+)_)/g;

  let lastIndex = 0;
  let match: RegExpExecArray | null;
  let key = 0;

  while ((match = regex.exec(text)) !== null) {
    if (match.index > lastIndex) {
      parts.push(text.slice(lastIndex, match.index));
    }

    const italicText = match[2] ?? match[3];
    parts.push(
      <Text key={`italic-${key++}`} style={italicStyle}>
        {italicText}
      </Text>
    );

    lastIndex = match.index + match[0]!.length;
  }

  if (lastIndex < text.length) {
    parts.push(text.slice(lastIndex));
  }

  return parts;
};

interface ReadingScreenProps {
  reading: DailyReading;
  onPrevDate: () => void;
  onNextDate: () => void;
  onOpenDatePicker: () => void;
  onOpenBookmarks?: () => void;
  isBookmarked?: boolean;
  onBookmarkToggle?: () => Promise<void>;
  onHighlight?: () => void;
  onShare?: () => void;
  // Legacy instruction modal props kept for possible future use:
  showInstruction?: boolean;
  onDismissInstruction?: () => void;
  onShowInstruction?: () => void;
}

export const ReadingScreen: React.FC<ReadingScreenProps> = ({
  reading,
  onPrevDate,
  onNextDate,
  onOpenDatePicker,
  onOpenBookmarks,
  isBookmarked = false,
  onBookmarkToggle,
  onHighlight,
  onShare,
  showInstruction = false,
  onDismissInstruction,
  onShowInstruction,
}) => {
  const { colors, isDark, themeId } = useTheme();
  const [localBookmarked, setLocalBookmarked] = useState(isBookmarked);
  const [toastVisible, setToastVisible] = useState(false);
  const [toastMessage, setToastMessage] = useState("");
  const scrollViewRef = useRef<ScrollView>(null);
  const translateX = useRef(new Animated.Value(0)).current;
  const heartScale = useRef(new Animated.Value(1)).current;
  const { width: screenWidth, height: screenHeight } = Dimensions.get("window");

  // Scale header for smaller screens. Full size at ≥ 844pt (iPhone 14);
  // shrinks aggressively for iPhone SE / small Android, floor at 65%.
  const hScale = Math.min(1, Math.max(0.65, (screenHeight - 300) / 544));
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
    return {
      // Title is always body size + 2 for a subtle hierarchy
      titleFontSize: typography.bodyFontSize + 2,
      sectionHeadingFontSize: typography.bodyFontSize + 6,
      thoughtLabelFontSize: typography.bodyFontSize - 4,
      thoughtTextFontSize: typography.bodyFontSize + 4,
      thoughtTextLineHeight: typography.bodyFontSize + 8,
    };
  }, [typography.bodyFontSize]);

  // Keep gesture handlers pointing at the latest navigation callbacks
  React.useEffect(() => {
    prevDateRef.current = onPrevDate;
  }, [onPrevDate]);

  React.useEffect(() => {
    nextDateRef.current = onNextDate;
  }, [onNextDate]);

  // Opening paragraphs (support \n\n markers in text)
  const openingParagraphs = useMemo(
    () =>
      (reading.opening || "")
        .replace(/\\n/g, "\n")
        .split(/\n{2,}/)
        .map((p) => p.trim())
        .filter((p) => p.length > 0),
    [reading.opening]
  );

  // Application quote + reference (extract trailing parenthetical, if present)
  const { applicationQuote, applicationReference } = useMemo(() => {
    const source = reading.quote ?? "";
    const raw =
      source
        .replace(/\\n/g, "\n")
        .split(/\n{2,}/)[0]
        ?.trim() ?? "";

    if (!raw) {
      return { applicationQuote: "", applicationReference: "" };
    }

    // Match trailing parenthetical, e.g. `"Quote text..." (BOOK, p. 89)`
    const match = raw.match(/^(.*?)(\s*\(([^()]*)\))\s*$/);
    if (match) {
      return {
        applicationQuote: match[1].trim(),
        // inner text of the parentheses only
        applicationReference: match[3].trim(),
      };
    }

    return { applicationQuote: raw, applicationReference: "" };
  }, [reading.quote]);

  // Application body (shown after main body paragraphs)
  const applicationParagraphs = useMemo(
    () =>
      (reading.application || "")
        .replace(/\\n/g, "\n")
        .split(/\n{2,}/)
        .map((p) => p.trim())
        .filter((p) => p.length > 0),
    [reading.application]
  );

  // Horizontal swipe gesture for previous/next readings
  const SWIPE_THRESHOLD = 48;
  const panResponder = useRef(
    PanResponder.create({
      onMoveShouldSetPanResponder: (_evt, gestureState) => {
        const { dx, dy } = gestureState;
        // Only capture when the intent is clearly horizontal:
        // - horizontal movement above a reasonable threshold
        // - and significantly greater than vertical movement
        const absDx = Math.abs(dx);
        const absDy = Math.abs(dy);
        const shouldSet = absDx > 32 && absDx > absDy * 1.5;
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
    if (!onBookmarkToggle) return;

    await onBookmarkToggle();
    const newState = !localBookmarked;
    setLocalBookmarked(newState);
    console.log("ReadingScreen: Bookmark toggled to:", newState);

    // Show a lightweight toast message
    setToastMessage(
      newState
        ? "Added this reading to your favorites"
        : "Removed this reading from your favorites"
    );
    setToastVisible(true);

    // Haptic feedback on toggle
    try {
      await Haptics.impactAsync(Haptics.ImpactFeedbackStyle.Medium);
    } catch {
      // best-effort only
    }

    // Heart "pop" animation
    heartScale.setValue(1);
    Animated.sequence([
      Animated.spring(heartScale, {
        toValue: 1.25,
        friction: 3,
        useNativeDriver: true,
      }),
      Animated.spring(heartScale, {
        toValue: 1,
        friction: 4,
        useNativeDriver: true,
      }),
    ]).start();
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

  // Whenever we get a new reading, snap the scroll position back to the top
  // so paging forward/backward always starts at the beginning.
  React.useEffect(() => {
    if (scrollViewRef.current) {
      scrollViewRef.current.scrollTo({ y: 0, animated: false });
    }
  }, [reading.id]);

  return (
    <SafeAreaView style={[styles.safeArea, { backgroundColor: colors.pearl }]} edges={["top", "left", "right"]}>
      <View style={[styles.container, { backgroundColor: colors.pearl }]}>
        {colors.headerGradientStart === colors.headerGradientEnd ? (
          <View style={[styles.header, { backgroundColor: colors.headerGradientStart }]}>
          <View style={styles.headerTop}>
            <Text style={[styles.logo, { color: colors.textOnAccent }]}>Al-Anon Daily Paths</Text>
            {/*
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
                <Ionicons name="chevron-back" size={20} color={colors.textOnAccent} />
              </BlurView>
            </TouchableOpacity>

            <TouchableOpacity
              onPress={onOpenDatePicker}
              style={styles.calendarDate}
            >
              <View style={styles.calendarCardWrapper}>
                <View style={[styles.calendarCard, { borderColor: colors.calendarBorder, backgroundColor: colors.cardBackground }]}>
                  <View style={[styles.calendarMonth, { backgroundColor: colors.calendarMonthBackground }]}>
                    <Text style={[styles.calendarMonthText, { color: colors.textOnAccent }]}>{month}</Text>
                  </View>
                  <View style={[styles.calendarDay, { backgroundColor: colors.calendarDayBackground }]}>
                    <Text style={[styles.calendarDayText, { color: colors.calendarDayText }]}>{day}</Text>
                  </View>
                </View>
              </View>
            </TouchableOpacity>

            <TouchableOpacity onPress={onNextDate} style={styles.navButton}>
              <BlurView intensity={20} tint="light" style={styles.blurNavButton}>
                <Ionicons name="chevron-forward" size={20} color={colors.textOnAccent} />
              </BlurView>
            </TouchableOpacity>
          </View>

          </View>
        ) : (
        <LinearGradient
          colors={[colors.headerGradientStart, colors.headerGradientEnd]}
          start={{ x: 0, y: 0 }}
          end={themeId === "twilight-fire" ? { x: 0, y: 1 } : { x: 1, y: 1 }}
          style={[styles.header, {
            paddingTop: 16 * hScale,
            paddingBottom: 24 * hScale,
          }]}
        >
          <View style={[styles.headerTop, { marginBottom: 20 * hScale }]}>
            <Text style={[styles.logo, { color: colors.textOnAccent, fontSize: 40 * hScale }]}>Al-Anon Daily Paths</Text>
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
            <TouchableOpacity onPress={onPrevDate} style={[styles.navButton, { width: 36 * hScale, height: 36 * hScale, borderRadius: 18 * hScale }]}>
              <BlurView intensity={20} tint="light" style={styles.blurNavButton}>
                <Ionicons name="chevron-back" size={Math.round(20 * hScale)} color={colors.textOnAccent} />
              </BlurView>
            </TouchableOpacity>

            <TouchableOpacity
              onPress={onOpenDatePicker}
              style={styles.calendarDate}
            >
              <View style={styles.calendarCardWrapper}>
                <View style={[styles.calendarCard, { borderColor: colors.calendarBorder, backgroundColor: colors.cardBackground }]}>
                  <View style={[styles.calendarMonth, { backgroundColor: colors.calendarMonthBackground }]}>
                    <Text style={[styles.calendarMonthText, { color: colors.textOnAccent }]}>{month}</Text>
                  </View>
                  <View style={[styles.calendarDay, { backgroundColor: colors.calendarDayBackground }]}>
                    <Text style={[styles.calendarDayText, { color: colors.calendarDayText, fontSize: 22 * hScale, lineHeight: 22 * hScale }]}>{day}</Text>
                  </View>
                </View>
              </View>
            </TouchableOpacity>

            <TouchableOpacity onPress={onNextDate} style={[styles.navButton, { width: 36 * hScale, height: 36 * hScale, borderRadius: 18 * hScale }]}>
              <BlurView intensity={20} tint="light" style={styles.blurNavButton}>
                <Ionicons name="chevron-forward" size={Math.round(20 * hScale)} color={colors.textOnAccent} />
              </BlurView>
            </TouchableOpacity>
          </View>

        </LinearGradient>
        )}

        <Animated.View
          style={{ flex: 1, transform: [{ translateX }] }}
          {...panResponder.panHandlers}
        >
          <ScrollView
            ref={scrollViewRef}
            style={[styles.content, { backgroundColor: colors.pearl }]}
            contentContainerStyle={styles.contentContainer}
            showsVerticalScrollIndicator={false}
            scrollEnabled={!isSwiping}
          >
            <Pressable onPress={handleContentPress}>
              <View style={styles.actionsHeader}>
                <TouchableOpacity
                  onPress={onOpenBookmarks}
                  activeOpacity={0.7}
                  hitSlop={{ top: 12, bottom: 12, left: 12, right: 12 }}
                >
                  <Ionicons
                    name="list-outline"
                    size={20}
                    color={colors.deepTeal}
                  />
                </TouchableOpacity>
                <View style={styles.actionsRight}>
                  <TouchableOpacity
                    onPress={handleBookmarkToggle}
                    activeOpacity={0.7}
                    hitSlop={{ top: 12, bottom: 12, left: 12, right: 12 }}
                  >
                    <Ionicons
                      name={localBookmarked ? "heart" : "heart-outline"}
                      size={20}
                      color={colors.deepTeal}
                    />
                  </TouchableOpacity>
                  <TouchableOpacity
                    onPress={onShare}
                    activeOpacity={0.7}
                    hitSlop={{ top: 12, bottom: 12, left: 12, right: 12 }}
                  >
                    <Ionicons
                      name="arrow-redo-outline"
                      size={20}
                      color={colors.deepTeal}
                    />
                  </TouchableOpacity>
                </View>
              </View>

              <View style={styles.titleRow}>
                <Text
                  style={[
                    styles.title,
                    { fontSize: headingTypography.titleFontSize, color: colors.ocean },
                  ]}
                >
                  {reading.title}
                </Text>
              </View>

              {!!applicationQuote && (
                <View style={styles.applicationQuoteContainer}>
                  <Text
                    style={[
                      styles.bodyText,
                      styles.applicationQuoteText,
                      {
                        fontSize: typography.bodyFontSize,
                        lineHeight: typography.bodyLineHeight,
                        color: colors.ink,
                      },
                    ]}
                  >
                    {renderInlineMarkdown(
                      applicationQuote,
                      styles.inlineItalic
                    )}
                  </Text>
                  {!!applicationReference && (
                    <Text
                      style={[
                        styles.thoughtLabel,
                        {
                          fontSize: headingTypography.thoughtLabelFontSize,
                          textAlign: "right",
                          marginTop: 0,
                          color: colors.seafoam,
                        },
                      ]}
                    >
                      {applicationReference}
                    </Text>
                  )}
                </View>
              )}

              {openingParagraphs.map((paragraph, index) => (
                <Text
                  key={`opening-${index}`}
                  style={[
                    styles.bodyText,
                    {
                      fontSize: typography.bodyFontSize,
                      lineHeight: typography.bodyLineHeight,
                      color: colors.ink,
                    },
                  ]}
                >
                  {renderInlineMarkdown(paragraph, styles.inlineItalic)}
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
                      color: colors.ink,
                    },
                  ]}
                >
                  {renderInlineMarkdown(paragraph, styles.inlineItalic)}
                </Text>
              ))}

              {applicationParagraphs.length > 0 && (
                <>
                  <View style={styles.applicationDividerWrapper}>
                    <View style={[styles.applicationDivider, { backgroundColor: colors.mist }]} />
                  </View>
                  {applicationParagraphs.map((paragraph, index) => (
                    <Text
                      key={`application-${index}`}
                      style={[
                        styles.applicationText,
                        {
                          fontSize: typography.bodyFontSize,
                          lineHeight: typography.bodyLineHeight,
                          color: colors.ink,
                        },
                      ]}
                    >
                      {renderInlineMarkdown(paragraph, styles.inlineItalic)}
                    </Text>
                  ))}
                </>
              )}

              <View style={[styles.thoughtCardContainer, { backgroundColor: colors.cloud }]}>
                <View style={[styles.thoughtCard, { backgroundColor: colors.cloud }]}>
                  <BlurView
                    intensity={20}
                    tint={isDark ? "dark" : "light"}
                    style={[styles.thoughtGradient, { backgroundColor: isDark ? colors.cloud : undefined }]}
                  >
                    <Text
                      style={[
                        styles.thoughtLabel,
                        { fontSize: headingTypography.thoughtLabelFontSize, color: colors.ocean },
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
                          color: colors.deepTeal,
                        },
                      ]}
                    >
                      {reading.thoughtForDay}
                    </Text>
                  </BlurView>
                </View>
              </View>
            </Pressable>

            {/* Reading Feedback */}
            <ReadingFeedback
              readingId={reading.id}
              dayOfYear={getScheduledDayOfYear(reading.date)}
              readingTitle={reading.title}
              readingDate={reading.date}
            />
          </ScrollView>
        </Animated.View>

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

// Layout-only styles. All colors applied inline via useTheme().
const styles = StyleSheet.create({
  safeArea: {
    flex: 1,
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
    fontSize: 40,
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
    minWidth: 70,
    borderRadius: 6,
    overflow: "hidden",
    borderWidth: 1.5,
    borderColor: "rgba(255, 255, 255, 0.3)",
    ...Platform.select({
      ios: {
        shadowColor: "#000",
        shadowOffset: { width: 0, height: 3 },
        shadowOpacity: 0.25,
        shadowRadius: 6,
      },
      android: {
        elevation: 4,
      },
    }),
  },
  calendarMonth: {
    paddingVertical: 3,
    paddingHorizontal: 4,
    alignItems: "center",
  },
  calendarMonthText: {
    fontFamily: fonts.bodyFamilyRegular,
    fontSize: 9,
    fontWeight: "700",
    letterSpacing: 0.5,
  },
  calendarDay: {
    paddingVertical: 3,
    paddingHorizontal: 4,
    alignItems: "center",
    backgroundColor: "rgba(255, 255, 255, 0.65)",
  },
  calendarDayText: {
    fontFamily: fonts.headerFamily,
    fontSize: 22,
    fontWeight: "600",
    lineHeight: 22,
  },
  content: {
    flex: 1,
  },
  contentPressing: {
    backgroundColor: "#f9fafb",
  },
  contentContainer: {
    padding: 20,
    paddingBottom: 40,
  },
  title: {
    fontFamily: "Inter_500Medium",
    textAlign: "center",
    textTransform: "uppercase",
    fontWeight: "600",
    marginBottom: 8,
    flex: 1,
    flexShrink: 1,
  },
  titleRow: {
    flexDirection: "row",
    alignItems: "flex-start",
    justifyContent: "center",
    width: "100%",
    marginTop: 4,
    marginBottom: 8,
  },
  actionsHeader: {
    flexDirection: "row",
    alignItems: "center",
    justifyContent: "space-between",
    marginBottom: 12,
    marginTop: -4,
  },
  actionsRight: {
    flexDirection: "row",
    alignItems: "center",
    gap: 24,
  },
  inlineFavorite: {
    marginLeft: 12,
    marginTop: 6,
  },
  favoriteTopContainer: {
    alignItems: "center",
    marginTop: 8,
  },
  favoriteTopButton: {
    padding: 8,
  },
  bodyText: {
    fontFamily: fonts.loraRegular,
    fontSize: 19,
    lineHeight: 33,
    marginBottom: 16,
  },
  inlineItalic: {
    fontFamily: fonts.loraRegular,
  },
  section: {
    marginTop: 8,
  },
  sectionHeading: {
    fontFamily: fonts.headerFamilyBoldItalic,
    fontSize: 24,
    marginBottom: 12,
  },
  applicationQuoteContainer: {
    marginBottom: 16,
  },
  applicationQuoteText: {
    fontFamily: fonts.loraRegular,
    textAlign: "center",
    marginBottom: 4,
  },
  applicationDividerWrapper: {
    alignItems: "center",
    marginTop: 8,
    marginBottom: 16,
  },
  applicationDivider: {
    width: 64,
    height: StyleSheet.hairlineWidth * 2,
    borderRadius: 999,
  },
  applicationText: {
    fontFamily: fonts.loraRegular,
    fontSize: 19,
    lineHeight: 33,
    marginBottom: 16,
  },
  thoughtCardContainer: {
    marginTop: 24,
    borderRadius: 12,
    ...Platform.select({
      ios: {
        shadowColor: "#000",
        shadowOffset: { width: 0, height: 2 },
        shadowOpacity: 0.1,
        shadowRadius: 4,
      },
      android: {
        backgroundColor: "transparent",
      },
    }),
  },
  thoughtCard: {
    borderRadius: 12,
    overflow: "hidden",
    ...Platform.select({
      android: {
        elevation: 4,
      },
    }),
  },
  thoughtGradient: {
    padding: 20,
  },
  thoughtLabel: {
    fontFamily: fonts.bodyFamilyRegular,
    fontSize: 14,
    textTransform: "uppercase",
    letterSpacing: 1,
    marginBottom: 8,
  },
  thoughtText: {
    fontFamily: fonts.headerFamilyItalic,
    fontSize: 22,
    lineHeight: 26,
    fontWeight: "600",
  },
});

