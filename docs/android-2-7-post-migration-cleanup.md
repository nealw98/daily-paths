# Android 2.7 post-migration cleanup plan

After the 30-day grandfather window closes — and once Mixpanel shows the
migration events have tapered to near-zero — all 2.6.x-migration code
can be deleted. This document is the checklist for that cleanup.

**Earliest safe date: ~30 days after the 2.7 production rollout begins.**

## Mixpanel signals to watch

Before deleting, confirm the following counts are at or near zero for at
least a week:

| Event | What it indicates | Filter to check |
|---|---|---|
| `lifetime_grandfathered` (`source = "free_grandfather"`) | A 2.6.x free user just upgraded and was granted lifetime | should drop to zero after window closes (server enforces) |
| `lifetime_grandfathered` (`source = "subscriber_to_lifetime"`) | A 2.6.x subscriber's sub was converted to lifetime | should drop to zero after the ~7 subscribers have all updated |
| `rc_identity_migration_ran` (any `path`) | An in-place 2.6.x → 2.7 upgrade just ran the one-time RC re-login | tapers as all 2.6.x devices update; should be near-zero after 30 days |
| `modal_shown` (`modal = "grandfathered"` or `"subscriber_to_lifetime"`) | A migration-related congratulatory modal was rendered | should drop with the grant events above |

Apply the existing `is_developer = false` filter to all queries.

## Order of cleanup (when ready)

Stripe out in this order; each step is independently shippable as an
OTA. None require a new native build.

### Step 1 — Remove subscriber-to-lifetime path

- Delete [lib/subscriberMigration.ts](../lib/subscriberMigration.ts)
- Delete [supabase/functions/grant-subscriber-lifetime/](../supabase/functions/grant-subscriber-lifetime/)
- Remove the call from [contexts/SubscriptionContext.tsx](../contexts/SubscriptionContext.tsx)
  (the `attemptSubscriberLifetimeGrantIfEligible` block, ~lines 393–408
  + the refresh-time copy ~lines 580–593)
- Delete [components/SubscriberToLifetimeModal.tsx](../components/SubscriberToLifetimeModal.tsx)
- Remove the SubscriberToLifetimeModal import + render in
  [app/_layout.tsx](../app/_layout.tsx) `PendingModalPresenter`
- Drop the `"subscriber_to_lifetime"` case from
  [lib/modalDecision.ts](../lib/modalDecision.ts) `PendingModalName` union
- Remove the corresponding branch from
  [supabase/functions/which-modal/](../supabase/functions/which-modal/)
- Remove the "Run Subscriber-to-Lifetime Check" QA button in
  [app/qa-logs.tsx](../app/qa-logs.tsx)
- Drop the `android_subscriber_lifetime_grants` table (or keep for audit;
  it's harmless idle)

### Step 2 — Remove grandfather path

- Delete [lib/grandfather.ts](../lib/grandfather.ts)
- Delete [supabase/functions/grant-grandfather-lifetime/](../supabase/functions/grant-grandfather-lifetime/)
- Remove the call from `SubscriptionContext.tsx` (~lines 290–302)
- Delete [components/GrandfatheredLifetimeModal.tsx](../components/GrandfatheredLifetimeModal.tsx)
- Remove the GrandfatheredLifetimeModal import + render in `_layout.tsx`
- The whole `PendingModalPresenter` component can be deleted at this
  point (both server modals are gone)
- Delete [lib/modalDecision.ts](../lib/modalDecision.ts) entirely
- Remove pending-modal state + actions from `SubscriptionContext`
- Remove the corresponding edge functions:
  - `which-modal`
  - `acknowledge-modal`
  - `reset-modal-acknowledgments`
- Remove "Run Grandfather Check", "Reset Modal Acknowledgments",
  "Preview Grandfather Modal", and the legacy-marker QA buttons in
  `app/qa-logs.tsx`
- Drop the `android_grandfather_grants` and
  `android_modal_acknowledgments` tables (or keep for audit)

### Step 3 — Remove legacy marker

- Delete `getLegacyTrialMarker`, `setLegacyTrialMarkerForQa`,
  `clearLegacyTrialMarkerForQa`, and `LegacyTrialMarker` type from
  [utils/trialTimer.ts](../utils/trialTimer.ts)
- The `LEGACY_TRIAL_START_KEY` constant can be deleted (or kept as a
  cleanup target that's removed from AsyncStorage on first launch of the
  next build)
- Remove all references in [app/qa-logs.tsx](../app/qa-logs.tsx)

### Step 4 — Remove RC identity migration block

- Remove the migration block in `SubscriptionContext.tsx` init effect
  (~lines 236–290, the entire `if (!migrated)` block + `MIGRATION_KEY`
  AsyncStorage handling)
- Remove the `RC_IDENTITY_MIGRATION_RAN` analytics event
- Remove the import of `Purchases` from `react-native-purchases` in
  SubscriptionContext if no longer used

### Step 5 — Remove the revoke-lifetime QA tooling

- Delete [lib/revokeLifetime.ts](../lib/revokeLifetime.ts)
- Delete [supabase/functions/revoke-lifetime/](../supabase/functions/revoke-lifetime/)
- Remove the "Revoke RC lifetime" button from
  [app/qa-logs.tsx](../app/qa-logs.tsx)
- Drop the `android_lifetime_revocations` table

### Step 6 — Remove the QA grant-rows viewer

- Delete [lib/grantRows.ts](../lib/grantRows.ts)
- Delete [supabase/functions/get-grant-rows/](../supabase/functions/get-grant-rows/)
- Remove "Load my grant rows" + the row-viewer panels from
  `app/qa-logs.tsx`

### Step 7 — Remove the QA "Scenario: 2.6.5 → 2.7 upgrade" button

- The grandfather scenario is no longer reachable; remove
  `handleScenarioGrandfatherUpgrade` from `app/qa-logs.tsx` and its UI
  button
- Also remove the "Scenario: Pristine reset" handler if it's only
  testing migration paths (review at cleanup time)

## What stays

- The 3-day trial system — for genuine new users
- First-launch trial modal — for genuine new users
- Hard paywall with `android_unlock` offering — for paywall-gated users
- `get-or-create-trial-start` edge function + `android_trial_starts`
  table — still needed for trial anchoring
- `RevenueCatUI` paywall presentation in `AndroidHardPaywallGate`
- `Purchases.restorePurchases()` cold-launch logic on Android
- All access-control + cache logic
- All trial analytics: `trial_started`, `trial_ended`,
  `trial_day_reached`
- Paywall analytics: `paywall_shown`, `paywall_purchase_completed`,
  `paywall_purchase_cancelled`, `restore_initiated`, `restore_completed`

## Expected cleanup impact

- ~1500+ lines of code removed across client + server
- 6 edge functions deleted
- 3-4 Supabase tables dropped (or marked archival)
- 4 React components deleted
- QA panel simplifies significantly
- `SubscriptionContext` init becomes much shorter — RC init, restore,
  cache, trial — done

The cleanup itself is mechanical and safe **once Mixpanel confirms the
migration events have stopped firing.** Do not delete prematurely.
