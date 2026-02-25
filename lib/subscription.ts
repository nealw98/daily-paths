import Purchases, {
  type CustomerInfo,
  type PurchasesPackage,
  LOG_LEVEL,
} from "react-native-purchases";
import { Platform } from "react-native";
import { qaLog } from "../utils/qaLog";
import { getSubscriptionOverride } from "../utils/subscriptionOverride";

/**
 * RevenueCat subscription management for Daily Paths Unlimited.
 * Products: Monthly ($3.99), Annual ($29.99) with 14-day free trial.
 */

// Entitlement ID configured in RevenueCat dashboard
const ENTITLEMENT_ID = "unlimited";

// API keys from environment (set in .env)
const REVENUECAT_IOS_KEY = process.env.EXPO_PUBLIC_REVENUECAT_IOS_KEY || "";
const REVENUECAT_ANDROID_KEY = process.env.EXPO_PUBLIC_REVENUECAT_ANDROID_KEY || "";

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

    if (!entitlement) {
      return {
        isSubscribed: false,
        isTrialing: false,
        isLegacy: false,
        expirationDate: null,
        productIdentifier: null,
        willRenew: false,
      };
    }

    return {
      isSubscribed: true,
      isTrialing: entitlement.periodType === "TRIAL",
      isLegacy: entitlement.productIdentifier === "lifetime_legacy",
      expirationDate: entitlement.expirationDate,
      productIdentifier: entitlement.productIdentifier,
      willRenew: entitlement.willRenew,
    };
  } catch (err) {
    qaLog("subscription", "Error getting subscription status", {
      error: String(err),
    });
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
