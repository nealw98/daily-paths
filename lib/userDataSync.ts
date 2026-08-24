import AsyncStorage from "@react-native-async-storage/async-storage";
import {
  SYNC_DATA_KEYS,
  SYNC_SCHEMA_VERSION,
  buildLocalSnapshot,
  syncDataEqual,
  upgradeSnapshot,
  type SyncClocks,
  type SyncSnapshot,
} from "./syncMerge";

/** User-owned data only. Entitlements, trials, caches and device state stay local. */
export const SYNC_KEYS: string[] = [...SYNC_DATA_KEYS];
export const BACKUP_SCHEMA_VERSION = SYNC_SCHEMA_VERSION;

const SYNC_METADATA_KEY = "@daily_paths_sync_metadata_v2";
const SYNC_DEVICE_ID_KEY = "@daily_paths_sync_device_id_v2";

function randomId(): string {
  return "xxxxxxxx-xxxx-4xxx-yxxx-xxxxxxxxxxxx".replace(/[xy]/g, (character) => {
    const random = (Math.random() * 16) | 0;
    const value = character === "x" ? random : (random & 0x3) | 0x8;
    return value.toString(16);
  });
}

export async function getSyncDeviceId(): Promise<string> {
  const existing = await AsyncStorage.getItem(SYNC_DEVICE_ID_KEY);
  if (existing) return existing;
  const created = randomId();
  await AsyncStorage.setItem(SYNC_DEVICE_ID_KEY, created);
  return created;
}

export async function readSyncData(): Promise<Record<string, string>> {
  const pairs = await AsyncStorage.multiGet(SYNC_KEYS);
  return Object.fromEntries(pairs.filter((pair): pair is [string, string] => pair[1] != null));
}

async function readSyncClocks(): Promise<SyncClocks> {
  try {
    const raw = await AsyncStorage.getItem(SYNC_METADATA_KEY);
    return raw ? (JSON.parse(raw) as SyncClocks) : {};
  } catch {
    return {};
  }
}

export async function persistSyncClocks(clocks: SyncClocks): Promise<void> {
  await AsyncStorage.setItem(SYNC_METADATA_KEY, JSON.stringify(clocks));
}

/**
 * Scans storage against the last synchronized record clocks. Changed hashes
 * receive a new clock and missing records become durable deletion tombstones.
 */
export async function createLocalSyncSnapshot(bootstrapAt?: number): Promise<SyncSnapshot> {
  const [deviceId, data, previousClocks] = await Promise.all([
    getSyncDeviceId(),
    readSyncData(),
    readSyncClocks(),
  ]);
  const snapshot = buildLocalSnapshot({ deviceId, data, previousClocks, bootstrapAt });
  await persistSyncClocks(snapshot.clocks);
  return snapshot;
}

/** Apply an exact merged view and retain tombstones for future device merges. */
export async function applySyncSnapshot(snapshot: SyncSnapshot): Promise<boolean> {
  const before = await readSyncData();
  const toSet: [string, string][] = [];
  const toRemove: string[] = [];
  for (const key of SYNC_KEYS) {
    const value = snapshot.data[key];
    if (value == null) toRemove.push(key);
    else toSet.push([key, value]);
  }
  if (toSet.length) await AsyncStorage.multiSet(toSet);
  if (toRemove.length) await AsyncStorage.multiRemove(toRemove);
  await persistSyncClocks(snapshot.clocks);
  return !syncDataEqual(before, snapshot.data);
}

/** Compatibility export for diagnostics and older callers. */
export async function serializeUserData(): Promise<string> {
  return JSON.stringify(await createLocalSyncSnapshot());
}

/** Compatibility restore; current cloud sync merges rather than force-replacing. */
export async function restoreUserData(json: string): Promise<number> {
  let parsed: unknown;
  try {
    parsed = JSON.parse(json);
  } catch {
    throw new Error("That doesn't look like a backup (not valid JSON).");
  }
  const snapshot = upgradeSnapshot(parsed, "legacy-restore");
  if (!snapshot) throw new Error("That isn't a Daily Paths backup.");
  await applySyncSnapshot(snapshot);
  return Object.keys(snapshot.data).length;
}

export async function countStoredItems(): Promise<number> {
  const pairs = await AsyncStorage.multiGet(SYNC_KEYS);
  return pairs.filter(([, value]) => value != null).length;
}
