import React, { useState, useEffect, useRef } from "react";
import {
  View,
  Text,
  ActivityIndicator,
  StyleSheet,
  Share,
  AppState,
  AppStateStatus,
} from "react-native";
import { useLocalSearchParams, useRouter } from "expo-router";
import { ReadingScreen } from "../../components/ReadingScreen";
import { JournalCategoryPicker } from "../../components/journal/JournalCategoryPicker";
import { JournalEntryEditor } from "../../components/journal/JournalEntryEditor";
import type { EntryType } from "../../constants/journalCategories";
import { useJournalStorage } from "../../hooks/useJournalStorage";
import { useTrialStatus } from "../../hooks/useTrialStatus";
import { useSubscription } from "../../hooks/useSubscription";
import { DismissibleToast } from "../../components/DismissibleToast";
import { markRatePromptShown, recordFirstUseIfNeeded, requestReview } from "../../utils/rateShareTracking";
import { recordDailyActivity, recordReadingView } from "../../utils/deviceIdentity";
import { qaLog } from "../../utils/qaLog";
import { useAnalytics, NavigationMethod } from "../../utils/analytics";
import { getRequiredGate } from "../../utils/accessControl";
import { useReading } from "../../hooks/useReading";
import { useBookmarkManager } from "../../hooks/useBookmarkManager";
import { hasSeenInstruction, markInstructionSeen } from "../../utils/bookmarkStorage";
import { formatDateLocal, parseDateLocal } from "../../utils/dateUtils";
import { useTheme } from "../../hooks/useTheme";
import * as Notifications from "expo-notifications";
import { SanctuaryButton } from "../../components/ui/Sanctuary";

export default function ReadingDetail() {
  const { colors, colorScheme, isDark } = useTheme();
  const router = useRouter();
  const params = useLocalSearchParams<{ jump?: string; ts?: string; selectedDate?: string }>();

  // Start with today's date
  const [currentDate, setCurrentDate] = useState(new Date());
  const [showInstruction, setShowInstruction] = useState(false);
  const [toastMessage, setToastMessage] = useState<string | null>(null);
  const [navigationMethod, setNavigationMethod] = useState<NavigationMethod>('app_open');
  const [showJournalPicker, setShowJournalPicker] = useState(false);
  const [journalEntryType, setJournalEntryType] = useState<EntryType | null>(null);
  const handledJumpTokenRef = useRef<string | null>(null);

  // Journal entry creation
  const { createEntry } = useJournalStorage();

  const trialStatus = useTrialStatus();
  const {
    status: subStatus,
    hasLifetimeAccess,
    loading: subscriptionLoading,
  } = useSubscription();
  const journalLockedByPaywall =
    !subscriptionLoading &&
    !trialStatus.loading &&
    getRequiredGate(subStatus, trialStatus, hasLifetimeAccess) === "paywall";

  // Analytics
  const { trackAppOpened, startReadingView, trackReadingFavorited, trackReadingUnfavorited, updateThemeMode } = useAnalytics();

  useEffect(() => {
    updateThemeMode(colorScheme);
  }, [colorScheme, updateThemeMode]);

  const { reading, loading, error } = useReading(currentDate);
  const {
    isBookmarked,
    toggleBookmark,
  } = useBookmarkManager(currentDate, reading?.id || "", reading?.title || "");

  const lastNotificationResponse = Notifications.useLastNotificationResponse();

  useEffect(() => {
    if (!lastNotificationResponse) return;
    if (
      lastNotificationResponse.actionIdentifier ===
      Notifications.DEFAULT_ACTION_IDENTIFIER
    ) {
      setNavigationMethod('notification');
      setCurrentDate(new Date());
    }
  }, [lastNotificationResponse]);

  useEffect(() => {
    if (params?.jump !== "today") return;
    const token = params?.ts ?? "__no_ts__";
    if (handledJumpTokenRef.current === token) return;
    handledJumpTokenRef.current = token;
    setCurrentDate(new Date());
    router.setParams({ jump: undefined, ts: undefined });
  }, [params?.jump, params?.ts, router]);

  useEffect(() => {
    if (!params?.selectedDate) return;
    const token = `${params.selectedDate}:${params?.ts ?? "__no_ts__"}`;
    if (handledJumpTokenRef.current === token) return;
    handledJumpTokenRef.current = token;
    setNavigationMethod("date_picker");
    setCurrentDate(parseDateLocal(params.selectedDate));
    router.setParams({ selectedDate: undefined, ts: undefined });
  }, [params?.selectedDate, params?.ts, router]);

  useEffect(() => {
    if (error && reading) {
      setToastMessage(error);
    }
    if (!reading) {
      setToastMessage(null);
    }
  }, [error, reading]);

  useEffect(() => {
    async function checkInstruction() {
      const seen = await hasSeenInstruction();
      setShowInstruction(!seen);
    }
    checkInstruction();
  }, []);

  useEffect(() => {
    recordFirstUseIfNeeded();
  }, []);

  useEffect(() => {
    recordDailyActivity();
  }, []);

  useEffect(() => {
    trackAppOpened();
  }, []);

  const readingRef = useRef(reading);
  const currentDateRef = useRef(currentDate);
  const navigationMethodRef = useRef(navigationMethod);
  readingRef.current = reading;
  currentDateRef.current = currentDate;
  navigationMethodRef.current = navigationMethod;

  useEffect(() => {
    if (reading?.id) {
      recordReadingView(reading.id);
      startReadingView(reading.id, currentDate, reading.title, navigationMethod);
    }
  }, [reading?.id]);

  useEffect(() => {
    const isSameLocalDay = (a: Date, b: Date) =>
      a.getFullYear() === b.getFullYear() &&
      a.getMonth() === b.getMonth() &&
      a.getDate() === b.getDate();

    const handleAppStateChange = (nextAppState: AppStateStatus) => {
      if (nextAppState === 'active') {
        const now = new Date();
        const selectedDate = currentDateRef.current;
        if (!isSameLocalDay(selectedDate, now)) {
          setCurrentDate(now);
          setNavigationMethod("app_open");
        }

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

  const handleOpenDatePicker = () => {
    router.push({
      pathname: "/select-date",
      params: { selectedDate: formatDateLocal(currentDate) },
    });
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
    handleOpenDatePicker();
  };

  const handleBookmarkToggle = async () => {
    const result = await toggleBookmark();
    if (reading?.id) {
      if (result.newState) {
        trackReadingFavorited(reading.id, currentDate);
      } else {
        trackReadingUnfavorited(reading.id, currentDate);
      }
    }
    if (result.shouldShowRatePrompt) {
      qaLog("rate", "Bookmark triggered rate prompt - requesting native review");
      await markRatePromptShown();
      setTimeout(async () => {
        await requestReview();
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
          lines.push("");
        }
      });
    };

    lines.push(dateLabel);
    lines.push("");
    lines.push(reading.title.toUpperCase());

    if (applicationQuote) {
      lines.push("");
      lines.push(applicationQuote);
      if (applicationReference) {
        lines.push(`(${applicationReference})`);
      }
    }

    if (bodyParagraphs.length) {
      lines.push("");
      lines.push(bodyParagraphs.join(" "));
    }

    if (applicationParagraphs.length) {
      lines.push("");
      lines.push("Practice:");
      pushParagraphs(applicationParagraphs);
    }

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
          <SanctuaryButton label="Go to Today" onPress={handleGoToToday} style={styles.errorButton} />
          <SanctuaryButton
            label="Pick a Date"
            variant="secondary"
            onPress={handleOpenDatePicker}
            style={styles.errorButton}
          />
        </View>
      </View>
    );
  } else {
    content = (
      <ReadingScreen
        reading={reading}
        onHeaderPress={handleGoToToday}
        onOpenDatePicker={handleOpenDatePicker}
        onOpenBookmarks={handleOpenBookmarks}
        isBookmarked={isBookmarked}
        onBookmarkToggle={handleBookmarkToggle}
        onShare={handleShare}
        onNewJournalEntry={
          journalLockedByPaywall ? undefined : () => setShowJournalPicker(true)
        }
        showInstruction={showInstruction}
        onDismissInstruction={handleDismissInstruction}
        onShowInstruction={handleShowInstruction}
      />
    );
  }

  if (journalEntryType) {
    return (
      <JournalEntryEditor
        key={journalEntryType}
        entryType={journalEntryType}
        onSave={async (entryType, content, structuredContent) => {
          await createEntry(entryType, content, structuredContent);
          setJournalEntryType(null);
        }}
        onCancel={() => setJournalEntryType(null)}
        onSwitchEntryType={setJournalEntryType}
      />
    );
  }

  return (
    <>
      {content}

      <JournalCategoryPicker
        visible={showJournalPicker && !journalLockedByPaywall}
        onSelect={(entryType) => {
          if (journalLockedByPaywall) return;
          setShowJournalPicker(false);
          setJournalEntryType(entryType);
        }}
        onClose={() => setShowJournalPicker(false)}
      />

      <DismissibleToast
        visible={!!toastMessage && !!reading}
        message={toastMessage ?? ""}
        onDismiss={() => setToastMessage(null)}
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
  buttonRow: {
    width: "100%",
    gap: 12,
    marginTop: 16,
  },
  errorButton: {
    width: "100%",
  },
});
