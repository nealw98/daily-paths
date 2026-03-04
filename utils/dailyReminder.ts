import * as Notifications from "expo-notifications";
import { Platform } from "react-native";

/**
 * Ask the user for notification permissions if we don't already have them.
 * Returns true if we can schedule alerts, false otherwise.
 */
export async function ensureNotificationPermissions(): Promise<boolean> {
  const settings = await Notifications.getPermissionsAsync();

  if (settings.granted || settings.ios?.status === Notifications.IosAuthorizationStatus.PROVISIONAL) {
    return true;
  }

  const request = await Notifications.requestPermissionsAsync();
  return (
    request.granted ||
    request.ios?.status === Notifications.IosAuthorizationStatus.PROVISIONAL
  );
}

/**
 * Cancel any existing scheduled notifications for this app.
 */
export async function cancelDailyReminder(): Promise<void> {
  try {
    const scheduled = await Notifications.getAllScheduledNotificationsAsync();
    console.log(`[Reminder] Cancelling ${scheduled.length} scheduled notification(s)`);
    await Notifications.cancelAllScheduledNotificationsAsync();
  } catch (e) {
    console.warn("Failed to cancel scheduled notifications", e);
  }
}

/**
 * Get all currently scheduled notifications (for debugging)
 */
export async function getScheduledNotifications() {
  try {
    const scheduled = await Notifications.getAllScheduledNotificationsAsync();
    console.log(`[Reminder] Currently scheduled notifications:`, scheduled);
    return scheduled;
  } catch (e) {
    console.warn("Failed to get scheduled notifications", e);
    return [];
  }
}

/**
 * Schedule a single one-time notification for a specific date with the given thought.
 * If the target time has already passed, the notification is silently skipped.
 */
export async function scheduleSingleDayNotification(
  date: Date,
  time: { hour: number; minute: number },
  thoughtForDay: string
): Promise<void> {
  const triggerDate = new Date(
    date.getFullYear(),
    date.getMonth(),
    date.getDate(),
    time.hour,
    time.minute,
    0
  );

  // Don't schedule if the time has already passed
  if (triggerDate <= new Date()) {
    console.log(`[Reminder] Skipping ${triggerDate.toLocaleDateString()} — time already passed`);
    return;
  }

  const id = await Notifications.scheduleNotificationAsync({
    content: {
      title: "Daily Paths",
      body: `Today's Thought: ${thoughtForDay}`,
      sound: "default",
    },
    trigger: {
      type: Notifications.SchedulableTriggerInputTypes.DATE,
      date: triggerDate,
    },
  });

  console.log(`[Reminder] Scheduled one-time notification for ${triggerDate.toLocaleDateString()} — id: ${id}`);
}

/**
 * Schedule a generic repeating notification as a fallback.
 * This fires on any day where no one-time notification was pre-scheduled
 * (e.g. day 8+ after last app open, or if cache was empty).
 */
export async function scheduleGenericFallbackNotification(
  time: { hour: number; minute: number }
): Promise<void> {
  let trigger: Notifications.NotificationTriggerInput;

  if (Platform.OS === "ios") {
    trigger = {
      type: Notifications.SchedulableTriggerInputTypes.CALENDAR,
      repeats: true,
      hour: time.hour,
      minute: time.minute,
    };
  } else {
    trigger = {
      type: Notifications.SchedulableTriggerInputTypes.DAILY,
      hour: time.hour,
      minute: time.minute,
    };
  }

  const id = await Notifications.scheduleNotificationAsync({
    content: {
      title: "Daily Paths",
      body: "It\u2019s time for today\u2019s Daily Path. Open the app to read today\u2019s reflection.",
      sound: "default",
    },
    trigger,
  });

  console.log(`[Reminder] Scheduled generic fallback notification — id: ${id}`);
}
