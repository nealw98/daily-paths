import { useEffect, useRef, useCallback, useState } from 'react';
import { AppState, AppStateStatus } from 'react-native';
import { usePostHog } from 'posthog-react-native';
import { getOrCreateDeviceId, isDeveloperDevice } from './deviceIdentity';

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

// Format date as human-readable "Jan 25" format
export function formatReadingDisplay(date: Date): string {
  return date.toLocaleDateString('en-US', { month: 'short', day: 'numeric' });
}

// Reading view tracking state (for time spent calculation)
interface ReadingViewState {
  readingId: string;
  readingDate: Date;
  readingTitle: string;
  navigationMethod: NavigationMethod;
  startTime: number;
}

// Theme mode type
export type ThemeMode = 'light' | 'dark' | 'system';

// Hook for using analytics in components
export function useAnalytics() {
  const posthog = usePostHog();
  const hasIdentified = useRef(false);
  const hasTrackedAppOpen = useRef(false);
  const hasLoggedStatus = useRef(false);
  const currentReadingView = useRef<ReadingViewState | null>(null);
  const appState = useRef<AppStateStatus>(AppState.currentState);
  const [isDeveloper, setIsDeveloper] = useState(false);
  const themeModeRef = useRef<ThemeMode>('system');

  // Log PostHog status once
  useEffect(() => {
    if (!hasLoggedStatus.current) {
      console.log('[POSTHOG] usePostHog() returned:', posthog ? 'PostHog instance' : 'null');
      hasLoggedStatus.current = true;
    }
  }, [posthog]);

  // Check developer mode status
  useEffect(() => {
    (async () => {
      const devMode = await isDeveloperDevice();
      setIsDeveloper(devMode);
      console.log('[POSTHOG] Developer mode:', devMode);
    })();
  }, []);

  // Update theme mode (called from components that have access to settings)
  // Sets both the ref (for event properties) and person property (for demographics)
  const updateThemeMode = useCallback((mode: ThemeMode) => {
    themeModeRef.current = mode;
    console.log('[POSTHOG] Theme mode updated:', mode);
    
    // Set as person property for demographic analysis using $set
    if (posthog) {
      console.log('[POSTHOG] Setting person property theme_mode:', mode);
      posthog.capture('$set', { $set: { theme_mode: mode } });
    }
  }, [posthog]);

  // Identify user with persistent device ID
  useEffect(() => {
    if (!posthog || hasIdentified.current) return;
    
    (async () => {
      try {
        const deviceId = await getOrCreateDeviceId();
        console.log('[POSTHOG] Identifying user with device ID:', deviceId);
        posthog.identify(deviceId);
        hasIdentified.current = true;
      } catch (err) {
        console.log('[POSTHOG] Failed to identify user:', err);
      }
    })();
  }, [posthog]);

  // Fire reading_viewed event with time spent
  const fireReadingViewedEvent = useCallback(() => {
    const viewState = currentReadingView.current;
    if (!viewState) {
      console.log('[POSTHOG] fireReadingViewedEvent: No current view state');
      return;
    }
    if (!posthog) {
      console.log('[POSTHOG] fireReadingViewedEvent: PostHog not available');
      return;
    }

    const timeSpentSeconds = Math.round((Date.now() - viewState.startTime) / 1000);
    
    // Only track if user spent at least 1 second (avoid accidental quick swipes)
    if (timeSpentSeconds >= 1) {
      // Build the event payload explicitly
      const readingDate = formatReadingDate(viewState.readingDate);
      const readingDisplay = formatReadingDisplay(viewState.readingDate);
      const readingTitle = viewState.readingTitle;
      
      const eventPayload = {
        reading_id: viewState.readingId,
        reading_date: readingDate,
        reading_display: readingDisplay,
        reading_title: readingTitle,
        navigation_method: viewState.navigationMethod,
        time_spent_seconds: timeSpentSeconds,
        is_developer: isDeveloper,
        theme_mode: themeModeRef.current,
      };
      
      console.log('[POSTHOG] ===== FIRING READING_VIEWED EVENT =====');
      console.log('[POSTHOG] Event name:', ANALYTICS_EVENTS.READING_VIEWED);
      console.log('[POSTHOG] Full payload:', JSON.stringify(eventPayload, null, 2));
      console.log('[POSTHOG] reading_id:', eventPayload.reading_id);
      console.log('[POSTHOG] reading_date:', eventPayload.reading_date);
      console.log('[POSTHOG] reading_display:', eventPayload.reading_display);
      console.log('[POSTHOG] reading_title:', eventPayload.reading_title);
      console.log('[POSTHOG] navigation_method:', eventPayload.navigation_method);
      console.log('[POSTHOG] time_spent_seconds:', eventPayload.time_spent_seconds);
      
      posthog.capture(ANALYTICS_EVENTS.READING_VIEWED, eventPayload);
      
      console.log('[POSTHOG] Calling flush() for reading_viewed...');
      posthog.flush().then(() => {
        console.log('[POSTHOG] reading_viewed flush() completed');
      }).catch((err: unknown) => {
        console.log('[POSTHOG] reading_viewed flush() error:', err);
      });
    } else {
      console.log('[POSTHOG] fireReadingViewedEvent: Time spent too short:', timeSpentSeconds, 'seconds');
    }
  }, [posthog, isDeveloper]);

  // Handle app state changes (foreground/background)
  useEffect(() => {
    const handleAppStateChange = (nextAppState: AppStateStatus) => {
      // App coming to foreground
      if (appState.current.match(/inactive|background/) && nextAppState === 'active') {
        // Fire app_opened only once per foreground transition
        if (posthog && !hasTrackedAppOpen.current) {
          posthog.capture(ANALYTICS_EVENTS.APP_OPENED, { 
            is_developer: isDeveloper,
            theme_mode: themeModeRef.current,
          });
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
  }, [posthog, fireReadingViewedEvent, isDeveloper]);

  // Track app opened (called on initial mount)
  const trackAppOpened = useCallback(() => {
    if (!posthog) {
      console.log('[POSTHOG] trackAppOpened: PostHog not available');
      return;
    }
    if (hasTrackedAppOpen.current) {
      console.log('[POSTHOG] trackAppOpened: Already tracked this session');
      return;
    }
    console.log('[POSTHOG] Capturing event:', ANALYTICS_EVENTS.APP_OPENED, { is_developer: isDeveloper, theme_mode: themeModeRef.current });
    posthog.capture(ANALYTICS_EVENTS.APP_OPENED, { 
      is_developer: isDeveloper,
      theme_mode: themeModeRef.current,
    });
    console.log('[POSTHOG] Calling flush()...');
    posthog.flush().then(() => {
      console.log('[POSTHOG] flush() completed successfully');
    }).catch((err: unknown) => {
      console.log('[POSTHOG] flush() error:', err);
    });
    hasTrackedAppOpen.current = true;
  }, [posthog, isDeveloper]);

  // Start tracking a reading view (called when reading appears)
  // This doesn't fire the event yet - that happens when user navigates away
  const startReadingView = useCallback((
    readingId: string,
    readingDate: Date,
    readingTitle: string,
    navigationMethod: NavigationMethod
  ) => {
    console.log('[POSTHOG] ===== START READING VIEW =====');
    console.log('[POSTHOG] readingId:', readingId);
    console.log('[POSTHOG] readingDate:', readingDate);
    console.log('[POSTHOG] readingDate type:', typeof readingDate);
    console.log('[POSTHOG] readingDate instanceof Date:', readingDate instanceof Date);
    console.log('[POSTHOG] readingTitle:', readingTitle);
    console.log('[POSTHOG] navigationMethod:', navigationMethod);
    
    // Fire event for previous reading before starting new one
    fireReadingViewedEvent();
    
    // Start tracking new reading
    currentReadingView.current = {
      readingId,
      readingDate,
      readingTitle,
      navigationMethod,
      startTime: Date.now(),
    };
    
    console.log('[POSTHOG] Stored view state:', JSON.stringify({
      readingId: currentReadingView.current.readingId,
      readingTitle: currentReadingView.current.readingTitle,
      navigationMethod: currentReadingView.current.navigationMethod,
    }));
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
      is_developer: isDeveloper,
      theme_mode: themeModeRef.current,
    });
  }, [posthog, isDeveloper]);

  const trackReadingFavorited = useCallback((readingId: string, readingDate: Date) => {
    if (!posthog) {
      console.log('[POSTHOG] trackReadingFavorited: PostHog not available');
      return;
    }
    console.log('[POSTHOG] Capturing event:', ANALYTICS_EVENTS.READING_FAVORITED, { reading_id: readingId, is_developer: isDeveloper, theme_mode: themeModeRef.current });
    posthog.capture(ANALYTICS_EVENTS.READING_FAVORITED, {
      reading_id: readingId,
      reading_date: formatReadingDate(readingDate),
      is_developer: isDeveloper,
      theme_mode: themeModeRef.current,
    });
    posthog.flush().then(() => {
      console.log('[POSTHOG] reading_favorited flush() completed');
    }).catch((err: unknown) => {
      console.log('[POSTHOG] reading_favorited flush() error:', err);
    });
  }, [posthog, isDeveloper]);

  const trackReadingUnfavorited = useCallback((readingId: string, readingDate: Date) => {
    if (!posthog) {
      console.log('[POSTHOG] trackReadingUnfavorited: PostHog not available');
      return;
    }
    console.log('[POSTHOG] Capturing event:', ANALYTICS_EVENTS.READING_UNFAVORITED, { reading_id: readingId, is_developer: isDeveloper, theme_mode: themeModeRef.current });
    posthog.capture(ANALYTICS_EVENTS.READING_UNFAVORITED, {
      reading_id: readingId,
      reading_date: formatReadingDate(readingDate),
      is_developer: isDeveloper,
      theme_mode: themeModeRef.current,
    });
    posthog.flush().then(() => {
      console.log('[POSTHOG] reading_unfavorited flush() completed');
    }).catch((err: unknown) => {
      console.log('[POSTHOG] reading_unfavorited flush() error:', err);
    });
  }, [posthog, isDeveloper]);

  return {
    trackAppOpened,
    startReadingView,
    trackReadingRated,
    trackReadingFavorited,
    trackReadingUnfavorited,
    updateThemeMode,
  };
}
