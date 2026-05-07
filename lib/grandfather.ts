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
const FUNCTION_NAME = "grant-grandfather-lifetime";

/**
 * Try to grant lifetime to the current user if they qualify under the
 * grandfather rules. Idempotent and safe to call on every launch.
 *
 * @returns true when a fresh grant was applied (caller should re-fetch
 *          subscription status so the new entitlement is reflected),
 *          false when no grant happened.
 */
export async function attemptGrandfatherGrantIfEligible(): Promise<boolean> {
  if (Platform.OS !== "android") return false;

  try {
    const attempted = await AsyncStorage.getItem(GRANDFATHER_ATTEMPTED_KEY);
    if (attempted === "true") return false;

    const { hasUnlimited, hasLifetime } = await getRawEntitlements();
    if (hasUnlimited || hasLifetime) {
      // Already entitled — nothing to grant. Mark attempted so we don't keep
      // calling the edge function on subsequent launches.
      await AsyncStorage.setItem(GRANDFATHER_ATTEMPTED_KEY, "true");
      return false;
    }

    let appUserId: string;
    try {
      appUserId = await Purchases.getAppUserID();
    } catch (err) {
      qaLog("grandfather", "Could not get RC app user id", { error: String(err) });
      return false;
    }

    if (!appUserId) return false;

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
    qaLog("grandfather", "Edge function result", { data });

    // Mark attempted so we don't keep calling. Even on `granted=false` the
    // server has decided the user is ineligible (post-cutoff, missing, etc.) —
    // no value in retrying.
    await AsyncStorage.setItem(GRANDFATHER_ATTEMPTED_KEY, "true");

    if (granted) {
      await AsyncStorage.setItem(GRANDFATHER_MODAL_PENDING_KEY, "true");
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
    return v === "true";
  } catch {
    return false;
  }
}

export async function clearGrandfatherModalPending(): Promise<void> {
  try {
    await AsyncStorage.removeItem(GRANDFATHER_MODAL_PENDING_KEY);
  } catch {
    // Non-critical
  }
}

/** QA helper: reset both the attempted flag and modal-pending flag. */
export async function resetGrandfatherState(): Promise<void> {
  await AsyncStorage.removeItem(GRANDFATHER_ATTEMPTED_KEY);
  await AsyncStorage.removeItem(GRANDFATHER_MODAL_PENDING_KEY);
}

/** QA helper: simulate a successful grandfather grant (sets modal pending). */
export async function simulateGrandfatherGrant(): Promise<void> {
  await AsyncStorage.setItem(GRANDFATHER_ATTEMPTED_KEY, "true");
  await AsyncStorage.setItem(GRANDFATHER_MODAL_PENDING_KEY, "true");
}
