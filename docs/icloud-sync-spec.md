# iCloud Multi-Device Sync — Design Spec

Status: **Draft / not yet implemented**
Branch: `2.7.1-icloud`
Platform: **iOS only** (CloudKit is Apple-only; Android keeps on-device-only storage)
Delivery: **Native EAS build only — never OTA** (requires entitlements + a native module)

## Goal

Let a user's journaling data follow them across their own Apple devices (iPhone ↔ iPad ↔ Mac) and survive reinstall, using the device's signed-in Apple ID. **No separate Daily Paths account** — the data lives in the user's private iCloud (CloudKit private database).

Two user types, one system:

| User type | Need | How this serves them |
|---|---|---|
| Restore-only | "I got a new phone / reinstalled — don't lose my journal." | Fresh install pulls the full CloudKit zone → complete restore. |
| Daily interchangeable | "I journal on iPad in the morning, iPhone at night." | Live delta sync + silent push → near-real-time across devices. |

The restore-only experience is a **subset** of live sync, so building live sync covers both.

## Strategy / monetization

Live multi-device sync is positioned as a premium offer ("use Daily Paths on all your devices"). **Recommendation: gate continuous multi-device sync behind the paywall, but keep restore-on-reinstall available to everyone** — losing-then-recovering your own data is a data-safety expectation; gating it invites "the app lost my journal" reviews. The paywall should sit on *ongoing sync*, not on *getting your data back*.

## Why CloudKit (not the flat backup file)

An earlier plan used a single JSON file in the iCloud Documents container. That covers backup/restore but **cannot deliver daily interchangeability**: no efficient deltas, no push, last-writer-wins clobbering, and deletions don't propagate (an additive merge re-adds deleted entries). CloudKit's private database solves all four:

- **Change tokens** → fetch only what changed (efficient delta sync).
- **Silent push subscriptions** → the other device updates within seconds.
- **Per-record change tags** → real conflict detection, not blind last-writer-wins.
- **Native deletes** → deleting on one device deletes everywhere.

## Architecture: offline-first

The **local AsyncStorage store stays the source of truth for the UI** — the app remains instant and fully usable offline. A background **sync engine** reconciles the local store against the CloudKit private database. CloudKit is the cross-device transport, not the live read path.

```
UI  ──reads/writes──▶  Local store (AsyncStorage, offline-first)
                              │  mutations recorded in a change/dirty queue
                              ▼
                       Sync engine (TS)  ◀──triggers: foreground, background, push, debounced edit
                              │  push dirty up / pull deltas down / resolve conflicts
                              ▼
                 Native CloudKit module (Swift)
                              │
                              ▼
                CKContainer.privateCloudDatabase (custom zone)
```

## Data in scope

Source: on-device storage inventory. Only user-generated/meaningful content syncs; caches and device-specific state do not.

### Synced record types (CloudKit record type ⇄ AsyncStorage key)

| Record type | AsyncStorage key | Notes |
|---|---|---|
| `JournalEntry` | `@daily_paths_local_journal` | Already has `id`, `created_at`, `updated_at`. |
| `PersonalPrayer` | `@daily_paths_personal_prayers_v1` | Needs `updatedAt` + soft-delete added. |
| `GratitudeEntry` | `@daily_paths_gratitude_entries` | Needs `updatedAt` + soft-delete added. |
| `Bookmark` | `@daily_paths_bookmarks` | Needs `updatedAt` + soft-delete added. |
| `Settings` | `daily_paths_settings_v2` | Single record; field-level or last-writer-wins. **Decision pending: sync or keep per-device.** |
| `SpeakerProgress` | `@daily_paths_speaker_progress` | Resume positions/completion. **Decision pending: sync or keep per-device.** |

### Explicitly NOT synced (regenerable or device-specific)

- Reading cache (`@daily_paths_reading_v6_*`), journal/gratitude quote caches — regenerable from Supabase.
- Downloaded speaker audio files + `speaker_downloads` metadata — large, redownloadable.
- Device identity (`@daily_paths_device_id`) — must stay per-device.
- Lifetime/subscription caches, subscription override — derived state.
- Trial timer — Android-only anyway.
- Rating/share counters, coachmark flags — optional; default to per-device (not synced) to avoid surprising "already seen" states on a new device.

## Decisions still open

1. **Paywall boundary** — confirm: live sync = premium, restore-on-reinstall = free for all. (Recommended.)
2. **Settings + speaker progress** — sync them, or keep per-device? (Leaning: sync settings, keep speaker progress per-device, but TBD.)
3. Counters/coachmarks — confirm not synced.

---

## Phases

### Phase 0 — Provisioning & schema (mostly ops, requires Apple Developer access)
- Enable **CloudKit** capability; create container `iCloud.com.nealwagner.dailypaths`.
- Define record types in the **CloudKit Dashboard** (see table above).
- **Expo config plugin** to inject entitlements: iCloud container + `CloudKit` service, `aps-environment`, and the `remote-notification` background mode.
- ⚠️ CloudKit has separate **Development vs Production** schema environments. Promoting the schema to Production before App Store release is mandatory and easy to forget.

### Phase 1 — Make local data syncable (highest-touch refactor; the foundation)
- Every syncable record gets: stable `id`, `updatedAt`, and a **soft-delete (tombstone) flag**. Journal already has id/updated_at; prayers, gratitude, bookmarks need normalizing (with migrations).
- Introduce a **syncable-store abstraction** that all storage hooks (`useJournalStorage`, `usePersonalPrayers`, gratitude, `useBookmarkManager`, settings, speaker progress) route mutations through. It records a **change/dirty queue** and caches each record's CloudKit system fields (`recordChangeTag`).

### Phase 2 — Native CloudKit module (Swift)
- New local module `modules/icloud-sync/`, modeled on `modules/paid-app-detector`. Wraps `CKContainer.privateCloudDatabase` in a **custom record zone** (required for change tokens + subscriptions).
- JS surface:
  - `accountStatus()`
  - `setupZoneAndSubscription()`
  - `saveRecords(batch)` / `deleteRecords(ids)`
  - `fetchChanges(sinceToken)` → `{ changed, deleted, newToken }`
  - JSON ⇄ CKRecord mapping, preserving `recordChangeTag` for conflict detection.
- Android: no-op stub (module returns unavailable).

### Phase 3 — Sync engine (TypeScript)
- **Push** dirty local records up; on stale-tag rejection, merge and retry.
- **Pull** remote deltas via change token; merge into local store; UI updates reactively.
- **Conflict policy**: field-level merge where sensible; otherwise last-writer-wins by `updatedAt`; **deletes win over edits**.
- **Triggers**: app foreground, app background (flush), silent push received, debounced after local edits.
- **Bootstrap vs delta**: first run pulls the full zone; thereafter token deltas only.

### Phase 4 — Near-real-time push
- `CKDatabaseSubscription` + silent (`content-available`) remote notifications, handled in a background notification handler that kicks the sync engine. This makes "close iPhone, open iPad, it's there" feel instant instead of poll-based.

### Phase 5 — Account states & restore/onboarding
- **Fresh install / reinstall / new device** → detect iCloud account, pull the whole zone → full restore (the restore-only user type, automatic).
- Handle: **not signed into iCloud**, iCloud disabled for the app, **account changed** (different Apple ID → clear local synced data so one user's journal never bleeds into another's), storage-full.

### Phase 6 — Settings UI, status & gating
- iCloud Sync section in `app/(tabs)/more.tsx` (iOS-only): status, last-synced time, "Sync now", clear account-state messaging, errors.
- Apply the paywall boundary from the decision above.

### Phase 7 — Conflict & edge-case hardening
- Concurrent same-entry edits, delete-vs-edit races, clock skew, large initial syncs, partial-batch failures + retry/backoff, durability of the offline queue across app kills.

### Phase 8 — QA & rollout
- QA-panel affordances (`app/qa-logs.tsx`): force sync, inspect change token, simulate conflict, reset sync state, account override.
- **Two real devices on one Apple ID** — the CloudKit simulator is unreliable; test on hardware.
- Promote schema to Production, cut a new **native EAS build**, phased rollout.

## Relative effort

- **Phases 1–3** are the bulk (data refactor + sync engine).
- Phases 0, 4, 6 are moderate.
- Multi-session feature, not a one-shot.

## Risks / constraints

- **iOS-only** — no Android cross-device sync from this. A future Android multi-device story would be a separate Supabase-based effort.
- **Native build only**, never OTA — and it touches purchase-critical paths, so QA must be careful.
- **Account isolation** — getting "account changed" handling wrong could leak one user's journal onto another device. High-priority correctness item.
- **Schema environment promotion** — forgetting to promote Dev→Prod schema breaks sync for all production users silently.
