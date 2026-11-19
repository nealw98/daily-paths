import AsyncStorage from '@react-native-async-storage/async-storage';
import * as Notifications from 'expo-notifications';
import { getCachedReading } from './readingCache';
import { getThoughtsByDay } from './thoughtsCache';
import { getScheduledDayOfYear } from './dateUtils';
import { qaLog } from './qaLog';
import {
  scheduleSingleDayNotification,
  pickLapsedPhrasing,
} from './dailyReminder';

/**
 * How many days ahead to schedule one-time notifications. Each day gets
 * that day's Thought for the Day from the thoughts table (see
 * thoughtsCache.ts), so even a user who stops opening the app keeps
 * getting real Thoughts for four weeks. The rotating fallback phrasing is
 * used only if neither the thoughts table nor the reading cache has that
 * day's Thought.
 */
const SCHEDULE_DAYS = 28;

let running: Promise<void> | null = null;
let queued: Promise<void> | null = null;

/**
 * Rebuild the scheduled daily-reminder notifications from the saved
 * settings, or clear them all if the reminder is off.
 *
 * Single-flight: each run cancels everything and re-adds ~28 entries, so
 * overlapping runs could interleave and leave duplicates or stale text.
 * A call made while a run is in progress queues exactly one follow-up run
 * (which re-reads the latest settings); further calls join that follow-up.
 *
 * Called on launch, on every foreground, and whenever the user changes the
 * reminder switch or time (see useSettings).
 */
export function scheduleWeekOfNotifications(): Promise<void> {
  if (!running) {
    running = runSchedule().finally(() => {
      running = null;
    });
    return running;
  }
  if (!queued) {
    queued = running.then(() => {
      queued = null;
      return scheduleWeekOfNotifications();
    });
  }
  return queued;
}

async function runSchedule(): Promise<void> {
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
      await Notifications.cancelAllScheduledNotificationsAsync();
      console.log('[NotificationSync] Reminder not enabled, cleared schedule');
      return;
    }

    const [hourStr = '8', minuteStr = '0'] = reminderTime.split(':');
    const time = { hour: Number(hourStr), minute: Number(minuteStr) };

    // 2. Resolve every day's text before touching the OS schedule, so the
    //    window between cancel and re-add stays as short as possible.
    const thoughts = await getThoughtsByDay();
    const days: { date: Date; body: string }[] = [];
    let withThought = 0;
    let withFallback = 0;
    for (let i = 0; i < SCHEDULE_DAYS; i++) {
      const date = new Date();
      date.setDate(date.getDate() + i);

      let thought = thoughts?.[getScheduledDayOfYear(date)];
      if (!thought) {
        const cached = await getCachedReading(date);
        thought = cached?.reading?.thoughtForDay || undefined;
      }

      if (thought) {
        days.push({ date, body: `Today's Thought: ${thought}` });
        withThought++;
      } else {
        days.push({ date, body: pickLapsedPhrasing(date) });
        withFallback++;
      }
    }

    // 3. Replace the schedule.
    await Notifications.cancelAllScheduledNotificationsAsync();
    for (const { date, body } of days) {
      await scheduleSingleDayNotification(date, time, body);
    }

    qaLog('notifications', 'Scheduled daily reminders', {
      time: reminderTime,
      withThought,
      withFallback,
      thoughtsTableLoaded: !!thoughts,
    });
  } catch (error) {
    console.warn('[NotificationSync] Failed to schedule notifications:', error);
    qaLog('notifications', 'Scheduling failed', {
      message: error instanceof Error ? error.message : String(error),
    });
  }
}
