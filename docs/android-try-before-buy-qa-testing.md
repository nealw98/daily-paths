# Android 2.7 entitlement QA guide

Use this guide for Android builds on runtime **2.7.0**. Reach **QA Diagnostics** by long-pressing the **Version** line at the bottom of **Settings**.

## 1. What the QA screen is for

The QA screen has two main jobs:

1. **Troubleshoot a real user**  
   Use this when someone says they are blocked, did not get lifetime, or saw the wrong modal.

2. **Set up test users**  
   Use this to create the common test states: new user, expired trial, old free user, monthly subscriber, annual subscriber, and lifetime purchaser.

The most important button is **Copy Support Report**. It copies a plain-English summary with the RevenueCat user ID, access result, trial state, old app marker, RevenueCat subscription/lifetime state, and modal seen flags.

## 2. How access works

On Android, the app gives full access if any of these are true:

- The local 3-day 2.7 trial is active.
- RevenueCat says the user has an active `unlimited` subscription.
- RevenueCat says the user has `lifetime`.

If none are true, the app shows the hard paywall.

RevenueCat is the final source of truth for paid access. Supabase only records and performs migration grants.

## 3. Important terms

| Term | Plain-English meaning |
|---|---|
| **3-day trial** | The new 2.7 trial. Canonical timestamp lives in Supabase (`android_trial_starts`); device caches it in `@daily_paths_v27_trial_start`. App-data-clear no longer resets the trial. |
| **Old app marker** | Proof that this device opened the old 2.6.x app. Stored on the device as `@daily_paths_trial_start`. One of two signals the server uses to qualify a user for grandfathering — the other is RC `first_seen` predating launch. |
| **Grandfather** | Old free users get RevenueCat `lifetime` for free if either the marker or RC `first_seen` predates launch, and they have no active subscription. **Window closes 30 days after launch.** |
| **Subscriber-to-lifetime** | Old monthly/annual subscribers get RevenueCat `lifetime`. You then cancel their Play subscription renewal manually. |
| **Modal A** | Subscriber-to-lifetime message. Annual users see the 5 gift-code mailto offer; monthly users do not. |
| **Modal B** | Grandfathered free-user lifetime message. |
| **Server modal decision** | A single edge function (`which-modal`) returns at most one modal name. Acknowledgment is server-side (`acknowledge-modal`), so the modal cannot fire twice — even after a reinstall — and Modal A / Modal B can never collide. |
| **First-launch modal** | One-time skippable onboarding shown on the very first Android open. Skip rate is tracked. |
| **Force NOT subscribed** | QA-only override that makes the app act like RevenueCat says "not subscribed." It expires after 30 minutes. |
| **Revoke RC lifetime (QA)** | QA-only button calling `revoke-lifetime` edge function — removes the user's RC promotional lifetime entitlement and clears modal acknowledgments so flows can be replayed. Does NOT touch a real $4.99 IAP purchase. |

## 4. Troubleshooting a real user

1. Open **QA Diagnostics**.
2. Tap **Refresh Access Status**.
3. Tap **Copy Support Report**.
4. Paste the report somewhere safe.
5. If needed, copy the **RevenueCat User ID** from the QA header and look up the user in RevenueCat.

Read the support report this way:

- **Access: FULL ACCESS** means the app thinks the user can enter.
- **Access: PAYWALL** means the app thinks the user is blocked.
- **Why** explains the reason: lifetime, subscription, active trial, or no access.
- **Old app marker: present** means this device can claim grandfathering.
- **RevenueCat lifetime: YES** means the durable lifetime entitlement exists.
- **RevenueCat subscription: YES** means the old subscription is still active.

For subscribers, your manual Play Console action is triggered by Supabase:

```text
android_subscriber_lifetime_grants.status = granted
```

After that row exists and RevenueCat shows lifetime, match the Play order by product and purchase timestamp, then cancel the Play subscription. Do not refund unless you intentionally want to refund money.

## 5. Test setups

### 5.1 New 2.7 user

Goal: prove a new user gets the 3-day trial and is not grandfathered.

Steps:

1. Tap **Clear Old App Marker**.
2. Tap **Reset trial**.
3. Make sure **Force NOT subscribed** is off.
4. Kill and reopen the app.
5. Expected: full access from the 3-day trial.

To test the paywall, tap **Expire trial**. Expected: paywall unless RevenueCat shows subscription or lifetime.

### 5.2 Old free user gets grandfathered

Goal: prove an old free user receives lifetime.

Steps:

1. Use a RevenueCat test user with no active subscription and no lifetime.
2. Tap **Set Old App Marker**.
3. Tap **Run Grandfather Check**.
4. Tap **Refresh Access Status**.
5. Expected: RevenueCat lifetime becomes YES, access becomes full, and Modal B may show.

Server record:

```text
android_grandfather_grants.status = granted
```

If no grant happens, check the support report and QA logs. Common reasons:

- Old app marker missing.
- User already has lifetime.
- User has an active subscription, so they belong in the subscriber-to-lifetime flow.
- Supabase or RevenueCat grant failed.

### 5.3 Old free user is not eligible

Goal: prove no old marker means no grandfather.

Steps:

1. Tap **Clear Old App Marker**.
2. Make sure RevenueCat has no subscription and no lifetime.
3. Tap **Run Grandfather Check**.
4. Expected: no lifetime grant.

This matches the business rule: downloaded but never opened the old app does not qualify.

### 5.4 Monthly subscriber becomes lifetime

Goal: prove monthly subscribers are migrated and see monthly Modal A.

Steps:

1. Use a RevenueCat user with active monthly `unlimited` and no `lifetime`.
2. Tap **Run Subscriber-to-Lifetime Check**.
3. Tap **Refresh Access Status**.
4. Expected: RevenueCat lifetime becomes YES and both subscription + lifetime are active.
5. Tap **Reset Modal A Seen Flag**, then kill and reopen if you need the real modal to fire.
6. Expected modal: monthly message, no gift-code offer.

Server record:

```text
android_subscriber_lifetime_grants.status = granted
android_subscriber_lifetime_grants.subscription_plan = monthly
```

After the row is granted, cancel the Play subscription renewal manually.

### 5.5 Annual subscriber becomes lifetime

Goal: prove annual subscribers are migrated and see the gift-code offer.

Steps:

1. Use a RevenueCat user with active annual `unlimited` and no `lifetime`.
2. Tap **Run Subscriber-to-Lifetime Check**.
3. Tap **Refresh Access Status**.
4. Expected: RevenueCat lifetime becomes YES and both subscription + lifetime are active.
5. Tap **Reset Modal A Seen Flag**, then kill and reopen if you need the real modal to fire.
6. Expected modal: annual message with 5 gift codes.

Server record:

```text
android_subscriber_lifetime_grants.status = granted
android_subscriber_lifetime_grants.subscription_plan = annual
```

Use `subscription_purchased_at` or `subscription_original_purchased_at` to match the Play Console order timestamp, then cancel renewal.

### 5.6 Lifetime purchaser

Goal: prove a one-time purchaser has access and does not need migration.

Steps:

1. Use a RevenueCat user with `lifetime`.
2. Tap **Refresh Access Status**.
3. Expected: full access because RevenueCat lifetime is YES.

Do not cancel or refund lifetime purchases. They do not renew.

## 6. Modal testing

Use modal previews only for layout/copy. They do not prove the server grant worked.

- **Preview Modal A Annual**: shows subscriber-to-lifetime annual copy with 5 gift-code offer.
- **Preview Modal A Monthly**: shows subscriber-to-lifetime monthly copy.
- **Preview Modal B**: shows grandfathered free-user copy.
- **Reset Modal A Seen Flag**: lets the real Modal A show again if RevenueCat has both subscription and lifetime.
- **Prime Modal B Pending**: tests local Modal B wiring only; it does not grant lifetime.
- **Reset Grandfather State**: clears local Modal B flags only; it does not undo RevenueCat or Supabase.

## 7. Quick reference

| Button | Use it for |
|---|---|
| **Copy Support Report** | Best first step for any problem. |
| **Refresh Access Status** | Re-read RevenueCat and app gate state. |
| **Set Old App Marker** | Simulate a device that opened the old 2.6.x app. |
| **Clear Old App Marker** | Simulate a brand-new 2.7 install. |
| **Run Grandfather Check** | Try free-user grandfather grant now. |
| **Run Subscriber-to-Lifetime Check** | Try active subscriber lifetime grant now. |
| **Revoke RC lifetime (QA only)** | Remove a promotional lifetime entitlement on RC server. Lets you re-run grandfather / migration flows on the same device. |
| **Reset Modal Acknowledgments (server)** | Clear server `modal_acknowledged_at` columns so Modal A / B will fire again on next launch. |
| **Scenario: Fresh 2.7 user** | One-tap: clear marker, reset trial, clear overrides, reload. |
| **Scenario: Expired trial** | One-tap: clear marker, expire trial (resets analytics keys too), reload. |
| **Scenario: Pristine reset** | Wipe everything (local + server promotional lifetime + modal acks) and reload. |
| **Load my grant rows** | Read this device's rows from grandfather + subscriber + trial-start tables. |
| **Reset trial** | Clear the 3-day trial and start fresh on next app open. |
| **Expire trial** | Force the 3-day trial to be over. Also clears `TRIAL_ENDED` / `TRIAL_DAY_REACHED` tracked keys so analytics refire. |
| **Force NOT subscribed** | Force paywall testing even if RevenueCat has access. Expires after 30 minutes. |
| **Present RC paywall now** | Open the RevenueCat paywall when the app gate is already paywall. |

## 8. Supabase tables

Grandfather free-user grants:

```text
android_grandfather_grants
```

Subscriber-to-lifetime grants:

```text
android_subscriber_lifetime_grants
```

For manual subscriber cancellation, look for:

- `status = granted`
- `subscription_plan`
- `subscription_product_identifier`
- `subscription_purchased_at`
- `subscription_original_purchased_at`
- `rc_app_user_id`

## 9. Related code

- Gate logic: `utils/accessControl.ts`
- Trial and old marker: `utils/trialTimer.ts`
- Subscription orchestration: `contexts/SubscriptionContext.tsx`
- RevenueCat adapter: `lib/subscription.ts`
- Grandfather client: `lib/grandfather.ts`
- Grandfather server: `supabase/functions/grant-grandfather-lifetime/index.ts`
- Subscriber migration client: `lib/subscriberMigration.ts`
- Subscriber migration server: `supabase/functions/grant-subscriber-lifetime/index.ts`
