import { Platform } from "react-native";
import AsyncStorage from "@react-native-async-storage/async-storage";
import Purchases from "react-native-purchases";
import { supabase } from "./supabase";
import { qaLog } from "../utils/qaLog";
import { trackEvent } from "../utils/trackEvent";
import { ANALYTICS_EVENTS } from "../utils/analytics";
import { getRawEntitlements } from "./subscription";
import { getLegacyTrialMarker } from "../utils/trialTimer";

/**
 * Grandfather flow for pre-2.7 Android users.
 *
 * Calls a Supabase Edge Function with the old 2.6.x local trial marker. The
 * server records the decision and uses the RevenueCat secret key to grant the
 * `lifetime` entitlement for eligible non-subscribers. After a grant,
 * RevenueCat remains the source of truth for access.
 *
 * The local flags here are purely cosmetic / control-flow:
 *   - `modal_pending` triggers the one-time grandfather welcome modal.
 */

const GRANDFATHER_MODAL_PENDING_KEY = "@daily_paths_grandfather_modal_pending";
const GRANDFATHER_MODAL_SEEN_KEY = "@daily_paths_grandfather_modal_seen";
const FUNCTION_NAME = "grant-grandfather-lifetime";

function isRevenueCatPromotionalLifetime(productIdentifier: string | null): boolean {
  if (!productIdentifier) return false;
  const id = productIdentifier.toLowerCase();
  return id.startsWith("rc_promo") || id.includes("promo");
}

async function queueGrandfatherModalIfUnseen(reason: string): Promise<boolean> {
  try {
    const pending = await AsyncStorage.getItem(GRANDFATHER_MODAL_PENDING_KEY);
    if (pending === "true") return true;

    const seen = await AsyncStorage.getItem(GRANDFATHER_MODAL_SEEN_KEY);
    if (seen === "true") {
      qaLog("grandfather-modal", "Not queueing Modal B: already seen locally", {
        reason,
      });
      return false;
    }

    await AsyncStorage.setItem(GRANDFATHER_MODAL_PENDING_KEY, "true");
    qaLog("grandfather-modal", "Queued Modal B", { reason });
    return true;
  } catch (err) {
    qaLog("grandfather-modal", "Could not queue Modal B", {
      reason,
      error: String(err),
    });
    return false;
  }
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
    const legacyMarker = await getLegacyTrialMarker();
    if (!legacyMarker.hasValidMarker || !legacyMarker.trialStartDate) {
      qaLog("grandfather", "Skipping grandfather attempt: missing old trial marker", {
        legacyMarker,
      });
      return false;
    }

    const {
      hasUnlimited,
      hasLifetime,
      unlimitedProductIdentifier,
      lifetimeProductIdentifier,
    } = await getRawEntitlements();
    if (hasUnlimited) {
      qaLog("grandfather", "Skipping free grandfather: active subscription present", {
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
      body: {
        app_user_id: appUserId,
        legacy_trial_start_date: legacyMarker.trialStartDate,
      },
    });

    if (error) {
      qaLog("grandfather", "Edge function error — will retry next launch", {
        error: String(error),
      });
      return false;
    }

    const granted = !!data?.granted;
    const grandfathered = !!data?.grandfathered;
    qaLog("grandfather", "Edge function result", {
      appUserId,
      granted,
      grandfathered,
      legacyTrialStartDate: legacyMarker.trialStartDate,
      data,
    });

    if (grandfathered) {
      await queueGrandfatherModalIfUnseen(data?.reason ?? "grandfathered");
    }

    if (granted) {
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

/** QA helper: reset local Modal B flags. */
export async function resetGrandfatherState(): Promise<void> {
  await AsyncStorage.removeItem(GRANDFATHER_MODAL_PENDING_KEY);
  await AsyncStorage.removeItem(GRANDFATHER_MODAL_SEEN_KEY);
}

/** QA helper: simulate a successful grandfather grant (sets modal pending). */
export async function simulateGrandfatherGrant(): Promise<void> {
  await AsyncStorage.setItem(GRANDFATHER_MODAL_PENDING_KEY, "true");
  await AsyncStorage.removeItem(GRANDFATHER_MODAL_SEEN_KEY);
}
