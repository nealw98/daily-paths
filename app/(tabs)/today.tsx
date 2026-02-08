import React, { useState, useEffect, useRef } from "react";
import {
  View,
  Text,
  ActivityIndicator,
  StyleSheet,
  Share,
  TouchableOpacity,
  AppState,
  AppStateStatus,
} from "react-native";
import { LinearGradient } from "expo-linear-gradient";
import { Ionicons } from "@expo/vector-icons";
import { useLocalSearchParams, useRouter } from "expo-router";
import { ReadingScreen } from "../../components/ReadingScreen";
import { JournalCategoryPicker } from "../../components/journal/JournalCategoryPicker";
import { JournalEntryEditor } from "../../components/journal/JournalEntryEditor";
import type { EntryType } from "../../constants/journalCategories";
import { useAuth } from "../../contexts/AuthContext";
import { useJournalEntries } from "../../hooks/useJournalEntries";
import { DatePickerModal } from "../../components/DatePickerModal";
import { BookmarkListModal } from "../../components/BookmarkListModal";
import { DismissibleToast } from "../../components/DismissibleToast";
import { BookmarkToast } from "../../components/BookmarkToast";
import { RateAppModal } from "../../components/RateAppModal";
import { markRatePromptShown, recordFirstUseIfNeeded } from "../../utils/rateShareTracking";
import { recordDailyActivity, recordReadingView } from "../../utils/deviceIdentity";
import { qaLog } from "../../utils/qaLog";
import { useAnalytics, NavigationMethod } from "../../utils/analytics";
import { updateNotificationWithThought } from "../../utils/notificationSync";
import { useReading } from "../../hooks/useReading";
import { useBookmarkManager } from "../../hooks/useBookmarkManager";
import { useAvailableDates } from "../../hooks/useAvailableDates";
import { hasSeenInstruction, markInstructionSeen, type BookmarkData } from "../../utils/bookmarkStorage";
import { parseDateLocal } from "../../utils/dateUtils";
import { useTheme } from "../../hooks/useTheme";
import * as Notifications from "expo-notifications";

console.log("[STARTUP] index.tsx module loading...");

export default function Index() {
  console.log("[STARTUP] Index function called");
  
  const { colors, colorScheme } = useTheme();
  
  let router;
  try {
    console.log("[STARTUP-INDEX] Getting router...");
    router = useRouter();
    console.log("[STARTUP-INDEX] Router obtained");
  } catch (err) {
    console.error("[STARTUP-INDEX] ERROR getting router:", err);
    throw err;
  }

  let params;
  try {
    console.log("[STARTUP-INDEX] Getting params...");
    params = useLocalSearchParams<{ jump?: string; ts?: string }>();
    console.log("[STARTUP-INDEX] Params obtained:", params);
  } catch (err) {
    console.error("[STARTUP-INDEX] ERROR getting params:", err);
    throw err;
  }

  console.log("[STARTUP-INDEX] Initializing state...");
  // Start with today's date
  const [currentDate, setCurrentDate] = useState(new Date());
  const [showDatePicker, setShowDatePicker] = useState(false);
  const [showBookmarkList, setShowBookmarkList] = useState(false);
  const [showInstruction, setShowInstruction] = useState(false);
  const [toastMessage, setToastMessage] = useState<string | null>(null);
  const [showRateModal, setShowRateModal] = useState(false);
  const [navigationMethod, setNavigationMethod] = useState<NavigationMethod>('app_open');
  const [showJournalPicker, setShowJournalPicker] = useState(false);
  const [journalEntryType, setJournalEntryType] = useState<EntryType | null>(null);
  console.log("[STARTUP-INDEX] State initialized");

  // Journal entry creation from Today page
  const { user, isAuthenticated: isAuthed } = useAuth();
  const { createEntry } = useJournalEntries(user?.id);
  
  // Analytics
  const { trackAppOpened, startReadingView, trackReadingFavorited, trackReadingUnfavorited, updateThemeMode } = useAnalytics();
  
  // Keep analytics in sync with theme preference
  useEffect(() => {
    updateThemeMode(colorScheme);
  }, [colorScheme, updateThemeMode]);
  
  console.log("[STARTUP-INDEX] Calling useReading...");
  const { reading, loading, error } = useReading(currentDate);
  console.log("[STARTUP-INDEX] useReading returned, loading:", loading, "error:", error);
  const {
    bookmarks,
    isBookmarked,
    toggleBookmark,
    removeBookmark,
    refreshBookmarks,
  } = useBookmarkManager(currentDate, reading?.id || "", reading?.title || "");
  const { availableDaysOfYear } = useAvailableDates();

  // If the app is opened from a notification, jump to today's reading.
  const lastNotificationResponse = Notifications.useLastNotificationResponse();

  useEffect(() => {
    if (!lastNotificationResponse) return;

    // For this app, any notification tap should bring us to today's reading.
    if (
      lastNotificationResponse.actionIdentifier ===
      Notifications.DEFAULT_ACTION_IDENTIFIER
    ) {
      setNavigationMethod('notification');
      setCurrentDate(new Date());
    }
  }, [lastNotificationResponse]);

  // Handle navigation params (e.g., from notification tap) to jump to today.
  useEffect(() => {
    if (params?.jump === "today") {
      setCurrentDate(new Date());
      // Clear params to avoid repeated resets.
      router.setParams({ jump: undefined, ts: undefined });
    }
  }, [params?.jump, params?.ts, router]);

  // Surface non-blocking errors only when we still have content onscreen.
  useEffect(() => {
    if (error && reading) {
      setToastMessage(error);
    }
    if (!reading) {
      setToastMessage(null);
    }
  }, [error, reading]);

  // Check if instruction should be shown on mount
  useEffect(() => {
    async function checkInstruction() {
      const seen = await hasSeenInstruction();
      setShowInstruction(!seen);
    }
    checkInstruction();
  }, []);

  // Record first use date for rate prompt timing
  useEffect(() => {
    recordFirstUseIfNeeded();
  }, []);

  // Record daily activity for analytics (once per day)
  useEffect(() => {
    recordDailyActivity();
  }, []);

  // Track app opened event (PostHog)
  useEffect(() => {
    trackAppOpened();
  }, []);

  // Update notification with latest thought on app launch
  useEffect(() => {
    updateNotificationWithThought();
  }, []);

  // Refs for AppState listener so foreground handler sees latest reading/date/navigation
  const readingRef = useRef(reading);
  const currentDateRef = useRef(currentDate);
  const navigationMethodRef = useRef(navigationMethod);
  readingRef.current = reading;
  currentDateRef.current = currentDate;
  navigationMethodRef.current = navigationMethod;

  // Record reading view for analytics (unique viewers per reading)
  useEffect(() => {
    if (reading?.id) {
      recordReadingView(reading.id);
      // Start tracking in PostHog (event fires when user navigates away or app goes to background)
      startReadingView(reading.id, currentDate, reading.title, navigationMethod);
    }
  }, [reading?.id]);

  // Foreground = new session: when app returns to active, start a new reading view session for current reading
  useEffect(() => {
    const handleAppStateChange = (nextAppState: AppStateStatus) => {
      if (nextAppState === 'active') {
        const r = readingRef.current;
        if (r?.id) {
          startReadingView(
            r.id,
            currentDateRef.current,
            r.title,
            navigationMethodRef.current
          );
        }
      }
    };
    const subscription = AppState.addEventListener('change', handleAppStateChange);
    return () => subscription?.remove();
  }, [startReadingView]);

  const handlePrevDate = () => {
    setNavigationMethod('prev_button');
    const prevDate = new Date(currentDate);
    prevDate.setDate(prevDate.getDate() - 1);
    setCurrentDate(prevDate);
  };

  const handleNextDate = () => {
    setNavigationMethod('next_button');
    const nextDate = new Date(currentDate);
    nextDate.setDate(nextDate.getDate() + 1);
    setCurrentDate(nextDate);
  };

  const handleOpenDatePicker = () => {
    setShowDatePicker(true);
  };

  const handleSelectDate = (date: Date) => {
    setNavigationMethod('date_picker');
    setCurrentDate(date);
  };

  const handleSelectBookmark = (dateStr: string) => {
    setNavigationMethod('bookmark_list');
    // Parse as local time to avoid timezone shift
    const date = parseDateLocal(dateStr);
    setCurrentDate(date);
  };

  const handleRemoveBookmark = async (bookmark: BookmarkData) => {
    await removeBookmark(bookmark);
    trackReadingUnfavorited(bookmark.readingId, parseDateLocal(bookmark.date));
  };

  const handleGoToToday = () => {
    setCurrentDate(new Date());
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

  // Wrapper for bookmark toggle that handles rate modal and analytics
  const handleBookmarkToggle = async () => {
    console.log('[POSTHOG] handleBookmarkToggle called, reading?.id:', reading?.id);
    const result = await toggleBookmark();
    console.log('[POSTHOG] toggleBookmark result:', result);
    
    // Track favorite/unfavorite in PostHog
    if (reading?.id) {
      if (result.newState) {
        console.log('[POSTHOG] Calling trackReadingFavorited');
        trackReadingFavorited(reading.id, currentDate);
      } else {
        console.log('[POSTHOG] Calling trackReadingUnfavorited');
        trackReadingUnfavorited(reading.id, currentDate);
      }
    } else {
      console.log('[POSTHOG] No reading?.id, skipping analytics');
    }
    
    if (result.shouldShowRatePrompt) {
      // Brief delay for the bookmark toast to appear first, then show rate modal
      qaLog("rate", "Bookmark triggered rate prompt - will show rate modal");
      await markRatePromptShown();
      setTimeout(() => {
        setShowRateModal(true);
      }, 800);
    }
  };

  const handleShare = async () => {
    if (!reading) return;

    const formatParagraphs = (text?: string | null) =>
      (text ?? "")
        .replace(/\\n/g, "\n")
        .split(/\n{2,}/)
        .map((p) => p.trim())
        .filter((p) => p.length > 0);

    const dateLabel = reading.date.toLocaleDateString("en-US", {
      month: "long",
      day: "numeric",
      year: "numeric",
    });

    const openingParagraphs = formatParagraphs(reading.opening);
    const bodyParagraphs = (reading.body ?? []).map((p) => p.trim()).filter(Boolean);
    const applicationParagraphs = formatParagraphs(
      (reading as any).application ?? (reading as any).todaysApplication
    );

    const rawQuote = (reading as any).quote ?? "";
    let applicationQuote = rawQuote;
    let applicationReference = "";
    const match = rawQuote.match(/^(.*?)(\s*\(([^()]*)\))\s*$/);
    if (match) {
      applicationQuote = match[1].trim();
      applicationReference = match[3].trim();
    }

    const lines: string[] = [];
    const pushParagraphs = (paras: string[]) => {
      paras.forEach((p, idx) => {
        lines.push(p);
        if (idx < paras.length - 1) {
          lines.push(""); // blank line between paragraphs
        }
      });
    };

    // Date
    lines.push(dateLabel);

    // Title (all caps)
    lines.push("");
    lines.push(reading.title.toUpperCase());

    // Quote (standalone paragraph; optionally includes reference on next line)
    if (applicationQuote) {
      lines.push("");
      lines.push(applicationQuote);
      if (applicationReference) {
        lines.push(`(${applicationReference})`);
      }
    }

    // Body
    if (bodyParagraphs.length) {
      lines.push("");
      // Collapse body into a single paragraph with spaces instead of line breaks.
      lines.push(bodyParagraphs.join(" "));
    }

    // Application paragraphs (with heading)
    if (applicationParagraphs.length) {
      lines.push("");
      lines.push("Application:");
      pushParagraphs(applicationParagraphs);
    }

    // Thought for the Day
    if (reading.thoughtForDay) {
      lines.push("");
      lines.push("Thought for the Day:");
      lines.push(reading.thoughtForDay.trim());
    }

    lines.push("");
    lines.push("-----");
    lines.push("Shared from Al-Anon Daily Paths");

    const message = lines.join("\n");

    try {
      await Share.share({ message });
    } catch (err) {
      console.error("Error sharing reading:", err);
    }
  };

  let content: React.ReactNode = null;

  // Show loading only on initial load, not when navigating
  if (loading && !reading) {
    content = (
      <View style={[styles.centerContainer, { backgroundColor: colors.pearl }]}>
        <ActivityIndicator size="large" color={colors.ocean} />
        <Text style={[styles.loadingText, { color: colors.ocean }]}>Loading reading...</Text>
      </View>
    );
  } else if (!reading) {
    content = (
      <View style={[styles.centerContainer, { backgroundColor: colors.pearl }]}>
        <Text style={[styles.errorDetail, { color: colors.ink }]}>
          {error ?? "No reading available for this date."}
        </Text>
        <View style={styles.buttonRow}>
          <TouchableOpacity style={[styles.primaryButton, { backgroundColor: colors.ocean }]} onPress={handleGoToToday}>
            <Text style={styles.primaryButtonText}>Go to Today</Text>
          </TouchableOpacity>
          <TouchableOpacity
            style={[styles.secondaryButton, { borderColor: colors.ocean }]}
            onPress={handleOpenDatePicker}
          >
            <Text style={[styles.secondaryButtonText, { color: colors.ocean }]}>Pick a Date</Text>
          </TouchableOpacity>
        </View>
      </View>
    );
  } else {
    content = (
      <ReadingScreen
        reading={reading}
        onPrevDate={handlePrevDate}
        onNextDate={handleNextDate}
        onOpenDatePicker={handleOpenDatePicker}
        onOpenBookmarks={handleOpenBookmarks}
        isBookmarked={isBookmarked}
        onBookmarkToggle={handleBookmarkToggle}
        onShare={handleShare}
        showInstruction={showInstruction}
        onDismissInstruction={handleDismissInstruction}
        onShowInstruction={handleShowInstruction}
      />
    );
  }

  // If user picked a journal type, show the editor full-screen
  if (journalEntryType) {
    return (
      <JournalEntryEditor
        entryType={journalEntryType}
        onSave={async (entryType, content, structuredContent) => {
          await createEntry(entryType, content, structuredContent);
          setJournalEntryType(null);
        }}
        onCancel={() => setJournalEntryType(null)}
      />
    );
  }

  return (
    <>
      {content}

      {/* Journal FAB — only show when reading is visible */}
      {reading && isAuthed && (
        <TouchableOpacity
          style={styles.fabTouchable}
          onPress={() => setShowJournalPicker(true)}
          activeOpacity={0.85}
        >
          <LinearGradient
            colors={["#2C5F5D", "#3A7573"]}
            start={{ x: 0, y: 0 }}
            end={{ x: 1, y: 1 }}
            style={styles.fab}
          >
            <Ionicons name="add" size={28} color="#FFFFFF" />
          </LinearGradient>
        </TouchableOpacity>
      )}

      <JournalCategoryPicker
        visible={showJournalPicker}
        onSelect={(entryType) => {
          setShowJournalPicker(false);
          setJournalEntryType(entryType);
        }}
        onClose={() => setShowJournalPicker(false)}
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
        onRemoveBookmark={handleRemoveBookmark}
      />
      <DismissibleToast
        visible={!!toastMessage && !!reading}
        message={toastMessage ?? ""}
        onDismiss={() => setToastMessage(null)}
      />

      <RateAppModal
        visible={showRateModal}
        onClose={() => setShowRateModal(false)}
        trigger="bookmark"
      />
    </>
  );
}

const styles = StyleSheet.create({
  centerContainer: {
    flex: 1,
    justifyContent: "center",
    alignItems: "center",
    padding: 20,
  },
  loadingText: {
    marginTop: 12,
    fontSize: 16,
  },
  errorDetail: {
    fontSize: 20,
    fontWeight: "600",
    marginBottom: 12,
    textAlign: "center",
    lineHeight: 26,
  },
  errorHint: {
    fontSize: 14,
    textAlign: "center",
    fontStyle: "italic",
  },
  buttonRow: {
    flexDirection: "row",
    gap: 12,
    marginTop: 16,
  },
  primaryButton: {
    paddingVertical: 12,
    paddingHorizontal: 16,
    borderRadius: 8,
  },
  primaryButtonText: {
    color: "#fff",
    fontWeight: "600",
  },
  secondaryButton: {
    borderWidth: 1,
    paddingVertical: 12,
    paddingHorizontal: 16,
    borderRadius: 8,
  },
  secondaryButtonText: {
    fontWeight: "600",
  },
  fabTouchable: {
    position: "absolute",
    bottom: 24,
    right: 24,
    zIndex: 10,
    shadowColor: "rgba(44, 95, 93, 1)",
    shadowOffset: { width: 0, height: 4 },
    shadowOpacity: 0.4,
    shadowRadius: 18,
    elevation: 8,
  },
  fab: {
    width: 56,
    height: 56,
    borderRadius: 28,
    alignItems: "center",
    justifyContent: "center",
  },
});