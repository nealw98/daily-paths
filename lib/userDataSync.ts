// User-data backup core. Provider-agnostic: it (de)serializes the user's data
// to and from a single JSON snapshot. lib/cloudSync.ts carries that snapshot to
// the user's own cloud (iCloud on iOS, Google Drive on Android).
//
// IMPORTANT: this is an explicit ALLOWLIST of user-created data — never "back
// up everything". Device-local state (caches, entitlements, trial timers, the
// analytics device id, dev flags) is deliberately excluded so it never travels
// between devices.
import AsyncStorage from "@react-native-async-storage/async-storage";

export const SYNC_KEYS: string[] = [
  // ── things the user wrote ──
  "@daily_paths_local_journal",
  "@daily_paths_gratitude_entries",
  "@daily_paths_personal_prayers_v1",
  // Edits to, and hiding of, the built-in prayers are user intent too.
  "@daily_paths_builtin_prayer_overrides_v1",
  "@daily_paths_hidden_builtin_prayers_v1",
  // ── things the user marked ──
  "@daily_paths_bookmarks",
  "@daily_paths_speaker_progress", // resume positions + completion
  // ── preferences ──
  "daily_paths_settings_v2", // text size, theme, colour scheme, reminder time
];

/**
 * Deliberately NOT backed up, and why — kept here so the next person doesn't
 * "helpfully" add them back:
 *
 *   @daily_paths_device_id            analytics/feedback identity, must stay per-device
 *   @daily_paths_trial_start,
 *   @daily_paths_v27_trial_*          trial timers — restoring these would move a
 *                                     trial window between devices
 *   @daily_paths_lifetime_access_v1,
 *   @daily_paths_lifetime_override,
 *   @daily_paths_subscription_override,
 *   @daily_paths_rc_identity_migration_v1
 *                                     entitlement state — derived from RevenueCat
 *                                     and the App Store receipt, never from a backup
 *   @daily_paths_journal_migrations   migration high-water mark. Excluded on purpose:
 *                                     a backup from a pre-migration device would
 *                                     otherwise restore a "already migrated" flag and
 *                                     its entries would never migrate. Leaving it out
 *                                     lets migrations re-run, which is idempotent.
 *   @daily_paths_reading_v6_*,
 *   @daily_paths_gratitude_quote_v1_*,
 *   @daily_paths_journal_quotes_list_v1
 *                                     content caches, refetched from Supabase
 *   @daily_paths_featured_pick,
 *   @daily_paths_featured_speaker_ids date-rotation state, regenerates daily
 *   speaker_downloads                 downloaded audio files — large, redownloadable
 *   @daily_paths_first_launch_modal_seen,
 *   @daily_paths_notification_coachmark_shown,
 *   @daily_paths_bookmark_instruction_seen
 *                                     coachmarks — per-device so a new device still
 *                                     gets its own first-run guidance
 *   @daily_paths_qa_logs_v1,
 *   @daily_paths_is_developer         dev-only
 *   daily_paths_settings_v1           legacy, superseded by v2
 */

export const BACKUP_SCHEMA_VERSION = 1;

export type BackupSnapshot = {
  app: "daily-paths";
  schemaVersion: number;
  exportedAt: number;
  data: Record<string, string>;
};

// Read the allowlisted keys into a JSON backup string.
export async function serializeUserData(keys: string[] = SYNC_KEYS): Promise<string> {
  const pairs = await AsyncStorage.multiGet(keys);
  const data: Record<string, string> = {};
  for (const [k, v] of pairs) if (v != null) data[k] = v;
  const snapshot: BackupSnapshot = {
    app: "daily-paths",
    schemaVersion: BACKUP_SCHEMA_VERSION,
    exportedAt: Date.now(),
    data,
  };
  return JSON.stringify(snapshot);
}

// Restore a backup string into AsyncStorage, overwriting the allowlisted keys
// present in it. Returns the count written. The app should reload afterwards so
// every hook re-reads storage on mount.
export async function restoreUserData(
  json: string,
  allowed: string[] = SYNC_KEYS,
): Promise<number> {
  let snapshot: any;
  try {
    snapshot = JSON.parse(json);
  } catch {
    throw new Error("That doesn't look like a backup (not valid JSON).");
  }
  if (!snapshot || snapshot.app !== "daily-paths" || typeof snapshot.data !== "object") {
    throw new Error("That isn't a Daily Paths backup.");
  }
  const entries = Object.entries(snapshot.data).filter(
    ([k, v]) => allowed.includes(k) && typeof v === "string",
  ) as [string, string][];
  if (entries.length === 0) throw new Error("The backup had no recognizable data.");

  await AsyncStorage.multiSet(entries);
  return entries.length;
}

// How many allowlisted keys currently hold data (for the Backup screen summary).
export async function countStoredItems(): Promise<number> {
  const pairs = await AsyncStorage.multiGet(SYNC_KEYS);
  return pairs.filter(([, v]) => v != null).length;
}
