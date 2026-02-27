import { getMixpanel } from '../lib/mixpanel';
import { isDeveloperDevice } from './deviceIdentity';
import AsyncStorage from '@react-native-async-storage/async-storage';

const SETTINGS_STORAGE_KEY = 'daily_paths_settings_v2';

let cachedIsDeveloper: boolean | null = null;

/**
 * Track a Mixpanel event from non-component code (hooks, lib modules).
 * Automatically attaches is_developer and theme_mode common properties.
 *
 * Use this in useJournalEntries, useLocalJournalEntries, useGratitude,
 * lib/subscription.ts, utils/trialTimer.ts, utils/legacyUserMigration.ts, etc.
 *
 * For component code, use the useAnalytics() hook instead.
 */
export async function trackEvent(
  eventName: string,
  properties: Record<string, unknown> = {},
  flush = false,
): Promise<void> {
  const mp = getMixpanel();
  if (!mp) return;

  // Resolve developer status (cached after first call)
  if (cachedIsDeveloper === null) {
    try {
      cachedIsDeveloper = await isDeveloperDevice();
    } catch {
      cachedIsDeveloper = false;
    }
  }

  // Read theme mode from the same storage location useSettings uses
  let themeMode = 'system';
  try {
    const stored = await AsyncStorage.getItem(SETTINGS_STORAGE_KEY);
    if (stored) {
      const settings = JSON.parse(stored);
      themeMode = settings.colorScheme || 'system';
    }
  } catch {
    // fallback to 'system'
  }

  mp.track(eventName, {
    ...properties,
    is_developer: cachedIsDeveloper,
    theme_mode: themeMode,
  });

  if (flush) {
    mp.flush();
  }
}
