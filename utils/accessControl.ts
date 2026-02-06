import type { SubscriptionStatus } from "../lib/subscription";

/**
 * Access control helpers for Daily Paths Plus features.
 * Determines whether a user can access premium features based on
 * subscription status, trial period, or legacy user status.
 */

const TRIAL_DURATION_DAYS = 14;

/**
 * Check if user can access Plus features (journal, gratitude, export, etc.).
 */
export function canAccessPlusFeatures(subscription: SubscriptionStatus): boolean {
  // Legacy users always have access
  if (subscription.isLegacy) return true;

  // Active subscribers have access
  if (subscription.isSubscribed) return true;

  return false;
}

/**
 * Check if user is currently in their free trial period.
 */
export function isInTrial(subscription: SubscriptionStatus): boolean {
  return subscription.isTrialing;
}

/**
 * Calculate days remaining in trial period.
 * Returns 0 if not in trial or trial has expired.
 */
export function daysRemainingInTrial(subscription: SubscriptionStatus): number {
  if (!subscription.isTrialing || !subscription.expirationDate) return 0;

  const expiration = new Date(subscription.expirationDate);
  const now = new Date();
  const diffMs = expiration.getTime() - now.getTime();
  const diffDays = Math.ceil(diffMs / (1000 * 60 * 60 * 24));

  return Math.max(0, diffDays);
}

/**
 * Get a user-friendly description of their access status.
 */
export function getAccessStatusMessage(subscription: SubscriptionStatus): string {
  if (subscription.isLegacy) {
    return "Lifetime Access";
  }
  if (subscription.isTrialing) {
    const days = daysRemainingInTrial(subscription);
    if (days <= 1) return "Trial expires today";
    return `${days} days left in trial`;
  }
  if (subscription.isSubscribed) {
    return "Plus Subscriber";
  }
  return "Free";
}

/**
 * Check if we should show the paywall to this user.
 * Returns true if they don't have access and should see the paywall.
 */
export function shouldShowPaywall(subscription: SubscriptionStatus): boolean {
  return !canAccessPlusFeatures(subscription);
}
