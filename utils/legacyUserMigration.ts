import { supabase } from "../lib/supabase";
import { qaLog } from "./qaLog";
import AsyncStorage from "@react-native-async-storage/async-storage";
import { Platform } from "react-native";
import Purchases from "react-native-purchases";
import { isRevenueCatInitialized } from "../lib/subscription";
import { trackEvent } from "./trackEvent";
import { ANALYTICS_EVENTS } from "./analytics";

/**
 * Legacy user migration for Daily Paths Unlimited.
 *
 * Detects users who purchased the original paid app and grants them
 * the "lifetime" entitlement in RevenueCat via a Supabase Edge Function.
 *
 * Detection: restorePurchases() syncs the App Store receipt with RevenueCat.
 * If originalApplicationVersion is a pre-2.5 build, the user bought the
 * original paid app. The receipt is tied to the Apple ID, so it persists
 * across devices.
 */

const LEGACY_MIGRATION_KEY = "@daily_paths_legacy_migration_done";
const LIFETIME_ENTITLEMENT_ID = "lifetime";

// First build number of the freemium release. Any originalApplicationVersion
// (which is CFBundleVersion — a plain integer on iOS) below this threshold
// means the user originally purchased the paid app.
const FREEMIUM_BUILD_NUMBER = 27;

/**
 * Check if legacy migration has already been performed for this device.
 */
export async function hasCompletedLegacyMigration(): Promise<boolean> {
  try {
    const value = await AsyncStorage.getItem(LEGACY_MIGRATION_KEY);
    return value === "true";
  } catch {
    return false;
  }
}

/**
 * Mark legacy migration as complete. Called by the migration orchestrator
 * after the lifetime entitlement has been successfully granted (or when
 * the user is confirmed non-legacy).
 */
export async function markLegacyMigrationDone(): Promise<void> {
  try {
    await AsyncStorage.setItem(LEGACY_MIGRATION_KEY, "true");
  } catch {
    // Non-critical — will retry next session
  }
}

/**
 * Detect legacy users and mark them for lifetime access.
 *
 * Called after first successful authentication. Returns true if the user
 * was identified as a legacy paid-app user and should be granted the
 * RevenueCat "lifetime" entitlement.
 */
export async function performLegacyMigration(userId: string): Promise<boolean> {
  try {
    const alreadyDone = await hasCompletedLegacyMigration();
    if (alreadyDone) {
      qaLog("migration", "Legacy migration already completed");
      return false;
    }

    // Legacy users are iOS-only (Android launches with 2.5, no prior paid version)
    if (Platform.OS !== "ios") {
      await AsyncStorage.setItem(LEGACY_MIGRATION_KEY, "true");
      return false;
    }

    if (!isRevenueCatInitialized()) {
      qaLog("migration", "RevenueCat not initialized, skipping legacy check");
      return false;
    }

    // ── Method 1: App Store receipt check ────────────────────────────────
    // restorePurchases() syncs the device's App Store receipt with RevenueCat.
    // The returned CustomerInfo includes originalApplicationVersion which is
    // the CFBundleVersion (build number) from the first download.
    try {
      qaLog("migration", "Checking App Store receipt for legacy status");
      const customerInfo = await Purchases.restorePurchases();

      // If the lifetime entitlement is already active (e.g. previously granted),
      // mark migration done and return — no need to grant again.
      if (customerInfo.entitlements.active[LIFETIME_ENTITLEMENT_ID]) {
        qaLog("migration", "Lifetime entitlement already active");
        await AsyncStorage.setItem(LEGACY_MIGRATION_KEY, "true");
        return false;
      }

      const originalVersion = customerInfo.originalApplicationVersion;
      if (originalVersion) {
        qaLog("migration", "App Store receipt originalApplicationVersion", {
          originalVersion,
        });

        if (isLegacyBuildNumber(originalVersion)) {
          qaLog("migration", "Legacy user detected via App Store receipt", {
            originalVersion,
            userId,
          });
          trackEvent(ANALYTICS_EVENTS.LEGACY_USER_IDENTIFIED, {
            detection_method: 'app_store_receipt',
            original_version: originalVersion,
          }, true);
          await markLegacyInSupabase(userId);
          // NOTE: Do NOT set LEGACY_MIGRATION_KEY here. The caller must
          // grant the lifetime entitlement first; only after a successful
          // grant should markLegacyMigrationDone() be called. This ensures
          // a failed grant retries on the next app session.
          return true;
        }
      }
    } catch (err) {
      qaLog("migration", "Receipt check failed", { error: String(err) });
    }

    qaLog("migration", "Not a legacy user");
    await AsyncStorage.setItem(LEGACY_MIGRATION_KEY, "true");
    return false;
  } catch (err) {
    qaLog("migration", "Legacy migration error", { error: String(err) });
    return false;
  }
}

/**
 * Check if an originalApplicationVersion (CFBundleVersion — a plain integer
 * build number on iOS) indicates a legacy paid-app user.
 *
 * Returns true if the build number is strictly before the first freemium build.
 */
function isLegacyBuildNumber(originalVersion: string): boolean {
  const buildNum = parseInt(originalVersion, 10);
  if (isNaN(buildNum)) return false;
  return buildNum < FREEMIUM_BUILD_NUMBER;
}

/**
 * Mark the user as a legacy user in Supabase (user_profiles.legacy_user).
 * Required by the Edge Function which verifies this flag before granting
 * the RevenueCat entitlement.
 */
async function markLegacyInSupabase(userId: string): Promise<void> {
  const { error } = await supabase.from("user_profiles").upsert(
    {
      id: userId,
      legacy_user: true,
      updated_at: new Date().toISOString(),
    },
    { onConflict: "id" },
  );

  if (error) {
    qaLog("migration", "Error marking legacy user in Supabase", {
      error: error.message,
    });
  }
}

/**
 * Grant the RevenueCat "lifetime" entitlement to a legacy user
 * via the Supabase Edge Function (which holds the RC secret key).
 */
export async function grantLifetimeEntitlement(userId: string): Promise<boolean> {
  try {
    qaLog("migration", "Granting RevenueCat lifetime entitlement", { userId });

    const { data, error } = await supabase.functions.invoke(
      "grant-legacy-entitlement",
      { body: { user_id: userId } },
    );

    if (error) {
      qaLog("migration", "Edge Function error granting lifetime entitlement", {
        error: String(error),
      });
      return false;
    }

    qaLog("migration", "RevenueCat lifetime entitlement granted", {
      userId,
      success: data?.success,
    });
    return data?.success === true;
  } catch (err) {
    qaLog("migration", "Error calling grant-legacy-entitlement", {
      error: String(err),
    });
    return false;
  }
}
