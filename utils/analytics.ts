import { usePostHog } from 'posthog-react-native';

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

// Hook for using analytics in components
export function useAnalytics() {
  const posthog = usePostHog();

  const trackAppOpened = () => {
    posthog?.capture(ANALYTICS_EVENTS.APP_OPENED);
  };

  const trackReadingViewed = (
    readingId: string,
    readingDate: Date,
    navigationMethod: NavigationMethod
  ) => {
    posthog?.capture(ANALYTICS_EVENTS.READING_VIEWED, {
      reading_id: readingId,
      reading_date: formatReadingDate(readingDate),
      navigation_method: navigationMethod,
    });
  };

  const trackReadingRated = (
    readingId: string,
    readingDate: Date,
    rating: RatingType
  ) => {
    posthog?.capture(ANALYTICS_EVENTS.READING_RATED, {
      reading_id: readingId,
      reading_date: formatReadingDate(readingDate),
      rating,
    });
  };

  const trackReadingFavorited = (readingId: string, readingDate: Date) => {
    posthog?.capture(ANALYTICS_EVENTS.READING_FAVORITED, {
      reading_id: readingId,
      reading_date: formatReadingDate(readingDate),
    });
  };

  const trackReadingUnfavorited = (readingId: string, readingDate: Date) => {
    posthog?.capture(ANALYTICS_EVENTS.READING_UNFAVORITED, {
      reading_id: readingId,
      reading_date: formatReadingDate(readingDate),
    });
  };

  return {
    trackAppOpened,
    trackReadingViewed,
    trackReadingRated,
    trackReadingFavorited,
    trackReadingUnfavorited,
  };
}
