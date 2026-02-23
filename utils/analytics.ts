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
  // Unlimited feature events
  JOURNAL_ENTRY_CREATED: 'journal_entry_created',
  JOURNAL_ENTRY_EDITED: 'journal_entry_edited',
  JOURNAL_ENTRY_DELETED: 'journal_entry_deleted',
  GRATITUDE_ENTRY_CREATED: 'gratitude_entry_created',
  SUBSCRIPTION_STARTED: 'subscription_started',
  SUBSCRIPTION_CANCELLED: 'subscription_cancelled',
  TRIAL_STARTED: 'trial_started',
  TRIAL_ENDED: 'trial_ended',
  PAYWALL_SHOWN: 'paywall_shown',
  PAYWALL_DISMISSED: 'paywall_dismissed',
  LEGACY_USER_IDENTIFIED: 'legacy_user_identified',
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

  return {
    trackAppOpened,
    startReadingView,
    trackReadingRated,
    trackReadingFavorited,
    trackReadingUnfavorited,
    trackRateModalShown,
    trackRateModalDismissed,
    trackRateModalOpenedStore,
    updateThemeMode,
  };
}
