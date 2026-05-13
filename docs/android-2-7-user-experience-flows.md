# Android 2.7 user experience flows

What each user persona actually experiences when they first launch the
2.7.0 build (versionCode 49+), traced from the code as of commit
`2b7687c`. Three personas cover the realistic install paths.

The Android-only logic lives in:

- `contexts/SubscriptionContext.tsx` — init sequence (the orchestrator)
- `lib/grandfather.ts` + `supabase/functions/grant-grandfather-lifetime/` — free-user lifetime grant
- `lib/subscriberMigration.ts` + `supabase/functions/grant-subscriber-lifetime/` — subscription-to-lifetime migration
- `lib/modalDecision.ts` + `supabase/functions/which-modal/` — server-decided one-time modal
- `utils/trialTimer.ts` + `supabase/functions/get-or-create-trial-start/` — server-anchored 3-day trial
- `app/_layout.tsx` — paywall presentation + modal presenters

## Persona 1 — Brand-new user (never had 2.6.x)

**Pre-state on the device:**
- Fresh Google account or one that has never installed Daily Paths
- No legacy marker `@daily_paths_trial_start`
- No 2.7 trial marker `@daily_paths_v27_trial_start`
- No RC entitlements
- No Supabase session in AsyncStorage

**Sequence on first launch:**

1. Native splash shows. App boots, fonts load.
2. `detectLifetimeAccess` → Android returns `false` (no paid-app detector on Android).
3. Cached subscription = none. Trial = `neverStarted: true`. Loading stays on.
4. RC initializes → fresh anonymous user_id, `first_seen` = now.
5. Migration block: no Supabase session in AsyncStorage, falls through to
   `restorePurchases()` → no purchases. Migration key saved.
6. `attemptGrandfatherGrantIfEligible()` calls the
   `grant-grandfather-lifetime` edge function:
   - No legacy marker → server: `decision_reason: missing_legacy_trial_marker`
     → **denied**
   - (RC `first_seen` is post-launch since the user was just created —
     wouldn't qualify via the fallback either.)
7. Trial-start gate: `hasLifetime=false, hasUnlimited=false` →
   `skipTrialBecauseEntitled=false` → calls `ensureTrialStarted()`.
8. `ensureTrialStarted` calls `get-or-create-trial-start` →
   server inserts a row with `trial_start_at = now`, returns
   `created: true`. `freshlyCreated=true` → fires Mixpanel
   `TRIAL_STARTED`.
9. `getTrialStatus` returns `isInTrial: true, daysRemaining: 3`.
10. `trialBefore.neverStarted === true && freshTrial.isInTrial === true`
    → reads `@daily_paths_first_launch_modal_seen` → not set →
    **shows the first-launch modal**.
11. Fresh RC status → not subscribed.
12. Cold-launch restore → no purchases.
13. Subscriber-to-lifetime check: `raw.hasUnlimited === false` → skip.
14. `fetchPendingModal` → server returns `reason: no_lifetime` → no pending
    congratulatory modal.
15. Gate: `hasLifetimeAccess=false`, but `trial.isInTrial=true` →
    `gate: "none"` → app opens.

**What the user sees:**

- Splash, then the **first-launch modal**:

  > **Welcome to Daily Paths**
  >
  > The full app is yours, free, for 3 days. After that, a one-time
  > $4.99 keeps it yours forever — no subscription, no further billing.
  >
  > [ Continue ]

- Tap Continue → modal dismissed (flag saved), app opens to tabs, full
  access.
- Days 1–3: full app.
- Day 4 (trial expired, `getTrialStatus` returns
  `trialExpired: true, isInTrial: false`): gate flips to `"paywall"` →
  hard paywall blocks the app.
- Paywall renders the `android_unlock` offering (targeted explicitly
  by `TARGET_PAYWALL_OFFERING_ID` in `app/_layout.tsx`) → $4.99 lifetime.
- User buys → RC grants `lifetime` → CustomerInfo update fires →
  status refreshes → gate flips to `"none"` → app opens.

**End state:** Has the `lifetime` entitlement. Permanent access. No
further billing.

## Persona 2 — 2.6.x user with active subscription, updating to 2.7

**Pre-state on the device:**
- 2.6.x native installed, RC `unlimited` entitlement active
- Legacy marker `@daily_paths_trial_start` from when they first opened
  2.6.x
- Supabase session in AsyncStorage (legacy from the 2.6.x auth era)
- Cached subscription status shows `isSubscribed: true`
- No 2.7 trial marker (never opened a 2.7 build before)

**Sequence on first launch after Play Store updates them to vc 49:**

1. App launches with the new binary. No OTA delta to download (vc 49
   embeds the current production OTA bundle).
2. `detectLifetimeAccess` → false.
3. Cached subscription = `isSubscribed: true` → `setStatus(cached)`.
   Loading turns off because the cache shows subscribed.
4. RC initializes.
5. Migration block: Supabase session FOUND → reads `oldUserId` →
   `Purchases.logIn(oldUserId)` re-links the device to its pre-auth-removal
   RC user (which still owns the `unlimited` entitlement). Migration key
   saved.
6. `attemptGrandfatherGrantIfEligible()`:
   - `getRawEntitlements()` → `hasUnlimited=true`
   - Early return: "Skipping free grandfather: active subscription present."
     No grant attempt — the subscriber-migration path handles them.
7. Trial-start gate: `hasUnlimited=true` →
   `skipTrialBecauseEntitled=true` → the whole trial-start block is
   skipped. **First-launch modal does NOT fire.**
8. Fresh RC status → still subscribed, `unlimited` entitlement active.
9. Cold-launch restore → Play Billing returns their active subscription
   purchase; RC remains aware of it.
10. Subscriber-to-lifetime check: `raw.hasUnlimited=true &&
    raw.hasLifetime=false` → calls
    `attemptSubscriberLifetimeGrantIfEligible(raw)` which hits the
    `grant-subscriber-lifetime` edge function:
    - Server: subscriber has active `unlimited`, no `lifetime` →
      **grants `lifetime` promotional** via RC's
      `/entitlements/lifetime/promotional` endpoint
    - Records a row in `android_subscriber_lifetime_grants` with
      `status: granted` and `subscription_plan: annual` or `monthly`
      (derived from product identifier)
    - Returns `granted: true, migrated: true, subscriptionPlan: ...`
11. Status re-fetched → now has BOTH `unlimited` AND `lifetime`.
12. `fetchPendingModal` → server: `hasUnlimited=true, hasLifetime=true,
    grant row not acknowledged` → returns `modal: "subscriber_to_lifetime"`.
13. `PendingModalPresenter` renders **`SubscriberToLifetimeModal`**.
14. Gate: has `unlimited` + `lifetime` → `isSubscribed: true` →
    `gate: "none"` → app open.

**What the user sees:**

- Splash → app opens directly (no first-launch modal).
- **Subscriber-to-lifetime modal**:

  > **You Own Daily Paths**
  >
  > Thank you for subscribing to Daily Paths. We've moved from
  > subscriptions to a one-time purchase model. As a result, your
  > subscription is now lifetime access, and the app is yours to keep.
  >
  > [ Continue ]

- Tap Continue → ack recorded server-side via `acknowledge-modal` →
  modal closes. Full access continues.
- The Google Play subscription is **still active** in Play Console until
  you (the developer) manually cancel the renewal or refund the purchase.
- After your manual cancel/refund:
  - Cancel renewal: the paid period continues, `unlimited` stays on RC
    until period ends, then drops off — only `lifetime` remains.
  - Refund: Play Billing notifies RC, `unlimited` is removed immediately
    — only `lifetime` remains.

**End state:** Permanent `lifetime` entitlement. After your manual Play
Console actions, no future billing.

## Persona 3 — 2.6.x user with free access (no subscription), updating to 2.7

**Pre-state on the device:**
- 2.6.x native installed, no RC entitlements (never subscribed, or
  earlier 7-day trial expired and they kept using the free daily reading)
- Legacy marker `@daily_paths_trial_start` from 2.6.x trial period
- Cached subscription status `isSubscribed: false`
- No 2.7 trial marker

**Sequence on first launch after Play Store updates them to vc 49:**

1. App launches with the new binary. No OTA delta to download.
2. `detectLifetimeAccess` → false.
3. Cached subscription not subscribed → loading stays on.
4. RC initializes.
5. Migration block: if Supabase session exists →
   `Purchases.logIn(oldUserId)` re-links to the old anonymous RC user
   (which holds no entitlements); else `restorePurchases()` → no
   purchases.
6. `attemptGrandfatherGrantIfEligible()`:
   - `getLegacyTrialMarker()` → returns the marker (predates cutoff)
   - `hasUnlimited=false` → proceeds
   - Calls `grant-grandfather-lifetime` with `legacy_trial_start_date`
   - Server: within the 30-day grandfather window, marker is
     pre-cutoff, no active subscription, not already lifetime →
     **grants `lifetime` promotional**
   - Records a row in `android_grandfather_grants` with
     `status: granted, decision_reason: legacy_trial_marker`
   - Returns `granted: true`
   - Client fires Mixpanel `LIFETIME_GRANDFATHERED`
7. Trial-start gate: re-reads `getRawEntitlements()` →
   `hasLifetime=true` → `skipTrialBecauseEntitled=true` → trial block
   skipped. **First-launch modal does NOT fire** (this is a long-time
   user, not a brand-new user).
8. Fresh RC status → now subscribed via the lifetime entitlement.
   `isSubscribed: true`.
9. Cold-launch restore → no Play purchases. No change.
10. Subscriber-to-lifetime check: `raw.hasUnlimited=false` → skip.
11. `fetchPendingModal` → server: `hasLifetime=true`, no `unlimited`,
    grandfather row status=granted, ack not set → returns
    `modal: "grandfathered"`.
12. `PendingModalPresenter` renders **`GrandfatheredLifetimeModal`**.
13. Gate: has lifetime → `gate: "none"` → app open.

**What the user sees:**

- Splash → app opens directly (no first-launch modal — they're already a
  long-time user, no welcome needed).
- **Grandfather modal**:

  > **You Own Daily Paths**
  >
  > As a thank-you for being an early adopter, the full app is now
  > yours to keep. No subscription, no purchase, no further billing.
  >
  > [ Continue ]

- Tap Continue → ack recorded server-side → modal closes.
- No trial countdown, no paywall, full access permanently — at no cost.
- Re-opens later (or reinstalls and reaches the same RC user): server
  `which-modal` returns null because ack is set → modal never re-fires.

**End state:** Permanent `lifetime` entitlement. Never paid. Full access
forever.

## Edge case — 2.6.x free user whose legacy marker is gone

If the device's AsyncStorage was wiped (factory reset, "Clear data" in
Settings, or some uninstall paths) before the upgrade to 2.7, the
legacy marker won't be present.

The current code in `grant-grandfather-lifetime` has a fallback: if RC
`subscriber.first_seen` predates the launch date, the user still
qualifies as a grandfather. This catches the wiped-AsyncStorage case for
devices that Play Services preserves the same RC anonymous user across.

**This fallback is flagged for removal** (see deferred discussion in
the plan history). Once removed, this edge case would route to Persona
1's flow instead — they would hit the paywall and could either purchase
$4.99 lifetime or contact support for a manual grant. Volume of
affected users is expected to be small (factory resets within the
30-day grandfather window are uncommon).

## Quick reference table

| Persona | First-launch modal | Auto-grant fires? | Modal shown | Trial countdown? | End state |
|---|---|---|---|---|---|
| 1. New 2.7 user | Yes (welcome) | No | None | 3 days | Paywall on day 4, pay $4.99 |
| 2. 2.6.x subscriber | No | Subscriber-to-lifetime | Subscriber modal | No | Lifetime + manual Play cancel |
| 3. 2.6.x free user with marker | No | Grandfather | Grandfather modal | No | Free lifetime |
| 3a. 2.6.x free user, marker wiped | Currently no (RC first_seen fallback) | Grandfather (via fallback) | Grandfather modal | No | Free lifetime |

## Operational notes

- **The subscriber modal promises "the app is yours to keep" but does
  NOT promise cancellation in-app.** You (the developer) must manually
  cancel each migrated subscriber's renewal in Play Console — or refund
  them. The Mixpanel funnel and the `android_subscriber_lifetime_grants`
  table give you the list of who's been migrated.

- **Modal acknowledgment is server-side**, so the modal cannot re-fire
  on the same RC user across reinstalls.

- **The 30-day grandfather window closes 30 days after
  `GRANDFATHER_LAUNCH_DATE`** (configured as Supabase env var).
  Requests after the cutoff return `grandfather_window_closed`. Past-launch
  installs that never opened the old app pay the $4.99 IAP like a new user.

- **iOS users are unaffected by all of this.** All of these flows are
  Android-only by `Platform.OS === "android"` guards. iOS remains a
  paid download with no IAP.
