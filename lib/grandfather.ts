import { Platform } from "react-native";
import AsyncStorage from "@react-native-async-storage/async-storage";
import Purchases from "react-native-purchases";
import { supabase } from "./supabase";
import { qaLog } from "../utils/qaLog";
import { trackEvent } from "../utils/trackEvent";
import { ANALYTICS_EVENTS } from "../utils/analytics";
import { getRawEntitlements } from "./subscription";

/**
 * Grandfather flow for pre-2.6.6 Android users.
 *
 * On first launch of 2.6.6, calls a Supabase Edge Function which uses the
 * RevenueCat secret key to grant the `lifetime` entitlement to users whose
 * RC subscriber `first_seen` predates the cutoff date. After a successful
 * grant, RC becomes the source of truth — access control just sees a
 * `lifetime`-entitled user.
 *
 * The local flags here are purely cosmetic / control-flow:
 *   - `attempted` prevents re-calling the edge function on every launch.
 *   - `modal_pending` triggers the one-time grandfather welcome modal.
 */

const GRANDFATHER_ATTEMPTED_KEY = "@daily_paths_grandfather_attempted";
const GRANDFATHER_MODAL_PENDING_KEY = "@daily_paths_grandfather_modal_pending";
const GRANDFATHER_MODAL_SEEN_KEY = "@daily_paths_grandfather_modal_seen";
const FUNCTION_NAME = "grant-grandfather-lifetime";

function isRevenueCatPromotionalLifetime(productIdentifier: string | null): boolean {
  if (!productIdentifier) return false;
  const id = productIdentifier.toLowerCase();
  return id.startsWith("rc_promo") || id.includes("promo");
}

/**
 * Try to grant lifetime to the current user if they qualify under the
 * grandfather rules. Idempotent and safe to call on every launch.
 *
 * @returns true when a fresh grant was applied (caller should re-fetch
 *          subscription status so the new entitlement is reflected),
 *          false when no grant happened.
 */
export async function attemptGrandfatherGrantIfEligible(): Promise<boolean> {
  if (Platform.OS !== "android") {
    qaLog("grandfather", "Skipping grandfather attempt: non-Android platform", {
      platform: Platform.OS,
    });
    return false;
  }

  try {
    const attempted = await AsyncStorage.getItem(GRANDFATHER_ATTEMPTED_KEY);
    if (attempted === "true") {
      qaLog("grandfather", "Skipping grandfather attempt: already attempted locally");
      return false;
    }

    const {
      hasUnlimited,
      hasLifetime,
      unlimitedProductIdentifier,
      lifetimeProductIdentifier,
    } = await getRawEntitlements();
    if (hasUnlimited || hasLifetime) {
      // Already entitled — nothing to grant. Mark attempted so we don't keep
      // calling the edge function on subsequent launches.
      await AsyncStorage.setItem(GRANDFATHER_ATTEMPTED_KEY, "true");
      qaLog("grandfather", "Skipping grandfather attempt: already entitled in RevenueCat", {
        hasUnlimited,
        hasLifetime,
        unlimitedProductIdentifier,
        lifetimeProductIdentifier,
      });
      return false;
    }

    let appUserId: string;
    try {
      appUserId = await Purchases.getAppUserID();
    } catch (err) {
      qaLog("grandfather", "Could not get RC app user id", { error: String(err) });
      return false;
    }

    if (!appUserId) {
      qaLog("grandfather", "Skipping grandfather attempt: missing RC app user id");
      return false;
    }

    qaLog("grandfather", "Attempting grandfather grant", { appUserId });

    const { data, error } = await supabase.functions.invoke(FUNCTION_NAME, {
      body: { app_user_id: appUserId },
    });

    if (error) {
      qaLog("grandfather", "Edge function error — will retry next launch", {
        error: String(error),
      });
      return false;
    }

    const granted = !!data?.granted;
    qaLog("grandfather", "Edge function result", {
      appUserId,
      granted,
      data,
    });

    // Mark attempted so we don't keep calling. Even on `granted=false` the
    // server has decided the user is ineligible (post-cutoff, missing, etc.) —
    // no value in retrying.
    await AsyncStorage.setItem(GRANDFATHER_ATTEMPTED_KEY, "true");

    if (granted) {
      await AsyncStorage.setItem(GRANDFATHER_MODAL_PENDING_KEY, "true");
      qaLog("grandfather", "Queued Modal B from fresh edge grant", { appUserId });
      trackEvent(ANALYTICS_EVENTS.LIFETIME_GRANDFATHERED, {
        app_user_id: appUserId,
      }, true);
      return true;
    }

    return false;
  } catch (err) {
    qaLog("grandfather", "Unexpected error", { error: String(err) });
    return false;
  }
}

export async function isGrandfatherModalPending(): Promise<boolean> {
  try {
    const v = await AsyncStorage.getItem(GRANDFATHER_MODAL_PENDING_KEY);
    const pending = v === "true";
    qaLog("grandfather-modal", "Read Modal B pending flag", { pending });
    return pending;
  } catch {
    return false;
  }
}

export async function clearGrandfatherModalPending(): Promise<void> {
  try {
    await AsyncStorage.removeItem(GRANDFATHER_MODAL_PENDING_KEY);
    await AsyncStorage.setItem(GRANDFATHER_MODAL_SEEN_KEY, "true");
    qaLog("grandfather-modal", "Cleared Modal B pending and marked seen");
  } catch {
    // Non-critical
  }
}

/**
 * Modal B should also fire when lifetime already exists in RevenueCat as a
 * promotional/manual grant before this app launch. That covers users migrated
 * in RC outside the current device's edge-function grant attempt.
 */
export async function queueGrandfatherModalForExistingLifetime(
  lifetimeProductIdentifier: string | null,
): Promise<boolean> {
  if (Platform.OS !== "android") {
    qaLog("grandfather-modal", "Not queueing Modal B: non-Android platform", {
      platform: Platform.OS,
      lifetimeProductIdentifier,
    });
    return false;
  }
  if (!isRevenueCatPromotionalLifetime(lifetimeProductIdentifier)) {
    qaLog("grandfather-modal", "Not queueing Modal B: lifetime is not promotional", {
      lifetimeProductIdentifier,
    });
    return false;
  }

  try {
    const pending = await AsyncStorage.getItem(GRANDFATHER_MODAL_PENDING_KEY);
    if (pending === "true") {
      qaLog("grandfather-modal", "Modal B already pending for promotional lifetime", {
        lifetimeProductIdentifier,
      });
      return true;
    }

    const seen = await AsyncStorage.getItem(GRANDFATHER_MODAL_SEEN_KEY);
    if (seen === "true") {
      qaLog("grandfather-modal", "Not queueing Modal B: already seen locally", {
        lifetimeProductIdentifier,
      });
      return false;
    }

    await AsyncStorage.setItem(GRANDFATHER_MODAL_PENDING_KEY, "true");
    qaLog("grandfather", "Queued Modal B for existing promotional lifetime", {
      lifetimeProductIdentifier,
    });
    return true;
  } catch (err) {
    qaLog("grandfather", "Could not queue Modal B for existing lifetime", {
      error: String(err),
    });
    return false;
  }
}

/** QA helper: reset both the attempted flag and modal-pending flag. */
export async function resetGrandfatherState(): Promise<void> {
  await AsyncStorage.removeItem(GRANDFATHER_ATTEMPTED_KEY);
  await AsyncStorage.removeItem(GRANDFATHER_MODAL_PENDING_KEY);
  await AsyncStorage.removeItem(GRANDFATHER_MODAL_SEEN_KEY);
}

/** QA helper: simulate a successful grandfather grant (sets modal pending). */
export async function simulateGrandfatherGrant(): Promise<void> {
  await AsyncStorage.setItem(GRANDFATHER_ATTEMPTED_KEY, "true");
  await AsyncStorage.setItem(GRANDFATHER_MODAL_PENDING_KEY, "true");
  await AsyncStorage.removeItem(GRANDFATHER_MODAL_SEEN_KEY);
}
