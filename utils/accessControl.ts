import { Platform } from "react-native";
import type { SubscriptionStatus } from "../lib/subscription";
import type { TrialStatus } from "./trialTimer";

/**
 * Access control helpers for Daily Paths.
 *
 * Premium access is granted through one of four mutually exclusive states
 * (checked in priority order):
 *
 * 1. Lifetime access  — user paid for the app download (detected via
 *    StoreKit 2 AppTransaction on iOS 16+)
 * 2. Legacy grant      — lifetime entitlement granted manually in RevenueCat
 * 3. Subscription      — active RevenueCat subscription
 * 4. Free trial        — 7-day local trial (unpaid users only)
 *
 * If none apply, the user sees a paywall.
 */

// ─── Gate type ───────────────────────────────────────────────────────────────

export type GateType = "none" | "paywall";

/**
 * Premium entitlement check.
 *
 * @param subscription  RevenueCat subscription status
 * @param trial         Local 7-day trial status
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
