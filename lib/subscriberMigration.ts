import { Platform } from "react-native";
import Purchases from "react-native-purchases";
import { supabase } from "./supabase";
import { qaLog } from "../utils/qaLog";
import { trackEvent } from "../utils/trackEvent";
import { ANALYTICS_EVENTS } from "../utils/analytics";
import type { RawEntitlements } from "./subscription";

const FUNCTION_NAME = "grant-subscriber-lifetime";

export type SubscriberPlan = "monthly" | "annual" | "unknown";

export function getSubscriberPlanFromRaw(raw: RawEntitlements): SubscriberPlan {
  const id = raw.unlimitedProductIdentifier?.toLowerCase() ?? "";
  if (id.includes("annual") || id.includes("year")) return "annual";
  if (id.includes("monthly") || id.includes("month")) return "monthly";

  if (raw.unlimitedExpirationDate) {
    const expiresMs = Date.parse(raw.unlimitedExpirationDate);
    if (!Number.isNaN(expiresMs)) {
      return expiresMs - Date.now() > 60 * 24 * 60 * 60 * 1000
        ? "annual"
        : "monthly";
    }
  }

  return "unknown";
}

/**
 * Active Android subscribers are migrated to promotional lifetime by the
 * server. Google Play renewal cancellation is handled separately outside the
 * app; RevenueCat `lifetime` is the durable access result.
 */
export async function attemptSubscriberLifetimeGrantIfEligible(
  raw: RawEntitlements,
): Promise<boolean> {
  if (Platform.OS !== "android") return false;
  if (!raw.hasUnlimited || raw.hasLifetime) return false;

  let appUserId: string;
  try {
    appUserId = await Purchases.getAppUserID();
  } catch (err) {
    qaLog("subscriber-migration", "Could not get RC app user id", {
      error: String(err),
    });
    return false;
  }

  if (!appUserId) {
    qaLog("subscriber-migration", "Skipping: missing RC app user id");
    return false;
  }

  const plan = getSubscriberPlanFromRaw(raw);
  qaLog("subscriber-migration", "Attempting subscriber lifetime grant", {
    appUserId,
    plan,
    raw,
  });

  const { data, error } = await supabase.functions.invoke(FUNCTION_NAME, {
    body: { app_user_id: appUserId },
  });

  if (error) {
    qaLog("subscriber-migration", "Edge function error", {
      appUserId,
      error: String(error),
    });
    return false;
  }

  const granted = !!data?.granted;
  const migrated = !!data?.migrated;
  qaLog("subscriber-migration", "Edge function result", {
    appUserId,
    granted,
    migrated,
    data,
  });

  if (granted) {
    trackEvent(ANALYTICS_EVENTS.LIFETIME_GRANDFATHERED, {
      app_user_id: appUserId,
      source: "subscriber_to_lifetime",
      subscription_plan: data?.subscriptionPlan ?? plan,
    }, true);
  }

  return granted || migrated;
}

