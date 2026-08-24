import test from "node:test";
import assert from "node:assert/strict";
import {
  buildLocalSnapshot,
  mergeSnapshots,
  normalizeStoredValue,
  upgradeSnapshot,
} from "../lib/syncMerge.ts";

const JOURNAL = "@daily_paths_local_journal";
const BOOKMARKS = "@daily_paths_bookmarks";

function journal(id: string, content: string, updatedAt: string) {
  return {
    id,
    user_id: "local",
    entry_type: "journal",
    content,
    structured_content: null,
    created_at: updatedAt,
    updated_at: updatedAt,
  };
}

test("merges independent additions from two devices", () => {
  const a = buildLocalSnapshot({
    deviceId: "iphone",
    data: { [JOURNAL]: JSON.stringify([journal("a", "Phone", "2026-08-24T10:00:00Z")]) },
    now: Date.parse("2026-08-24T10:00:01Z"),
  });
  const b = buildLocalSnapshot({
    deviceId: "ipad",
    data: { [JOURNAL]: JSON.stringify([journal("b", "Tablet", "2026-08-24T10:01:00Z")]) },
    now: Date.parse("2026-08-24T10:01:01Z"),
  });

  const merged = mergeSnapshots([a, b], "iphone", Date.parse("2026-08-24T10:02:00Z"));
  const records = normalizeStoredValue(JOURNAL, merged.data[JOURNAL]);
  assert.deepEqual(Object.keys(records).sort(), ["a", "b"]);
});

test("newer edit of the same record wins", () => {
  const original = buildLocalSnapshot({
    deviceId: "iphone",
    data: { [JOURNAL]: JSON.stringify([journal("shared", "Original", "2026-08-24T10:00:00Z")]) },
    now: Date.parse("2026-08-24T10:00:01Z"),
  });
  const edited = buildLocalSnapshot({
    deviceId: "ipad",
    data: { [JOURNAL]: JSON.stringify([journal("shared", "Edited", "2026-08-24T10:03:00Z")]) },
    previousClocks: original.clocks,
    now: Date.parse("2026-08-24T10:03:01Z"),
  });

  const merged = mergeSnapshots([original, edited], "iphone");
  const records = normalizeStoredValue(JOURNAL, merged.data[JOURNAL]) as Record<string, any>;
  assert.equal(records.shared.content, "Edited");
});

test("a deletion tombstone beats a stale device copy", () => {
  const original = buildLocalSnapshot({
    deviceId: "iphone",
    data: { [JOURNAL]: JSON.stringify([journal("gone", "Delete me", "2026-08-24T10:00:00Z")]) },
    now: Date.parse("2026-08-24T10:00:01Z"),
  });
  const deleted = buildLocalSnapshot({
    deviceId: "iphone",
    data: { [JOURNAL]: "[]" },
    previousClocks: original.clocks,
    now: Date.parse("2026-08-24T10:05:00Z"),
  });

  const merged = mergeSnapshots([original, deleted], "ipad");
  assert.deepEqual(normalizeStoredValue(JOURNAL, merged.data[JOURNAL]), {});
  assert.equal(merged.clocks[JOURNAL].gone.deleted, true);
});

test("a fresh empty installation cannot erase cloud content", () => {
  const cloud = buildLocalSnapshot({
    deviceId: "iphone",
    data: { [BOOKMARKS]: JSON.stringify([{ date: "2026-08-24", readingId: "24", title: "Today", timestamp: 100 }]) },
    now: 101,
  });
  const fresh = buildLocalSnapshot({ deviceId: "new-ipad", data: {}, now: 200, bootstrapAt: 1 });

  const merged = mergeSnapshots([cloud, fresh], "new-ipad", 201);
  assert.deepEqual(Object.keys(normalizeStoredValue(BOOKMARKS, merged.data[BOOKMARKS])), ["2026-08-24"]);
});

test("imports a version-one whole backup", () => {
  const legacy = {
    app: "daily-paths",
    schemaVersion: 1,
    exportedAt: 500,
    data: { [JOURNAL]: JSON.stringify([journal("legacy", "Kept", "1970-01-01T00:00:00.400Z")]) },
  };
  const upgraded = upgradeSnapshot(legacy, "legacy-file");
  assert.ok(upgraded);
  assert.equal(upgraded.schemaVersion, 2);
  assert.equal(upgraded.clocks[JOURNAL].legacy.deleted, false);
});

test("merge result is independent of cloud file order", () => {
  const a = buildLocalSnapshot({
    deviceId: "a",
    data: { [JOURNAL]: JSON.stringify([journal("a", "A", "2026-08-24T10:00:00Z")]) },
    now: Date.parse("2026-08-24T10:00:01Z"),
  });
  const b = buildLocalSnapshot({
    deviceId: "b",
    data: { [JOURNAL]: JSON.stringify([journal("b", "B", "2026-08-24T10:00:00Z")]) },
    now: Date.parse("2026-08-24T10:00:01Z"),
  });
  const first = mergeSnapshots([a, b], "x", 1);
  const second = mergeSnapshots([b, a], "x", 1);
  assert.deepEqual(first.data, second.data);
  assert.deepEqual(first.clocks, second.clocks);
});
