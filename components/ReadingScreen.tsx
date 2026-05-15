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
import { Ionicons, MaterialIcons, MaterialCommunityIcons } from "@expo/vector-icons";
import { SafeAreaView } from "react-native-safe-area-context";
import * as Haptics from "expo-haptics";
import { fonts, layout, typography as staticTypography } from "../constants/theme";
import { useTheme } from "../hooks/useTheme";
import { useSettings } from "../hooks/useSettings";
import { useTypography } from "../hooks/useTypography";
import { DailyReading } from "../types/readings";
import { BookmarkToast } from "./BookmarkToast";
import { ReadingFeedback } from "./ReadingFeedback";
import { getScheduledDayOfYear } from "../utils/dateUtils";
import { scheduleWeekOfNotifications } from "../utils/notificationSync";
import { SanctuaryCard } from "./ui/Sanctuary";
import { TealHeader } from "./shared/TealHeader";
import { NotificationCoachmark } from "./NotificationCoachmark";
import { useNotificationCoachmark } from "../hooks/useNotificationCoachmark";
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
  onOpenFavorites?: () => void;
  isBookmarked?: boolean;
  onBookmarkToggle?: () => Promise<void>;
  onHighlight?: () => void;
  onShare?: () => void;
  onNewJournalEntry?: () => void;
  /** Header title — defaults to "Reflection". */
  headerTitle?: string;
  // Legacy instruction modal props kept for possible future use:
  showInstruction?: boolean;
  onDismissInstruction?: () => void;
  onShowInstruction?: () => void;
}

export const ReadingScreen: React.FC<ReadingScreenProps> = ({
  reading,
  onHeaderPress,
  onOpenDatePicker,
  onOpenFavorites,
  isBookmarked = false,
  onBookmarkToggle,
  onHighlight,
  onShare,
  onNewJournalEntry,
  headerTitle = "Reflection",
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
  const { typography } = useTypography();
  const coachmark = useNotificationCoachmark({
    enabled: settings.dailyReminderEnabled,
  });
  const pageTitleType = useMemo(() => {
    // Scale the display-size reading title off the user's body text setting
    // so it grows/shrinks with "Text size". Medium preset (bodyFontSize: 18)
    // is the baseline that produces the original 36pt.
    const baseSize = 36 + (Platform.OS === "android" ? 4 : 0);
    const baseLine = 44 + (Platform.OS === "android" ? 4 : 0);
    const scale = typography.body.fontSize / 18;
    return {
      fontSize: Math.round(baseSize * scale),
      lineHeight: Math.round(baseLine * scale),
    };
  }, [typography.body.fontSize]);
  const [showTimePicker, setShowTimePicker] = useState(false);
  const [tempReminderDate, setTempReminderDate] = useState<Date | null>(null);

  const reminderDate = useMemo(
    () => parseTimeToDate(settings.dailyReminderTime),
    [settings.dailyReminderTime]
  );

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

  // Sizing for the application quote and "Thought for the Day" — anchor
  // to the dynamic `bodyLargeFontSize` so the same visual ratios hold at
  // every text-size tier.
  const quoteFontSize = Math.round(typography.bodyLargeFontSize * (22 / 19));
  const quoteLineHeight = Math.round(quoteFontSize * (27 / 22));
  // Decorative open-quote glyph scales with quote text size. Ratio (~2.5×)
  // matches the speaker card glyph proportion at the default text size.
  const quoteGlyphSize = Math.round(quoteFontSize * 2.5) + 4;
  const thoughtFontSize = Math.round(typography.bodyLargeFontSize * (21 / 19));
  const thoughtLineHeight = Math.round(thoughtFontSize * (27 / 21));

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
    <SafeAreaView style={[styles.safeArea, { backgroundColor: colors.surface }]} edges={["left", "right"]}>
      <View style={[styles.container, { backgroundColor: colors.surface }]}>
        <TealHeader />

        <Animated.View
          style={{ flex: 1, transform: [{ translateX }] }}
          {...panResponder.panHandlers}
        >
          <ScrollView
            ref={scrollViewRef}
            style={[styles.content, { backgroundColor: colors.surface }]}
            contentContainerStyle={styles.contentContainer}
            showsVerticalScrollIndicator={false}
            scrollEnabled={!isSwiping && !coachmark.visible}
            onScroll={coachmark.scrollProps.onScroll}
            onScrollEndDrag={coachmark.scrollProps.onScrollEndDrag}
            onMomentumScrollEnd={coachmark.scrollProps.onMomentumScrollEnd}
            scrollEventThrottle={16}
            onContentSizeChange={coachmark.scrollProps.onContentSizeChange}
            onLayout={coachmark.scrollProps.onLayout}
          >
            <Pressable onPress={handleContentPress}>
              <View style={styles.pageIntro}>
                <View style={styles.pageIntroCopy}>
                  <Text style={[styles.pageTitle, pageTitleType, { color: colors.primaryContainer }]}>
                    {reading.title}
                  </Text>
                  <Text
                    style={[
                      styles.pageDate,
                      {
                        color: colors.onSurfaceVariant,
                        fontSize: typography.bodySmall.fontSize,
                        lineHeight: typography.bodySmall.lineHeight,
                      },
                    ]}
                  >
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
                  tone="lowest"
                  style={[
                    styles.applicationQuoteContainer,
                    { backgroundColor: colors.surfaceContainerLowest },
                  ]}
                  contentStyle={styles.applicationQuoteContent}
                >
                  <View style={styles.applicationQuoteRow}>
                    <Text
                      style={[
                        styles.applicationQuoteGlyph,
                        {
                          fontSize: quoteGlyphSize,
                          lineHeight: Math.round(quoteGlyphSize * 1.2),
                          marginTop: -Math.round(quoteGlyphSize * 0.22),
                          color: colors.outlineVariant,
                        },
                      ]}
                    >
                      {"“"}
                    </Text>
                    <View style={styles.applicationQuoteColumn}>
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
                              fontSize: typography.bodySmallFontSize,
                              lineHeight: typography.bodySmallLineHeight,
                              color: colors.onSurfaceVariant,
                            },
                          ]}
                        >
                          {applicationReference}
                        </Text>
                      )}
                    </View>
                  </View>
                </SanctuaryCard>
              )}

              {openingParagraphs.map((paragraph, index) => (
                <Text
                  key={`opening-${index}`}
                  style={[
                    styles.bodyText,
                    { color: colors.onSurface, fontSize: typography.body.fontSize, lineHeight: typography.body.lineHeight },
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
                    { color: colors.onSurface, fontSize: typography.body.fontSize, lineHeight: typography.body.lineHeight },
                  ]}
                >
                  {renderInlineMarkdown(paragraph, styles.inlineItalic)}
                </Text>
              ))}

              {applicationParagraphs.length > 0 && (
                <View style={styles.practiceSection}>
                  <View style={[styles.practiceCardContainer, { backgroundColor: colors.surfaceContainerLowest }]}>
                    <View style={styles.practiceAccent} />
                    <View style={styles.practiceBodyRow}>
                      <View style={styles.practiceBadge}>
                        <Ionicons name="checkmark-circle-outline" size={24} color={colors.deepTeal} />
                      </View>
                      <View style={styles.practiceBodyCopy}>
                        <Text
                          style={[
                            styles.practiceEyebrow,
                            {
                              fontSize: typography.label.fontSize,
                              lineHeight: typography.label.lineHeight,
                              color: colors.deepTeal,
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
                                fontSize: typography.body.fontSize,
                                lineHeight: typography.quoteBox.lineHeight,
                                color: colors.onSurfaceVariant,
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
                  { backgroundColor: colors.secondary },
                ]}
              >
                <Text
                  style={[
                    styles.thoughtLabel,
                    {
                      fontSize: typography.labelFontSize,
                      lineHeight: typography.labelLineHeight,
                      color: colors.secondaryContainer,
                    },
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
                <TouchableOpacity
                  onPress={onOpenFavorites}
                  style={styles.favoritedButton}
                  hitSlop={{ top: 12, right: 12, bottom: 12, left: 12 }}
                >
                  <MaterialCommunityIcons
                    name="heart-multiple"
                    size={26}
                    color={colors.primaryContainer}
                    style={styles.favoritedIcon}
                  />
                  <Text
                    style={[
                      styles.favoritedLabel,
                      {
                        fontSize: typography.bodySmall.fontSize,
                        lineHeight: typography.bodySmall.lineHeight,
                        color: colors.primaryContainer,
                      },
                    ]}
                  >
                    Favorites
                  </Text>
                </TouchableOpacity>
                <View style={styles.actionsRight}>
                  <TouchableOpacity
                    onPress={handleBookmarkToggle}
                    hitSlop={{ top: 12, right: 12, bottom: 12, left: 12 }}
                    style={styles.actionIconButton}
                  >
                    <Ionicons
                      name={localBookmarked ? "heart" : "heart-outline"}
                      size={28}
                      color={
                        localBookmarked ? colors.primaryContainer : colors.onSurfaceVariant
                      }
                    />
                  </TouchableOpacity>
                  <TouchableOpacity
                    onPress={onShare}
                    hitSlop={{ top: 12, right: 12, bottom: 12, left: 12 }}
                    style={styles.actionIconButton}
                  >
                    <MaterialIcons
                      name={Platform.OS === "ios" ? "ios-share" : "share"}
                      size={26}
                      color={colors.onSurfaceVariant}
                      style={styles.shareIcon}
                    />
                  </TouchableOpacity>
                </View>
              </View>

              <View style={[styles.sectionSeparator, { backgroundColor: colors.ghostBorder }]} />

              <View style={styles.notificationSection}>
                <View
                  ref={coachmark.registerToggleRef}
                  collapsable={false}
                  onLayout={coachmark.scrollProps.onToggleLayout}
                  style={styles.notificationUtilityHeader}
                >
                  <View style={styles.notificationUtilityCopy}>
                    <Text
                      style={[
                        styles.notificationUtilityTitle,
                        {
                          fontSize: typography.bodySmall.fontSize,
                          lineHeight: typography.bodySmall.lineHeight,
                          color: colors.onSurface,
                        },
                      ]}
                    >
                      Daily notification
                    </Text>
                    <Text
                      style={[
                        styles.notificationUtilitySubtitle,
                        {
                          fontSize: typography.caption.fontSize,
                          lineHeight: typography.caption.lineHeight,
                          color: colors.onSurfaceVariant,
                        },
                      ]}
                    >
                      Receive the Thought for the Day
                    </Text>
                  </View>
                  <Switch
                    style={styles.notificationSwitch}
                    value={settings.dailyReminderEnabled}
                    onValueChange={handleReminderToggle}
                    trackColor={{ false: colors.surfaceContainerHighest, true: colors.primaryContainer }}
                    thumbColor="#FFFFFF"
                  />
                </View>

                {settings.dailyReminderEnabled ? (
                  <TouchableOpacity
                    activeOpacity={0.8}
                    onPress={() => {
                      setTempReminderDate(reminderDate);
                      setShowTimePicker(true);
                    }}
                    style={styles.notificationUtilityTimeLink}
                  >
                    <Text
                      style={[
                        styles.notificationUtilityTimeLabel,
                        {
                          fontSize: typography.caption.fontSize,
                          lineHeight: typography.caption.lineHeight,
                          color: colors.onSurface,
                        },
                      ]}
                    >
                      Notification time
                    </Text>
                    <Text
                      style={[
                        styles.notificationUtilityTimeValue,
                        {
                          fontSize: typography.caption.fontSize,
                          lineHeight: typography.caption.lineHeight,
                          color: colors.onSurfaceVariant,
                        },
                      ]}
                    >
                      {formatTimeDisplay(reminderDate)}
                    </Text>
                  </TouchableOpacity>
                ) : null}

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
                          <Text
                            style={[
                              styles.notificationTimeButtonText,
                              {
                                fontSize: typography.bodySmall.fontSize,
                                lineHeight: typography.bodySmall.lineHeight,
                                color: colors.onSurface,
                              },
                            ]}
                          >
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
                          <Text
                            style={[
                              styles.notificationTimeButtonText,
                              {
                                fontSize: typography.bodySmall.fontSize,
                                lineHeight: typography.bodySmall.lineHeight,
                                color: colors.onPrimary,
                              },
                            ]}
                          >
                            Set Time
                          </Text>
                        </TouchableOpacity>
                      </View>
                    ) : null}
                  </View>
                ) : null}
              </View>

              <View style={[styles.sectionSeparator, { backgroundColor: colors.ghostBorder }]} />

              <ReadingFeedback
                readingId={reading.id}
                dayOfYear={getScheduledDayOfYear(reading.date)}
                readingTitle={reading.title}
                readingDate={reading.date}
              />
            </Pressable>

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

        <NotificationCoachmark
          visible={coachmark.visible}
          anchor={coachmark.anchor}
          onDismiss={coachmark.onDismiss}
        />
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
  headerAdd: {
    width: 40,
    height: 40,
    alignItems: "center",
    justifyContent: "center",
  },
  content: {
    flex: 1,
  },
  contentPressing: {
    backgroundColor: "#f9fafb",
  },
  contentContainer: {
    paddingHorizontal: layout.spacing.xl,
    paddingTop: 20,
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
  pageCalendarButton: {
    width: 40,
    height: 40,
    alignItems: "center",
    justifyContent: "center",
  },
  pageTitle: {
    // Lora regular (the family's lightest available weight) for an
    // editorial, serif title treatment.
    fontFamily: fonts.loraRegular,
    fontSize: 36 + (Platform.OS === "android" ? 4 : 0),
    lineHeight: 44 + (Platform.OS === "android" ? 4 : 0),
    letterSpacing: -0.9,
    fontWeight: "400",
    marginBottom: 6,
  },
  pageDate: {
    ...staticTypography.body,
    marginBottom: 0, // Reset any default margin
  },
  favoritedButton: {
    height: 36,
    flexDirection: "row",
    alignItems: "center",
  },
  favoritedIcon: {
    marginRight: 6,
  },
  favoritedLabel: {
    // fontSize/lineHeight applied inline via typography.bodySmall.
    fontFamily: fonts.bodyFamilySemiBold,
    letterSpacing: 0,
    includeFontPadding: false,
    textAlignVertical: "center",
  },
  actionIconButton: {
    width: 36,
    height: 36,
    alignItems: "center",
    justifyContent: "center",
  },
  shareIcon: {
    marginTop: -4,
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
    gap: 12,
  },
  notificationSection: {
    marginTop: 8,
    marginBottom: 20,
    gap: 10,
  },
  sectionSeparator: {
    height: 1,
    marginVertical: 10,
  },
  notificationUtilityHeader: {
    flexDirection: "row",
    alignItems: "flex-start",
    justifyContent: "space-between",
    gap: 12,
  },
  notificationUtilityCopy: {
    flex: 1,
    minWidth: 0,
  },
  notificationSwitch: {
    alignSelf: "flex-end",
    transform: [{ scaleX: 0.84 }, { scaleY: 0.84 }],
  },
  notificationUtilityTitle: {
    ...staticTypography.bodySmall,
    fontFamily: fonts.bodyFamilySemiBold,
  },
  notificationUtilitySubtitle: {
    ...staticTypography.caption,
    marginTop: 2,
  },
  notificationUtilityTimeLink: {
    alignSelf: "flex-start",
  },
  notificationUtilityTimeLabel: {
    ...staticTypography.caption,
    fontFamily: fonts.bodyFamilySemiBold,
    marginBottom: 2,
  },
  notificationUtilityTimeValue: {
    ...staticTypography.caption,
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
    ...staticTypography.bodySmall,
    fontFamily: fonts.bodyFamilySemiBold,
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
    ...staticTypography.bodyLarge,
    fontFamily: fonts.loraRegular,
    marginBottom: 18,
  },
  inlineItalic: {
    fontFamily: fonts.loraItalic,
    fontStyle: "italic",
  },
  section: {
    marginTop: 8,
  },
  sectionHeading: {
    ...staticTypography.h2,
    marginBottom: 12,
  },
  applicationQuoteContainer: {
    marginBottom: 20,
    borderRadius: 12,
    shadowColor: "#2D4C47",
    shadowOpacity: 0.08,
    shadowRadius: 12,
    shadowOffset: { width: 0, height: 3 },
    elevation: 3,
  },
  applicationQuoteContent: {
    paddingHorizontal: 32,
    paddingVertical: 32,
  },
  applicationQuoteRow: {
    flexDirection: "row",
    alignItems: "flex-start",
    gap: 12,
  },
  applicationQuoteGlyph: {
    fontFamily: fonts.cormorantGaramondMedium,
    marginTop: -4,
  },
  applicationQuoteColumn: {
    flex: 1,
  },
  applicationQuoteText: {
    // fontSize/lineHeight set dynamically at the call site via
    // quoteFontSize/quoteLineHeight so this scales with global text-size.
    fontFamily: fonts.bodyFamilySemiBold,
    textAlign: "left",
    marginBottom: 10,
    fontStyle: "italic",
    fontWeight: "600",
  },
  quoteInlineItalic: {
    fontFamily: fonts.bodyFamilySemiBold,
    fontStyle: "italic",
    fontWeight: "600",
  },
  applicationReference: {
    fontFamily: fonts.bodyFamilyRegular,
    textAlign: "left",
    letterSpacing: 0.2,
  },
  practiceSection: {
    marginTop: 8,
    marginBottom: 20,
  },
  practiceCardContainer: {
    borderRadius: 16,
    padding: 20,
    shadowColor: "#2D4C47",
    shadowOpacity: 0.08,
    shadowRadius: 12,
    shadowOffset: { width: 0, height: 3 },
    elevation: 3,
  },
  practiceAccent: {
    position: "absolute",
    left: 0,
    top: 0,
    bottom: 0,
    width: 4,
    backgroundColor: "#2D4C47",
  },
  practiceEyebrow: {
    ...staticTypography.label,
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
    ...staticTypography.bodySmall,
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
    // fontSize/lineHeight applied inline via typography.labelFontSize so
    // this scales with global text-size.
    fontFamily: staticTypography.label.fontFamily,
    textTransform: "uppercase",
    letterSpacing: 1.4,
    marginBottom: 12,
    textAlign: "center",
  },
  thoughtText: {
    // fontSize/lineHeight set dynamically at the call site.
    fontFamily: fonts.bodyFamilySemiBold,
    fontWeight: "600",
    textAlign: "center",
  },
});

