import { supabase } from "../lib/supabase";
import { getOrCreateDeviceId } from "./deviceIdentity";
import { qaLog } from "./qaLog";
import AsyncStorage from "@react-native-async-storage/async-storage";

/**
 * Legacy user migration for Daily Paths Unlimited.
 * Detects users who purchased the original paid app and grants them
 * lifetime Unlimited access via user_profiles.legacy_user flag.
 */

const LEGACY_MIGRATION_KEY = "@daily_paths_legacy_migration_done";

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
 * Perform legacy user migration.
 * Called after first successful authentication.
 * Checks if the device has existing engagement data (bookmarks, readings, etc.)
 * which indicates they were a paid app user.
 */
export async function performLegacyMigration(userId: string): Promise<boolean> {
  try {
    // Check if already migrated
    const alreadyDone = await hasCompletedLegacyMigration();
    if (alreadyDone) {
      qaLog("migration", "Legacy migration already completed");
      return false;
    }

    const deviceId = await getOrCreateDeviceId();

    // Check for existing engagement data that indicates a legacy paid user
    // Legacy users have device data in app_devices, favorites, feedback, etc.
    const { data: deviceData } = await supabase
      .from("app_devices")
      .select("device_id, created_at")
      .eq("device_id", deviceId)
      .single();

    if (!deviceData) {
      qaLog("migration", "No device data found, not a legacy user");
      await AsyncStorage.setItem(LEGACY_MIGRATION_KEY, "true");
      return false;
    }

    // Check if device was created before the 2.0 release
    // If they have app_devices and app_favorites entries, they're a legacy user
    const { count: favoritesCount } = await supabase
      .from("app_favorites")
      .select("*", { count: "exact", head: true })
      .eq("device_id", deviceId);

    const { count: feedbackCount } = await supabase
      .from("app_reading_feedback")
      .select("*", { count: "exact", head: true })
      .eq("device_id", deviceId);

    const hasEngagement = (favoritesCount || 0) > 0 || (feedbackCount || 0) > 0;

    if (hasEngagement) {
      // Grant legacy access
      const { error } = await supabase.from("user_profiles").upsert(
        {
          id: userId,
          device_id: deviceId,
          legacy_user: true,
          updated_at: new Date().toISOString(),
        },
        { onConflict: "id" }
      );

      if (error) {
        qaLog("migration", "Error granting legacy access", {
          error: error.message,
        });
        return false;
      }

      qaLog("migration", "Legacy access granted", {
        userId,
        deviceId,
        favoritesCount,
        feedbackCount,
      });

      await AsyncStorage.setItem(LEGACY_MIGRATION_KEY, "true");
      return true;
    }

    qaLog("migration", "Device found but no engagement data, not legacy");
    await AsyncStorage.setItem(LEGACY_MIGRATION_KEY, "true");
    return false;
  } catch (err) {
    qaLog("migration", "Legacy migration error", { error: String(err) });
    return false;
  }
}
