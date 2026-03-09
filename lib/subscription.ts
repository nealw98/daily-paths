import Purchases, {
  type CustomerInfo,
  type PurchasesPackage,
  LOG_LEVEL,
} from "react-native-purchases";
import { Platform } from "react-native";
import AsyncStorage from "@react-native-async-storage/async-storage";
import { qaLog } from "../utils/qaLog";
import { getSubscriptionOverride } from "../utils/subscriptionOverride";
import { trackEvent } from "../utils/trackEvent";
import { ANALYTICS_EVENTS } from "../utils/analytics";

/**
 * RevenueCat subscription management for Daily Paths Unlimited.
 * Products: Monthly ($3.99), Annual ($29.99) with 14-day free trial.
 */

// Entitlement IDs configured in RevenueCat dashboard
const ENTITLEMENT_ID = "unlimited";
const LIFETIME_ENTITLEMENT_ID = "lifetime";

// API keys from environment (set in .env)
const REVENUECAT_IOS_KEY = process.env.EXPO_PUBLIC_REVENUECAT_IOS_KEY || "";
const REVENUECAT_ANDROID_KEY = process.env.EXPO_PUBLIC_REVENUECAT_ANDROID_KEY || "";

const SUBSCRIPTION_CACHE_KEY = "@daily_paths_subscription_status_v1";
const LIFETIME_REVOKED_KEY = "@daily_paths_lifetime_revoked";

export interface SubscriptionStatus {
  isSubscribed: boolean;
  isTrialing: boolean;
  isLegacy: boolean;
  expirationDate: string | null;
  productIdentifier: string | null;
  willRenew: boolean;
}

let isInitialized = false;

/**
 * Initialize RevenueCat SDK. Call once after user authentication.
 */
export async function initializeRevenueCat(userId?: string): Promise<void> {
  if (isInitialized) {
    qaLog("subscription", "RevenueCat already initialized");
    return;
  }

  const apiKey = Platform.OS === "ios" ? REVENUECAT_IOS_KEY : REVENUECAT_ANDROID_KEY;

  if (!apiKey) {
    qaLog("subscription", "RevenueCat API key not configured, skipping init");
    return;
  }

  try {
    if (__DEV__) {
      Purchases.setLogLevel(LOG_LEVEL.DEBUG);
    }

    Purchases.configure({
      apiKey,
      appUserID: userId || undefined,
    });

    isInitialized = true;
    qaLog("subscription", "RevenueCat initialized", { userId, platform: Platform.OS });
  } catch (err) {
    qaLog("subscription", "RevenueCat init error", { error: String(err) });
  }
}

/**
 * Log in a user to RevenueCat (call after auth).
 */
export async function loginRevenueCat(userId: string): Promise<void> {
  try {
    const { customerInfo } = await Purchases.logIn(userId);
    qaLog("subscription", "RevenueCat user logged in", {
      userId,
      entitlements: Object.keys(customerInfo.entitlements.active),
    });
  } catch (err) {
    qaLog("subscription", "RevenueCat login error", { error: String(err) });
  }
}

/**
 * Log out from RevenueCat.
 */
export async function logoutRevenueCat(): Promise<void> {
  try {
    await Purchases.logOut();
    qaLog("subscription", "RevenueCat user logged out");
  } catch (err) {
    qaLog("subscription", "RevenueCat logout error", { error: String(err) });
  }
}

/**
 * Get available subscription packages.
 */
export async function getOfferings(): Promise<PurchasesPackage[]> {
  try {
    const offerings = await Purchases.getOfferings();
    if (offerings.current?.availablePackages) {
      qaLog("subscription", "Offerings loaded", {
        count: offerings.current.availablePackages.length,
      });
      return offerings.current.availablePackages;
    }
    qaLog("subscription", "No offerings available");
    return [];
  } catch (err) {
    qaLog("subscription", "Error getting offerings", { error: String(err) });
    return [];
  }
}

/**
 * Purchase a subscription package.
 */
export async function purchasePackage(
  pkg: PurchasesPackage
): Promise<CustomerInfo | null> {
  try {
    qaLog("subscription", "Purchasing package", {
      identifier: pkg.identifier,
      price: pkg.product.priceString,
    });

    const { customerInfo } = await Purchases.purchasePackage(pkg);

    const isActive = customerInfo.entitlements.active[ENTITLEMENT_ID] !== undefined;
    qaLog("subscription", "Purchase complete", {
      isActive,
      entitlements: Object.keys(customerInfo.entitlements.active),
    });

    if (isActive) {
      trackEvent(ANALYTICS_EVENTS.SUBSCRIPTION_STARTED, {
        package_identifier: pkg.identifier,
        price_string: pkg.product.priceString,
        product_identifier: pkg.product.identifier,
      }, true);
    }

    return customerInfo;
  } catch (err: any) {
    if (err.userCancelled) {
      qaLog("subscription", "Purchase cancelled by user");
      return null;
    }
    qaLog("subscription", "Purchase error", { error: String(err) });
    throw err;
  }
}

// First build number of the freemium release. Any originalApplicationVersion
// (which is CFBundleVersion — a plain integer on iOS) below this threshold
// means the user originally purchased the paid app.
const FREEMIUM_BUILD_NUMBER = 27;

/**
 * Check the App Store receipt for legacy (paid-app) status.
 *
 * Calls restorePurchases() to sync the receipt, then inspects
 * originalApplicationVersion. Returns true if the user originally
 * purchased the app before the freemium switch, OR if the lifetime
 * entitlement is already active in RevenueCat.
 *
 * Safe to call before authentication — only reads the device receipt.
 * iOS-only; always returns false on Android.
 */
export async function checkReceiptForLegacyStatus(): Promise<boolean> {
  if (Platform.OS !== "ios") return false;
  if (!isInitialized) return false;

  try {
    const customerInfo = await Purchases.restorePurchases();

    // Already has the lifetime entitlement (previously granted / restored)
    if (customerInfo.entitlements.active[LIFETIME_ENTITLEMENT_ID]) {
      qaLog("subscription", "Lifetime entitlement already active (receipt check)");
      return true;
    }

    // If lifetime was explicitly revoked (account deletion), don't re-detect
    // based on the permanent Apple receipt build number. The entitlement check
    // above is still authoritative — if support re-grants it, that will work.
    const revoked = await isLifetimeRevoked();
    if (revoked) {
      qaLog("subscription", "Lifetime was revoked — skipping receipt build-number check");
      return false;
    }

    const originalVersion = customerInfo.originalApplicationVersion;
    if (originalVersion && isLegacyBuildNumber(originalVersion)) {
      qaLog("subscription", "Legacy user detected via receipt", { originalVersion });
      return true;
    }

    return false;
  } catch (err) {
    qaLog("subscription", "Receipt legacy check failed", { error: String(err) });
    return false;
  }
}

/**
 * Check if an originalApplicationVersion (CFBundleVersion — a plain integer
 * build number on iOS) indicates a legacy paid-app user.
 *
 * Returns true if the build number is strictly before the first freemium build.
 */
function isLegacyBuildNumber(originalVersion: string): boolean {
  const buildNum = parseInt(originalVersion, 10);
  if (isNaN(buildNum)) return false;
  return buildNum < FREEMIUM_BUILD_NUMBER;
}

/**
 * Restore previous purchases.
 */
export async function restorePurchases(): Promise<CustomerInfo> {
  try {
    qaLog("subscription", "Restoring purchases");
    const customerInfo = await Purchases.restorePurchases();
    qaLog("subscription", "Purchases restored", {
      entitlements: Object.keys(customerInfo.entitlements.active),
    });
    return customerInfo;
  } catch (err) {
    qaLog("subscription", "Error restoring purchases", { error: String(err) });
    throw err;
  }
}

/**
 * Get current subscription status.
 */
export async function getSubscriptionStatus(): Promise<SubscriptionStatus> {
  // QA override: skip RevenueCat and report "not subscribed"
  try {
    const overrideActive = await getSubscriptionOverride();
    if (overrideActive) {
      qaLog("subscription", "QA override active — reporting not subscribed");
      return {
        isSubscribed: false,
        isTrialing: false,
        isLegacy: false,
        expirationDate: null,
        productIdentifier: null,
        willRenew: false,
      };
    }
  } catch {
    // Override check failed — fall through to real RevenueCat
  }

  try {
    const customerInfo = await Purchases.getCustomerInfo();
    const entitlement = customerInfo.entitlements.active[ENTITLEMENT_ID];
    const lifetimeEntitlement = customerInfo.entitlements.active[LIFETIME_ENTITLEMENT_ID];

    let result: SubscriptionStatus;

    // Lifetime entitlement (legacy users granted via Edge Function)
    if (lifetimeEntitlement) {
      result = {
        isSubscribed: true,
        isTrialing: false,
        isLegacy: true,
        expirationDate: null,
        productIdentifier: lifetimeEntitlement.productIdentifier,
        willRenew: false,
      };
    } else if (!entitlement) {
      result = {
        isSubscribed: false,
        isTrialing: false,
        isLegacy: false,
        expirationDate: null,
        productIdentifier: null,
        willRenew: false,
      };
    } else {
      result = {
        isSubscribed: true,
        isTrialing: entitlement.periodType === "TRIAL",
        isLegacy: false,
        expirationDate: entitlement.expirationDate,
        productIdentifier: entitlement.productIdentifier,
        willRenew: entitlement.willRenew,
      };
    }

    // Detect cancellation: willRenew flipped from true to false while still subscribed
    try {
      const cached = await getCachedSubscriptionStatus();
      if (cached && cached.willRenew && !result.willRenew && result.isSubscribed && !result.isLegacy) {
        trackEvent(ANALYTICS_EVENTS.SUBSCRIPTION_CANCELLED, {
          product_identifier: result.productIdentifier,
          expiration_date: result.expirationDate,
        }, true);
      }
    } catch {
      // Non-critical — don't block status return
    }

    await cacheSubscriptionStatus(result);
    return result;
  } catch (err) {
    qaLog("subscription", "Error getting subscription status", {
      error: String(err),
    });

    // Fall back to cached status so a paying subscriber isn't locked out
    const cached = await getCachedSubscriptionStatus();
    if (cached) {
      qaLog("subscription", "Returning cached subscription status");
      return cached;
    }

    return {
      isSubscribed: false,
      isTrialing: false,
      isLegacy: false,
      expirationDate: null,
      productIdentifier: null,
      willRenew: false,
    };
  }
}

/**
 * Check if RevenueCat is initialized.
 */
export function isRevenueCatInitialized(): boolean {
  return isInitialized;
}

/**
 * Cache the subscription status to AsyncStorage for offline/error fallback.
 */
export async function cacheSubscriptionStatus(
  status: SubscriptionStatus,
): Promise<void> {
  try {
    await AsyncStorage.setItem(SUBSCRIPTION_CACHE_KEY, JSON.stringify(status));
  } catch {
    // Non-critical
  }
}

/**
 * Read the last cached subscription status from AsyncStorage.
 * Returns null if no cache exists (first-ever launch).
 */
export async function getCachedSubscriptionStatus(): Promise<SubscriptionStatus | null> {
  try {
    const raw = await AsyncStorage.getItem(SUBSCRIPTION_CACHE_KEY);
    if (!raw) return null;
    return JSON.parse(raw) as SubscriptionStatus;
  } catch {
    return null;
  }
}

/**
 * Clear the cached subscription status.
 * Called during account deletion to prevent stale legacy/subscribed state.
 */
export async function clearSubscriptionCache(): Promise<void> {
  try {
    await AsyncStorage.removeItem(SUBSCRIPTION_CACHE_KEY);
  } catch {
    // Non-critical
  }
}

// ─── Lifetime revocation tracking ────────────────────────────────────────────

/**
 * Mark the lifetime entitlement as explicitly revoked (e.g. account deletion).
 *
 * When set, `checkReceiptForLegacyStatus()` will still honour an active
 * RevenueCat lifetime entitlement (in case support re-grants it) but will
 * NOT fall back to the permanent Apple receipt `originalApplicationVersion`
 * check. This prevents a deleted account from re-gaining lifetime access
 * simply because the receipt is tied to the Apple ID.
 */
export async function markLifetimeRevoked(): Promise<void> {
  try {
    await AsyncStorage.setItem(LIFETIME_REVOKED_KEY, "true");
  } catch {
    // Non-critical — worst case the receipt re-detects on next launch
  }
}

/**
 * Check whether the lifetime entitlement was explicitly revoked.
 */
export async function isLifetimeRevoked(): Promise<boolean> {
  try {
    const val = await AsyncStorage.getItem(LIFETIME_REVOKED_KEY);
    return val === "true";
  } catch {
    return false;
  }
}
