import Purchases from "react-native-purchases";

import { supabase } from "./supabase";
import { qaLog } from "../utils/qaLog";

export interface AccessGrantRows {
  grandfather: { status?: string } | null;
  subscriber: { status?: string } | null;
}

export async function fetchAccessGrantRows(): Promise<AccessGrantRows | null> {
  try {
    const appUserId = await Purchases.getAppUserID();
    if (!appUserId) return null;
    const { data, error } = await supabase.functions.invoke("get-grant-rows", {
      body: { app_user_id: appUserId },
    });
    if (error) {
      qaLog("access-diagnostics", "Grant lookup failed", { error: String(error) });
      return null;
    }
    return {
      grandfather: data?.grandfather ?? null,
      subscriber: data?.subscriber ?? null,
    };
  } catch (error) {
    qaLog("access-diagnostics", "Grant lookup failed", { error: String(error) });
    return null;
  }
}
