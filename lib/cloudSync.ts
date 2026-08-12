// Cloud sync — automatic backup and restore of the user's data as one JSON file
// in their own private cloud, via react-native-cloud-storage (file-based, so no
// key-value size cap). iOS = the app's iCloud container (no sign-in needed);
// Android = Google Drive's hidden appDataFolder (one Google sign-in, from the
// Backup screen — see lib/googleDriveAuth.ts).
//
// Whole-snapshot last-write-wins by the snapshot's embedded `exportedAt`. This
// is backup/restore, not field-level merge: the newer snapshot wins entirely.
// Good enough for "don't lose my journal" and for a user moving to a new phone;
// it is NOT a live multi-device sync and two devices edited in the same session
// will not merge.
import { Platform } from "react-native";
import AsyncStorage from "@react-native-async-storage/async-storage";
import { serializeUserData, restoreUserData } from "./userDataSync";
import { getDriveAccessToken, driveAuthSupported } from "./googleDriveAuth";
import { qaLog } from "../utils/qaLog";

// Defensive require: on a binary without the native module (e.g. an OTA landing
// on an older build) this would throw at import time and take the app down.
// Degrade to no-ops instead; the feature activates once the app is rebuilt.
let CloudStorage: any = null;
try {
  CloudStorage = require("react-native-cloud-storage").CloudStorage;
} catch {
  CloudStorage = null;
}

const FILE = "/daily-paths-backup.json";
const LOCAL_AT = "@daily_paths_cloud_last_sync"; // this device's last-synced snapshot timestamp
const PAUSED = "@daily_paths_cloud_sync_paused"; // set during a local "clear all data" reset

// User-facing name of this platform's cloud.
export const CLOUD_NAME = Platform.OS === "ios" ? "iCloud" : "Google Drive";

export function cloudBackupSupported(): boolean {
  if (!CloudStorage) return false;
  if (Platform.OS === "ios") return true;
  return driveAuthSupported();
}

// Ready the provider for a call. iOS needs nothing; Android must set a fresh
// Drive access token first. Auto sync passes interactive=false so it silently
// no-ops until the user has connected a Google account once.
async function prepareProvider(interactive: boolean): Promise<boolean> {
  if (!cloudBackupSupported()) return false;
  if (Platform.OS === "ios") return true;
  const token = await getDriveAccessToken(interactive);
  if (!token) return false;
  CloudStorage.setProviderOptions({ accessToken: token });
  return true;
}

// While paused, auto push/pull no-op. Used by a local reset so it can't (a)
// clobber the cloud backup with an empty snapshot on the next background, or
// (b) get instantly re-restored by the launch/foreground pull. A manual restore
// or backup clears it. Plain AsyncStorage so it works even without the module.
export async function isSyncPaused(): Promise<boolean> {
  try {
    return (await AsyncStorage.getItem(PAUSED)) === "1";
  } catch {
    return false;
  }
}

export async function setSyncPaused(paused: boolean): Promise<void> {
  try {
    if (paused) await AsyncStorage.setItem(PAUSED, "1");
    else await AsyncStorage.removeItem(PAUSED);
  } catch {
    /* ignore */
  }
}

// Whether the cloud is reachable (iCloud signed in / Google account connected).
// Best-effort, for the UI.
export async function cloudAvailable(): Promise<boolean> {
  if (!cloudBackupSupported()) return false;
  try {
    if (Platform.OS === "ios") return !!(await CloudStorage.isCloudAvailable());
    return !!(await getDriveAccessToken(false));
  } catch {
    return false;
  }
}

// When this device last synced, or null if never.
export async function lastSyncedAt(): Promise<Date | null> {
  try {
    const raw = await AsyncStorage.getItem(LOCAL_AT);
    const n = Number(raw);
    return raw && Number.isFinite(n) && n > 0 ? new Date(n) : null;
  } catch {
    return null;
  }
}

// Upload this device's current data to the cloud (best-effort). A manual
// "Back up now" passes interactive=true so Android can show the account picker.
export async function pushToCloud(interactive = false): Promise<boolean> {
  if (await isSyncPaused()) return false; // don't overwrite the backup mid-reset
  if (!(await prepareProvider(interactive))) return false;
  try {
    const json = await serializeUserData();
    await CloudStorage.writeFile(FILE, json);
    const at = Number(JSON.parse(json)?.exportedAt ?? Date.now());
    await AsyncStorage.setItem(LOCAL_AT, String(at));
    qaLog("backup", "Pushed to cloud", { cloud: CLOUD_NAME, bytes: json.length });
    return true;
  } catch (err) {
    qaLog("backup", "Push failed", { error: String(err) });
    return false;
  }
}

// Restore from the cloud. Auto callers (launch/foreground) pass force=false: it
// restores only if the cloud copy is newer and sync isn't paused. A manual
// "Restore" passes force=true, bypassing the newer-than gate and the pause so
// the user can always pull their backup on demand (and, on Android, may sign in
// interactively). Returns true if data was restored — the caller should reload.
export async function pullFromCloud(force = false): Promise<boolean> {
  if (!force && (await isSyncPaused())) return false;
  if (!(await prepareProvider(force))) return false;
  try {
    if (!(await CloudStorage.exists(FILE))) return false;
    const json = await CloudStorage.readFile(FILE);
    if (!json) return false;
    const cloudAt = Number(JSON.parse(json)?.exportedAt ?? 0);
    const localAt = Number((await AsyncStorage.getItem(LOCAL_AT)) ?? 0);
    if (!force && cloudAt <= localAt) return false;
    const count = await restoreUserData(json);
    await AsyncStorage.setItem(LOCAL_AT, String(cloudAt));
    await setSyncPaused(false); // a successful restore resumes normal sync
    qaLog("backup", "Restored from cloud", { cloud: CLOUD_NAME, keys: count, force });
    return true;
  } catch (err) {
    qaLog("backup", "Pull failed", { error: String(err) });
    return false;
  }
}

// Delete the backup file from the user's cloud. The local data is untouched.
export async function deleteCloudBackup(): Promise<boolean> {
  if (!(await prepareProvider(true))) return false;
  try {
    if (await CloudStorage.exists(FILE)) await CloudStorage.unlink(FILE);
    await AsyncStorage.removeItem(LOCAL_AT);
    qaLog("backup", "Deleted cloud backup", { cloud: CLOUD_NAME });
    return true;
  } catch (err) {
    qaLog("backup", "Delete failed", { error: String(err) });
    return false;
  }
}
