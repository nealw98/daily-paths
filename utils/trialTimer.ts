import AsyncStorage from "@react-native-async-storage/async-storage";
import Purchases from "react-native-purchases";
import { Platform } from "react-native";
import { trackEvent } from "./trackEvent";
import { ANALYTICS_EVENTS } from "./analytics";
import { supabase } from "../lib/supabase";
import { qaLog } from "./qaLog";

/**
 * Local 3-day trial timer for the try-before-you-buy model.
 *
 * The clock starts on first 2.7 app open and is stored as an ISO timestamp in
 * AsyncStorage. During the trial window every feature is accessible without
 * an account. After the window expires, a hard paywall blocks the app on
 * Android until the user purchases the lifetime IAP.
 */

const LEGACY_TRIAL_START_KEY = "@daily_paths_trial_start";
const TRIAL_START_KEY = "@daily_paths_v27_trial_start";
const TRIAL_ENDED_TRACKED_KEY = "@daily_paths_v27_trial_ended_tracked";
const TRIAL_DAY_TRACKED_PREFIX = "@daily_paths_v27_trial_day_";
const TRIAL_DURATION_DAYS = 3;
const DAY_MS = 24 * 60 * 60 * 1000;
const TRIAL_DURATION_MS = TRIAL_DURATION_DAYS * DAY_MS;

export interface TrialStatus {
  /** True when within the trial window */
  isInTrial: boolean;
  /** True when past the trial window */
  trialExpired: boolean;
  /** True when no trial start has been recorded yet (very first launch) */
  neverStarted: boolean;
  /** ISO date string of when the trial started, or null */
  trialStartDate: string | null;
  /** Whole days remaining (0 when expired) */
  daysRemaining: number;
}

export interface LegacyTrialMarker {
  /** Old 2.6.x seven-day trial timestamp, if this install opened that app. */
  trialStartDate: string | null;
  /** True when the old timestamp parses to a valid date. */
  hasValidMarker: boolean;
}

/**
 * Read the old 2.6.x trial marker. The 2.7 trial must never write this key;
 * it is now migration evidence for grandfathering existing Android users.
 */
export async function getLegacyTrialMarker(): Promise<LegacyTrialMarker> {
  try {
    const trialStartDate = await AsyncStorage.getItem(LEGACY_TRIAL_START_KEY);
    if (!trialStartDate) {
      return { trialStartDate: null, hasValidMarker: false };
    }

    return {
      trialStartDate,
      hasValidMarker: !Number.isNaN(Date.parse(trialStartDate)),
    };
  } catch (err) {
    console.warn("[trialTimer] getLegacyTrialMarker error:", err);
    return { trialStartDate: null, hasValidMarker: false };
  }
}

/** QA helper: create the old 2.6.x marker used for grandfather testing. */
export async function setLegacyTrialMarkerForQa(dateIso?: string): Promise<string> {
  const marker = dateIso ?? new Date(Date.now() - 7 * DAY_MS).toISOString();
  await AsyncStorage.setItem(LEGACY_TRIAL_START_KEY, marker);
  return marker;
}

/** QA helper: remove the old 2.6.x grandfather marker. */
export async function clearLegacyTrialMarkerForQa(): Promise<void> {
  await AsyncStorage.removeItem(LEGACY_TRIAL_START_KEY);
}

/**
 * Ensure a trial-start timestamp exists. Safe to call on every launch —
 * only writes if the key doesn't exist yet.
 *
 * On Android, the canonical trial start lives in Supabase (table
 * `android_trial_starts`) keyed by the RC App User ID. Clearing app data
 * does not reset the trial — the server replays the original timestamp.
 * Local AsyncStorage acts as the offline cache.
 *
 * If the network call fails (offline first launch), we fall back to the
 * local timestamp. The server will reconcile on the next launch — using
 * whichever is older (server keeps the existing row when the client sends
 * a `fallback_start_at` after a row already exists).
 */
export async function ensureTrialStarted(): Promise<void> {
  let local: string | null = null;
  try {
    local = await AsyncStorage.getItem(TRIAL_START_KEY);
  } catch (err) {
    console.warn("[trialTimer] read local trial start failed:", err);
  }

  let canonical: string | null = local;
  // True only when the canonical timestamp is genuinely new (server inserted
  // a row, or we fell back to a brand-new local timestamp). Restored trials
  // (server returned an existing row) must NOT fire TRIAL_STARTED.
  let freshlyCreated = false;

  if (Platform.OS === "android") {
    try {
      const appUserId = await Purchases.getAppUserID();
      if (appUserId) {
        const { data, error } = await supabase.functions.invoke(
          "get-or-create-trial-start",
          {
            body: {
              app_user_id: appUserId,
              fallback_start_at: local ?? null,
            },
          },
        );
        if (error) {
          qaLog("trial-server", "get-or-create-trial-start error", {
            error: String(error),
          });
        } else if (data?.trial_start_at) {
          canonical = data.trial_start_at as string;
          freshlyCreated = !!data.created && !local;
          qaLog("trial-server", "Resolved trial start from server", {
            canonical,
            local,
            created: !!data.created,
            freshlyCreated,
          });
        }
      }
    } catch (err) {
      qaLog("trial-server", "get-or-create-trial-start unexpected error", {
        error: String(err),
      });
    }
  }

  if (!canonical) {
    // Offline / iOS / failed RC lookup → use a fresh local timestamp.
    canonical = new Date().toISOString();
    freshlyCreated = true;
  }

  try {
    if (canonical !== local) {
      await AsyncStorage.setItem(TRIAL_START_KEY, canonical);
    }
  } catch (err) {
    console.warn("[trialTimer] write local trial start failed:", err);
  }

  if (freshlyCreated) {
    trackEvent(ANALYTICS_EVENTS.TRIAL_STARTED, {}, true);
  }
}

/**
 * Read the current trial status.
 */
export async function getTrialStatus(): Promise<TrialStatus> {
  try {
    const startStr = await AsyncStorage.getItem(TRIAL_START_KEY);

    if (!startStr) {
      return {
        isInTrial: false,
        trialExpired: false,
        neverStarted: true,
        trialStartDate: null,
        daysRemaining: TRIAL_DURATION_DAYS,
      };
    }

    const startMs = new Date(startStr).getTime();
    const elapsed = Date.now() - startMs;
    const remaining = Math.max(
      0,
      Math.ceil((TRIAL_DURATION_MS - elapsed) / DAY_MS),
    );

    // Fire trial_day_reached once for each 24h boundary the user has crossed
    await markTrialDayReachedIfDue(elapsed, startStr);

    // Fire trial_ended exactly once when expiry is first detected
    if (elapsed >= TRIAL_DURATION_MS) {
      try {
        const alreadyTracked = await AsyncStorage.getItem(TRIAL_ENDED_TRACKED_KEY);
        if (!alreadyTracked) {
          await AsyncStorage.setItem(TRIAL_ENDED_TRACKED_KEY, "true");
          trackEvent(ANALYTICS_EVENTS.TRIAL_ENDED, {
            trial_start_date: startStr,
            trial_duration_days: TRIAL_DURATION_DAYS,
          }, true);
        }
      } catch {
        // Non-critical analytics — don't block status return
      }
    }

    return {
      isInTrial: elapsed < TRIAL_DURATION_MS,
      trialExpired: elapsed >= TRIAL_DURATION_MS,
      neverStarted: false,
      trialStartDate: startStr,
      daysRemaining: remaining,
    };
  } catch (err) {
    console.warn("[trialTimer] getTrialStatus error:", err);
    // Fail-open: treat as trial active so the user isn't locked out by a
    // transient storage error.
    return {
      isInTrial: true,
      trialExpired: false,
      neverStarted: false,
      trialStartDate: null,
      daysRemaining: TRIAL_DURATION_DAYS,
    };
  }
}

/**
 * Fire `trial_day_reached` events as the user crosses each 24h boundary.
 * Idempotent per day — won't re-fire across launches within the same day.
 *
 * Day-1 fires alongside TRIAL_STARTED on first open. Day-2 fires once after
 * 24h elapsed; Day-3 fires once after 48h elapsed.
 */
async function markTrialDayReachedIfDue(elapsedMs: number, trialStartIso: string): Promise<void> {
  const elapsedDays = Math.floor(elapsedMs / DAY_MS) + 1; // 1-indexed (day 1 = first 24h)
  const cap = Math.min(TRIAL_DURATION_DAYS, elapsedDays);

  for (let day = 1; day <= cap; day++) {
    try {
      const key = `${TRIAL_DAY_TRACKED_PREFIX}${day}_tracked`;
      const tracked = await AsyncStorage.getItem(key);
      if (tracked) continue;
      await AsyncStorage.setItem(key, "true");
      trackEvent(ANALYTICS_EVENTS.TRIAL_DAY_REACHED, {
        day,
        trial_start_date: trialStartIso,
        trial_duration_days: TRIAL_DURATION_DAYS,
      }, true);
    } catch {
      // Non-critical — continue
    }
  }
}

/**
 * Reset the trial (dev / testing only).
 * Removes the start timestamp so the next app interaction starts a fresh trial.
 */
export async function resetTrial(): Promise<void> {
  await AsyncStorage.removeItem(TRIAL_START_KEY);
  await AsyncStorage.removeItem(TRIAL_ENDED_TRACKED_KEY);
  for (let day = 1; day <= TRIAL_DURATION_DAYS; day++) {
    await AsyncStorage.removeItem(`${TRIAL_DAY_TRACKED_PREFIX}${day}_tracked`);
  }
}

/**
 * Immediately expire the trial (dev / testing only).
 * Sets the start date past the trial window so it appears expired without
 * needing to manipulate the device clock. Also clears trial analytics tracking
 * keys so TRIAL_ENDED and TRIAL_DAY_REACHED refire on the next status read.
 */
export async function expireTrial(): Promise<void> {
  const expired = new Date(Date.now() - TRIAL_DURATION_MS - DAY_MS);
  await AsyncStorage.setItem(TRIAL_START_KEY, expired.toISOString());
  await AsyncStorage.removeItem(TRIAL_ENDED_TRACKED_KEY);
  for (let day = 1; day <= TRIAL_DURATION_DAYS; day++) {
    await AsyncStorage.removeItem(`${TRIAL_DAY_TRACKED_PREFIX}${day}_tracked`);
  }
}
