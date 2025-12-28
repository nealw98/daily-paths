import AsyncStorage from "@react-native-async-storage/async-storage";
import * as StoreReview from "expo-store-review";
import { Platform, Share, Linking } from "react-native";

const STORAGE_KEYS = {
  READINGS_COMPLETED: "readings_completed_count",
  LAST_RATE_PROMPT: "last_rate_prompt_date",
  RATE_DECLINED_COUNT: "rate_declined_count",
  HAS_RATED: "has_rated_app",
  SHARE_COUNT: "share_count",
};

// Strategic timing: prompt after engagement milestones
const MIN_READINGS_FOR_PROMPT = 3; // After 3 readings
const DAYS_BETWEEN_PROMPTS = 30; // Don't nag
const MAX_DECLINES = 2; // Stop asking after 2 declines

export async function incrementReadingsCompleted(): Promise<void> {
  try {
    const current = await AsyncStorage.getItem(STORAGE_KEYS.READINGS_COMPLETED);
    const count = current ? parseInt(current, 10) : 0;
    await AsyncStorage.setItem(
      STORAGE_KEYS.READINGS_COMPLETED,
      (count + 1).toString()
    );
  } catch (error) {
    console.error("Error incrementing readings:", error);
  }
}

export async function shouldShowRatePrompt(): Promise<boolean> {
  try {
    // Check if they've already rated
    const hasRated = await AsyncStorage.getItem(STORAGE_KEYS.HAS_RATED);
    if (hasRated === "true") return false;

    // Check if they've declined too many times
    const declineCount = await AsyncStorage.getItem(
      STORAGE_KEYS.RATE_DECLINED_COUNT
    );
    if (declineCount && parseInt(declineCount, 10) >= MAX_DECLINES) {
      return false;
    }

    // Check readings count
    const readingsStr = await AsyncStorage.getItem(
      STORAGE_KEYS.READINGS_COMPLETED
    );
    const readings = readingsStr ? parseInt(readingsStr, 10) : 0;
    if (readings < MIN_READINGS_FOR_PROMPT) return false;

    // Check last prompt date
    const lastPromptStr = await AsyncStorage.getItem(
      STORAGE_KEYS.LAST_RATE_PROMPT
    );
    if (lastPromptStr) {
      const lastPrompt = new Date(lastPromptStr);
      const daysSince =
        (Date.now() - lastPrompt.getTime()) / (1000 * 60 * 60 * 24);
      if (daysSince < DAYS_BETWEEN_PROMPTS) return false;
    }

    return true;
  } catch (error) {
    console.error("Error checking rate prompt:", error);
    return false;
  }
}

export async function markRatePromptShown(): Promise<void> {
  try {
    await AsyncStorage.setItem(
      STORAGE_KEYS.LAST_RATE_PROMPT,
      new Date().toISOString()
    );
  } catch (error) {
    console.error("Error marking prompt shown:", error);
  }
}

export async function markRateDeclined(): Promise<void> {
  try {
    const current = await AsyncStorage.getItem(STORAGE_KEYS.RATE_DECLINED_COUNT);
    const count = current ? parseInt(current, 10) : 0;
    await AsyncStorage.setItem(
      STORAGE_KEYS.RATE_DECLINED_COUNT,
      (count + 1).toString()
    );
  } catch (error) {
    console.error("Error marking decline:", error);
  }
}

export async function markHasRated(): Promise<void> {
  try {
    await AsyncStorage.setItem(STORAGE_KEYS.HAS_RATED, "true");
  } catch (error) {
    console.error("Error marking rated:", error);
  }
}

export async function requestReview(): Promise<boolean> {
  try {
    if (await StoreReview.hasAction()) {
      await StoreReview.requestReview();
      await markHasRated();
      return true;
    } else {
      // Fallback: Open App Store rating page if native review isn't available
      const appStoreReviewUrl =
        Platform.OS === "ios"
          ? "https://apps.apple.com/app/id6739451768?action=write-review"
          : "https://play.google.com/store/apps/details?id=com.nealw98.dailypaths";
      
      const canOpen = await Linking.canOpenURL(appStoreReviewUrl);
      if (canOpen) {
        await Linking.openURL(appStoreReviewUrl);
        await markHasRated();
        return true;
      }
    }
    return false;
  } catch (error) {
    console.error("Error requesting review:", error);
    // Try fallback on error
    try {
      const appStoreReviewUrl =
        Platform.OS === "ios"
          ? "https://apps.apple.com/app/id6739451768?action=write-review"
          : "https://play.google.com/store/apps/details?id=com.nealw98.dailypaths";
      await Linking.openURL(appStoreReviewUrl);
      await markHasRated();
      return true;
    } catch (fallbackError) {
      console.error("Error opening App Store fallback:", fallbackError);
      return false;
    }
  }
}

export async function shareApp(): Promise<boolean> {
  try {
    const appStoreUrl =
      Platform.OS === "ios"
        ? "https://apps.apple.com/us/app/al-anon-daily-paths/id6739451768"
        : "https://play.google.com/store/apps/details?id=com.nealw98.dailypaths";

    const message = `Check out Al-Anon Daily Paths - daily readings for recovery! ${appStoreUrl}`;

    // Use React Native's Share API for URLs/text
    const result = await Share.share({
      message: message,
      url: appStoreUrl, // iOS will use this if message is provided
      title: "Al-Anon Daily Paths",
    });
    
    // Track share count (result.action can be 'sharedAction' or 'dismissedAction')
    if (result.action === Share.sharedAction) {
      const current = await AsyncStorage.getItem(STORAGE_KEYS.SHARE_COUNT);
      const count = current ? parseInt(current, 10) : 0;
      await AsyncStorage.setItem(STORAGE_KEYS.SHARE_COUNT, (count + 1).toString());
    }
    
    return result.action === Share.sharedAction || result.action === Share.dismissedAction;
  } catch (error) {
    console.error("Error sharing app:", error);
    return false;
  }
}

export async function getShareCount(): Promise<number> {
  try {
    const count = await AsyncStorage.getItem(STORAGE_KEYS.SHARE_COUNT);
    return count ? parseInt(count, 10) : 0;
  } catch (error) {
    console.error("Error getting share count:", error);
    return 0;
  }
}

// For debugging/testing
export async function resetRateShareTracking(): Promise<void> {
  try {
    await AsyncStorage.multiRemove([
      STORAGE_KEYS.READINGS_COMPLETED,
      STORAGE_KEYS.LAST_RATE_PROMPT,
      STORAGE_KEYS.RATE_DECLINED_COUNT,
      STORAGE_KEYS.HAS_RATED,
      STORAGE_KEYS.SHARE_COUNT,
    ]);
  } catch (error) {
    console.error("Error resetting tracking:", error);
  }
}

