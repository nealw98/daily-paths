import { Platform } from "react-native";
import Purchases from "react-native-purchases";
import { supabase } from "./supabase";
import { qaLog } from "../utils/qaLog";

/**
 * QA-only: ask the server to revoke this device's promotional `lifetime`
 * entitlement in RevenueCat. Used to re-run grandfather / subscriber-migration
 * flows on the same device without leaving the app.
 *
 * Does not touch real $4.99 IAP lifetime — RC's `revoke_promotionals`
 * endpoint only affects manually-granted promotional entitlements.
 */
export async function revokeRcLifetime(): Promise<{ ok: boolean; reason?: string }> {
  if (Platform.OS !== "android") {
    return { ok: false, reason: "ios_not_supported" };
  }

  let appUserId: string;
  try {
    appUserId = await Purchases.getAppUserID();
  } catch (err) {
    qaLog("revoke-lifetime", "Could not get RC app user id", { error: String(err) });
    return { ok: false, reason: "no_app_user_id" };
  }
  if (!appUserId) return { ok: false, reason: "no_app_user_id" };

  try {
    const { data, error } = await supabase.functions.invoke("revoke-lifetime", {
      body: { app_user_id: appUserId },
    });
    qaLog("revoke-lifetime", "Edge function result", { appUserId, data, error });
    if (error) return { ok: false, reason: String(error) };
    return { ok: !!data?.revoked, reason: data?.reason };
  } catch (err) {
    qaLog("revoke-lifetime", "Unexpected error", { error: String(err) });
    return { ok: false, reason: String(err) };
  }
}
