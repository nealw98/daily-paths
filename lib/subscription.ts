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

    // Log the RC app user ID so we can find this customer in the dashboard
    try {
      const appUserId = await Purchases.getAppUserID();
      qaLog("subscription", "RevenueCat initialized", { userId, appUserId, platform: Platform.OS });
    } catch {
      qaLog("subscription", "RevenueCat initialized", { userId, platform: Platform.OS });
    }
  } catch (err) {
    qaLog("subscription", "RevenueCat init error", { error: String(err) });
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

    // Lifetime entitlement — RevenueCat is the sole source of truth
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


