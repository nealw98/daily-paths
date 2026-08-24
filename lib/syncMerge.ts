export const SYNC_SCHEMA_VERSION = 2;

export const SYNC_DATA_KEYS = [
  "@daily_paths_local_journal",
  "@daily_paths_gratitude_entries",
  "@daily_paths_personal_prayers_v1",
  "@daily_paths_builtin_prayer_overrides_v1",
  "@daily_paths_hidden_builtin_prayers_v1",
  "@daily_paths_bookmarks",
  "@daily_paths_speaker_progress",
] as const;

export type SyncDataKey = (typeof SYNC_DATA_KEYS)[number];

export type SyncClock = {
  changedAt: number;
  origin: string;
  deleted: boolean;
  hash: string;
};

export type SyncClocks = Record<string, Record<string, SyncClock>>;

export type SyncSnapshot = {
  app: "daily-paths";
  schemaVersion: 2;
  deviceId: string;
  exportedAt: number;
  data: Record<string, string>;
  clocks: SyncClocks;
};

type NormalizedRecords = Record<string, unknown>;
type StorageKind = "array" | "map" | "set" | "scalar";

const SCALAR_ID = "__value__";

const kinds: Record<SyncDataKey, StorageKind> = {
  "@daily_paths_local_journal": "array",
  "@daily_paths_gratitude_entries": "array",
  "@daily_paths_personal_prayers_v1": "array",
  "@daily_paths_builtin_prayer_overrides_v1": "map",
  "@daily_paths_hidden_builtin_prayers_v1": "set",
  "@daily_paths_bookmarks": "array",
  "@daily_paths_speaker_progress": "map",
};

function stableValue(value: unknown): unknown {
  if (Array.isArray(value)) return value.map(stableValue);
  if (value && typeof value === "object") {
    return Object.fromEntries(
      Object.entries(value as Record<string, unknown>)
        .sort(([a], [b]) => a.localeCompare(b))
        .map(([key, child]) => [key, stableValue(child)]),
    );
  }
  return value;
}

export function stableJson(value: unknown): string {
  return JSON.stringify(stableValue(value));
}

function parseStored(raw: string | undefined): unknown {
  if (raw == null) return undefined;
  try {
    return JSON.parse(raw);
  } catch {
    return undefined;
  }
}

function recordId(key: SyncDataKey, value: unknown): string | null {
  if (!value || typeof value !== "object") return null;
  const record = value as Record<string, unknown>;
  if (key === "@daily_paths_bookmarks") {
    return typeof record.date === "string" ? record.date : null;
  }
  return typeof record.id === "string" ? record.id : null;
}

export function normalizeStoredValue(key: SyncDataKey, raw: string | undefined): NormalizedRecords {
  const parsed = parseStored(raw);
  const kind = kinds[key];
  if (kind === "scalar") return parsed === undefined ? {} : { [SCALAR_ID]: parsed };
  if (kind === "set") {
    if (!Array.isArray(parsed)) return {};
    return Object.fromEntries(parsed.filter((id): id is string => typeof id === "string").map((id) => [id, id]));
  }
  if (kind === "map") {
    return parsed && typeof parsed === "object" && !Array.isArray(parsed)
      ? (parsed as Record<string, unknown>)
      : {};
  }
  if (!Array.isArray(parsed)) return {};
  const records: NormalizedRecords = {};
  for (const value of parsed) {
    const id = recordId(key, value);
    if (id) records[id] = value;
  }
  return records;
}

function sortArray(key: SyncDataKey, values: unknown[]): unknown[] {
  if (key === "@daily_paths_local_journal") {
    return values.sort((a: any, b: any) =>
      String(b?.created_at ?? "").localeCompare(String(a?.created_at ?? "")) ||
      String(a?.id ?? "").localeCompare(String(b?.id ?? "")),
    );
  }
  if (key === "@daily_paths_gratitude_entries") {
    return values.sort((a: any, b: any) =>
      String(b?.date ?? "").localeCompare(String(a?.date ?? "")) ||
      String(a?.id ?? "").localeCompare(String(b?.id ?? "")),
    );
  }
  if (key === "@daily_paths_bookmarks") {
    return values.sort((a: any, b: any) =>
      Number(b?.timestamp ?? 0) - Number(a?.timestamp ?? 0) ||
      String(a?.date ?? "").localeCompare(String(b?.date ?? "")),
    );
  }
  if (key === "@daily_paths_personal_prayers_v1") {
    return values.sort((a: any, b: any) =>
      String(a?.createdAt ?? "").localeCompare(String(b?.createdAt ?? "")) ||
      String(a?.id ?? "").localeCompare(String(b?.id ?? "")),
    );
  }
  return values;
}

export function denormalizeStoredValue(key: SyncDataKey, records: NormalizedRecords): string | undefined {
  const kind = kinds[key];
  if (kind === "scalar") {
    return Object.prototype.hasOwnProperty.call(records, SCALAR_ID)
      ? JSON.stringify(records[SCALAR_ID])
      : undefined;
  }
  if (kind === "set") return JSON.stringify(Object.keys(records).sort());
  if (kind === "map") return JSON.stringify(records);
  return JSON.stringify(sortArray(key, Object.values(records)));
}

function intrinsicTimestamp(value: unknown): number {
  if (!value || typeof value !== "object") return 0;
  const record = value as Record<string, unknown>;
  for (const field of ["updated_at", "updatedAt", "timestamp", "created_at", "createdAt"]) {
    const candidate = record[field];
    const parsed = typeof candidate === "number" ? candidate : Date.parse(String(candidate ?? ""));
    if (Number.isFinite(parsed) && parsed > 0) return parsed;
  }
  return 0;
}

function nextTimestamp(base: number, offset: number): number {
  return Math.max(1, base + offset);
}

export function buildLocalSnapshot(args: {
  deviceId: string;
  data: Record<string, string>;
  previousClocks?: SyncClocks;
  now?: number;
  bootstrapAt?: number;
}): SyncSnapshot {
  const now = args.now ?? Date.now();
  const bootstrapAt = args.bootstrapAt ?? now;
  const clocks: SyncClocks = {};
  let changeOffset = 0;

  for (const key of SYNC_DATA_KEYS) {
    const current = normalizeStoredValue(key, args.data[key]);
    const previous = args.previousClocks?.[key] ?? {};
    const mergedKeyClocks: Record<string, SyncClock> = {};
    const ids = new Set([...Object.keys(current), ...Object.keys(previous)]);

    for (const id of ids) {
      const hasValue = Object.prototype.hasOwnProperty.call(current, id);
      const prior = previous[id];
      if (hasValue) {
        const hash = stableJson(current[id]);
        if (prior && !prior.deleted && prior.hash === hash) {
          mergedKeyClocks[id] = prior;
        } else {
          changeOffset += 1;
          mergedKeyClocks[id] = {
            changedAt: prior
              ? nextTimestamp(now, changeOffset)
              : Math.max(intrinsicTimestamp(current[id]), nextTimestamp(bootstrapAt, changeOffset)),
            origin: args.deviceId,
            deleted: false,
            hash,
          };
        }
      } else if (prior) {
        if (prior.deleted) {
          mergedKeyClocks[id] = prior;
        } else {
          changeOffset += 1;
          mergedKeyClocks[id] = {
            changedAt: nextTimestamp(now, changeOffset),
            origin: args.deviceId,
            deleted: true,
            hash: prior.hash,
          };
        }
      }
    }
    clocks[key] = mergedKeyClocks;
  }

  return {
    app: "daily-paths",
    schemaVersion: SYNC_SCHEMA_VERSION,
    deviceId: args.deviceId,
    exportedAt: now,
    data: { ...args.data },
    clocks,
  };
}

function compareClock(a: SyncClock, b: SyncClock): number {
  if (a.changedAt !== b.changedAt) return a.changedAt - b.changedAt;
  if (a.deleted !== b.deleted) return a.deleted ? 1 : -1;
  return a.origin.localeCompare(b.origin);
}

export function mergeSnapshots(snapshots: SyncSnapshot[], deviceId: string, now = Date.now()): SyncSnapshot {
  const data: Record<string, string> = {};
  const clocks: SyncClocks = {};

  for (const key of SYNC_DATA_KEYS) {
    const winners: Record<string, { clock: SyncClock; value?: unknown }> = {};
    for (const snapshot of snapshots) {
      const records = normalizeStoredValue(key, snapshot.data[key]);
      for (const [id, clock] of Object.entries(snapshot.clocks[key] ?? {})) {
        if (!clock.deleted && !Object.prototype.hasOwnProperty.call(records, id)) continue;
        const current = winners[id];
        if (!current || compareClock(clock, current.clock) > 0) {
          winners[id] = {
            clock,
            value: clock.deleted ? undefined : records[id],
          };
        }
      }
    }

    const live: NormalizedRecords = {};
    const keyClocks: Record<string, SyncClock> = {};
    for (const [id, winner] of Object.entries(winners)) {
      if (!winner.clock.deleted && winner.value === undefined) continue;
      keyClocks[id] = winner.clock;
      if (!winner.clock.deleted) live[id] = winner.value;
    }
    clocks[key] = keyClocks;
    const raw = denormalizeStoredValue(key, live);
    if (raw !== undefined) data[key] = raw;
  }

  return {
    app: "daily-paths",
    schemaVersion: SYNC_SCHEMA_VERSION,
    deviceId,
    exportedAt: now,
    data,
    clocks,
  };
}

export function upgradeSnapshot(value: unknown, fallbackOrigin: string): SyncSnapshot | null {
  if (!value || typeof value !== "object") return null;
  const raw = value as Record<string, unknown>;
  if (raw.app !== "daily-paths" || !raw.data || typeof raw.data !== "object") return null;
  if (raw.schemaVersion === SYNC_SCHEMA_VERSION && raw.clocks && typeof raw.clocks === "object") {
    return raw as unknown as SyncSnapshot;
  }
  const exportedAt = Number(raw.exportedAt) || 1;
  return buildLocalSnapshot({
    deviceId: fallbackOrigin,
    data: raw.data as Record<string, string>,
    now: exportedAt,
    bootstrapAt: exportedAt,
  });
}

export function syncDataEqual(a: Record<string, string>, b: Record<string, string>): boolean {
  for (const key of SYNC_DATA_KEYS) {
    if (stableJson(normalizeStoredValue(key, a[key])) !== stableJson(normalizeStoredValue(key, b[key]))) {
      return false;
    }
  }
  return true;
}
