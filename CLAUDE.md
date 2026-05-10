# CLAUDE.md

This file provides guidance to Claude Code (claude.ai/code) when working with code in this repository.

## Stack

Expo (SDK 54) + React Native 0.81 + expo-router 6 + TypeScript (strict). Hermes + new architecture enabled. Supabase for the only remote data we hold (speakers, gratitude quotes, journal quotes, app feedback, grandfather edge function). Mixpanel + an in-app QA log for analytics. RevenueCat for purchases (Android only — iOS is a paid download with no IAP).

There is no test runner configured; verification is `npx tsc --noEmit` plus running the app in a simulator / dev client. Don't add Jest unless asked.

## Common commands

```bash
npm run start                                    # expo start (Metro / dev server)
npm run ios                                      # build & run iOS dev client
npm run android                                  # build & run Android dev client
npx tsc --noEmit                                 # typecheck (only verification we run)
eas update --branch preview --message "..."      # OTA to the preview channel
eas update --branch production --message "..."   # OTA to production (rare; coordinate first)
eas build --profile preview --platform ios       # native build for preview
eas build --profile production --platform all    # native build for store submission
```

Env values live in `eas.json` per profile (`development` / `preview` / `production`). Local dev expects an `.env` mirroring `env.example.txt`. Supabase client falls back to a clearly-throwing proxy when env vars are missing — see `lib/supabase.ts`.

Two release surfaces exist independently:
- **Native builds** are gated by `app.json` `ios.buildNumber` / `android.versionCode` and EAS profiles.
- **OTA updates** use `expo-updates`. `runtimeVersion.policy = "appVersion"` means an OTA only reaches devices on a matching `app.json.expo.version`. Bumping the app version cuts existing devices off OTA until they install the new native build.

## Architecture

### Routing — expo-router file-based

`app/_layout.tsx` is the root: loads fonts, wires `SettingsProvider`, `SubscriptionProvider`, `AppDateProvider`, `KeyboardProvider`, sets the notification handler, mounts `AndroidHardPaywallGate` and the two grandfather modal presenters, and decides whether the user lands on tabs or a paywall.

`app/(tabs)/_layout.tsx` defines the bottom tab bar. Tabs in the published app are: **Today** (`home`), **Notebook** (`journal`), **Speakers**, **Prayers**, **Settings** (`more`). The `reading.tsx` route is reached by tapping a reading from Today; it's *not* a tab. Tab gating is no longer per-tab — the Android hard paywall at root short-circuits non-entitled users entirely.

Other top-level routes: `app/select-date.tsx`, `app/favorites.tsx`, `app/qa-logs.tsx` (dev-only QA panel; reach via long-press on Settings or from the Settings screen).

### Cross-cutting providers

| Provider | Surface | Notes |
|---|---|---|
| `SettingsProvider` (`hooks/useSettings.ts`) | text size, theme, daily reminder time, color scheme | Persists to AsyncStorage. `useSettings()` is the only consumer; `useTheme()` and `useTypography()` derive from it. |
| `SubscriptionContext` (`contexts/SubscriptionContext.tsx`) | RevenueCat status, trial state, lifetime detection, grandfather grant flow, `gate` | The `gate` value is the source of truth for "what to show this user" (`none`, `paywall`, etc.) — see `utils/accessControl.ts`. Android-only logic: subscription, trial, grandfather. iOS users always have lifetime access via `paid-app-detector` (a local Swift module under `modules/`). |
| `AppDateProvider` (`contexts/AppDateContext.tsx`) | `today` Date + `todayKey` string | Refreshes at local midnight so date-rotated content (the daily reading, daily quote, featured speaker) advances without an app restart. Don't read `new Date()` directly in screens — use `useAppDate()`. |

### Theming

`constants/theme.ts` defines a layered palette: `SemanticPalette` + `LegacyColorNames` + `SanctuaryRoles` + a fixed terracotta subscription palette. Multiple selectable schemes (Ocean light/dark, Forest, Burgundy Rose, etc.) are built via `buildPalette(...)`. Components consume `useTheme().colors` — which exposes both new semantic names (`primary`, `secondary`, `outlineVariant`, `surfaceContainerLowest`, …) and legacy ones (`deepTeal`, `seafoam`, `mist`, `cloud`, `pearl`, `ink`). Both are valid; new code prefers the semantic names.

`fonts` (also in `constants/theme.ts`) is the canonical font name registry. Bodies are Manrope, headings/decorative are Cormorant Garamond italic, occasional Lora for quotes. Don't reference Google Font module names directly in components — go through `fonts.bodyFamily`, `fonts.headerFamily`, `fonts.cormorantGaramondMedium`, etc.

`useTypography()` returns text-size-scaled metrics derived from `settings.textSize`. Anything that should grow with the user's "Text size" setting must read from `useTypography()` rather than hardcoding `fontSize`.

### Data layer

- **Daily reading** (`hooks/useReading.ts` + `utils/readingCache.ts`): bundled JSON content, no remote read. Date keyed by `todayKey`.
- **Speakers** (`hooks/useSpeakers.tsx`): list pulled from Supabase, audio downloaded on demand via `hooks/useSpeakerDownload.ts`. Featured-speaker rotation in `hooks/useFeaturedSpeaker.ts`. Resume position + completion tracking — see `memory/project_speaker_resume.md`.
- **Journal / Notebook** (`hooks/useJournalStorage.ts`, `useLocalJournalEntries.ts`): on-device storage; the v2 schema is in `database/migration_journal_v2.sql`.
- **Personal prayers** (`hooks/usePersonalPrayers.ts`): on-device.
- **Gratitude / Journal quotes** (`useDailyGratitudeQuote.ts`, `useDailyJournalQuote.ts`): rotated remote quotes with local cache (`utils/gratitudeQuoteCache.ts`, `utils/journalQuoteCache.ts`).
- **Bookmarks / favorites** (`utils/bookmarkStorage.ts`, `hooks/useBookmarkManager.ts`): on-device. Architecture notes in the `BOOKMARK_*.md` design docs.

### Subscription / paywall flow (Android only)

The combination of trial + lifetime + grandfather is non-trivial. The authoritative explainer is `SubscriptionContext.tsx`. Key concepts:

- **`hasLifetimeAccess`** — detected via the local `paid-app-detector` Swift module on iOS (always true) and via RevenueCat entitlements on Android.
- **`hasSubAndLifetime`** — Android edge case where a legacy annual subscriber was manually granted lifetime in the RC dashboard during the 2.6.6 transition. Triggers **Modal A** (`SubscriberToLifetimeModal`).
- **Grandfather grant** — on Android, `lib/grandfather.ts` calls a Supabase edge function (`supabase/functions/grant-grandfather-lifetime`) that promotes eligible users to lifetime. On success, `showGrandfatherModal` flips true and **Modal B** (`GrandfatheredLifetimeModal`) fires.
- **Both Modal A and Modal B are gated to `Platform.OS === "android"`.** They never render on iOS.
- **Trial** — `utils/trialTimer.ts`. 3-day window, started on first launch when no lifetime/subscription exists.
- **Gate decision** — `utils/accessControl.ts.getRequiredGate(...)` is the single source of truth.

The QA panel (`app/qa-logs.tsx`) exposes overrides for almost all of this state (lifetime override, trial reset, grandfather simulate, modal previews) — that's the primary surface for testing edge cases.

### Notifications

Daily reminder time + enabled flag live in `useSettings`. `utils/notificationSync.ts` reconciles the OS schedule with settings; `utils/dailyReminder.ts` produces the next-fire datetime. The notification handler is set once at module load in `app/_layout.tsx`.

`components/NotificationCoachmark.tsx` + `hooks/useNotificationCoachmark.ts` is the spotlight-tooltip nudge that appears on the reading screen when the daily reminder is off and the user has scrolled to the bottom. It's measurement-driven (`measureInWindow` + a `requestAnimationFrame` re-measure to handle iOS layout-commit timing).

### Analytics & QA logging

- `utils/analytics.ts` — Mixpanel event helpers (`useAnalytics()` hook). Use these instead of importing Mixpanel directly.
- `utils/qaLog.ts` — in-app circular log buffer, viewable in `app/qa-logs.tsx`. `qaLog(scope, message, details?)` from anywhere; show via long-press on Settings (`app/(tabs)/more.tsx`) or the Settings screen's developer section.

## Conventions

- **Match existing component style.** When adding cards, glyphs, or decoration, look at recent additions on the home Speaker card (`app/(tabs)/home.tsx`) and the reading-page quote (`components/ReadingScreen.tsx`) — both use Cormorant Garamond Medium open-quote glyphs and the same teal palette tokens. The teal that backs the prayers/tools icon pips is `colors.secondary`; foreground on it is `colors.onSecondary`.
- **Never read `new Date()` directly in a screen.** Use `useAppDate()` so date rotations advance correctly across local midnight.
- **Don't hardcode font names.** Use `fonts.*` from `constants/theme.ts`.
- **Don't hardcode color hexes.** Use `useTheme().colors.*`. The terracotta subscription palette is the only fixed-hue exception.
- **Text-size scaling** flows through `useTypography()`. Anything in the reading flow especially must respect it.
- **QA-gated test affordances** belong in `app/qa-logs.tsx`, not scattered across screens. The pattern is: store override in AsyncStorage, expose a setter/clearer in the QA panel, read it at the consumption site.
- **Commits are atomic and feature-scoped.** Recent log shows the style — short imperative subject, a few-sentence body explaining *why* when non-obvious. Co-authored-by trailer for Claude commits is the convention.

## Things to know before editing

- The `BOOKMARK_*.md`, `FEEDBACK_*.md`, `LOVABLE_*.md`, `NOTIFICATION_FIX.md`, `RESTORE_WORKING_BUILD.md`, and other top-level `.md` files are historical implementation notes. They're not authoritative for current state — read code first, treat the docs as background.
- `docs/visual-redesign-change-spec.md`, `docs/speakers-build-spec.md`, `THEME_ELEMENTS_AND_COLORS.md`, `TYPOGRAPHY_AUDIT.md`, `WEB_STYLE_GUIDE.md` are design references; useful for understanding intent but check the code for what actually shipped.
- `modules/paid-app-detector` is a local Expo native module (Swift / Kotlin). Editing it requires a native rebuild — OTA won't pick up native changes.
- The `crashes/` directory is committed crash reports, not source.
- iOS = paid download, no IAP. Don't add subscription / trial UI for iOS.
