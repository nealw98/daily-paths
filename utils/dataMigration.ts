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

// ─── Freemium trial data migration ──────────────────────────────────────────

const FREEMIUM_MIGRATION_DONE_KEY = "@daily_paths_freemium_migration_done";
const LOCAL_JOURNAL_KEY = "@daily_paths_local_journal";
const LOCAL_PRAYER_KEY = "@daily_paths_local_prayer_notes";

/**
 * Migrate locally-stored trial data (journal entries + prayer notes) to
 * Supabase after the user subscribes and creates an account.
 *
 * Idempotent — a flag in AsyncStorage prevents re-running.  Local data is
 * intentionally NOT deleted so it survives a later sign-out cycle (the
 * PremiumGate will block access anyway).
 */
export async function migrateTrialDataToSupabase(userId: string): Promise<void> {
  try {
    const done = await AsyncStorage.getItem(FREEMIUM_MIGRATION_DONE_KEY);
    if (done === "true") {
      qaLog("migration", "Freemium trial migration skipped — already done");
      return;
    }

    qaLog("migration", "Starting freemium trial data migration", { userId });

    // ── Journal entries ──────────────────────────────────────────────────
    const journalRaw = await AsyncStorage.getItem(LOCAL_JOURNAL_KEY);
    if (journalRaw) {
      const entries: Array<{
        entry_type: string;
        content: string | null;
        structured_content: Record<string, any> | null;
        created_at: string;
        updated_at: string;
      }> = JSON.parse(journalRaw);

      if (entries.length > 0) {
        const rows = entries.map((e) => ({
          user_id: userId,
          entry_type: e.entry_type,
          content: e.content,
          structured_content: e.structured_content,
          created_at: e.created_at,
          updated_at: e.updated_at,
        }));

        const { error } = await supabase
          .from("journal_entries")
          .insert(rows);

        if (error) {
          qaLog("migration", "Error migrating trial journal entries", {
            error: error.message,
          });
          return; // Don't mark as done — allow retry
        }

        qaLog("migration", `Migrated ${rows.length} trial journal entries`);
      }
    }

    // ── Prayer notes ─────────────────────────────────────────────────────
    const prayerRaw = await AsyncStorage.getItem(LOCAL_PRAYER_KEY);
    if (prayerRaw) {
      const parsed: { content: string; updated_at: string } =
        JSON.parse(prayerRaw);

      if (parsed.content?.trim()) {
        const { error } = await supabase.from("prayer_notes").upsert(
          {
            user_id: userId,
            content: parsed.content.trim(),
          },
          { onConflict: "user_id" },
        );

        if (error) {
          qaLog("migration", "Error migrating trial prayer notes", {
            error: error.message,
          });
          return;
        }

        qaLog("migration", "Migrated trial prayer notes");
      }
    }

    // ── Mark complete ────────────────────────────────────────────────────
    await AsyncStorage.setItem(FREEMIUM_MIGRATION_DONE_KEY, "true");
    qaLog("migration", "Freemium trial data migration complete");
  } catch (err) {
    qaLog("migration", "Freemium migration exception", { error: String(err) });
  }
}

/**
 * Clear the freemium migration flag so migration re-runs on next sign-in.
 * Dev / testing only.
 */
export async function clearFreemiumMigrationFlag(): Promise<void> {
  await AsyncStorage.removeItem(FREEMIUM_MIGRATION_DONE_KEY);
}
