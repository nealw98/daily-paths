# Android try-before-you-buy — QA testing guide

Step-by-step cases for **QA Diagnostics** (production or preview Android builds). Reach QA from **long-press on Settings** or the **Settings developer entry**.

---

## 1. Prerequisites

- Android device or emulator with a build that includes QA Diagnostics.
- Turn **Developer mode** **ON** in QA when you want usage excluded from Mixpanel (`is_developer`).
- Copy your **RevenueCat App User ID** from the QA header (tap the line) when you need to look up or edit a customer in the RevenueCat dashboard.
- Optional: Supabase access to **Edge Function logs** for `grant-grandfather-lifetime` when debugging grandfather.

---

## 2. How the app decides access (read this first)

| Concept | What it means | Where it comes from |
|--------|----------------|---------------------|
| **App gate** | **FULL ACCESS** or **PAYWALL** (tabs may be hidden on PAYWALL). | Local **3-day trial** active **or** RevenueCat says subscribed (`unlimited` / `lifetime`), via `getSubscriptionStatus()`. QA **Force NOT subscribed** makes RC look “not subscribed” for that check only. See `utils/accessControl.ts`. |
| **Access States** (Subscription / Lifetime rows) | Green checkmarks = **real** RevenueCat entitlements. | `getRawEntitlements()` — not affected by “Force NOT subscribed”. You can see **Lifetime ✓** in the panel and still have **gate PAYWALL** if the override is on and trial is expired. |
| **Grandfather grant** | Server may attach **`lifetime`** in RC for **legacy** Android identities. | App calls `grant-grandfather-lifetime` once per “attempt cycle” (see §4). Not driven by trial on/off in QA. |

---

## 3. User cases — expected results and QA steps

Use the **Android: gate and overrides** and **Access States** sections on the QA screen while you run these.

### 3.1 First-time app user

| | |
|--|--|
| **User case** | Install (or clear data) and open the app for the first time; no prior local trial timestamp. |
| **Expected result** | **FULL ACCESS** for the **3-day** local preview from first open. RevenueCat may show no subscription until the SDK runs. After the preview ends and RC still shows no entitlement → **PAYWALL** (hard paywall / RC paywall). |
| **QA / device steps** | 1. Turn **Force NOT subscribed** **OFF** (if it was on, the app reloads when you clear it). 2. Optional: **Reset trial**, then **fully kill the app and reopen** so a clean trial start is obvious. 3. Confirm **gate FULL ACCESS** and trial copy shows remaining days (or use **Show trial status**). 4. To test paywall later: **Expire trial**; if RC still grants access, turn **Force NOT subscribed** **ON** (reload), then expire trial again. |

### 3.2 Free trial user (local 3-day trial active)

| | |
|--|--|
| **User case** | User is inside the AsyncStorage-backed trial window (`isInTrial` true). |
| **Expected result** | **FULL ACCESS** even if RevenueCat has no active subscription — trial alone unlocks the app. |
| **QA / device steps** | 1. **Show trial status** — confirm `isInTrial: true`. 2. Keep **Force NOT subscribed** off unless you intentionally want to combine with other tests. 3. **Refresh from RevenueCat** only updates the entitlement panel; it does not end the trial. |

### 3.3 Free user (no subscription, no trial)

| | |
|--|--|
| **User case** | Local trial **expired** (or never in trial and not entitled); RevenueCat has no `unlimited` / `lifetime` (or override forces “not subscribed”). |
| **Expected result** | **Gate PAYWALL**. Unless a **grandfather** (or other RC) grant applies, the user should not reach tabs until they purchase or restore. |
| **QA / device steps** | 1. **Expire trial** (after clearing override if you need RC truth for gate). 2. **Refresh from RevenueCat**. 3. Expect **PAYWALL** and, on cold path, RC paywall presentation when gated. |

---

## 4. Grandfather — how to test it (three tracks)

**Critical:** A **real** grandfather grant is **not** produced by trial toggles alone. The Supabase edge function `grant-grandfather-lifetime` grants only when **all** of the following hold (server-side, see `supabase/functions/grant-grandfather-lifetime/index.ts`):

1. A **RevenueCat subscriber** exists for the current `app_user_id`.
2. `subscriber.first_seen` is **strictly before** `GRANDFATHER_CUTOFF_DATE` (edge env).
3. The subscriber has **no active** `lifetime` or `unlimited` entitlement at grant time.

The app (`lib/grandfather.ts`) **skips** calling the edge function if `unlimited` or `lifetime` is already active (and marks attempted). After **any** response from the edge (grant or deny), it sets **`@daily_paths_grandfather_attempted`** so the server is **not** called again until you use QA **Reset Grandfather state**.

### Track A — Real grant (integration / staging RC user)

**Goal:** Prove end-to-end promotional `lifetime` in RC for an **eligible** legacy identity.

1. In **RevenueCat**, use a customer whose **`first_seen`** is **before** the cutoff configured on the edge function (or create a test project / sandbox user that matches your policy).
2. Ensure that customer has **no** active `unlimited` / `lifetime` when you want the grant to run (or use a fresh anonymous ID that still resolves to an eligible subscriber — usually you work with a known test `app_user_id`).
3. Open **QA Diagnostics** → **Reset Grandfather state** (clears attempted + modal pending flags).
4. **Kill the app completely** and reopen (cold start runs RC init → grandfather attempt).
5. **Expected:** QA logs show `grandfather` / `subscription` messages; **Access States** eventually show **Lifetime**; **gate FULL ACCESS**. **Modal B** (grandfather welcome) may appear once if the app set the modal-pending flag on grant.
6. **Failure reasons to verify in RC / edge logs:** `post_cutoff` (new user), `subscriber_not_found`, `already_entitled`, `rc_lookup_failed`. After a denied run, use **Reset Grandfather state** before the next attempt.

### Track B — Modal B UI only (no server grant)

**Goal:** Verify copy and layout without changing RC.

1. **Preview Modal B (Grandfathered)** — instant UI preview; does not call the server.
2. Or **Prime Modal B pending** — sets local flags so the **real** presenter can fire on next launch **without** a grant in RC (wiring test only). Do not confuse this with Track A success in RC.

### Track C — Retry after an ineligible or failed run

If the edge returned `granted: false` or errored, the app still sets **attempted** — the edge will **not** be called again on every launch.

1. Fix RC test data or cutoff as needed **outside** the app.
2. QA → **Reset Grandfather state**.
3. Kill app and reopen to invoke the edge function again.

---

## 5. Mapping phrases to product behavior

| Phrase | Meaning | Can you simulate with QA alone? |
|--------|---------|--------------------------------|
| **Free trial users → grandfathered** | Legacy **RevenueCat** identity (pre-cutoff) with no entitlement gets promotional `lifetime` when the edge runs — **same server rules** whether they were in a local trial or not on the device. | **No** for the real grant — you need an eligible RC `first_seen`. Trial toggles do not change `first_seen`. |
| **Free users (no subscription, no trial) → grandfathered** | Same as above: eligibility is **RC + cutoff**, not “trial expired” in the app. | **No** for the real grant — same as Track A. |
| **First-time app users** | New SDK identity → `first_seen` typically **on or after** cutoff → **`post_cutoff`** → **no** grandfather. They get the **3-day local trial**, then paywall if unpurchased. | **Yes** for trial/paywall path. **Do not** expect grandfather unless RC data was intentionally seeded (e.g. identity migration) to look pre-cutoff. |

---

## 6. Quick reference — QA controls used in this doc

| Control | Effect |
|---------|--------|
| **Show trial status** | AsyncStorage trial snapshot (alert). |
| **Reset trial** | Clears trial start; **kill and reopen** app for a clean new trial. |
| **Expire trial** | Sets start in the past; gate should go **PAYWALL** if RC does not grant access. |
| **Force NOT subscribed** | QA override on `getSubscriptionStatus()`; **reloads app** when toggled. |
| **Refresh from RevenueCat** | Refreshes raw entitlement rows in Access States. |
| **Reset Grandfather state** | Clears attempted + modal pending; next cold start can call the edge again. |
| **Prime Modal B pending** | Local wiring for Modal B; not a real RC grant. |
| **Present RC paywall now** | Only when **gate** is already **PAYWALL**; opens RevenueCat paywall UI. |

---

## 7. Related code and docs

- Gate logic: `utils/accessControl.ts`, `contexts/SubscriptionContext.tsx`
- Trial: `utils/trialTimer.ts`
- Grandfather client: `lib/grandfather.ts`
- Grandfather server: `supabase/functions/grant-grandfather-lifetime/index.ts`
- Business requirements: `docs/daily-paths-android-try-before-buy-requirements.md`
