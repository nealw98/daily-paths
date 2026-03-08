import { supabase } from "./supabase";
import { qaLog } from "../utils/qaLog";

/**
 * Immediately delete the authenticated user's account.
 *
 * Calls the `delete-account-now` edge function which:
 *  1. Revokes any RevenueCat promotional entitlements
 *  2. Deletes all Supabase user data
 *  3. Deletes the auth user
 */
export async function deleteAccountNow(): Promise<void> {
  qaLog("account", "Deleting account immediately");
  const { data, error } = await supabase.functions.invoke("delete-account-now");
  if (error) {
    qaLog("account", "Error deleting account", { error: error.message });
    throw error;
  }
  if (data?.error) {
    throw new Error(data.error);
  }
  qaLog("account", "Account deleted");
}
