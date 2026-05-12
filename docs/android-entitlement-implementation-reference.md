# Android Entitlement Implementation Reference

This document describes the current working code for Android 2.7 access control:

- Grandfather free-user lifetime grant and Modal B
- Subscriber-to-lifetime grant and Modal A
- RevenueCat subscription/lifetime access
- New 3-day trial
- The states each access control can be in

RevenueCat is the source of truth for paid access. Supabase records migration decisions and performs promotional lifetime grants using the RevenueCat secret key. Local app storage controls trials, QA setup, and whether a one-time modal has already been shown.

## Access Decision Summary

Android full access is granted when at least one of these is true:

- RevenueCat has active `lifetime`
- RevenueCat has active `unlimited`
- The local 2.7 3-day trial is active

If none are true, Android shows the hard paywall.

```ts
// utils/accessControl.ts
export function hasPremiumEntitlement(
  subscription: SubscriptionStatus,
  trial: TrialStatus,
  hasLifetimeAccess: boolean,
): boolean {
  if (Platform.OS === "ios") return true;

  if (hasLifetimeAccess) return true;
  return subscription.isSubscribed || trial.isInTrial;
}

export function getRequiredGate(
  subscription: SubscriptionStatus,
  trial: TrialStatus,
  hasLifetimeAccess: boolean,
): GateType {
  return hasPremiumEntitlement(subscription, trial, hasLifetimeAccess)
    ? "none"
    : "paywall";
}
```

## Access Control States

### App Gate

| State | Meaning | User Experience |
|---|---|---|
| `none` | App should allow access. | Main app routes are available. |
| `paywall` | App should block access. | Android hard paywall appears. |

The gate is computed in `SubscriptionContext`:

```ts
// contexts/SubscriptionContext.tsx
const gate = useMemo<GateType>(() => {
  if (hasLifetimeAccess) return "none";
  if (!isRevenueCatInitialized()) {
    if (trial.isInTrial) return "none";
    if (status.isSubscribed) return "none";
    return "paywall";
  }
  return getRequiredGate(status, trial, hasLifetimeAccess);
}, [status, trial, hasLifetimeAccess]);
```

### RevenueCat Subscription Status

| State | RevenueCat Entitlement | App Meaning |
|---|---|---|
| No entitlement | none | No paid access. Trial may still allow access. |
| Active subscription | `unlimited` | Full access while subscription is active. |
| Lifetime | `lifetime` | Full access permanently. |
| Both | `unlimited` + `lifetime` | Subscriber was migrated to lifetime; Modal A can show. |

The collapsed app status prioritizes lifetime first:

```ts
// lib/subscription.ts
if (lifetimeEntitlement) {
  result = {
    isSubscribed: true,
    isTrialing: false,
    expirationDate: null,
    productIdentifier: lifetimeEntitlement.productIdentifier,
    willRenew: false,
  };
} else if (!entitlement) {
  result = {
    isSubscribed: false,
    isTrialing: false,
    expirationDate: null,
    productIdentifier: null,
    willRenew: false,
  };
} else {
  result = {
    isSubscribed: true,
    isTrialing: entitlement.periodType === "TRIAL",
    expirationDate: entitlement.expirationDate,
    productIdentifier: entitlement.productIdentifier,
    willRenew: entitlement.willRenew,
  };
}
```

Raw entitlements are kept separate because Modal A needs to know whether both `unlimited` and `lifetime` are active:

```ts
// lib/subscription.ts
export interface RawEntitlements {
  hasUnlimited: boolean;
  hasLifetime: boolean;
  unlimitedExpirationDate: string | null;
  unlimitedProductIdentifier: string | null;
  unlimitedWillRenew: boolean;
  lifetimeProductIdentifier: string | null;
}

export async function getRawEntitlements(): Promise<RawEntitlements> {
  const customerInfo = await Purchases.getCustomerInfo();
  const unlimited = customerInfo.entitlements.active[ENTITLEMENT_ID];
  const lifetime = customerInfo.entitlements.active[LIFETIME_ENTITLEMENT_ID];
  return {
    hasUnlimited: unlimited !== undefined,
    hasLifetime: lifetime !== undefined,
    unlimitedExpirationDate: unlimited?.expirationDate ?? null,
    unlimitedProductIdentifier: unlimited?.productIdentifier ?? null,
    unlimitedWillRenew: unlimited?.willRenew ?? false,
    lifetimeProductIdentifier: lifetime?.productIdentifier ?? null,
  };
}
```

## New 3-Day Trial

The 2.7 trial uses a new key:

```ts
// utils/trialTimer.ts
const TRIAL_START_KEY = "@daily_paths_v27_trial_start";
const TRIAL_DURATION_DAYS = 3;
```

The old 2.6.x trial key is preserved only as grandfather evidence:

```ts
// utils/trialTimer.ts
const LEGACY_TRIAL_START_KEY = "@daily_paths_trial_start";

export async function getLegacyTrialMarker(): Promise<LegacyTrialMarker> {
  const trialStartDate = await AsyncStorage.getItem(LEGACY_TRIAL_START_KEY);
  if (!trialStartDate) {
    return { trialStartDate: null, hasValidMarker: false };
  }

  return {
    trialStartDate,
    hasValidMarker: !Number.isNaN(Date.parse(trialStartDate)),
  };
}
```

### Trial States

| State | Fields | Meaning | Access |
|---|---|---|---|
| Never started | `neverStarted: true` | No 2.7 trial timestamp yet. | Access not granted until `ensureTrialStarted()` creates it. |
| Active | `isInTrial: true` | Inside 3-day window. | Full access. |
| Expired | `trialExpired: true` | 3-day window has passed. | No access unless RevenueCat grants subscription/lifetime. |
| Storage error | fallback returns `isInTrial: true` | AsyncStorage failed. | Fails open to avoid accidental lockout. |

```ts
// utils/trialTimer.ts
export async function ensureTrialStarted(): Promise<void> {
  const existing = await AsyncStorage.getItem(TRIAL_START_KEY);
  if (!existing) {
    await AsyncStorage.setItem(TRIAL_START_KEY, new Date().toISOString());
    trackEvent(ANALYTICS_EVENTS.TRIAL_STARTED, {}, true);
  }
}
```

## Grandfather Free-User Lifetime Grant

This is for old free users who opened the 2.6.x app. They qualify only when:

- Android
- Old 2.6.x marker exists: `@daily_paths_trial_start`
- Current RevenueCat user has no active `unlimited`
- Current RevenueCat user has no active `lifetime`
- Marker date is before `GRANDFATHER_CUTOFF_DATE`

### Client Code

```ts
// lib/grandfather.ts
export async function attemptGrandfatherGrantIfEligible(): Promise<boolean> {
  if (Platform.OS !== "android") return false;

  const legacyMarker = await getLegacyTrialMarker();
  if (!legacyMarker.hasValidMarker || !legacyMarker.trialStartDate) {
    return false;
  }

  const { hasUnlimited } = await getRawEntitlements();
  if (hasUnlimited) {
    return false;
  }

  const appUserId = await Purchases.getAppUserID();

  const { data, error } = await supabase.functions.invoke(
    "grant-grandfather-lifetime",
    {
      body: {
        app_user_id: appUserId,
        legacy_trial_start_date: legacyMarker.trialStartDate,
      },
    },
  );

  if (error) return false;

  const granted = !!data?.granted;
  const grandfathered = !!data?.grandfathered;

  if (grandfathered) {
    await queueGrandfatherModalIfUnseen(data?.reason ?? "grandfathered");
  }

  return granted;
}
```

### Server Code

The function verifies eligibility and writes to `android_grandfather_grants`:

```ts
// supabase/functions/grant-grandfather-lifetime/index.ts
if (!legacyTrialStartAt) {
  return jsonResponse({ granted: false, reason: "missing_legacy_trial_marker" }, 400);
}

if (legacyTrialStartMs >= cutoffMs) {
  await recordGrantStatus(...status: "denied", decisionReason: "legacy_marker_post_cutoff");
  return jsonResponse({
    granted: false,
    grandfathered: false,
    reason: "legacy_marker_post_cutoff",
    status: "denied",
  });
}
```

It denies active subscribers because they use the subscriber migration path:

```ts
// supabase/functions/grant-grandfather-lifetime/index.ts
if (hasActiveSubscription) {
  await recordGrantStatus(...status: "denied", decisionReason: "active_subscription");
  return jsonResponse({
    granted: false,
    grandfathered: false,
    reason: "active_subscription",
    status: "denied",
  });
}
```

It grants promotional lifetime through RevenueCat:

```ts
// supabase/functions/grant-grandfather-lifetime/index.ts
const grantRes = await fetch(
  `${RC_API_BASE}/subscribers/${encodeURIComponent(appUserId)}/entitlements/${LIFETIME_ENTITLEMENT_ID}/promotional`,
  {
    method: "POST",
    headers: {
      Authorization: `Bearer ${rcSecret}`,
      "Content-Type": "application/json",
      Accept: "application/json",
    },
    body: JSON.stringify({ duration: "lifetime" }),
  },
);
```

### Grandfather Grant States

| State | Supabase Status | Reason | Meaning |
|---|---|---|---|
| Missing marker | none or denied | `missing_legacy_trial_marker` | Device did not prove it opened old app. |
| Marker after cutoff | `denied` | `legacy_marker_post_cutoff` | Marker is not old enough. |
| Already lifetime | `denied` or `granted` if previously granted | `already_lifetime` / existing reason | No new grant needed. |
| Active subscription | `denied` | `active_subscription` | User belongs in subscriber-to-lifetime path. |
| Grant failed | `grant_failed` | `rc_grant_failed` | RevenueCat API failed. |
| Granted | `granted` | `legacy_trial_marker` | RevenueCat promotional lifetime was granted. |

## Grandfather Modal B

Modal B is local UI. It does not grant access. It appears when the app has queued `@daily_paths_grandfather_modal_pending`.

```ts
// lib/grandfather.ts
async function queueGrandfatherModalIfUnseen(reason: string): Promise<boolean> {
  const pending = await AsyncStorage.getItem(GRANDFATHER_MODAL_PENDING_KEY);
  if (pending === "true") return true;

  const seen = await AsyncStorage.getItem(GRANDFATHER_MODAL_SEEN_KEY);
  if (seen === "true") return false;

  await AsyncStorage.setItem(GRANDFATHER_MODAL_PENDING_KEY, "true");
  return true;
}
```

`SubscriptionContext` reads the pending flag:

```ts
// contexts/SubscriptionContext.tsx
const pending = await isGrandfatherModalPending();
if (!cancelled) {
  setShowGrandfatherModal(pending);
}
```

Root layout displays Modal B:

```tsx
// app/_layout.tsx
function GrandfatheredLifetimePresenter() {
  const { showGrandfatherModal, acknowledgeGrandfatherModal } = useSubscriptionContext();

  if (Platform.OS !== "android") return null;

  return (
    <GrandfatheredLifetimeModal
      visible={showGrandfatherModal}
      onClose={() => {
        void acknowledgeGrandfatherModal();
      }}
    />
  );
}
```

Dismissal clears pending and marks seen:

```ts
// lib/grandfather.ts
export async function clearGrandfatherModalPending(): Promise<void> {
  await AsyncStorage.removeItem(GRANDFATHER_MODAL_PENDING_KEY);
  await AsyncStorage.setItem(GRANDFATHER_MODAL_SEEN_KEY, "true");
}
```

### Modal B States

| State | Local Flags | Meaning |
|---|---|---|
| Not queued | no pending flag | Modal B will not show. |
| Pending | `@daily_paths_grandfather_modal_pending = true` | Modal B should show. |
| Seen | `@daily_paths_grandfather_modal_seen = true` | Modal B should not be queued again locally. |

Modal B copy:

```tsx
// components/GrandfatheredLifetimeModal.tsx
<Text style={[styles.title, { color: colors.text }]}>You Own Daily Paths</Text>
<Text style={[styles.message, { color: colors.textSecondary }]}>
  A thank-you for being an early Daily Paths user — the full app is now yours
  to keep, on us. No subscription, no purchase, no further billing.
</Text>
```

## Subscriber-To-Lifetime Grant

This is for active monthly/annual subscribers. They qualify when:

- Android
- RevenueCat has active `unlimited`
- RevenueCat does not already have `lifetime`

The app grants lifetime but does not cancel the Play subscription. Play cancellation is a manual/ops step after the Supabase row is `granted`.

### Client Code

```ts
// lib/subscriberMigration.ts
export async function attemptSubscriberLifetimeGrantIfEligible(
  raw: RawEntitlements,
): Promise<boolean> {
  if (Platform.OS !== "android") return false;
  if (!raw.hasUnlimited || raw.hasLifetime) return false;

  const appUserId = await Purchases.getAppUserID();

  const { data, error } = await supabase.functions.invoke(
    "grant-subscriber-lifetime",
    {
      body: { app_user_id: appUserId },
    },
  );

  if (error) return false;

  const granted = !!data?.granted;
  const migrated = !!data?.migrated;

  return granted || migrated;
}
```

Annual/monthly detection prefers product ID, then expiration date:

```ts
// lib/subscriberMigration.ts
export function getSubscriberPlanFromRaw(raw: RawEntitlements): SubscriberPlan {
  const id = raw.unlimitedProductIdentifier?.toLowerCase() ?? "";
  if (id.includes("annual") || id.includes("year")) return "annual";
  if (id.includes("monthly") || id.includes("month")) return "monthly";

  if (raw.unlimitedExpirationDate) {
    const expiresMs = Date.parse(raw.unlimitedExpirationDate);
    if (!Number.isNaN(expiresMs)) {
      return expiresMs - Date.now() > 60 * 24 * 60 * 60 * 1000
        ? "annual"
        : "monthly";
    }
  }

  return "unknown";
}
```

### Server Code

The function verifies active `unlimited`, records useful Play matching data, and grants lifetime:

```ts
// supabase/functions/grant-subscriber-lifetime/index.ts
const unlimited = entitlements[ENTITLEMENT_ID];
const lifetime = entitlements[LIFETIME_ENTITLEMENT_ID];
const hasActiveSubscription = isActiveEntitlement(entitlements, ENTITLEMENT_ID);
const hasLifetime = isActiveEntitlement(entitlements, LIFETIME_ENTITLEMENT_ID);
const productIdentifier = unlimited?.product_identifier ?? null;
const purchasedAt = getFirstString(unlimited, [
  "purchase_date",
  "purchased_at",
  "latest_purchase_date",
]);
const originalPurchasedAt = getFirstString(unlimited, [
  "original_purchase_date",
  "original_purchased_at",
]);
```

If no active subscription exists:

```ts
// supabase/functions/grant-subscriber-lifetime/index.ts
if (!hasActiveSubscription) {
  await recordGrantStatus(...status: "denied", decisionReason: "no_active_subscription");
  return jsonResponse({
    granted: false,
    migrated: false,
    reason: "no_active_subscription",
    status: "denied",
    subscriptionPlan,
  });
}
```

The grant uses the same RevenueCat promotional entitlement endpoint:

```ts
// supabase/functions/grant-subscriber-lifetime/index.ts
const grantRes = await fetch(
  `${RC_API_BASE}/subscribers/${encodeURIComponent(appUserId)}/entitlements/${LIFETIME_ENTITLEMENT_ID}/promotional`,
  {
    method: "POST",
    headers: {
      Authorization: `Bearer ${rcSecret}`,
      "Content-Type": "application/json",
      Accept: "application/json",
    },
    body: JSON.stringify({ duration: "lifetime" }),
  },
);
```

### Subscriber Grant States

| State | Supabase Status | Reason | Meaning |
|---|---|---|---|
| No active subscription | `denied` | `no_active_subscription` | Not a subscriber migration candidate. |
| Already lifetime | `granted` | `already_lifetime` | RevenueCat already has lifetime. |
| Grant failed | `grant_failed` | `rc_grant_failed` | RevenueCat API failed. |
| Granted | `granted` | `active_subscription` | Lifetime was granted to an active subscriber. |

Useful columns for manual Play cancellation:

- `rc_app_user_id`
- `subscription_plan`
- `subscription_product_identifier`
- `subscription_purchased_at`
- `subscription_original_purchased_at`
- `subscription_will_renew`
- `status`

## Subscriber Modal A

Modal A appears when both `unlimited` and `lifetime` are active and the local seen flag is not set.

```tsx
// app/_layout.tsx
function SubscriberToLifetimePresenter() {
  const { hasSubAndLifetime, isAnnualSubscriber } = useSubscriptionContext();
  const [visible, setVisible] = useState(false);

  useEffect(() => {
    if (Platform.OS !== "android") return;
    if (!hasSubAndLifetime) return;
    (async () => {
      const seen = await AsyncStorage.getItem(SUB_TO_LIFETIME_MODAL_KEY);
      if (seen !== "true") {
        setVisible(true);
        trackModalShown("subscriber_to_lifetime");
      }
    })();
  }, [hasSubAndLifetime, trackModalShown]);

  return (
    <SubscriberToLifetimeModal
      visible={visible}
      isAnnual={isAnnualSubscriber}
      onClose={async () => {
        await AsyncStorage.setItem(SUB_TO_LIFETIME_MODAL_KEY, "true");
        setVisible(false);
      }}
    />
  );
}
```

### Modal A States

| State | Condition | User Experience |
|---|---|---|
| Not eligible | Missing `unlimited` or missing `lifetime` | Modal A does not show. |
| Eligible, unseen | `unlimited` + `lifetime`, no seen flag | Modal A shows. |
| Eligible, seen | `unlimited` + `lifetime`, seen flag set | Modal A does not show again. |
| Annual | `isAnnualSubscriber = true` | Shows 5 gift-code offer. |
| Monthly | `isAnnualSubscriber = false` | Shows conversion message only. |

Modal A copy:

```tsx
// components/SubscriberToLifetimeModal.tsx
{isAnnual
  ? "Your annual subscription has been converted to lifetime access. The app is yours to keep — no renewal at the end of your year, no further billing."
  : "Your monthly subscription has been converted to lifetime access. The app is yours to keep — no more monthly charges, no renewal, nothing further to do."}

{isAnnual ? (
  <Text>
    As thanks for your early support, you'll receive 5 gift codes to share Daily Paths with others.
  </Text>
) : null}
```

## Subscription Context Startup Order

The startup order matters:

1. Read iOS paid-app lifetime status.
2. Read cached subscription status.
3. Read current local 3-day trial status.
4. Initialize RevenueCat.
5. Run one-time RevenueCat identity migration.
6. Attempt grandfather grant.
7. Ensure 2.7 trial has started.
8. Fetch fresh RevenueCat subscription status.
9. Silent restore on Android if trial expired and RevenueCat has no entitlement.
10. Attempt subscriber-to-lifetime migration.
11. Read Modal B pending flag.
12. Compute gate.

Key code:

```ts
// contexts/SubscriptionContext.tsx
if (isRevenueCatInitialized()) {
  const granted = await attemptGrandfatherGrantIfEligible();
  qaLog("subscription", "Grandfather grant attempt", { granted });
}

if (!lifetimeStatus.hasLifetimeAccess) {
  await ensureTrialStarted();
  const freshTrial = await getTrialStatus();
  setTrial(freshTrial);
}

let raw = await getRawEntitlements();
if (raw.hasUnlimited && !raw.hasLifetime) {
  const migratedSubscriber =
    await attemptSubscriberLifetimeGrantIfEligible(raw);
  if (migratedSubscriber) {
    const after = await getSubscriptionStatus();
    setStatus(after);
    raw = await getRawEntitlements();
  }
}

setHasSubAndLifetime(raw.hasUnlimited && raw.hasLifetime);
setIsAnnualSubscriber(raw.hasUnlimited && getSubscriberPlanFromRaw(raw) === "annual");
```

## Local Caches And What They Do Not Do

Local cache can make access look sticky briefly, but it is not the durable entitlement.

```ts
// lib/subscription.ts
export async function clearLocalSubscriptionCache(): Promise<void> {
  await AsyncStorage.removeItem(SUBSCRIPTION_CACHE_KEY);
  await (Purchases as any).invalidateCustomerInfoCache?.();
  qaLog("subscription", "Cleared local subscription and RevenueCat customer-info cache");
}
```

Clearing local cache does not remove:

- RevenueCat server entitlements
- Google Play purchases
- Supabase grant rows

If lifetime comes back after clearing local cache and refreshing, it is coming from RevenueCat or Google Play.

## Overall State Matrix

| User Type | Local Trial | Old Marker | RC `unlimited` | RC `lifetime` | Supabase Action | Modal |
|---|---|---|---|---|---|---|
| New 2.7 user, day 1 | active | missing | no | no | none | none |
| New 2.7 user, expired | expired | missing | no | no | none | paywall |
| Old free user before grant | any | present | no | no | `grant-grandfather-lifetime` | Modal B after grant |
| Old free user after grant | any | present | no | yes | `android_grandfather_grants.status = granted` | Modal B if unseen |
| Monthly subscriber before grant | any | any | yes | no | `grant-subscriber-lifetime` | Modal A after grant |
| Annual subscriber before grant | any | any | yes | no | `grant-subscriber-lifetime` | Modal A annual after grant |
| Subscriber after grant | any | any | yes | yes | `android_subscriber_lifetime_grants.status = granted` | Modal A if unseen |
| Lifetime purchaser | any | any | maybe no | yes | none | none unless promo modal logic applies |

