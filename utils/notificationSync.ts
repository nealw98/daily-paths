import AsyncStorage from '@react-native-async-storage/async-storage';
import * as Notifications from 'expo-notifications';
import { getCachedReading } from './readingCache';
import {
  scheduleSingleDayNotification,
  scheduleGenericFallbackNotification,
} from './dailyReminder';

/**
 * Schedule up to 7 individually-dated notifications — one per day — each
 * containing the correct Thought for the Day for that specific date.
 * A generic repeating fallback is also scheduled to cover day 8+.
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

    // 3. Schedule one-time notifications for today + next 6 days
    let scheduled = 0;
    for (let i = 0; i < 7; i++) {
      const date = new Date();
      date.setDate(date.getDate() + i);

      const cached = await getCachedReading(date);
      if (cached?.reading?.thoughtForDay) {
        await scheduleSingleDayNotification(date, time, cached.reading.thoughtForDay);
        scheduled++;
      } else {
        console.log(
          `[NotificationSync] No cached thought for day +${i}, skipping one-time notification`
        );
      }
    }

    console.log(`[NotificationSync] Scheduled ${scheduled} one-time notification(s)`);

    // 4. Always keep a generic repeating notification as fallback
    await scheduleGenericFallbackNotification(time);

    // Debug: log what's scheduled
    const all = await Notifications.getAllScheduledNotificationsAsync();
    console.log(`[NotificationSync] Total scheduled notifications: ${all.length}`);
  } catch (error) {
    console.warn('[NotificationSync] Failed to schedule week of notifications:', error);
  }
}
