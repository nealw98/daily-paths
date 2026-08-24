import { Platform } from "react-native";
import AsyncStorage from "@react-native-async-storage/async-storage";
import {
  applySyncSnapshot,
  createLocalSyncSnapshot,
  getSyncDeviceId,
} from "./userDataSync";
import { mergeSnapshots, upgradeSnapshot, type SyncSnapshot } from "./syncMerge";
import { getDriveAccessToken, driveAuthSupported } from "./googleDriveAuth";
import { qaLog } from "../utils/qaLog";

let CloudStorage: any = null;
try {
  CloudStorage = require("react-native-cloud-storage").CloudStorage;
} catch {
  CloudStorage = null;
}

const LEGACY_FILE = "/daily-paths-backup.json";
const SYNC_DIRECTORY = "/daily-paths-sync";
const LOCAL_AT = "@daily_paths_cloud_last_sync";
const PAUSED = "@daily_paths_cloud_sync_paused";

export const CLOUD_NAME = Platform.OS === "ios" ? "iCloud" : "Google Drive";

export type CloudSyncResult = {
  success: boolean;
  localChanged: boolean;
  cloudFileCount: number;
};

let operationTail: Promise<void> = Promise.resolve();

function serialized<T>(operation: () => Promise<T>): Promise<T> {
  const result = operationTail.then(operation, operation);
  operationTail = result.then(() => undefined, () => undefined);
  return result;
}

export function cloudBackupSupported(): boolean {
  if (!CloudStorage) return false;
  if (Platform.OS === "ios") return true;
  return driveAuthSupported();
}

async function prepareProvider(interactive: boolean): Promise<boolean> {
  if (!cloudBackupSupported()) return false;
  if (Platform.OS === "ios") return true;
  const token = await getDriveAccessToken(interactive);
  if (!token) return false;
  CloudStorage.setProviderOptions({ accessToken: token });
  return true;
}

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
    // Sync remains best-effort when local status storage is unavailable.
  }
}

export async function cloudAvailable(): Promise<boolean> {
  if (!cloudBackupSupported()) return false;
  try {
    if (Platform.OS === "ios") return !!(await CloudStorage.isCloudAvailable());
    return !!(await getDriveAccessToken(false));
  } catch {
    return false;
  }
}

export async function lastSyncedAt(): Promise<Date | null> {
  try {
    const raw = await AsyncStorage.getItem(LOCAL_AT);
    const value = Number(raw);
    return raw && Number.isFinite(value) && value > 0 ? new Date(value) : null;
  } catch {
    return null;
  }
}

async function ensureSyncDirectory(): Promise<void> {
  if (!(await CloudStorage.exists(SYNC_DIRECTORY))) {
    try {
      await CloudStorage.mkdir(SYNC_DIRECTORY);
    } catch (error) {
      // A second device/process may have created it between exists and mkdir.
      if (!(await CloudStorage.exists(SYNC_DIRECTORY))) throw error;
    }
  }
}

function parseSnapshot(json: string, origin: string): SyncSnapshot | null {
  try {
    return upgradeSnapshot(JSON.parse(json), origin);
  } catch {
    return null;
  }
}

async function readCloudSnapshots(): Promise<SyncSnapshot[]> {
  const snapshots: SyncSnapshot[] = [];

  if (await CloudStorage.exists(SYNC_DIRECTORY)) {
    const names: string[] = await CloudStorage.readdir(SYNC_DIRECTORY);
    for (const name of names.filter((candidate) => candidate.endsWith(".json"))) {
      const path = `${SYNC_DIRECTORY}/${name}`;
      try {
        if (Platform.OS === "ios") await CloudStorage.triggerSync(path);
        const parsed = parseSnapshot(await CloudStorage.readFile(path), `cloud-${name}`);
        if (parsed) snapshots.push(parsed);
      } catch (error) {
        qaLog("backup", "Skipped unreadable device sync file", { path, error: String(error) });
      }
    }
  }

  // Import the version-1 whole backup during the transition. New versions no
  // longer write this shared file, so devices cannot overwrite one another.
  try {
    if (await CloudStorage.exists(LEGACY_FILE)) {
      if (Platform.OS === "ios") await CloudStorage.triggerSync(LEGACY_FILE);
      const parsed = parseSnapshot(await CloudStorage.readFile(LEGACY_FILE), "legacy-cloud-backup");
      if (parsed) snapshots.push(parsed);
    }
  } catch (error) {
    qaLog("backup", "Legacy backup import failed", { error: String(error) });
  }

  return snapshots;
}

async function performSync(interactive: boolean, ignorePause: boolean): Promise<CloudSyncResult> {
  if (!ignorePause && (await isSyncPaused())) {
    return { success: false, localChanged: false, cloudFileCount: 0 };
  }
  if (!(await prepareProvider(interactive))) {
    return { success: false, localChanged: false, cloudFileCount: 0 };
  }

  try {
    const cloudSnapshots = await readCloudSnapshots();
    // On a device's first v2 sync, existing cloud clocks win conflicts while
    // unique unsynced local records are still added to the union.
    const bootstrapAt = cloudSnapshots.length > 0 ? 1 : Date.now();
    const localSnapshot = await createLocalSyncSnapshot(bootstrapAt);
    const deviceId = await getSyncDeviceId();
    const merged = mergeSnapshots([...cloudSnapshots, localSnapshot], deviceId);

    await ensureSyncDirectory();
    const ownFile = `${SYNC_DIRECTORY}/${deviceId}.json`;
    await CloudStorage.writeFile(ownFile, JSON.stringify(merged));
    if (Platform.OS === "ios") await CloudStorage.triggerSync(ownFile);

    // Apply only after this device's merged snapshot is durable in the cloud.
    // If the upload fails, in-memory screens and local storage remain aligned.
    const localChanged = await applySyncSnapshot(merged);
    await AsyncStorage.setItem(LOCAL_AT, String(merged.exportedAt));
    await setSyncPaused(false);
    qaLog("backup", "Cloud sync complete", {
      cloud: CLOUD_NAME,
      files: cloudSnapshots.length,
      localChanged,
    });
    return { success: true, localChanged, cloudFileCount: cloudSnapshots.length };
  } catch (error) {
    qaLog("backup", "Cloud sync failed", { error: String(error) });
    return { success: false, localChanged: false, cloudFileCount: 0 };
  }
}

/** Safe read-merge-write synchronization; all calls share one operation queue. */
export function syncWithCloud(interactive = false, ignorePause = false): Promise<CloudSyncResult> {
  return serialized(() => performSync(interactive, ignorePause));
}

/** Compatibility API used by the current manual screen. */
export async function pushToCloud(interactive = false): Promise<boolean> {
  return (await syncWithCloud(interactive)).success;
}

/** Returns true only when cloud data changed this device and the UI should reload. */
export async function pullFromCloud(force = false): Promise<boolean> {
  return (await syncWithCloud(force, force)).localChanged;
}

export function deleteCloudBackup(): Promise<boolean> {
  return serialized(async () => {
    if (!(await prepareProvider(true))) return false;
    try {
      if (await CloudStorage.exists(SYNC_DIRECTORY)) {
        await CloudStorage.rmdir(SYNC_DIRECTORY, { recursive: true });
      }
      if (await CloudStorage.exists(LEGACY_FILE)) await CloudStorage.unlink(LEGACY_FILE);
      await AsyncStorage.removeItem(LOCAL_AT);
      // A deliberate delete remains deleted until the user explicitly resumes
      // with Sync/Back up now; backgrounding must not immediately recreate it.
      await setSyncPaused(true);
      qaLog("backup", "Deleted cloud sync data", { cloud: CLOUD_NAME });
      return true;
    } catch (error) {
      qaLog("backup", "Delete failed", { error: String(error) });
      return false;
    }
  });
}
