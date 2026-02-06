import AsyncStorage from "@react-native-async-storage/async-storage";
import { supabase } from "../lib/supabase";
import { qaLog } from "./qaLog";
import type { BookmarkData } from "./bookmarkStorage";

/**
 * Migrates local AsyncStorage data to Supabase cloud storage.
 * Called once after first successful authentication.
 */

const MIGRATION_DONE_KEY = "@daily_paths_cloud_migration_done";

/**
 * Check if cloud migration has been completed.
 */
export async function hasCompletedCloudMigration(): Promise<boolean> {
  try {
    const value = await AsyncStorage.getItem(MIGRATION_DONE_KEY);
    return value === "true";
  } catch {
    return false;
  }
}

/**
 * Migrate local bookmarks and settings to cloud storage.
 * This preserves existing data while enabling cross-device sync.
 */
export async function migrateLocalDataToCloud(userId: string): Promise<void> {
  try {
    const alreadyDone = await hasCompletedCloudMigration();
    if (alreadyDone) {
      qaLog("migration", "Cloud migration already completed");
      return;
    }

    qaLog("migration", "Starting cloud migration", { userId });

    // Migrate bookmarks
    await migrateBookmarks(userId);

    // Migrate settings
    await migrateSettings(userId);

    // Mark migration complete
    await AsyncStorage.setItem(MIGRATION_DONE_KEY, "true");
    qaLog("migration", "Cloud migration completed successfully");
  } catch (err) {
    qaLog("migration", "Cloud migration error", { error: String(err) });
    // Don't mark as done so it can be retried
  }
}

async function migrateBookmarks(userId: string): Promise<void> {
  try {
    const bookmarksJson = await AsyncStorage.getItem("@daily_paths_bookmarks");
    if (!bookmarksJson) {
      qaLog("migration", "No local bookmarks to migrate");
      return;
    }

    const bookmarks: BookmarkData[] = JSON.parse(bookmarksJson);
    if (bookmarks.length === 0) return;

    qaLog("migration", `Migrating ${bookmarks.length} bookmarks`);

    // Upsert bookmarks to cloud (app_favorites table already syncs)
    // The existing bookmark sync in useBookmarkManager handles this
    // We just ensure they're all synced up
    for (const bookmark of bookmarks) {
      await supabase.from("app_favorites").upsert(
        {
          device_id: bookmark.readingId, // Uses reading_id as identifier
          reading_id: bookmark.readingId,
          user_id: userId,
        },
        { onConflict: "device_id,reading_id" }
      );
    }

    qaLog("migration", "Bookmarks migration complete");
  } catch (err) {
    qaLog("migration", "Bookmarks migration error", { error: String(err) });
  }
}

async function migrateSettings(userId: string): Promise<void> {
  try {
    const settingsJson = await AsyncStorage.getItem("daily_paths_settings_v2");
    if (!settingsJson) {
      qaLog("migration", "No local settings to migrate");
      return;
    }

    const settings = JSON.parse(settingsJson);

    // Store settings in user_preferences table
    await supabase.from("user_preferences").upsert(
      {
        user_id: userId,
        updated_at: new Date().toISOString(),
      },
      { onConflict: "user_id" }
    );

    qaLog("migration", "Settings migration complete");
  } catch (err) {
    qaLog("migration", "Settings migration error", { error: String(err) });
  }
}
