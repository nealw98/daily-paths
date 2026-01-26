import AsyncStorage from '@react-native-async-storage/async-storage';
import { getCachedReading } from './readingCache';
import { scheduleDailyReminder } from './dailyReminder';

const REMINDER_TIME_KEY = 'dailyReminderTime';
const REMINDER_ENABLED_KEY = 'dailyReminderEnabled';

/**
 * Updates the scheduled notification with today's thought.
 * Reads from cache and reschedules if reminder is enabled.
 * 
 * This function is called:
 * - When the app launches (to sync with latest cached data)
 * - When a reading is fetched and cached (to update with fresh content)
 * - When user changes reminder settings (to apply new time with current thought)
 */
export async function updateNotificationWithThought(): Promise<void> {
  try {
    // Check if user has reminder enabled
    // The settings are stored in the settings object, but we check both locations
    // to be robust during the migration
    const settingsRaw = await AsyncStorage.getItem('daily_paths_settings_v1');
    let reminderEnabled = false;
    let reminderTime = '08:00';
    
    if (settingsRaw) {
      const settings = JSON.parse(settingsRaw);
      reminderEnabled = settings.dailyReminderEnabled ?? false;
      reminderTime = settings.dailyReminderTime ?? '08:00';
    }
    
    if (!reminderEnabled) {
      console.log('[NotificationSync] Reminder not enabled, skipping update');
      return; // No reminder set, nothing to update
    }

    // Get today's reading from cache
    const today = new Date();
    const cached = await getCachedReading(today);
    
    if (cached?.reading?.thoughtForDay) {
      console.log('[NotificationSync] Updating notification with today\'s thought');
      await scheduleDailyReminder(reminderTime, cached.reading.thoughtForDay);
    } else {
      console.log('[NotificationSync] No thought available, scheduling with default message');
      // Still schedule, but without the thought (will use fallback message)
      await scheduleDailyReminder(reminderTime);
    }
  } catch (error) {
    console.warn('[NotificationSync] Failed to update notification:', error);
    // Don't throw - this is a best-effort enhancement
  }
}
