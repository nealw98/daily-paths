import AsyncStorage from '@react-native-async-storage/async-storage';
import * as Notifications from 'expo-notifications';
import { getCachedReading } from './readingCache';
import {
  scheduleSingleDayNotification,
  pickLapsedPhrasing,
} from './dailyReminder';

/**
 * Active window: the next N days where we expect to have a cached
 * Thought for the Day. Each day gets a one-time notification with the
 * specific thought (or a rotating fallback phrasing if the cache missed
 * for that day, which should be rare).
 */
const ACTIVE_DAYS = 7;

/**
 * Lapsed window: additional days beyond the active window scheduled
 * with rotating fallback phrasings to nudge users who haven't opened
 * the app. Each app open / prefetch refreshes the whole schedule, so
 * an active user never sees these.
 */
const LAPSED_DAYS = 21;

/**
 * Schedule per-day one-time notifications for the next ACTIVE_DAYS +
 * LAPSED_DAYS days. The active window uses the cached Thought for the
 * Day when available; the lapsed window uses rotating fallback phrasings
 * to re-engage users who go quiet.
 *
 * Call this whenever:
 * - The app opens to the Today tab
 * - A fresh reading is fetched from Supabase
 * - The user enables or changes their reminder time
 */
export async function scheduleWeekOfNotifications(): Promise<void> {
  try {
    // 1. Read user settings
    const settingsRaw =
      (await AsyncStorage.getItem('daily_paths_settings_v2')) ??
      (await AsyncStorage.getItem('daily_paths_settings_v1'));

    let reminderEnabled = false;
    let reminderTime = '08:00';

    if (settingsRaw) {
      const settings = JSON.parse(settingsRaw);
      reminderEnabled = settings.dailyReminderEnabled ?? false;
      reminderTime = settings.dailyReminderTime ?? '08:00';
    }

    if (!reminderEnabled) {
      console.log('[NotificationSync] Reminder not enabled, skipping schedule');
      return;
    }

    const [hourStr = '8', minuteStr = '0'] = reminderTime.split(':');
    const time = { hour: Number(hourStr), minute: Number(minuteStr) };

    // 2. Cancel ALL existing scheduled notifications
    await Notifications.cancelAllScheduledNotificationsAsync();
    console.log('[NotificationSync] Cleared existing notifications');

    // 3. Active window — one-time notification per day with the
    //    Thought for the Day (or a rotating fallback if cache missed).
    let activeWithThought = 0;
    let activeWithFallback = 0;
    for (let i = 0; i < ACTIVE_DAYS; i++) {
      const date = new Date();
      date.setDate(date.getDate() + i);

      const cached = await getCachedReading(date);
      if (cached?.reading?.thoughtForDay) {
        await scheduleSingleDayNotification(
          date,
          time,
          `Today's Thought: ${cached.reading.thoughtForDay}`
        );
        activeWithThought++;
      } else {
        await scheduleSingleDayNotification(date, time, pickLapsedPhrasing(date));
        activeWithFallback++;
      }
    }

    // 4. Lapsed window — rotating fallback phrasings for days where
    //    the user hasn't opened the app (and so hasn't refreshed the
    //    schedule). An active user will never see these.
    let lapsedScheduled = 0;
    for (let i = ACTIVE_DAYS; i < ACTIVE_DAYS + LAPSED_DAYS; i++) {
      const date = new Date();
      date.setDate(date.getDate() + i);
      await scheduleSingleDayNotification(date, time, pickLapsedPhrasing(date));
      lapsedScheduled++;
    }

    console.log(
      `[NotificationSync] Scheduled ${activeWithThought} thought-of-day, ` +
        `${activeWithFallback} active-window fallback, ${lapsedScheduled} lapsed fallback`
    );

    // Debug: log what's scheduled
    const all = await Notifications.getAllScheduledNotificationsAsync();
    console.log(`[NotificationSync] Total scheduled notifications: ${all.length}`);
  } catch (error) {
    console.warn('[NotificationSync] Failed to schedule week of notifications:', error);
  }
}
