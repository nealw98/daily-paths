import { useEffect, useRef, useCallback } from 'react';
import { AppState, AppStateStatus } from 'react-native';
import { usePostHog } from 'posthog-react-native';
import { getOrCreateDeviceId } from './deviceIdentity';

// Event names as constants for consistency
export const ANALYTICS_EVENTS = {
  APP_OPENED: 'app_opened',
  READING_VIEWED: 'reading_viewed',
  READING_RATED: 'reading_rated',
  READING_FAVORITED: 'reading_favorited',
  READING_UNFAVORITED: 'reading_unfavorited',
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

// Reading view tracking state (for time spent calculation)
interface ReadingViewState {
  readingId: string;
  readingDate: Date;
  navigationMethod: NavigationMethod;
  startTime: number;
}

// Hook for using analytics in components
export function useAnalytics() {
  const posthog = usePostHog();
  const hasIdentified = useRef(false);
  const hasTrackedAppOpen = useRef(false);
  const currentReadingView = useRef<ReadingViewState | null>(null);
  const appState = useRef<AppStateStatus>(AppState.currentState);

  // Identify user with persistent device ID
  useEffect(() => {
    if (!posthog || hasIdentified.current) return;
    
    (async () => {
      try {
        const deviceId = await getOrCreateDeviceId();
        posthog.identify(deviceId);
        hasIdentified.current = true;
      } catch (err) {
        console.log('[Analytics] Failed to identify user:', err);
      }
    })();
  }, [posthog]);

  // Fire reading_viewed event with time spent
  const fireReadingViewedEvent = useCallback(() => {
    const viewState = currentReadingView.current;
    if (!viewState || !posthog) return;

    const timeSpentSeconds = Math.round((Date.now() - viewState.startTime) / 1000);
    
    // Only track if user spent at least 1 second (avoid accidental quick swipes)
    if (timeSpentSeconds >= 1) {
      posthog.capture(ANALYTICS_EVENTS.READING_VIEWED, {
        reading_id: viewState.readingId,
        reading_date: formatReadingDate(viewState.readingDate),
        navigation_method: viewState.navigationMethod,
        time_spent_seconds: timeSpentSeconds,
      });
    }
  }, [posthog]);

  // Handle app state changes (foreground/background)
  useEffect(() => {
    const handleAppStateChange = (nextAppState: AppStateStatus) => {
      // App coming to foreground
      if (appState.current.match(/inactive|background/) && nextAppState === 'active') {
        // Fire app_opened only once per foreground transition
        if (posthog && !hasTrackedAppOpen.current) {
          posthog.capture(ANALYTICS_EVENTS.APP_OPENED);
          hasTrackedAppOpen.current = true;
        }
        
        // Reset the current reading start time since user returned
        if (currentReadingView.current) {
          currentReadingView.current.startTime = Date.now();
        }
      }
      
      // App going to background - fire reading_viewed for current reading
      if (appState.current === 'active' && nextAppState.match(/inactive|background/)) {
        fireReadingViewedEvent();
        hasTrackedAppOpen.current = false; // Allow new app_opened on next foreground
      }
      
      appState.current = nextAppState;
    };

    const subscription = AppState.addEventListener('change', handleAppStateChange);
    return () => subscription?.remove();
  }, [posthog, fireReadingViewedEvent]);

  // Track app opened (called on initial mount)
  const trackAppOpened = useCallback(() => {
    if (!posthog || hasTrackedAppOpen.current) return;
    posthog.capture(ANALYTICS_EVENTS.APP_OPENED);
    hasTrackedAppOpen.current = true;
  }, [posthog]);

  // Start tracking a reading view (called when reading appears)
  // This doesn't fire the event yet - that happens when user navigates away
  const startReadingView = useCallback((
    readingId: string,
    readingDate: Date,
    navigationMethod: NavigationMethod
  ) => {
    // Fire event for previous reading before starting new one
    fireReadingViewedEvent();
    
    // Start tracking new reading
    currentReadingView.current = {
      readingId,
      readingDate,
      navigationMethod,
      startTime: Date.now(),
    };
  }, [fireReadingViewedEvent]);

  const trackReadingRated = useCallback((
    readingId: string,
    readingDate: Date,
    rating: RatingType
  ) => {
    posthog?.capture(ANALYTICS_EVENTS.READING_RATED, {
      reading_id: readingId,
      reading_date: formatReadingDate(readingDate),
      rating,
    });
  }, [posthog]);

  const trackReadingFavorited = useCallback((readingId: string, readingDate: Date) => {
    posthog?.capture(ANALYTICS_EVENTS.READING_FAVORITED, {
      reading_id: readingId,
      reading_date: formatReadingDate(readingDate),
    });
  }, [posthog]);

  const trackReadingUnfavorited = useCallback((readingId: string, readingDate: Date) => {
    posthog?.capture(ANALYTICS_EVENTS.READING_UNFAVORITED, {
      reading_id: readingId,
      reading_date: formatReadingDate(readingDate),
    });
  }, [posthog]);

  return {
    trackAppOpened,
    startReadingView, // Renamed from trackReadingViewed - now handles time tracking
    trackReadingRated,
    trackReadingFavorited,
    trackReadingUnfavorited,
  };
}
