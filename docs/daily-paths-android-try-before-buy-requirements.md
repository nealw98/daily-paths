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
- **Trial state storage:** Trial start is anchored in Supabase (table `android_trial_starts`) keyed by the RC App User ID. Local AsyncStorage holds the cached value for offline reads. Clearing app data does not reset the trial — Google Play restores the same anonymous RC user, and the server replays the original timestamp.
- **First-launch onboarding:** A one-time skippable modal explains the model ("free for 3 days, then $4.99 forever") on the very first Android app open. Skip rate is tracked in Mixpanel via `first_launch_modal_skipped` / `first_launch_modal_continued`.
- **Trial expiration:** After the 3-day preview window has elapsed (from the canonical trial start), the user hits a hard paywall on app open. No grace period, no soft tier, no continued access to any feature.

## Paywall behavior

- **Paywall UI managed in RevenueCat.** The paywall screen itself — layout, copy, button styling, offer presentation — is configured and served via RevenueCat's paywall builder, not built natively in the app. Updates can be made remotely without an app release. The paywall must be configured **non-dismissable** in the RC dashboard (close/back affordance disabled).
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
- **Existing subscribers ($3.99/month or $29.99/year):** Granted the `lifetime` entitlement. Play subscription renewal is cancelled manually in Play Console after the `android_subscriber_lifetime_grants.status = granted` row appears (volume is <10 customers, so manual ops). Annual subscribers receive 5 promo codes via a mailto request from Modal A — establishing a support contact for these legacy customers.
- **Identifying "existing" users:** Either of (a) the local 2.6.x trial marker `@daily_paths_trial_start` predates the launch date, OR (b) the RC subscriber's `first_seen` predates the launch date. The OR catches users whose AsyncStorage was wiped (factory reset, app data clear).
- **Grandfather window:** The migration program is open for **30 days after launch**. Requests after that close as `grandfather_window_closed`. Past-launch installs that never opened the app within the window pay the $4.99 IAP like a new user.
- **3-day trial paywall applies only to:** New installs from launch date forward.

## Analytics requirements

- **Mixpanel events to track:**
  - First-launch modal shown / continued / skipped
  - Trial started (only fires for genuinely new trials — grandfathered and migrated subscribers are excluded so they don't pollute the funnel)
  - Trial day reached (1, 2, 3)
  - Trial ended
  - Paywall shown
  - Paywall purchase completed
  - Paywall purchase cancelled
  - Restore initiated / completed
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
