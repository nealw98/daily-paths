import * as Notifications from "expo-notifications";

/**
 * Rotating "come back" phrasings. Used for every day in the lapsed window
 * (day 8 onward after the last app open), and in the active window only
 * when no Thought for the Day is available for that date (thoughts table
 * never fetched and no cached reading). See notificationSync.ts.
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
 * - granted: we can deliver alerts (provisional counts as granted).
 * - undetermined: the OS will still show a permission prompt.
 * - blocked: the OS won't prompt again; only the system Settings app can
 *   turn notifications back on (e.g. the user denied the prompt, or chose
 *   "Turn Off" on a delivered notification).
 */
export type NotificationPermissionState = "granted" | "undetermined" | "blocked";

function toPermissionState(
  response: Notifications.NotificationPermissionsStatus
): NotificationPermissionState {
  if (
    response.granted ||
    response.ios?.status === Notifications.IosAuthorizationStatus.PROVISIONAL
  ) {
    return "granted";
  }
  return response.canAskAgain ? "undetermined" : "blocked";
}

/** Read the current OS permission state without prompting. */
export async function getNotificationPermissionState(): Promise<NotificationPermissionState> {
  return toPermissionState(await Notifications.getPermissionsAsync());
}

/**
 * Ask the user for notification permission if the OS still allows a prompt.
 * Returns "granted" if we can schedule alerts, otherwise "blocked" — meaning
 * the user must enable notifications in the system Settings app.
 */
export async function ensureNotificationPermissions(): Promise<"granted" | "blocked"> {
  const current = await getNotificationPermissionState();
  if (current !== "undetermined") return current;

  const request = await Notifications.requestPermissionsAsync();
  return toPermissionState(request) === "granted" ? "granted" : "blocked";
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
