import type { SubscriptionStatus } from "../lib/subscription";
import type { TrialStatus } from "./trialTimer";

/**
 * Access control helpers for the Daily Paths freemium model.
 *
 * Premium features (Journal, Prayers, Speakers) are free during the 7-day
 * local trial, then require a subscription.  The daily reader is free forever.
 */

// ─── Gate type ───────────────────────────────────────────────────────────────

export type GateType = "none" | "paywall" | "signin";

/**
 * Determine which gate (if any) should block a premium tab.
 *
 * Priority:
 *  1. Local trial active             → no gate
 *  2. Entitlement + authenticated    → no gate
 *  3. Entitlement + NOT authenticated → sign-in gate
 *  4. No entitlement + trial expired → paywall gate
 */
export function getRequiredGate(
  subscription: SubscriptionStatus,
  trial: TrialStatus,
  isAuthenticated: boolean,
): GateType {
  // During the local 7-day trial, everything is unlocked — no gate needed.
  if (trial.isInTrial) return "none";

  // User has a subscription or legacy lifetime access AND is signed in.
  if ((subscription.isSubscribed || subscription.isLegacy) && isAuthenticated) {
    return "none";
  }

  // Device has an entitlement (paid or legacy) but the user isn't signed in.
  // They need to sign in so we can load their cloud data.
  if (subscription.isSubscribed || subscription.isLegacy) {
    return "signin";
  }

  // Trial expired and no entitlement — show the paywall.
  return "paywall";
}

// ─── Legacy helpers (kept for backward compat during transition) ─────────────

/**
 * Check whether the user has an active entitlement (subscription or legacy).
 * Does NOT consider the local trial — use `getRequiredGate` for full logic.
 */
export function canAccessUnlimitedFeatures(
  subscription: SubscriptionStatus,
): boolean {
  if (subscription.isLegacy) return true;
  if (subscription.isSubscribed) return true;
  return false;
}

/**
 * Inverse of `canAccessUnlimitedFeatures`.
 */
export function shouldShowPaywall(
  subscription: SubscriptionStatus,
): boolean {
  return !canAccessUnlimitedFeatures(subscription);
}

// ─── Status messages ─────────────────────────────────────────────────────────

/**
 * User-friendly description of the current access level.
 */
export function getAccessStatusMessage(
  subscription: SubscriptionStatus,
  trial?: TrialStatus,
): string {
  if (subscription.isLegacy) {
    return "Lifetime Access";
  }
  if (subscription.isSubscribed) {
    return "Premium Subscriber";
  }
  if (trial?.isInTrial) {
    const d = trial.daysRemaining;
    if (d <= 1) return "Free access expires today";
    return `${d} days of free access remaining`;
  }
  return "Free";
}
