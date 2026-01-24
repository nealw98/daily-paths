import React, { useState, useEffect } from "react";
import {
  View,
  Text,
  ActivityIndicator,
  StyleSheet,
  Share,
  TouchableOpacity,
} from "react-native";
import { Ionicons } from "@expo/vector-icons";
import { useLocalSearchParams, useRouter } from "expo-router";
import { ReadingScreen } from "../components/ReadingScreen";
import { DatePickerModal } from "../components/DatePickerModal";
import { BookmarkListModal } from "../components/BookmarkListModal";
import { SettingsModal } from "../components/SettingsModal";
import { SettingsContent } from "../components/SettingsContent";
import { TextSizeModal } from "../components/TextSizeModal";
import { ReminderModal } from "../components/ReminderModal";
import { DismissibleToast } from "../components/DismissibleToast";
import { BookmarkToast } from "../components/BookmarkToast";
import { RateAppModal } from "../components/RateAppModal";
import { markRatePromptShown, recordFirstUseIfNeeded } from "../utils/rateShareTracking";
import { recordDailyActivity, recordReadingView } from "../utils/deviceIdentity";
import { qaLog } from "../utils/qaLog";
import { useAnalytics, NavigationMethod } from "../utils/analytics";
import { useReading } from "../hooks/useReading";
import { useBookmarkManager } from "../hooks/useBookmarkManager";
import { useAvailableDates } from "../hooks/useAvailableDates";
import { hasSeenInstruction, markInstructionSeen } from "../utils/bookmarkStorage";
import { parseDateLocal } from "../utils/dateUtils";
import { colors } from "../constants/theme";
import * as Notifications from "expo-notifications";

console.log("[STARTUP] index.tsx module loading...");

export default function Index() {
  console.log("[STARTUP] Index function called");
  
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
  const [showSettings, setShowSettings] = useState(false);
  const [showTextSize, setShowTextSize] = useState(false);
  const [showReminder, setShowReminder] = useState(false);
  const [toastMessage, setToastMessage] = useState<string | null>(null);
  const [reminderToast, setReminderToast] = useState<string | null>(null);
  const [showReminderToast, setShowReminderToast] = useState(false);
  const [showRateModal, setShowRateModal] = useState(false);
  const [navigationMethod, setNavigationMethod] = useState<NavigationMethod>('app_open');
  console.log("[STARTUP-INDEX] State initialized");
  
  // Analytics
  const { trackAppOpened, startReadingView, trackReadingFavorited, trackReadingUnfavorited } = useAnalytics();
  
  console.log("[STARTUP-INDEX] Calling useReading...");
  const { reading, loading, error } = useReading(currentDate);
  console.log("[STARTUP-INDEX] useReading returned, loading:", loading, "error:", error);
  const {
    bookmarks,
    isBookmarked,
    toggleBookmark,
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

  // Record reading view for analytics (unique viewers per reading)
  useEffect(() => {
    if (reading?.id) {
      recordReadingView(reading.id);
      // Start tracking in PostHog (event fires when user navigates away)
      startReadingView(reading.id, currentDate, navigationMethod);
    }
  }, [reading?.id]);

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

  const handleSettingsPress = () => {
    setShowSettings(true);
  };

  const handleOpenTextSize = () => {
    setShowTextSize(true);
  };

  const handleOpenReminder = () => {
    setShowReminder(true);
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
      <View style={styles.centerContainer}>
        <ActivityIndicator size="large" color={colors.ocean} />
        <Text style={styles.loadingText}>Loading reading...</Text>
      </View>
    );
  } else if (!reading) {
    content = (
      <View style={styles.centerContainer}>
        <Text style={styles.errorDetail}>
          {error ?? "No reading available for this date."}
        </Text>
        <View style={styles.buttonRow}>
          <TouchableOpacity style={styles.primaryButton} onPress={handleGoToToday}>
            <Text style={styles.primaryButtonText}>Go to Today</Text>
          </TouchableOpacity>
          <TouchableOpacity
            style={styles.secondaryButton}
            onPress={handleOpenDatePicker}
          >
            <Text style={styles.secondaryButtonText}>Pick a Date</Text>
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
        isBookmarked={isBookmarked}
        onBookmarkToggle={handleBookmarkToggle}
        onShare={handleShare}
        showInstruction={showInstruction}
        onDismissInstruction={handleDismissInstruction}
        onShowInstruction={handleShowInstruction}
      />
    );
  }

  return (
    <>
      {content}
      
      {/* Persistent Action Bar - stays above modals */}
      <View style={styles.actionBar}>
        <TouchableOpacity
          onPress={handleOpenBookmarks}
          style={styles.actionButton}
        >
          <Ionicons
            name="list-outline"
            size={24}
            color={colors.deepTeal}
          />
        </TouchableOpacity>

        <TouchableOpacity
          onPress={handleOpenTextSize}
          style={styles.actionButton}
        >
          <Ionicons name="text-outline" size={24} color={colors.deepTeal} />
        </TouchableOpacity>

        <TouchableOpacity
          onPress={handleOpenReminder}
          style={styles.actionButton}
        >
          <Ionicons
            name="notifications-outline"
            size={24}
            color={colors.deepTeal}
          />
        </TouchableOpacity>

        <TouchableOpacity onPress={handleSettingsPress} style={styles.actionButton}>
          <Ionicons name="information-circle-outline" size={24} color={colors.deepTeal} />
        </TouchableOpacity>
      </View>
      
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
        <SettingsContent onOpenQaLogs={() => setShowSettings(false)} />
      </SettingsModal>
      
      <TextSizeModal 
        visible={showTextSize} 
        onClose={() => setShowTextSize(false)} 
      />
      
      <ReminderModal 
        visible={showReminder} 
        onClose={() => {
          setShowReminder(false);
          setShowReminderToast(false); // Hide toast when modal closes
        }}
        onShowToast={(message) => {
          setReminderToast(message);
          setShowReminderToast(true);
        }}
      />
      
      <DismissibleToast
        visible={!!toastMessage && !!reading}
        message={toastMessage ?? ""}
        onDismiss={() => setToastMessage(null)}
      />
      
      <BookmarkToast
        visible={showReminderToast}
        message={reminderToast ?? ""}
        onHide={() => setShowReminderToast(false)}
        autoDismiss={false}
      />

      <RateAppModal
        visible={showRateModal}
        onClose={() => setShowRateModal(false)}
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
    zIndex: 1000,
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
  loadingText: {
    marginTop: 12,
    fontSize: 16,
    color: colors.ocean,
  },
  errorDetail: {
    fontSize: 20,
    fontWeight: "600",
    color: colors.ink,
    marginBottom: 12,
    textAlign: "center",
    lineHeight: 26,
  },
  errorHint: {
    fontSize: 14,
    color: colors.ocean,
    textAlign: "center",
    fontStyle: "italic",
  },
  buttonRow: {
    flexDirection: "row",
    gap: 12,
    marginTop: 16,
  },
  primaryButton: {
    backgroundColor: colors.ocean,
    paddingVertical: 12,
    paddingHorizontal: 16,
    borderRadius: 8,
  },
  primaryButtonText: {
    color: "#fff",
    fontWeight: "600",
  },
  secondaryButton: {
    borderColor: colors.ocean,
    borderWidth: 1,
    paddingVertical: 12,
    paddingHorizontal: 16,
    borderRadius: 8,
  },
  secondaryButtonText: {
    color: colors.ocean,
    fontWeight: "600",
  },
});