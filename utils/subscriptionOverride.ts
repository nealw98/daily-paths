import AsyncStorage from "@react-native-async-storage/async-storage";

/**
 * QA override for subscription status.
 *
 * When enabled, getSubscriptionStatus() will skip RevenueCat and return a
 * "not subscribed" result.  This lets testers see the paywall even when they
 * have an active App Store subscription.
 */

const OVERRIDE_KEY = "@daily_paths_subscription_override";

/**
 * Returns true when the QA "force no subscription" override is active.
 */
export async function getSubscriptionOverride(): Promise<boolean> {
  try {
    const value = await AsyncStorage.getItem(OVERRIDE_KEY);
    return value === "true";
  } catch (err) {
    console.warn("[subscriptionOverride] getSubscriptionOverride error:", err);
    return false;
  }
}

/**
 * Enable the override — getSubscriptionStatus() will report "not subscribed".
 */
export async function enableSubscriptionOverride(): Promise<void> {
  await AsyncStorage.setItem(OVERRIDE_KEY, "true");
}

/**
 * Clear the override — getSubscriptionStatus() returns real RevenueCat data.
 */
export async function clearSubscriptionOverride(): Promise<void> {
  await AsyncStorage.removeItem(OVERRIDE_KEY);
}
