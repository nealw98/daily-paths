import type { SubscriptionStatus } from "../lib/subscription";
import type { TrialStatus } from "./trialTimer";

/**
 * Access control helpers for Daily Paths.
 *
 * The app is a PAID download on the App Store. Every user who has the app
 * already paid for it. All features are unlocked — no paywall, no trial
 * gate, no subscription required.
 *
 * RevenueCat subscriptions and the trial system remain wired up for a
 * potential future freemium transition, but they are never the sole gate.
 * The paid-app check (`IS_PAID_APP`) always grants full access.
 *
 * When/if the app transitions to freemium, set IS_PAID_APP to false and
 * add StoreKit 2 AppTransaction detection to identify legacy paid users.
 */

// ─── Paid-app flag ───────────────────────────────────────────────────────────
// The app is currently sold as a paid download. Every user is entitled.
// Flip this to `false` only when the app goes free on the App Store.
const IS_PAID_APP = true;

// ─── Gate type ───────────────────────────────────────────────────────────────

export type GateType = "none" | "paywall";

/**
 * Premium entitlement check.
 * If the app is paid, everyone is entitled — period.
 * Otherwise falls back to subscription / legacy / trial checks.
 */
export function hasPremiumEntitlement(
  subscription: SubscriptionStatus,
  trial: TrialStatus,
): boolean {
  if (IS_PAID_APP) return true;
  return subscription.isSubscribed || subscription.isLegacy || trial.isInTrial;
}

/**
 * Determine which gate (if any) should block a premium tab.
 */
export function getRequiredGate(
  subscription: SubscriptionStatus,
  trial: TrialStatus,
): GateType {
  return hasPremiumEntitlement(subscription, trial) ? "none" : "paywall";
}

/**
 * Determine whether speaker downloads are allowed.
 */
export function canDownloadSpeakers(
  subscription: SubscriptionStatus,
  trial: TrialStatus,
): boolean {
  return hasPremiumEntitlement(subscription, trial);
}
