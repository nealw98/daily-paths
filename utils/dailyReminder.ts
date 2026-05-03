import * as Notifications from "expo-notifications";

/**
 * Rotating phrasings for the lapsed/fallback nag. Used both when no
 * Thought for the Day is cached for a given day in the active window
 * (rare — cache miss) and for every day in the lapsed window (days 7+
 * since last app open).
 */
export const LAPSED_PHRASINGS = [
  "A new path is waiting for you today.",
  "Your daily reflection is ready when you are.",
  "Take a quiet moment for today’s thought.",
  "Today’s reading is here — a few minutes is all it takes.",
  "A reflection to take into your day.",
  "One small pause can shape the whole day.",
  "Your next reflection is one tap away.",
  "Step back onto the path — today’s reading is ready.",
];

/**
 * Pick a phrasing deterministically based on the date's day-of-year so
 * consecutive days rotate through the pool rather than repeating.
 */
export function pickLapsedPhrasing(date: Date): string {
  const start = new Date(date.getFullYear(), 0, 0).getTime();
  const dayOfYear = Math.floor((date.getTime() - start) / 86400000);
  return LAPSED_PHRASINGS[dayOfYear % LAPSED_PHRASINGS.length];
}

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
 * Schedule a single one-time notification for a specific date with the given body.
 * If the target time has already passed, the notification is silently skipped.
 */
export async function scheduleSingleDayNotification(
  date: Date,
  time: { hour: number; minute: number },
  body: string
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
      body,
      sound: "default",
    },
    trigger: {
      type: Notifications.SchedulableTriggerInputTypes.DATE,
      date: triggerDate,
    },
  });

  console.log(`[Reminder] Scheduled one-time notification for ${triggerDate.toLocaleDateString()} — id: ${id}`);
}
