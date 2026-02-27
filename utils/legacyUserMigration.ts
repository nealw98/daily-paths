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
 * Detection methods (in priority order):
 *  1. App Store receipt — restorePurchases() syncs the receipt with RevenueCat.
 *     If originalApplicationVersion is a pre-2.5 build, the user bought the
 *     original paid app.
 *  2. Build version fallback — if no receipt is available, check whether
 *     local data from a pre-2.5 install exists (bookmarks, device ID, etc.)
 *     which indicates an upgrade from the paid version.
 */

const LEGACY_MIGRATION_KEY = "@daily_paths_legacy_migration_done";
const LIFETIME_ENTITLEMENT_ID = "lifetime";

// First version of the freemium release. Any originalApplicationVersion
// below this is a legacy paid-app user.
const FREEMIUM_VERSION = "2.5.0";

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

        if (isVersionBefore(originalVersion, FREEMIUM_VERSION)) {
          qaLog("migration", "Legacy user detected via App Store receipt", {
            originalVersion,
            userId,
          });
          trackEvent(ANALYTICS_EVENTS.LEGACY_USER_IDENTIFIED, {
            detection_method: 'app_store_receipt',
            original_version: originalVersion,
          }, true);
          await markLegacyInSupabase(userId);
          await AsyncStorage.setItem(LEGACY_MIGRATION_KEY, "true");
          return true;
        }
      }
    } catch (err) {
      qaLog("migration", "Receipt check failed, falling through to build version check", {
        error: String(err),
      });
    }

    // ── Method 2: Build version fallback ─────────────────────────────────
    // If the receipt check didn't find a legacy user (e.g. receipt unavailable),
    // look for local data that only exists on devices that ran a pre-2.5 build.
    // The bookmarks key and device ID key were used in all pre-2.5 versions but
    // the trial start key was introduced in 2.5 — so if bookmarks exist without
    // a trial start, this device upgraded from the paid version.
    try {
      const hasBookmarks = await AsyncStorage.getItem("@daily_paths_bookmarks");
      const hasTrialStart = await AsyncStorage.getItem("@daily_paths_trial_start");

      if (hasBookmarks && !hasTrialStart) {
        qaLog("migration", "Legacy user detected via pre-2.5 local data", {
          userId,
          hasBookmarks: !!hasBookmarks,
        });
        trackEvent(ANALYTICS_EVENTS.LEGACY_USER_IDENTIFIED, {
          detection_method: 'build_version_fallback',
        }, true);
        await markLegacyInSupabase(userId);
        await AsyncStorage.setItem(LEGACY_MIGRATION_KEY, "true");
        return true;
      }
    } catch (err) {
      qaLog("migration", "Build version fallback check failed", {
        error: String(err),
      });
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
 * Compare two semver-style version strings (e.g. "2.4.1" < "2.5.0").
 * Returns true if `version` is strictly before `threshold`.
 */
function isVersionBefore(version: string, threshold: string): boolean {
  const a = version.split(".").map(Number);
  const b = threshold.split(".").map(Number);
  for (let i = 0; i < Math.max(a.length, b.length); i++) {
    const av = a[i] || 0;
    const bv = b[i] || 0;
    if (av < bv) return true;
    if (av > bv) return false;
  }
  return false; // equal
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
