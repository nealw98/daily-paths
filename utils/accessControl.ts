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
  _isAuthenticated: boolean,
): GateType {
  // Content access is entitlement-driven and independent from auth state.
  // Account/sign-in is only required when attempting to save.
  if (subscription.isSubscribed || subscription.isLegacy) return "none";

  // During the local 7-day trial, premium content is unlocked.
  if (trial.isInTrial) return "none";

  // Trial expired and no entitlement — show the paywall.
  return "paywall";
}

export type SaveRequirement = "local" | "cloud" | "signin_required" | "blocked";

/**
 * Determine where save operations should write for the current state.
 *
 * Rules:
 * - Trial + signed-out -> local storage
 * - Entitled + signed-in -> cloud storage
 * - Entitled + signed-out -> sign-in required (save prompt flow)
 * - No entitlement -> blocked before save
 */
export function getSaveRequirement(
  subscription: SubscriptionStatus,
  trial: TrialStatus,
  isAuthenticated: boolean,
): SaveRequirement {
  if (subscription.isSubscribed || subscription.isLegacy) {
    return isAuthenticated ? "cloud" : "signin_required";
  }
  if (trial.isInTrial) return "local";
  return "blocked";
}

// ─── Download access ─────────────────────────────────────────────────────────

/**
 * Check whether the user can download speaker recordings for offline use.
 *
 * Stricter than general premium access:
 *   - Requires (subscriber OR legacy) AND authenticated
 *   - Excludes free trial users (both local trial and RevenueCat trial)
 *   - Excludes signed-out users regardless of entitlement
 */
export function canDownloadSpeakers(
  subscription: SubscriptionStatus,
  isAuthenticated: boolean,
): boolean {
  if (!isAuthenticated) return false;
  if (!subscription.isSubscribed) return false;
  if (subscription.isTrialing) return false;
  return true;
}

