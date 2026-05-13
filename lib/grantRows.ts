import { Platform } from "react-native";
import Purchases from "react-native-purchases";
import { supabase } from "./supabase";
import { qaLog } from "../utils/qaLog";

export interface QaGrantRows {
  grandfather: unknown | null;
  subscriber: unknown | null;
  trialStart: unknown | null;
}

/**
 * QA helper: fetches this device's current rows from the grandfather grant,
 * subscriber-lifetime grant, and trial-start tables. Used for the inline
 * "view grant row" panels in the QA screen.
 */
export async function fetchQaGrantRows(): Promise<QaGrantRows | null> {
  if (Platform.OS !== "android") return null;

  let appUserId: string;
  try {
    appUserId = await Purchases.getAppUserID();
  } catch (err) {
    qaLog("grant-rows", "Could not get RC app user id", { error: String(err) });
    return null;
  }
  if (!appUserId) return null;

  try {
    const { data, error } = await supabase.functions.invoke("get-grant-rows", {
      body: { app_user_id: appUserId },
    });
    qaLog("grant-rows", "get-grant-rows result", { appUserId, data, error });
    if (error || !data) return null;
    return {
      grandfather: data.grandfather ?? null,
      subscriber: data.subscriber ?? null,
      trialStart: data.trialStart ?? null,
    };
  } catch (err) {
    qaLog("grant-rows", "get-grant-rows unexpected error", { error: String(err) });
    return null;
  }
}
