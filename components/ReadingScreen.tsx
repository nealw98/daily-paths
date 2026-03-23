import React, { useMemo, useState, useRef } from "react";
import {
  View,
  Text,
  StyleSheet,
  ScrollView,
  TouchableOpacity,
  PanResponder,
  Animated,
  Pressable,
  Platform,
  Switch,
} from "react-native";
import DateTimePicker from "@react-native-community/datetimepicker";
import { Ionicons } from "@expo/vector-icons";
import { SafeAreaView } from "react-native-safe-area-context";
import Svg, { Path } from "react-native-svg";
import * as Haptics from "expo-haptics";
import { fonts } from "../constants/theme";
import { useTheme } from "../hooks/useTheme";
import { useSettings, getTextSizeMetrics } from "../hooks/useSettings";
import { DailyReading } from "../types/readings";
import { BookmarkToast } from "./BookmarkToast";
import { ReadingFeedback } from "./ReadingFeedback";
import { getScheduledDayOfYear } from "../utils/dateUtils";
import { scheduleWeekOfNotifications } from "../utils/notificationSync";
import { SanctuaryCard, FocusPill } from "./ui/Sanctuary";
import { TealHeader } from "./shared/TealHeader";
import { LightOnWater } from "./icons";
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

function DecorativeQuoteMark({ color }: { color: string }) {
  return (
    <Svg width={80} height={62} viewBox="0 0 118 92" fill="none">
      <Path
        d="M38 10C24.7 10 14 20.7 14 34C14 44.9 21.2 54 31.1 56.8L22 82H42.3L56 53.9V34C56 20.7 45.3 10 32 10H38Z"
        fill={color}
      />
      <Path
        d="M82 10C68.7 10 58 20.7 58 34C58 44.9 65.2 54 75.1 56.8L66 82H86.3L100 53.9V34C100 20.7 89.3 10 76 10H82Z"
        fill={color}
      />
    </Svg>
  );
}

function parseTimeToDate(time: string): Date {
  const [h = "8", m = "0"] = time.split(":");
  const d = new Date();
  d.setHours(Number(h), Number(m), 0, 0);
  return d;
}

function formatTimeDisplay(date: Date): string {
  const hours = date.getHours();
  const minutes = date.getMinutes();
  const suffix = hours >= 12 ? "PM" : "AM";
  const displayHour = ((hours + 11) % 12) + 1;
  return `${displayHour}:${minutes.toString().padStart(2, "0")} ${suffix}`;
}

function formatTimeStorage(date: Date): string {
  return `${date.getHours().toString().padStart(2, "0")}:${date.getMinutes().toString().padStart(2, "0")}`;
}

interface ReadingScreenProps {
  reading: DailyReading;
  onHeaderPress?: () => void;
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
  onHeaderPress,
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
  const { colors } = useTheme();
  const [localBookmarked, setLocalBookmarked] = useState(isBookmarked);
  const [toastVisible, setToastVisible] = useState(false);
  const [toastMessage, setToastMessage] = useState("");
  const scrollViewRef = useRef<ScrollView>(null);
  const translateX = useRef(new Animated.Value(0)).current;
  const heartScale = useRef(new Animated.Value(1)).current;
  const [isSwiping, setIsSwiping] = useState(false);
  const lastTapRef = useRef<number | null>(null);

  const { settings, setTextSize, setDailyReminderEnabled, setDailyReminderTime } = useSettings();
  const [showTimePicker, setShowTimePicker] = useState(false);
  const [tempReminderDate, setTempReminderDate] = useState<Date | null>(null);
  const typography = useMemo(
    () => getTextSizeMetrics(settings.textSize),
    [settings.textSize]
  );
  const reminderDate = useMemo(
    () => parseTimeToDate(settings.dailyReminderTime),
    [settings.dailyReminderTime]
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

  const quoteFontSize = Math.round(typography.bodyFontSize * 1.11) + 2;
  const quoteLineHeight = Math.round(quoteFontSize * 1.18);
  const practiceEyebrowFontSize = Math.max(12, typography.bodyFontSize - 5);
  const practiceEyebrowLineHeight = practiceEyebrowFontSize + 4;
  const practiceBodyFontSize = Math.max(16, typography.bodyFontSize - 1);
  const practiceBodyLineHeight = Math.round(practiceBodyFontSize * 1.35);
  const thoughtFontSize = Math.round(typography.bodyFontSize * 1.33);
  const thoughtLineHeight = Math.round(thoughtFontSize * 1.16);

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
        if (Math.abs(dx) > SWIPE_THRESHOLD) {
          Haptics.selectionAsync().catch(() => {});
        }
        Animated.spring(translateX, {
          toValue: 0,
          useNativeDriver: true,
        }).start(() => {
          setIsSwiping(false);
        });
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

  const { fullDateLabel } = useMemo(() => {
    const date = new Date(reading.date);

    const fullDateLabel = new Intl.DateTimeFormat("en-US", {
      weekday: "long",
      month: "long",
      day: "numeric",
    }).format(date);

    return { fullDateLabel };
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

  const handleReminderToggle = async (enabled: boolean) => {
    await setDailyReminderEnabled(enabled);

    if (enabled) {
      await scheduleWeekOfNotifications();
      setToastMessage(`You'll receive the Thought for the Day at ${formatTimeDisplay(reminderDate)}`);
    } else {
      setToastMessage("Thought for the Day notifications turned off");
      setShowTimePicker(false);
      setTempReminderDate(null);
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
    <SafeAreaView style={[styles.safeArea, { backgroundColor: colors.surface }]} edges={["top", "left", "right"]}>
      <View style={[styles.container, { backgroundColor: colors.surface }]}>
        <TealHeader
          title="Today"
          leftIcon={<LightOnWater size={24} color={colors.onPrimary} strokeWidth={1.7} />}
          onPress={onHeaderPress}
        />

        <Animated.View
          style={{ flex: 1, transform: [{ translateX }] }}
          {...panResponder.panHandlers}
        >
          <ScrollView
            ref={scrollViewRef}
            style={[styles.content, { backgroundColor: colors.surface }]}
            contentContainerStyle={styles.contentContainer}
            showsVerticalScrollIndicator={false}
            scrollEnabled={!isSwiping}
          >
            <Pressable onPress={handleContentPress}>
              <View style={styles.pageIntro}>
                <View style={styles.pageIntroCopy}>
                  <Text style={[styles.pageTitle, { color: colors.primaryContainer }]}>
                    {reading.title}
                  </Text>
                  <Text style={[styles.pageDate, { color: colors.onSurfaceVariant }]}>
                    {fullDateLabel}
                  </Text>
                </View>
                <TouchableOpacity
                  onPress={onOpenDatePicker}
                  style={styles.pageCalendarButton}
                  hitSlop={{ top: 12, right: 12, bottom: 12, left: 12 }}
                >
                  <Ionicons name="calendar-outline" size={28} color={colors.primaryContainer} />
                </TouchableOpacity>
              </View>

              {!!applicationQuote && (
                <SanctuaryCard
                  tone="low"
                  style={[
                    styles.applicationQuoteContainer,
                    { backgroundColor: colors.surfaceContainerLow },
                  ]}
                  contentStyle={styles.applicationQuoteContent}
                >
                  <View style={styles.quoteMark}>
                    <DecorativeQuoteMark color={colors.onSurfaceVariant + "1F"} />
                  </View>
                  <Text
                    style={[
                      styles.applicationQuoteText,
                      {
                        fontSize: quoteFontSize,
                        lineHeight: quoteLineHeight,
                        color: colors.primary,
                      },
                    ]}
                  >
                    {renderInlineMarkdown(applicationQuote, styles.quoteInlineItalic)}
                  </Text>
                  {!!applicationReference && (
                    <Text
                      style={[
                        styles.applicationReference,
                        {
                          fontSize: 14,
                          color: colors.onSurfaceVariant,
                        },
                      ]}
                    >
                      {applicationReference}
                    </Text>
                  )}
                </SanctuaryCard>
              )}

              {openingParagraphs.map((paragraph, index) => (
                <Text
                  key={`opening-${index}`}
                  style={[
                    styles.bodyText,
                    {
                      fontSize: typography.bodyFontSize,
                      lineHeight: typography.bodyLineHeight,
                      color: colors.onSurface,
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
                      color: colors.onSurface,
                    },
                  ]}
                >
                  {renderInlineMarkdown(paragraph, styles.inlineItalic)}
                </Text>
              ))}

              {applicationParagraphs.length > 0 && (
                <View style={styles.practiceSection}>
                  <View style={styles.practiceCardContainer}>
                    <View style={styles.practiceAccent} />
                    <View style={styles.practiceBodyRow}>
                      <View style={styles.practiceBadge}>
                        <Ionicons name="checkmark-circle-outline" size={24} color="#2E6F69" />
                      </View>
                      <View style={styles.practiceBodyCopy}>
                        <Text
                          style={[
                            styles.practiceEyebrow,
                            {
                              fontSize: practiceEyebrowFontSize,
                              lineHeight: practiceEyebrowLineHeight,
                              color: "#2E6F69",
                            },
                          ]}
                        >
                          PRACTICE
                        </Text>
                        {applicationParagraphs.map((paragraph, index) => (
                          <Text
                            key={`application-${index}`}
                            style={[
                              styles.practiceText,
                              {
                                fontSize: practiceBodyFontSize,
                                lineHeight: practiceBodyLineHeight,
                              },
                              index === applicationParagraphs.length - 1 ? styles.practiceTextLast : null,
                            ]}
                          >
                            {renderInlineMarkdown(paragraph, styles.inlineItalic)}
                          </Text>
                        ))}
                      </View>
                    </View>
                  </View>
                </View>
              )}

              <SanctuaryCard
                tone="high"
                style={styles.thoughtCardContainer}
                contentStyle={[
                  styles.thoughtCard,
                  { backgroundColor: colors.primaryContainer },
                ]}
              >
                <Text
                  style={[
                    styles.thoughtLabel,
                    { fontSize: 15, color: colors.secondaryContainer },
                  ]}
                >
                  Thought for the Day
                </Text>
                <Text
                  style={[
                    styles.thoughtText,
                    {
                      fontSize: thoughtFontSize,
                      lineHeight: thoughtLineHeight,
                      color: colors.onPrimary,
                    },
                  ]}
                >
                  {reading.thoughtForDay}
                </Text>
              </SanctuaryCard>

              <View style={styles.actionsHeader}>
                <FocusPill
                  label="Library"
                  onPress={onOpenBookmarks}
                  icon={<Ionicons name="list-outline" size={14} color={colors.onSurfaceVariant} />}
                />
                <View style={styles.actionsRight}>
                  <FocusPill
                    label={localBookmarked ? "Saved" : "Save"}
                    onPress={handleBookmarkToggle}
                    selected={localBookmarked}
                    icon={
                      <Ionicons
                        name={localBookmarked ? "heart" : "heart-outline"}
                        size={14}
                        color={localBookmarked ? colors.onSecondaryContainer : colors.onSurfaceVariant}
                      />
                    }
                  />
                  <FocusPill
                    label="Share"
                    onPress={onShare}
                    icon={<Ionicons name="arrow-redo-outline" size={14} color={colors.onSurfaceVariant} />}
                  />
                </View>
              </View>

              <View style={[styles.notificationSection, { borderTopColor: colors.ghostBorder }]}>
                <View style={styles.notificationRow}>
                  <View style={styles.notificationCopy}>
                    <Text style={[styles.notificationTitle, { color: colors.primaryContainer }]}>
                      Daily Notification
                    </Text>
                    <Text style={[styles.notificationSubtitle, { color: colors.onSurfaceVariant }]}>
                      Receive the Thought for the Day
                    </Text>
                  </View>
                  <View style={styles.notificationControlRail}>
                    <View style={styles.notificationSwitchWrap}>
                      <Switch
                        style={styles.notificationSwitch}
                        value={settings.dailyReminderEnabled}
                        onValueChange={handleReminderToggle}
                        trackColor={{ false: colors.surfaceContainerHighest, true: colors.primaryContainer }}
                        thumbColor="#FFFFFF"
                      />
                    </View>
                  </View>
                </View>

                <View
                  style={[
                    styles.notificationRow,
                    styles.notificationRowLast,
                    !settings.dailyReminderEnabled && styles.notificationRowDisabled,
                  ]}
                >
                  <View style={styles.notificationCopy}>
                    <Text style={[styles.notificationTitle, { color: colors.primaryContainer }]}>
                      Notification Time
                    </Text>
                    <Text style={[styles.notificationSubtitle, { color: colors.onSurfaceVariant }]}>
                      Quiet reflection reminder
                    </Text>
                  </View>
                  <View style={styles.notificationControlRail}>
                    <TouchableOpacity
                      activeOpacity={0.8}
                      disabled={!settings.dailyReminderEnabled}
                      onPress={() => {
                        if (!settings.dailyReminderEnabled) return;
                        setTempReminderDate(reminderDate);
                        setShowTimePicker(true);
                      }}
                      style={[styles.notificationTimePill, { backgroundColor: colors.surfaceContainerLowest }]}
                    >
                      <Text style={[styles.notificationTimeText, { color: colors.primaryContainer }]}>
                        {formatTimeDisplay(reminderDate)}
                      </Text>
                    </TouchableOpacity>
                  </View>
                </View>

                {showTimePicker && settings.dailyReminderEnabled ? (
                  <View style={styles.notificationTimePicker}>
                    <DateTimePicker
                      value={tempReminderDate ?? reminderDate}
                      mode="time"
                      display={Platform.OS === "ios" ? "spinner" : "default"}
                      onChange={(event, selectedDate) => {
                        if (Platform.OS === "android") {
                          setShowTimePicker(false);
                          setTempReminderDate(null);
                          if (event.type === "set" && selectedDate) {
                            (async () => {
                              await setDailyReminderTime(formatTimeStorage(selectedDate));
                              await scheduleWeekOfNotifications();
                              setToastMessage(`You'll receive the Thought for the Day at ${formatTimeDisplay(selectedDate)}`);
                            })();
                          }
                        } else if (selectedDate) {
                          setTempReminderDate(selectedDate);
                        }
                      }}
                    />
                    {Platform.OS === "ios" ? (
                      <View style={styles.notificationTimeActions}>
                        <TouchableOpacity
                          activeOpacity={0.8}
                          onPress={() => {
                            setShowTimePicker(false);
                            setTempReminderDate(null);
                          }}
                          style={[styles.notificationTimeButton, { backgroundColor: colors.surfaceContainerLowest }]}
                        >
                          <Text style={[styles.notificationTimeButtonText, { color: colors.onSurface }]}>
                            Cancel
                          </Text>
                        </TouchableOpacity>
                        <TouchableOpacity
                          activeOpacity={0.8}
                          onPress={async () => {
                            const finalDate = tempReminderDate ?? reminderDate;
                            setShowTimePicker(false);
                            setTempReminderDate(null);
                            await setDailyReminderTime(formatTimeStorage(finalDate));
                            await scheduleWeekOfNotifications();
                            setToastMessage(`You'll receive the Thought for the Day at ${formatTimeDisplay(finalDate)}`);
                          }}
                          style={[styles.notificationTimeButton, { backgroundColor: colors.primaryContainer }]}
                        >
                          <Text style={[styles.notificationTimeButtonText, { color: colors.onPrimary }]}>
                            Set Time
                          </Text>
                        </TouchableOpacity>
                      </View>
                    ) : null}
                  </View>
                ) : null}
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
  pageIntro: {
    flexDirection: "row",
    alignItems: "flex-start",
    justifyContent: "space-between",
    marginBottom: 20,
    gap: 16,
  },
  pageIntroCopy: {
    flex: 1,
  },
  pageTitle: {
    fontFamily: fonts.headerFamilyLight,
    fontSize: 36,
    lineHeight: 44,
    fontWeight: "300",
    letterSpacing: -0.9,
    marginBottom: 6,
  },
  pageDate: {
    fontFamily: fonts.bodyFamilyRegular,
    fontSize: 17,
    lineHeight: 24,
  },
  pageCalendarButton: {
    width: 36,
    height: 36,
    alignItems: "center",
    justifyContent: "center",
    marginTop: 2,
  },
  actionsHeader: {
    flexDirection: "row",
    alignItems: "center",
    justifyContent: "space-between",
    marginTop: 28,
    marginBottom: 16,
  },
  actionsRight: {
    flexDirection: "row",
    alignItems: "center",
    gap: 10,
  },
  notificationSection: {
    marginTop: 8,
    paddingTop: 22,
    marginBottom: 20,
    borderTopWidth: 1,
  },
  notificationRow: {
    flexDirection: "row",
    alignItems: "center",
    justifyContent: "space-between",
    gap: 18,
    marginBottom: 24,
  },
  notificationRowLast: {
    marginBottom: 0,
  },
  notificationRowDisabled: {
    opacity: 0.5,
  },
  notificationCopy: {
    flex: 1,
    minWidth: 0,
  },
  notificationControlRail: {
    width: 140,
    alignItems: "flex-end",
    justifyContent: "center",
  },
  notificationSwitchWrap: {
    width: "100%",
    alignItems: "flex-end",
    justifyContent: "center",
    paddingRight: 8,
  },
  notificationSwitch: {
    alignSelf: "flex-end",
  },
  notificationTitle: {
    fontFamily: fonts.bodyFamilyBold,
    fontSize: 21,
    lineHeight: 28,
    marginBottom: 6,
  },
  notificationSubtitle: {
    fontFamily: fonts.bodyFamilyRegular,
    fontSize: 16,
    lineHeight: 22,
  },
  notificationTimePill: {
    width: 140,
    height: 80,
    borderRadius: 16,
    alignItems: "flex-end",
    justifyContent: "center",
    paddingHorizontal: 20,
    alignSelf: "flex-end",
  },
  notificationTimeText: {
    fontFamily: fonts.bodyFamilyBold,
    fontSize: 21,
    lineHeight: 28,
    textAlign: "right",
    width: "100%",
  },
  notificationTimePicker: {
    marginTop: 8,
    marginBottom: 12,
  },
  notificationTimeActions: {
    flexDirection: "row",
    justifyContent: "flex-end",
    gap: 10,
    marginTop: 12,
  },
  notificationTimeButton: {
    minHeight: 44,
    borderRadius: 12,
    paddingHorizontal: 16,
    alignItems: "center",
    justifyContent: "center",
  },
  notificationTimeButtonText: {
    fontFamily: fonts.bodyFamilySemiBold,
    fontSize: 15,
    lineHeight: 20,
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
    lineHeight: 32,
    marginBottom: 18,
  },
  inlineItalic: {
    fontFamily: fonts.loraRegular,
    fontStyle: "italic",
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
    marginBottom: 20,
    borderRadius: 12,
    overflow: "hidden",
  },
  applicationQuoteContent: {
    paddingHorizontal: 32,
    paddingVertical: 32,
    paddingTop: 80,
    position: "relative",
    overflow: "hidden",
  },
  quoteMark: {
    position: "absolute",
    top: 8,
    left: 10,
    width: 80,
    height: 62,
  },
  applicationQuoteText: {
    fontFamily: fonts.bodyFamilyBold,
    textAlign: "left",
    marginBottom: 16,
    fontStyle: "italic",
    fontWeight: "700",
    position: "relative",
    zIndex: 1,
    alignSelf: "stretch",
    marginLeft: 28,
    marginRight: 0,
  },
  quoteInlineItalic: {
    fontFamily: fonts.bodyFamilyBold,
    fontStyle: "italic",
    fontWeight: "700",
  },
  applicationReference: {
    fontFamily: fonts.bodyFamilyRegular,
    textAlign: "left",
    letterSpacing: 0.2,
    position: "relative",
    zIndex: 1,
    alignSelf: "stretch",
    marginLeft: 28,
    marginRight: 0,
  },
  practiceSection: {
    marginTop: 8,
    marginBottom: 20,
  },
  practiceCardContainer: {
    backgroundColor: "#FFFFFF",
    borderRadius: 16,
    borderWidth: 1,
    borderColor: "#F3F4F6",
    padding: 20,
    overflow: "hidden",
    shadowColor: "#163531",
    shadowOpacity: 0.04,
    shadowRadius: 12,
    shadowOffset: { width: 0, height: 4 },
    elevation: 3,
  },
  practiceAccent: {
    position: "absolute",
    left: 0,
    top: 0,
    bottom: 0,
    width: 4,
    backgroundColor: "#163531",
  },
  practiceEyebrow: {
    fontFamily: fonts.bodyFamilyBold,
    fontSize: 12,
    lineHeight: 16,
    letterSpacing: 1.2,
    textTransform: "uppercase",
    marginBottom: 12,
    color: "#4B5563",
  },
  practiceBodyRow: {
    flexDirection: "row",
    alignItems: "flex-start",
    gap: 14,
  },
  practiceBadge: {
    width: 44,
    height: 44,
    borderRadius: 12,
    alignItems: "center",
    justifyContent: "center",
    backgroundColor: "#E0F2F1",
  },
  practiceBodyCopy: {
    flex: 1,
    minWidth: 0,
  },
  practiceText: {
    fontFamily: fonts.bodyFamilyMedium,
    fontSize: 14,
    lineHeight: 20,
    color: "#4B5563",
    marginBottom: 6,
  },
  practiceTextLast: {
    marginBottom: 0,
  },
  thoughtCardContainer: {
    marginTop: 24,
    borderRadius: 12,
  },
  thoughtCard: {
    paddingHorizontal: 28,
    paddingTop: 20,
    paddingBottom: 20,
    borderRadius: 12,
    alignItems: "center",
  },
  thoughtLabel: {
    fontFamily: fonts.labelFamily,
    fontSize: 14,
    textTransform: "uppercase",
    letterSpacing: 1.4,
    marginBottom: 12,
    textAlign: "center",
  },
  thoughtText: {
    fontFamily: fonts.bodyFamilyMedium,
    fontSize: 32,
    lineHeight: 40,
    fontWeight: "500",
    textAlign: "center",
  },
});

