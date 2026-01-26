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
 * For this project, we only schedule the single daily reminder.
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
 * Schedule (or reschedule) the Al-Anon Daily Paths reminder at the given local time.
 *
 * `time` is "HH:MM" in 24h format, e.g. "08:00".
 * `thoughtForDay` is optional - if provided, notification will include the actual thought.
 * Returns true if a reminder was scheduled, false if permissions were denied.
 */
export async function scheduleDailyReminder(time: string, thoughtForDay?: string): Promise<boolean> {
  const hasPermission = await ensureNotificationPermissions();
  if (!hasPermission) {
    console.warn("Notification permission not granted; daily reminder not scheduled.");
    return false;
  }

  // Clear any previous daily reminder so we don't accumulate duplicates.
  await cancelDailyReminder();

  const [hourStr = "8", minuteStr = "0"] = time.split(":");
  const hour = Number(hourStr);
  const minute = Number(minuteStr);

  // Create a date for the notification time TODAY in local timezone
  const now = new Date();
  const scheduledTime = new Date();
  scheduledTime.setHours(hour, minute, 0, 0);

  // If that time has already passed today, schedule for tomorrow
  if (scheduledTime <= now) {
    scheduledTime.setDate(scheduledTime.getDate() + 1);
    console.log(`[Reminder] Time ${hour}:${minute.toString().padStart(2, '0')} has passed today, scheduling for tomorrow`);
  }

  console.log(`[Reminder] Scheduling daily notification for ${scheduledTime.toLocaleString()}`);

  // Use platform-specific trigger types
  // iOS supports CALENDAR triggers, Android needs DAILY trigger
  let trigger: Notifications.NotificationTriggerInput;
  
  if (Platform.OS === "ios") {
    // iOS: Use calendar trigger for exact time scheduling
    trigger = {
      type: Notifications.SchedulableTriggerInputTypes.CALENDAR,
      repeats: true,
      hour: hour,
      minute: minute,
    };
  } else {
    // Android: Use DAILY trigger type which is supported
    trigger = {
      type: Notifications.SchedulableTriggerInputTypes.DAILY,
      hour: hour,
      minute: minute,
    };
  }

  const notificationId = await Notifications.scheduleNotificationAsync({
    content: {
      title: "Al-Anon Daily Paths",
      body: thoughtForDay 
        ? `Today's Thought: ${thoughtForDay}`
        : "It\u2019s time for today\u2019s Daily Path. A few quiet moments can shift the whole day.",
      sound: "default",
    },
    trigger,
  });

  console.log(`[Reminder] Notification scheduled with ID: ${notificationId}`);

  // Log what's scheduled for debugging
  const scheduled = await Notifications.getAllScheduledNotificationsAsync();
  console.log(`[Reminder] Total scheduled notifications: ${scheduled.length}`);
  if (scheduled.length > 0) {
    console.log(`[Reminder] Next trigger:`, scheduled[0].trigger);
  }

  return true;
}


