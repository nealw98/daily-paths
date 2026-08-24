import { Platform } from "react-native";
import type { SubscriptionStatus } from "../lib/subscription";

/**
 * Access control helpers for Daily Paths.
 *
 * Android: premium only when RevenueCat reports an active legacy subscription
 * (`unlimited`) or lifetime purchase. Unentitled users see onboarding and may
 * open the RevenueCat checkout from there.
 *
 * iOS: paid download — `hasLifetimeAccess` is always treated as premium here
 * (StoreKit 2 AppTransaction); the hook also short-circuits the platform.
 *
 * If none apply on Android, `getRequiredGate` returns `paywall`.
 */

// ─── Gate type ───────────────────────────────────────────────────────────────

export type GateType = "none" | "paywall";

/**
 * Premium entitlement check.
 *
 * @param subscription  RevenueCat subscription status
 * @param hasLifetimeAccess  Whether the user paid for the app download
 */
export function hasPremiumEntitlement(
  subscription: SubscriptionStatus,
  hasLifetimeAccess: boolean,
): boolean {
  // iOS is a paid download — always premium, regardless of subscription or
  // receipt state. Belt-and-suspenders guard so paywall logic can
  // never accidentally fire on iOS.
  if (Platform.OS === "ios") return true;

  if (hasLifetimeAccess) return true;
  return subscription.isSubscribed;
}

/**
 * Determine which gate (if any) should block a premium tab.
 */
export function getRequiredGate(
  subscription: SubscriptionStatus,
  hasLifetimeAccess: boolean,
): GateType {
  return hasPremiumEntitlement(subscription, hasLifetimeAccess)
    ? "none"
    : "paywall";
}

/**
 * Determine whether speaker downloads are allowed.
 */
export function canDownloadSpeakers(
  subscription: SubscriptionStatus,
  hasLifetimeAccess: boolean,
): boolean {
  return hasPremiumEntitlement(subscription, hasLifetimeAccess);
}
