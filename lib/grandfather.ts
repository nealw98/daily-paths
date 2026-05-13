import { Platform } from "react-native";
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
 * Calls a Supabase Edge Function. The server records the decision and uses
 * the RevenueCat secret key to grant the `lifetime` entitlement for eligible
 * non-subscribers. After a grant, RevenueCat remains the source of truth for
 * access.
 *
 * The legacy 2.6.x trial marker is one signal; the edge function also accepts
 * a null marker and falls back to RC `first_seen` for users whose AsyncStorage
 * was wiped (see `grant-grandfather-lifetime/index.ts`).
 *
 * Modal decisioning lives on the server (`which-modal` / `acknowledge-modal`)
 * — no local seen flags here.
 */

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
  if (Platform.OS !== "android") {
    qaLog("grandfather", "Skipping grandfather attempt: non-Android platform", {
      platform: Platform.OS,
    });
    return false;
  }

  try {
    // The server accepts a null marker and falls back to RC first_seen.
    // We still send the local marker when present so the audit row records it.
    const legacyMarker = await getLegacyTrialMarker();

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

    qaLog("grandfather", "Attempting grandfather grant", {
      appUserId,
      hasLocalMarker: legacyMarker.hasValidMarker,
    });

    const { data, error } = await supabase.functions.invoke(FUNCTION_NAME, {
      body: {
        app_user_id: appUserId,
        legacy_trial_start_date: legacyMarker.trialStartDate ?? null,
      },
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
      legacyTrialStartDate: legacyMarker.trialStartDate,
      data,
    });

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
