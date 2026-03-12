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
 * Premium entitlement is independent from account authentication.
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
 *
 * Priority:
 *  1. Entitlement + authenticated    → no gate
 *  2. Entitlement + NOT authenticated → sign-in gate
 *  3. Local trial active             → no gate
 *  4. No entitlement + trial expired → paywall gate
 *
 * Legacy / subscription checks come BEFORE the trial check so that a
 * lifetime member who accidentally got a trial still lands on the
 * correct "signin" gate instead of "none" (which skips sign-in).
 */
export function getRequiredGate(
  subscription: SubscriptionStatus,
  trial: TrialStatus,
): GateType {
  return hasPremiumEntitlement(subscription, trial) ? "none" : "paywall";
}

/**
 * Supabase cloud authorization is separate from entitlement.
 * If account auth is missing, cloud read/write/delete must be blocked.
 */
export function canAccessCloudData(
  isAuthenticated: boolean,
  userId?: string | null,
): boolean {
  return isAuthenticated && !!userId;
}

/**
 * Whether UI should show the standard sign-in prompt before attempting
 * a cloud write/delete action.
 */
export function requiresSignInForCloudWrite(
  isAuthenticated: boolean,
  userId?: string | null,
): boolean {
  return !canAccessCloudData(isAuthenticated, userId);
}

/**
 * Determine whether speaker downloads are allowed.
 *
 * Download availability is entitlement-driven (same as premium access),
 * not account-driven.
 */
export function canDownloadSpeakers(
  subscription: SubscriptionStatus,
  trial: TrialStatus,
): boolean {
  return hasPremiumEntitlement(subscription, trial);
}
