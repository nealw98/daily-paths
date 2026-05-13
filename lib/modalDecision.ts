import { Platform } from "react-native";
import Purchases from "react-native-purchases";
import { supabase } from "./supabase";
import { qaLog } from "../utils/qaLog";

/**
 * Server-owned decision for which one-time congratulatory modal — Modal A
 * (subscriber-to-lifetime) or Modal B (grandfathered) — the current Android
 * user should see, if any.
 *
 * The server inspects RevenueCat entitlements plus the existing grant tables
 * and returns at most one modal name. The client renders it, then calls
 * `acknowledgePendingModal` on dismiss so the same modal cannot fire twice.
 *
 * Replaces the prior local-AsyncStorage seen-flag scheme, which both leaked
 * across reinstalls (false re-shows) and could trigger Modal A + Modal B
 * simultaneously for migrated subscribers whose lifetime product was
 * `rc_promo_lifetime`.
 */

export type PendingModalName = "subscriber_to_lifetime" | "grandfathered";

export interface PendingModal {
  modal: PendingModalName;
  /** Present only for `subscriber_to_lifetime`. */
  plan?: "monthly" | "annual" | "unknown";
}

const WHICH_FUNCTION = "which-modal";
const ACK_FUNCTION = "acknowledge-modal";
const RESET_FUNCTION = "reset-modal-acknowledgments";

/**
 * Ask the server which (if any) modal the current user should see. Returns
 * null on iOS, on missing app_user_id, or on any error — modals are
 * non-critical UX and should never block app entry.
 */
export async function fetchPendingModal(): Promise<PendingModal | null> {
  if (Platform.OS !== "android") return null;

  let appUserId: string;
  try {
    appUserId = await Purchases.getAppUserID();
  } catch (err) {
    qaLog("modal-decision", "Could not get RC app user id", { error: String(err) });
    return null;
  }
  if (!appUserId) return null;

  try {
    const { data, error } = await supabase.functions.invoke(WHICH_FUNCTION, {
      body: { app_user_id: appUserId },
    });
    if (error) {
      qaLog("modal-decision", "which-modal error", { error: String(error) });
      return null;
    }
    const modalName = data?.modal as PendingModalName | null | undefined;
    qaLog("modal-decision", "which-modal result", { appUserId, data });
    if (!modalName) return null;
    return { modal: modalName, plan: data?.plan };
  } catch (err) {
    qaLog("modal-decision", "which-modal unexpected error", { error: String(err) });
    return null;
  }
}

/**
 * Mark the modal as acknowledged so it does not fire again. Fire-and-forget
 * from the caller's perspective; we still await to surface errors to QA logs.
 */
export async function acknowledgePendingModal(modal: PendingModalName): Promise<void> {
  if (Platform.OS !== "android") return;

  let appUserId: string;
  try {
    appUserId = await Purchases.getAppUserID();
  } catch (err) {
    qaLog("modal-decision", "Could not get RC app user id for ack", { error: String(err) });
    return;
  }
  if (!appUserId) return;

  try {
    const { data, error } = await supabase.functions.invoke(ACK_FUNCTION, {
      body: { app_user_id: appUserId, modal },
    });
    qaLog("modal-decision", "acknowledge-modal result", { appUserId, modal, data, error });
  } catch (err) {
    qaLog("modal-decision", "acknowledge-modal unexpected error", {
      modal,
      error: String(err),
    });
  }
}

/**
 * QA-only: clear server-side acknowledgments so the modal will fire again.
 */
export async function resetModalAcknowledgments(): Promise<boolean> {
  if (Platform.OS !== "android") return false;

  let appUserId: string;
  try {
    appUserId = await Purchases.getAppUserID();
  } catch (err) {
    qaLog("modal-decision", "Could not get RC app user id for reset", { error: String(err) });
    return false;
  }
  if (!appUserId) return false;

  try {
    const { data, error } = await supabase.functions.invoke(RESET_FUNCTION, {
      body: { app_user_id: appUserId },
    });
    qaLog("modal-decision", "reset-modal-acknowledgments result", {
      appUserId,
      data,
      error,
    });
    return !error && !!data?.reset;
  } catch (err) {
    qaLog("modal-decision", "reset-modal-acknowledgments unexpected error", {
      error: String(err),
    });
    return false;
  }
}
