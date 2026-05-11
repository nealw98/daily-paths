# Daily Paths Android — Business Requirements: Try-Before-You-Buy Model

## Overview

Transition the Android app from a freemium subscription model to a try-before-you-buy lifetime unlock model. The entire app becomes a 3-day free preview, after which a one-time $4.99 purchase is required to continue using any part of the app. No user account or sign-up required.

## Business model change

**Current model:** Free download, free daily reading forever, premium features (notebook, speakers, prayers) gated behind a 7-day trial then $3.99/month or $29.99/year subscription.

**New model:** Free download, entire app available for 3 days, then a hard paywall requires a one-time $4.99 purchase for permanent access. No subscription option. No free tier after day 3.

## Pricing

- **New product:** One-time in-app purchase, $4.99, permanent access.
- **Subscriptions:** Removed from the offering for new users. Existing $3.99/month and $29.99/year products are no longer shown.
- **RevenueCat entitlement:** New purchases grant the existing `lifetime` entitlement.

## Trial behavior

- **Trial length:** 3 days from first app open (not from install/download).
- **Trial scope:** Full access to all features — daily reading, notebook (Journal, Gratitude, Spot Check, Nightly Review), Speakers library, Prayers section. Identical to the paid experience.
- **Trial state storage (v1):** Trial start time is stored **on-device** (AsyncStorage), written on the first app open. This keeps cold start and offline behavior simple and avoids coupling the paywall gate to Supabase availability. **Known limitation:** clearing app data or a clean reinstall resets the trial clock (same practical loophole as resetting an anonymous server identity). **Deferred:** persisting trial start in Supabase keyed to anonymous auth — revisit only if analytics show meaningful abuse.
- **Trial expiration:** After the 3-day preview window has elapsed (from the stored trial start time), the user hits a hard paywall on app open. No grace period, no soft tier, no continued access to any feature.

## Paywall behavior

- **Paywall UI managed in RevenueCat.** The paywall screen itself — layout, copy, button styling, offer presentation — is configured and served via RevenueCat's paywall builder, not built natively in the app. Updates can be made remotely without an app release.
- **Trigger:** App open after the 3-day preview has ended, for users without the `lifetime` entitlement.
- **Placement:** Full-screen, blocks access to all app features. Cannot be dismissed without purchasing.
- **Content:** Single offer — $4.99 one-time purchase for permanent access. No subscription options shown. "Restore Purchases" button visible for users reinstalling or on a new device.
- **Restore flow:** Tapping "Restore Purchases" calls RevenueCat, which checks the device's Google Play account for prior purchases and restores the `lifetime` entitlement if found. No sign-up or login required.
- **Copy tone:** Direct, plain, "attraction not promotion." Final copy drafted separately and configured in RevenueCat.

## Account model

- **No sign-up required at any point.** No email, no password, no Google Sign-In.
- **Identity:** Anonymous RevenueCat App User ID for purchases and entitlements. Trial timing is tracked locally (see Trial behavior) — no separate user-visible account for the preview. Supabase is still used elsewhere in the app (content, feedback, grandfather edge function, etc.); it is **not** the source of truth for trial start in v1.
- **Cross-device / reinstall:** Handled by Google Play's purchase history. RevenueCat queries Google Play on app initialization and restores the `lifetime` entitlement automatically when the device is signed into the Google account that made the purchase. The "Restore Purchases" button on the paywall covers any edge case where automatic restore doesn't fire.

## RevenueCat configuration

- **Add new product:** $4.99 one-time Android purchase, mapped to the `lifetime` entitlement. Mirrors the Google Play Console product.
- **Configure paywall** in RevenueCat's paywall builder for the new offering.
- **Remove subscription products** from the active Android offering. Products themselves remain configured (existing subscribers still managed) but are not shown to new users.

## Play Store changes

- **App listing:** Remains free to download.
- **In-app products:** Add new managed product (one-time purchase) at $4.99. Subscription products remain configured for existing subscribers but are removed from new-user offerings.
- **Store listing copy:** Update description to reflect try-before-you-buy model. Remove subscription language.

## Existing user migration

All existing Android users are granted permanent access. No one currently using the app will encounter the new 3-day paywall.

- **Users currently in the 7-day trial:** Granted the `lifetime` entitlement. They keep full access permanently with no purchase required.
- **Users past the 7-day trial using the free daily reading only:** Granted the `lifetime` entitlement. They get a free upgrade to full access permanently.
- **Existing subscribers ($3.99/month or $29.99/year):** Subscription cancelled and replaced with the `lifetime` entitlement. They keep full access permanently with no further charges. Annual subscribers additionally receive 5 promo codes they can share with others to redeem the one-time IAP for free.
- **Identifying "existing" users:** Any Android user with an active RevenueCat App User ID created before the new model's launch date.
- **3-day trial paywall applies only to:** New installs from launch date forward.

## Analytics requirements

- **Mixpanel events to track:**
  - Trial started (first app open)
  - Trial day reached (1, 2, 3)
  - Paywall shown
  - Paywall purchase initiated
  - Paywall purchase completed
  - Restore purchase attempted / completed
- **Conversion funnel to monitor:** Install → first open → trial day 3 → paywall shown → purchase completed.
- **Apply existing developer filter:** `is_developer = false` on all queries.
- **Production QA:** Step-by-step Android scenarios (gate vs RevenueCat vs local trial, paywall preview) live in-app on **QA Diagnostics** (reach via long-press on Settings or the Settings developer entry). Full written test cases, grandfather testing tracks, and control reference: [android-try-before-buy-qa-testing.md](android-try-before-buy-qa-testing.md).

## Out of scope

- iOS changes (handled separately).
- Website changes.
- Refund policy changes (Google Play standard policy applies).
- Promotional pricing or launch discounts.
- Smart link / device-detection routing.
- Closing the trial-reset loophole (revisit if Mixpanel shows meaningful abuse patterns).
- Server-backed trial state in Supabase (optional future hardening; not required for v1 — see Trial state storage).

## Success criteria

To be evaluated 4–6 weeks post-launch via Mixpanel dashboard:

- Install-to-purchase conversion rate (the headline number).
- Comparison to current freemium conversion rate as baseline.
- Comparison to iOS paid-download conversion as a directional benchmark.
- Trial completion rate (% of installs that reach day 3 active).
- Refund rate via Google Play Console.
