import { useEffect, useRef, useCallback, useState } from 'react';
import { AppState, AppStateStatus } from 'react-native';
import { getMixpanel } from '../lib/mixpanel';
import { getOrCreateDeviceId, isDeveloperDevice } from './deviceIdentity';

// Event names as constants for consistency
export const ANALYTICS_EVENTS = {
  APP_OPENED: 'app_opened',
  READING_VIEWED: 'reading_viewed',
  READING_RATED: 'reading_rated',
  READING_FAVORITED: 'reading_favorited',
  READING_UNFAVORITED: 'reading_unfavorited',
  RATE_MODAL_SHOWN: 'rate_modal_shown',
  RATE_MODAL_DISMISSED: 'rate_modal_dismissed',
  RATE_MODAL_OPENED_STORE: 'rate_modal_opened_store',
  // Subscription & paywall events
  SUBSCRIPTION_STARTED: 'subscription_started',
  SUBSCRIPTION_CANCELLED: 'subscription_cancelled',
  TRIAL_STARTED: 'trial_started',
  TRIAL_ENDED: 'trial_ended',
  TRIAL_DAY_REACHED: 'trial_day_reached',
  PAYWALL_SHOWN: 'paywall_shown',
  PAYWALL_PURCHASE_COMPLETED: 'paywall_purchase_completed',
  PAYWALL_PURCHASE_CANCELLED: 'paywall_purchase_cancelled',
  PAYWALL_DISMISSED: 'paywall_dismissed',
  RESTORE_INITIATED: 'restore_initiated',
  RESTORE_COMPLETED: 'restore_completed',
  LIFETIME_GRANDFATHERED: 'lifetime_grandfathered',
  MODAL_SHOWN: 'modal_shown',
  LEGACY_USER_IDENTIFIED: 'legacy_user_identified',
  FIRST_LAUNCH_MODAL_SHOWN: 'first_launch_modal_shown',
  FIRST_LAUNCH_MODAL_CONTINUED: 'first_launch_modal_continued',
  FIRST_LAUNCH_MODAL_SKIPPED: 'first_launch_modal_skipped',
  // Reminder events
  REMINDER_SET: 'reminder_set',
  REMINDER_CHANGED: 'reminder_changed',
  REMINDER_DISABLED: 'reminder_disabled',
  // Notebook
  NOTEBOOK_OPENED: 'notebook_opened',
  // Journal CRUD
  JOURNAL_ENTRY_CREATED: 'journal_entry_created',
  JOURNAL_ENTRY_VIEWED: 'journal_entry_viewed',
  JOURNAL_ENTRY_EDITED: 'journal_entry_edited',
  JOURNAL_ENTRY_DELETED: 'journal_entry_deleted',
  // Gratitude CRUD
  GRATITUDE_ENTRY_CREATED: 'gratitude_entry_created',
  GRATITUDE_ENTRY_VIEWED: 'gratitude_entry_viewed',
  GRATITUDE_ENTRY_EDITED: 'gratitude_entry_edited',
  GRATITUDE_ENTRY_DELETED: 'gratitude_entry_deleted',
  // Spot Check CRUD
  SPOT_CHECK_CREATED: 'spot_check_created',
  SPOT_CHECK_VIEWED: 'spot_check_viewed',
  SPOT_CHECK_EDITED: 'spot_check_edited',
  SPOT_CHECK_DELETED: 'spot_check_deleted',
  // Nightly Review CRUD
  NIGHTLY_REVIEW_CREATED: 'nightly_review_created',
  NIGHTLY_REVIEW_VIEWED: 'nightly_review_viewed',
  NIGHTLY_REVIEW_EDITED: 'nightly_review_edited',
  NIGHTLY_REVIEW_DELETED: 'nightly_review_deleted',
  // Prayers
  PRAYER_VIEWED: 'prayer_viewed',
  // Speaker Audio
  SPEAKER_AUDIO_PLAYED: 'speaker_audio_played',
  SPEAKER_AUDIO_PAUSED: 'speaker_audio_paused',
  SPEAKER_AUDIO_COMPLETED: 'speaker_audio_completed',
  // Notification coachmark
  NOTIFICATION_COACHMARK_SHOWN: 'notification_coachmark_shown',
  NOTIFICATION_COACHMARK_DISMISSED: 'notification_coachmark_dismissed',
  NOTIFICATION_TOGGLE_CHANGED: 'notification_toggle_changed',
} as const;

// Navigation method types
export type NavigationMethod = 'app_open' | 'date_picker' | 'prev_button' | 'next_button' | 'bookmark_list' | 'notification';

// Rating types
export type RatingType = 'thumbs_up' | 'thumbs_down';

// Format date as YYYY-MM-DD string
export function formatReadingDate(date: Date): string {
  const year = date.getFullYear();
  const month = String(date.getMonth() + 1).padStart(2, '0');
  const day = String(date.getDate()).padStart(2, '0');
  return `${year}-${month}-${day}`;
}

// Format date as human-readable "Jan 25" format
export function formatReadingDisplay(date: Date): string {
  return date.toLocaleDateString('en-US', { month: 'short', day: 'numeric' });
}

// Theme mode type
export type ThemeMode = 'light' | 'dark' | 'system';

// Reading view tracking state (for time spent calculation)
// Only foreground time is counted; background ends the session, foreground starts a new one.
interface ReadingViewState {
  readingId: string;
  readingDate: Date;
  readingTitle: string;
  navigationMethod: NavigationMethod;
  /** Total ms spent in foreground so far (sum of completed foreground segments). */
  accumulatedForegroundMs: number;
  /** Start of current foreground segment, or null if app is in background. */
  foregroundSegmentStart: number | null;
}

// Hook for using analytics in components
export function useAnalytics() {
  const hasIdentified = useRef(false);
  const hasTrackedAppOpen = useRef(false);
  const currentReadingView = useRef<ReadingViewState | null>(null);
  const appState = useRef<AppStateStatus>(AppState.currentState);
  const [isDeveloper, setIsDeveloper] = useState(false);
  const themeModeRef = useRef<ThemeMode>('system');

  // Check developer mode status
  useEffect(() => {
    (async () => {
      const devMode = await isDeveloperDevice();
      setIsDeveloper(devMode);
    })();
  }, []);

  // Update theme mode (called from components that have access to settings)
  const updateThemeMode = useCallback((mode: ThemeMode) => {
    themeModeRef.current = mode;
    const mp = getMixpanel();
    if (mp) {
      mp.getPeople().set({ theme_mode: mode });
    }
  }, []);

  // Identify user with persistent device ID
  useEffect(() => {
    if (hasIdentified.current) return;

    (async () => {
      const mp = getMixpanel();
      if (!mp) return;
      try {
        const deviceId = await getOrCreateDeviceId();
        mp.identify(deviceId);
        hasIdentified.current = true;
        console.log('[ANALYTICS] Identified user:', deviceId);
      } catch (err) {
        console.log('[ANALYTICS] Failed to identify user:', err);
      }
    })();
  }, []);

  // Fire reading_viewed event with foreground-only time spent, then end session.
  const fireReadingViewedEvent = useCallback(() => {
    const viewState = currentReadingView.current;
    if (!viewState) return;

    const mp = getMixpanel();
    if (!mp) return;

    const currentSegmentMs = viewState.foregroundSegmentStart
      ? Date.now() - viewState.foregroundSegmentStart
      : 0;
    const totalForegroundMs = viewState.accumulatedForegroundMs + currentSegmentMs;
    const timeSpentSeconds = Math.round(totalForegroundMs / 1000);

    // End session: clear so we don't count time for this reading anymore
    currentReadingView.current = null;

    // Only track if user spent at least 1 second
    if (timeSpentSeconds >= 1) {
      mp.track(ANALYTICS_EVENTS.READING_VIEWED, {
        reading_id: viewState.readingId,
        reading_date: formatReadingDate(viewState.readingDate),
        reading_display: formatReadingDisplay(viewState.readingDate),
        reading_title: viewState.readingTitle,
        navigation_method: viewState.navigationMethod,
        time_spent_seconds: timeSpentSeconds,
        is_developer: isDeveloper,
        theme_mode: themeModeRef.current,
      });
      mp.flush();
    }
  }, [isDeveloper]);

  // Handle app state changes (foreground/background)
  useEffect(() => {
    const handleAppStateChange = (nextAppState: AppStateStatus) => {
      // App going to background: pause timer, fire reading_viewed, clear state
      if (appState.current === 'active' && nextAppState.match(/inactive|background/)) {
        const view = currentReadingView.current;
        if (view && view.foregroundSegmentStart !== null) {
          view.accumulatedForegroundMs += Date.now() - view.foregroundSegmentStart;
          view.foregroundSegmentStart = null;
        }
        fireReadingViewedEvent();
        hasTrackedAppOpen.current = false;
      }

      // App coming to foreground
      if (appState.current.match(/inactive|background/) && nextAppState === 'active') {
        const mp = getMixpanel();
        if (mp && !hasTrackedAppOpen.current) {
          mp.track(ANALYTICS_EVENTS.APP_OPENED, {
            is_developer: isDeveloper,
            theme_mode: themeModeRef.current,
          });
          hasTrackedAppOpen.current = true;
        }
      }

      appState.current = nextAppState;
    };

    const subscription = AppState.addEventListener('change', handleAppStateChange);
    return () => subscription?.remove();
  }, [fireReadingViewedEvent, isDeveloper]);

  // Track app opened (called on initial mount)
  const trackAppOpened = useCallback(() => {
    const mp = getMixpanel();
    if (!mp) return;
    if (hasTrackedAppOpen.current) return;

    mp.track(ANALYTICS_EVENTS.APP_OPENED, {
      is_developer: isDeveloper,
      theme_mode: themeModeRef.current,
    });
    mp.flush();
    hasTrackedAppOpen.current = true;
  }, [isDeveloper]);

  // Start tracking a reading view (called when reading appears or app returns to foreground)
  const startReadingView = useCallback((
    readingId: string,
    readingDate: Date,
    readingTitle: string,
    navigationMethod: NavigationMethod
  ) => {
    // Fire event for previous reading before starting new one
    fireReadingViewedEvent();

    const isActive = AppState.currentState === 'active';
    currentReadingView.current = {
      readingId,
      readingDate,
      readingTitle,
      navigationMethod,
      accumulatedForegroundMs: 0,
      foregroundSegmentStart: isActive ? Date.now() : null,
    };
  }, [fireReadingViewedEvent]);

  const trackReadingRated = useCallback((
    readingId: string,
    readingDate: Date,
    rating: RatingType
  ) => {
    getMixpanel()?.track(ANALYTICS_EVENTS.READING_RATED, {
      reading_id: readingId,
      reading_date: formatReadingDate(readingDate),
      rating,
      is_developer: isDeveloper,
      theme_mode: themeModeRef.current,
    });
  }, [isDeveloper]);

  const trackReadingFavorited = useCallback((readingId: string, readingDate: Date) => {
    const mp = getMixpanel();
    if (!mp) return;
    mp.track(ANALYTICS_EVENTS.READING_FAVORITED, {
      reading_id: readingId,
      reading_date: formatReadingDate(readingDate),
      is_developer: isDeveloper,
      theme_mode: themeModeRef.current,
    });
    mp.flush();
  }, [isDeveloper]);

  const trackReadingUnfavorited = useCallback((readingId: string, readingDate: Date) => {
    const mp = getMixpanel();
    if (!mp) return;
    mp.track(ANALYTICS_EVENTS.READING_UNFAVORITED, {
      reading_id: readingId,
      reading_date: formatReadingDate(readingDate),
      is_developer: isDeveloper,
      theme_mode: themeModeRef.current,
    });
    mp.flush();
  }, [isDeveloper]);

  const trackRateModalShown = useCallback((trigger: 'bookmark' | 'positive_feedback' | 'settings_button') => {
    const mp = getMixpanel();
    if (!mp) return;
    mp.track(ANALYTICS_EVENTS.RATE_MODAL_SHOWN, {
      trigger,
      is_developer: isDeveloper,
      theme_mode: themeModeRef.current,
    });
    mp.flush();
  }, [isDeveloper]);

  const trackRateModalDismissed = useCallback((trigger: 'bookmark' | 'positive_feedback' | 'settings_button') => {
    const mp = getMixpanel();
    if (!mp) return;
    mp.track(ANALYTICS_EVENTS.RATE_MODAL_DISMISSED, {
      trigger,
      is_developer: isDeveloper,
      theme_mode: themeModeRef.current,
    });
    mp.flush();
  }, [isDeveloper]);

  const trackRateModalOpenedStore = useCallback((trigger: 'bookmark' | 'positive_feedback' | 'settings_button') => {
    const mp = getMixpanel();
    if (!mp) return;
    mp.track(ANALYTICS_EVENTS.RATE_MODAL_OPENED_STORE, {
      trigger,
      is_developer: isDeveloper,
      theme_mode: themeModeRef.current,
    });
    mp.flush();
  }, [isDeveloper]);

  // ─── Paywall ──────────────────────────────────────────────────────────

  const trackPaywallShown = useCallback(() => {
    const mp = getMixpanel();
    if (!mp) return;
    mp.track(ANALYTICS_EVENTS.PAYWALL_SHOWN, {
      is_developer: isDeveloper,
      theme_mode: themeModeRef.current,
    });
    mp.flush();
  }, [isDeveloper]);

  const trackPaywallDismissed = useCallback(() => {
    const mp = getMixpanel();
    if (!mp) return;
    mp.track(ANALYTICS_EVENTS.PAYWALL_DISMISSED, {
      is_developer: isDeveloper,
      theme_mode: themeModeRef.current,
    });
    mp.flush();
  }, [isDeveloper]);

  const trackPaywallPurchaseCompleted = useCallback(() => {
    const mp = getMixpanel();
    if (!mp) return;
    mp.track(ANALYTICS_EVENTS.PAYWALL_PURCHASE_COMPLETED, {
      is_developer: isDeveloper,
      theme_mode: themeModeRef.current,
    });
    mp.flush();
  }, [isDeveloper]);

  const trackPaywallPurchaseCancelled = useCallback(() => {
    const mp = getMixpanel();
    if (!mp) return;
    mp.track(ANALYTICS_EVENTS.PAYWALL_PURCHASE_CANCELLED, {
      is_developer: isDeveloper,
      theme_mode: themeModeRef.current,
    });
    mp.flush();
  }, [isDeveloper]);

  const trackRestoreInitiated = useCallback(() => {
    const mp = getMixpanel();
    if (!mp) return;
    mp.track(ANALYTICS_EVENTS.RESTORE_INITIATED, {
      is_developer: isDeveloper,
      theme_mode: themeModeRef.current,
    });
    mp.flush();
  }, [isDeveloper]);

  const trackRestoreCompleted = useCallback((restored: boolean) => {
    const mp = getMixpanel();
    if (!mp) return;
    mp.track(ANALYTICS_EVENTS.RESTORE_COMPLETED, {
      restored,
      is_developer: isDeveloper,
      theme_mode: themeModeRef.current,
    });
    mp.flush();
  }, [isDeveloper]);

  const trackModalShown = useCallback(
    (modalName: 'subscriber_to_lifetime' | 'grandfathered') => {
      const mp = getMixpanel();
      if (!mp) return;
      mp.track(ANALYTICS_EVENTS.MODAL_SHOWN, {
        modal_name: modalName,
        is_developer: isDeveloper,
        theme_mode: themeModeRef.current,
      });
      mp.flush();
    },
    [isDeveloper],
  );

  // ─── Reminders ───────────────────────────────────────────────────────

  const trackReminderSet = useCallback((time: string) => {
    const mp = getMixpanel();
    if (!mp) return;
    mp.track(ANALYTICS_EVENTS.REMINDER_SET, {
      reminder_time: time,
      is_developer: isDeveloper,
      theme_mode: themeModeRef.current,
    });
    mp.flush();
  }, [isDeveloper]);

  const trackReminderChanged = useCallback((oldTime: string, newTime: string) => {
    const mp = getMixpanel();
    if (!mp) return;
    mp.track(ANALYTICS_EVENTS.REMINDER_CHANGED, {
      old_time: oldTime,
      new_time: newTime,
      is_developer: isDeveloper,
      theme_mode: themeModeRef.current,
    });
  }, [isDeveloper]);

  const trackReminderDisabled = useCallback(() => {
    const mp = getMixpanel();
    if (!mp) return;
    mp.track(ANALYTICS_EVENTS.REMINDER_DISABLED, {
      is_developer: isDeveloper,
      theme_mode: themeModeRef.current,
    });
  }, [isDeveloper]);

  // ─── Notification coachmark ─────────────────────────────────────────

  const trackNotificationCoachmarkShown = useCallback(() => {
    const mp = getMixpanel();
    if (!mp) return;
    mp.track(ANALYTICS_EVENTS.NOTIFICATION_COACHMARK_SHOWN, {
      is_developer: isDeveloper,
      theme_mode: themeModeRef.current,
    });
    mp.flush();
  }, [isDeveloper]);

  const trackNotificationCoachmarkDismissed = useCallback(
    (reason: 'toggle_tap' | 'got_it') => {
      const mp = getMixpanel();
      if (!mp) return;
      mp.track(ANALYTICS_EVENTS.NOTIFICATION_COACHMARK_DISMISSED, {
        dismiss_reason: reason,
        is_developer: isDeveloper,
        theme_mode: themeModeRef.current,
      });
      mp.flush();
    },
    [isDeveloper]
  );

  const trackNotificationToggleChanged = useCallback(
    (enabled: boolean, source: 'coachmark' | 'settings') => {
      const mp = getMixpanel();
      if (!mp) return;
      mp.track(ANALYTICS_EVENTS.NOTIFICATION_TOGGLE_CHANGED, {
        enabled,
        source,
        is_developer: isDeveloper,
        theme_mode: themeModeRef.current,
      });
      mp.flush();
    },
    [isDeveloper]
  );

  // ─── Notebook ────────────────────────────────────────────────────────

  const trackNotebookOpened = useCallback(() => {
    const mp = getMixpanel();
    if (!mp) return;
    mp.track(ANALYTICS_EVENTS.NOTEBOOK_OPENED, {
      is_developer: isDeveloper,
      theme_mode: themeModeRef.current,
    });
  }, [isDeveloper]);

  // ─── Notebook Entry Viewed (dispatches by entry_type) ────────────────

  const trackEntryViewed = useCallback((entryType: string, entryId: string) => {
    const mp = getMixpanel();
    if (!mp) return;

    const eventMap: Record<string, string> = {
      journal: ANALYTICS_EVENTS.JOURNAL_ENTRY_VIEWED,
      spot_check: ANALYTICS_EVENTS.SPOT_CHECK_VIEWED,
      nightly_review: ANALYTICS_EVENTS.NIGHTLY_REVIEW_VIEWED,
      gratitude: ANALYTICS_EVENTS.GRATITUDE_ENTRY_VIEWED,
    };
    const eventName = eventMap[entryType];
    if (!eventName) return;

    mp.track(eventName, {
      entry_id: entryId,
      entry_type: entryType,
      is_developer: isDeveloper,
      theme_mode: themeModeRef.current,
    });
  }, [isDeveloper]);

  // ─── Prayers ─────────────────────────────────────────────────────────

  const trackPrayerViewed = useCallback((prayerId: string, prayerName: string) => {
    const mp = getMixpanel();
    if (!mp) return;
    mp.track(ANALYTICS_EVENTS.PRAYER_VIEWED, {
      prayer_id: prayerId,
      prayer_name: prayerName,
      is_developer: isDeveloper,
      theme_mode: themeModeRef.current,
    });
  }, [isDeveloper]);

  // ─── Speaker Audio ───────────────────────────────────────────────────

  const trackSpeakerAudioPlayed = useCallback((speakerId: string, speakerName: string, talkTitle: string) => {
    const mp = getMixpanel();
    if (!mp) return;
    mp.track(ANALYTICS_EVENTS.SPEAKER_AUDIO_PLAYED, {
      speaker_id: speakerId,
      speaker_name: speakerName,
      talk_title: talkTitle,
      is_developer: isDeveloper,
      theme_mode: themeModeRef.current,
    });
  }, [isDeveloper]);

  const trackSpeakerAudioPaused = useCallback((speakerId: string, speakerName: string, positionMs: number, durationMs: number) => {
    const mp = getMixpanel();
    if (!mp) return;
    mp.track(ANALYTICS_EVENTS.SPEAKER_AUDIO_PAUSED, {
      speaker_id: speakerId,
      speaker_name: speakerName,
      position_seconds: Math.round(positionMs / 1000),
      duration_seconds: Math.round(durationMs / 1000),
      percent_complete: durationMs > 0 ? Math.round((positionMs / durationMs) * 100) : 0,
      is_developer: isDeveloper,
      theme_mode: themeModeRef.current,
    });
  }, [isDeveloper]);

  const trackSpeakerAudioCompleted = useCallback((speakerId: string, speakerName: string, durationMs: number) => {
    const mp = getMixpanel();
    if (!mp) return;
    mp.track(ANALYTICS_EVENTS.SPEAKER_AUDIO_COMPLETED, {
      speaker_id: speakerId,
      speaker_name: speakerName,
      duration_seconds: Math.round(durationMs / 1000),
      is_developer: isDeveloper,
      theme_mode: themeModeRef.current,
    });
    mp.flush();
  }, [isDeveloper]);

  return {
    // Existing
    trackAppOpened,
    startReadingView,
    trackReadingRated,
    trackReadingFavorited,
    trackReadingUnfavorited,
    trackRateModalShown,
    trackRateModalDismissed,
    trackRateModalOpenedStore,
    updateThemeMode,
    // Paywall
    trackPaywallShown,
    trackPaywallDismissed,
    trackPaywallPurchaseCompleted,
    trackPaywallPurchaseCancelled,
    trackRestoreInitiated,
    trackRestoreCompleted,
    trackModalShown,
    // Reminders
    trackReminderSet,
    trackReminderChanged,
    trackReminderDisabled,
    // Notification coachmark
    trackNotificationCoachmarkShown,
    trackNotificationCoachmarkDismissed,
    trackNotificationToggleChanged,
    // Notebook
    trackNotebookOpened,
    trackEntryViewed,
    // Prayers
    trackPrayerViewed,
    // Speaker Audio
    trackSpeakerAudioPlayed,
    trackSpeakerAudioPaused,
    trackSpeakerAudioCompleted,
  };
}
