import * as Notifications from "expo-notifications";

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
    await Notifications.cancelAllScheduledNotificationsAsync();
  } catch (e) {
    console.warn("Failed to cancel scheduled notifications", e);
  }
}

/**
 * Schedule (or reschedule) the static Daily Paths reminder at the given local time.
 *
 * `time` is "HH:MM" in 24h format, e.g. "08:00".
 * Returns true if a reminder was scheduled, false if permissions were denied.
 */
export async function scheduleDailyReminder(time: string): Promise<boolean> {
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

  await Notifications.scheduleNotificationAsync({
    content: {
      // Line 1 (system title): "Daily Paths - {Month} {Day}" is not dynamic with a static
      // local repeating notification, so we use a timeless title.
      title: "Daily Paths",
      // Line 2–3 (body): static gentle nudge.
      body:
        "It\u2019s time for today\u2019s Daily Path. A few quiet moments can shift the whole day.",
      // Explicitly request the default notification sound to avoid any nil casting issues.
      sound: "default",
    },
    trigger: {
      hour,
      minute,
      repeats: true,
    },
  });

  return true;
}


