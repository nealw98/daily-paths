import AsyncStorage from "@react-native-async-storage/async-storage";

/**
 * QA override for subscription status.
 *
 * When enabled, getSubscriptionStatus() will skip RevenueCat and return a
 * "not subscribed" result.  This lets testers see the paywall even when they
 * have an active App Store subscription.
 */

const OVERRIDE_KEY = "@daily_paths_subscription_override";
const OVERRIDE_TTL_MS = 30 * 60 * 1000;

interface OverridePayload {
  enabled: true;
  expiresAt: number;
}

/**
 * Returns true when the QA "force no subscription" override is active.
 */
export async function getSubscriptionOverride(): Promise<boolean> {
  try {
    const value = await AsyncStorage.getItem(OVERRIDE_KEY);
    if (!value) return false;

    // Legacy override values were stored forever as the literal string "true".
    // Treat them as expired so a QA paywall test cannot permanently trap a
    // production tester behind the paywall after OTA/reinstall/update cycles.
    if (value === "true") {
      await AsyncStorage.removeItem(OVERRIDE_KEY);
      return false;
    }

    const parsed = JSON.parse(value) as Partial<OverridePayload>;
    if (parsed.enabled !== true || typeof parsed.expiresAt !== "number") {
      await AsyncStorage.removeItem(OVERRIDE_KEY);
      return false;
    }

    if (Date.now() >= parsed.expiresAt) {
      await AsyncStorage.removeItem(OVERRIDE_KEY);
      return false;
    }

    return true;
  } catch (err) {
    console.warn("[subscriptionOverride] getSubscriptionOverride error:", err);
    await AsyncStorage.removeItem(OVERRIDE_KEY).catch(() => {});
    return false;
  }
}

/**
 * Enable the override — getSubscriptionStatus() will report "not subscribed".
 */
export async function enableSubscriptionOverride(): Promise<void> {
  const payload: OverridePayload = {
    enabled: true,
    expiresAt: Date.now() + OVERRIDE_TTL_MS,
  };
  await AsyncStorage.setItem(OVERRIDE_KEY, JSON.stringify(payload));
}

/**
 * Clear the override — getSubscriptionStatus() returns real RevenueCat data.
 */
export async function clearSubscriptionOverride(): Promise<void> {
  await AsyncStorage.removeItem(OVERRIDE_KEY);
}
