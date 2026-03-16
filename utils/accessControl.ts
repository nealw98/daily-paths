import type { SubscriptionStatus } from "../lib/subscription";
import type { TrialStatus } from "./trialTimer";

/**
 * Access control helpers for the Daily Paths freemium model.
 *
 * Premium features (Journal, Prayers, Speakers) are free during the 7-day
 * local trial, then require a subscription.  The daily reader is free forever.
 */

// ─── Gate type ───────────────────────────────────────────────────────────────

export type GateType = "none" | "paywall";

/**
 * Premium entitlement check.
 * Users are entitled when subscribed/lifetime, or while the local trial is active.
 */
export function hasPremiumEntitlement(
  subscription: SubscriptionStatus,
  trial: TrialStatus,
): boolean {
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
 * Download availability is entitlement-driven (same as premium access).
 */
export function canDownloadSpeakers(
  subscription: SubscriptionStatus,
  trial: TrialStatus,
): boolean {
  return hasPremiumEntitlement(subscription, trial);
}
