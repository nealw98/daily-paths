import AsyncStorage from "@react-native-async-storage/async-storage";
import * as StoreReview from "expo-store-review";
import { Platform, Share, Linking } from "react-native";

const STORAGE_KEYS = {
  READINGS_COMPLETED: "readings_completed_count",
  LAST_RATE_PROMPT: "last_rate_prompt_date",
  RATE_DECLINED_COUNT: "rate_declined_count",
  HAS_RATED: "has_rated_app",
  SHARE_COUNT: "share_count",
  FIRST_USE_DATE: "first_use_date",
};

// Strategic timing: prompt after engagement milestones
const MIN_READINGS_FOR_PROMPT = 1; // After 1 favorite or 1 thumbs up
const MIN_DAYS_FOR_PROMPT = 5; // Or after 5 days of use
const FIRST_DECLINE_COOLDOWN = 5; // After first "Not Now", wait 5 days
const SECOND_DECLINE_COOLDOWN = 30; // After second "Not Now", wait 30 days
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

export async function recordFirstUseIfNeeded(): Promise<void> {
  try {
    const existing = await AsyncStorage.getItem(STORAGE_KEYS.FIRST_USE_DATE);
    if (!existing) {
      // Check if this is an existing user (has engagement history)
      const readingsStr = await AsyncStorage.getItem(STORAGE_KEYS.READINGS_COMPLETED);
      const readings = readingsStr ? parseInt(readingsStr, 10) : 0;
      
      if (readings > 0) {
        // Existing user with history - backdate first use to make them eligible immediately
        const backdated = new Date();
        backdated.setDate(backdated.getDate() - MIN_DAYS_FOR_PROMPT - 1);
        await AsyncStorage.setItem(
          STORAGE_KEYS.FIRST_USE_DATE,
          backdated.toISOString()
        );
      } else {
        // New user - record today as first use
        await AsyncStorage.setItem(
          STORAGE_KEYS.FIRST_USE_DATE,
          new Date().toISOString()
        );
      }
    }
  } catch (error) {
    console.error("Error recording first use:", error);
  }
}

export async function shouldShowRatePrompt(): Promise<boolean> {
  try {
    // Check if they've already rated
    const hasRated = await AsyncStorage.getItem(STORAGE_KEYS.HAS_RATED);
    if (hasRated === "true") return false;

    // Check if they've declined too many times
    const declineCountStr = await AsyncStorage.getItem(
      STORAGE_KEYS.RATE_DECLINED_COUNT
    );
    const declineCount = declineCountStr ? parseInt(declineCountStr, 10) : 0;
    if (declineCount >= MAX_DECLINES) {
      return false;
    }

    // Check last prompt date with cooldown based on decline count
    // First decline: 5 day cooldown
    // Second decline: 30 day cooldown (then stop asking)
    const lastPromptStr = await AsyncStorage.getItem(
      STORAGE_KEYS.LAST_RATE_PROMPT
    );
    if (lastPromptStr) {
      const lastPrompt = new Date(lastPromptStr);
      const daysSince =
        (Date.now() - lastPrompt.getTime()) / (1000 * 60 * 60 * 24);
      
      // Use appropriate cooldown based on how many times they've declined
      const cooldownDays = declineCount === 0 
        ? FIRST_DECLINE_COOLDOWN 
        : SECOND_DECLINE_COOLDOWN;
      
      if (daysSince < cooldownDays) return false;
    }

    // Must have at least 1 positive engagement (favorite or thumbs up)
    const readingsStr = await AsyncStorage.getItem(
      STORAGE_KEYS.READINGS_COMPLETED
    );
    const readings = readingsStr ? parseInt(readingsStr, 10) : 0;
    if (readings < MIN_READINGS_FOR_PROMPT) return false;

    // For new users: also require 5+ days of use
    // For existing users: recordFirstUseIfNeeded() backdates their first use date
    const firstUseStr = await AsyncStorage.getItem(STORAGE_KEYS.FIRST_USE_DATE);
    if (firstUseStr) {
      const firstUse = new Date(firstUseStr);
      const daysSinceFirstUse =
        (Date.now() - firstUse.getTime()) / (1000 * 60 * 60 * 24);
      if (daysSinceFirstUse < MIN_DAYS_FOR_PROMPT) return false;
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
    }
    return false;
  } catch (error) {
    console.error("Error requesting review:", error);
    return false;
  }
}

export async function openAppStoreForRating(): Promise<boolean> {
  try {
    // Use action=write-review to open directly to the rating/review section
    const storeUrl =
      Platform.OS === "ios"
        ? "itms-apps://apps.apple.com/app/id6755981862?action=write-review"
        : "market://details?id=com.nealw98.dailypaths";
    
    await Linking.openURL(storeUrl);
    await markHasRated();
    return true;
  } catch (error) {
    console.error("Error opening App Store:", error);
    return false;
  }
}

export async function shareApp(): Promise<boolean> {
  try {
    const appStoreUrl =
      Platform.OS === "ios"
        ? "https://apps.apple.com/us/app/al-anon-daily-paths/id6755981862"
        : "https://play.google.com/store/apps/details?id=com.nealw98.dailypaths";

    // iOS: use separate url field so the social preview image works
    // Android: include URL in message since it doesn't support the url field
    const shareContent = Platform.OS === "ios"
      ? {
          message: "Check out Al-Anon Daily Paths - daily readings for recovery!",
          url: appStoreUrl,
        }
      : {
          message: `Check out Al-Anon Daily Paths - daily readings for recovery! ${appStoreUrl}`,
        };

    // Use React Native's Share API for URLs/text
    const result = await Share.share(shareContent);
    
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

// Called when user dismisses the rate modal without rating
export async function markRatePromptDismissed(): Promise<void> {
  try {
    // Record the current time as the last prompt shown
    await AsyncStorage.setItem(
      STORAGE_KEYS.LAST_RATE_PROMPT,
      new Date().toISOString()
    );
    // Increment decline count
    const current = await AsyncStorage.getItem(STORAGE_KEYS.RATE_DECLINED_COUNT);
    const count = current ? parseInt(current, 10) : 0;
    await AsyncStorage.setItem(
      STORAGE_KEYS.RATE_DECLINED_COUNT,
      (count + 1).toString()
    );
  } catch (error) {
    console.error("Error marking prompt dismissed:", error);
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
      STORAGE_KEYS.FIRST_USE_DATE,
    ]);
  } catch (error) {
    console.error("Error resetting tracking:", error);
  }
}

