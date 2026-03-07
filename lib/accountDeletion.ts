import { supabase } from "./supabase";
import { qaLog } from "../utils/qaLog";

export async function revokeLifetimeEntitlement(): Promise<void> {
  qaLog("account", "Revoking lifetime entitlement");
  const { data, error } = await supabase.functions.invoke("revoke-lifetime-entitlement");
  if (error) {
    qaLog("account", "Error revoking lifetime entitlement", { error: error.message });
    throw error;
  }
  if (data?.error) {
    throw new Error(data.error);
  }
  qaLog("account", "Lifetime entitlement revoked");
}

export async function requestAccountDeletion(): Promise<{ deletionScheduledFor: string }> {
  qaLog("account", "Requesting account deletion");
  const { data, error } = await supabase.rpc("request_account_deletion");
  if (error) {
    qaLog("account", "RPC error requesting deletion", { error: error.message });
    throw error;
  }
  if (data?.error) {
    throw new Error(data.error);
  }
  qaLog("account", "Deletion scheduled", { scheduledFor: data.deletion_scheduled_for });
  return { deletionScheduledFor: data.deletion_scheduled_for };
}

export async function cancelAccountDeletion(): Promise<void> {
  qaLog("account", "Cancelling account deletion");
  const { data, error } = await supabase.rpc("cancel_account_deletion");
  if (error) {
    qaLog("account", "RPC error cancelling deletion", { error: error.message });
    throw error;
  }
  if (data?.error) {
    throw new Error(data.error);
  }
  qaLog("account", "Deletion cancelled");
}

export async function checkDeletionStatus(): Promise<{
  pendingDeletion: boolean;
  deletionScheduledFor: string | null;
}> {
  const { data, error } = await supabase.rpc("check_deletion_status");
  if (error) {
    qaLog("account", "Check deletion status error", { error: error.message });
    return { pendingDeletion: false, deletionScheduledFor: null };
  }
  return {
    pendingDeletion: data?.pending_deletion === true,
    deletionScheduledFor: data?.deletion_scheduled_for ?? null,
  };
}
