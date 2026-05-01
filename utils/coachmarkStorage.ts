import AsyncStorage from "@react-native-async-storage/async-storage";

const NOTIFICATION_COACHMARK_KEY = "@daily_paths_notification_coachmark_shown";

export async function hasSeenNotificationCoachmark(): Promise<boolean> {
  try {
    const seen = await AsyncStorage.getItem(NOTIFICATION_COACHMARK_KEY);
    return seen === "true";
  } catch (error) {
    console.error("Error checking notification coachmark seen:", error);
    return false;
  }
}

export async function markNotificationCoachmarkSeen(): Promise<void> {
  try {
    await AsyncStorage.setItem(NOTIFICATION_COACHMARK_KEY, "true");
  } catch (error) {
    console.error("Error marking notification coachmark seen:", error);
  }
}

export async function resetNotificationCoachmark(): Promise<void> {
  try {
    await AsyncStorage.removeItem(NOTIFICATION_COACHMARK_KEY);
  } catch (error) {
    console.error("Error resetting notification coachmark:", error);
  }
}
