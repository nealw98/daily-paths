import { Platform } from "react-native";
import type { SubscriptionStatus } from "../lib/subscription";
import type { TrialStatus } from "./trialTimer";

/**
 * Access control helpers for Daily Paths.
 *
 * Android try-before-you-buy: premium if RevenueCat reports subscribed
 * (`unlimited` or `lifetime`) or the user is inside the local 3-day preview
 * window (AsyncStorage-backed trial from first app open).
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
 * @param trial         Local 3-day trial status
 * @param hasLifetimeAccess  Whether the user paid for the app download
 */
export function hasPremiumEntitlement(
  subscription: SubscriptionStatus,
  trial: TrialStatus,
  hasLifetimeAccess: boolean,
): boolean {
  // iOS is a paid download — always premium, regardless of subscription /
  // trial / receipt state. Belt-and-suspenders guard so paywall logic can
  // never accidentally fire on iOS.
  if (Platform.OS === "ios") return true;

  if (hasLifetimeAccess) return true;
  return subscription.isSubscribed || trial.isInTrial;
}

/**
 * Determine which gate (if any) should block a premium tab.
 */
export function getRequiredGate(
  subscription: SubscriptionStatus,
  trial: TrialStatus,
  hasLifetimeAccess: boolean,
): GateType {
  return hasPremiumEntitlement(subscription, trial, hasLifetimeAccess)
    ? "none"
    : "paywall";
}

/**
 * Determine whether speaker downloads are allowed.
 */
export function canDownloadSpeakers(
  subscription: SubscriptionStatus,
  trial: TrialStatus,
  hasLifetimeAccess: boolean,
): boolean {
  return hasPremiumEntitlement(subscription, trial, hasLifetimeAccess);
}
