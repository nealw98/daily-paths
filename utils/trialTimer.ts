import AsyncStorage from "@react-native-async-storage/async-storage";
import { trackEvent } from "./trackEvent";
import { ANALYTICS_EVENTS } from "./analytics";

/**
 * Local 7-day trial timer for the freemium model.
 *
 * The clock starts on first app open and is stored as an ISO timestamp in
 * AsyncStorage.  During the trial window every feature is accessible without
 * an account.  After the window expires, premium tabs (Journal, Prayers,
 * Speakers) require a subscription.
 */

const TRIAL_START_KEY = "@daily_paths_trial_start";
const TRIAL_ENDED_TRACKED_KEY = "@daily_paths_trial_ended_tracked";
const TRIAL_ENDED_MODAL_SEEN_KEY = "@daily_paths_trial_ended_modal_seen";
const TRIAL_DURATION_MS = 7 * 24 * 60 * 60 * 1000; // 7 days

export interface TrialStatus {
  /** True when within the 7-day window */
  isInTrial: boolean;
  /** True when past the 7-day window */
  trialExpired: boolean;
  /** True when no trial start has been recorded yet (very first launch) */
  neverStarted: boolean;
  /** ISO date string of when the trial started, or null */
  trialStartDate: string | null;
  /** Whole days remaining (0 when expired) */
  daysRemaining: number;
}

/**
 * Ensure a trial-start timestamp exists.  Safe to call on every launch —
 * only writes if the key doesn't exist yet.
 */
export async function ensureTrialStarted(): Promise<void> {
  try {
    const existing = await AsyncStorage.getItem(TRIAL_START_KEY);
    if (!existing) {
      await AsyncStorage.setItem(TRIAL_START_KEY, new Date().toISOString());
      trackEvent(ANALYTICS_EVENTS.TRIAL_STARTED, {}, true);
    }
  } catch (err) {
    // AsyncStorage failure should not crash the app
    console.warn("[trialTimer] ensureTrialStarted error:", err);
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
        daysRemaining: 7,
      };
    }

    const startMs = new Date(startStr).getTime();
    const elapsed = Date.now() - startMs;
    const remaining = Math.max(
      0,
      Math.ceil((TRIAL_DURATION_MS - elapsed) / (24 * 60 * 60 * 1000)),
    );

    // Fire trial_ended exactly once when expiry is first detected
    if (elapsed >= TRIAL_DURATION_MS) {
      try {
        const alreadyTracked = await AsyncStorage.getItem(TRIAL_ENDED_TRACKED_KEY);
        if (!alreadyTracked) {
          await AsyncStorage.setItem(TRIAL_ENDED_TRACKED_KEY, "true");
          trackEvent(ANALYTICS_EVENTS.TRIAL_ENDED, {
            trial_start_date: startStr,
            trial_duration_days: 7,
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
      daysRemaining: 7,
    };
  }
}

/**
 * Reset the trial (dev / testing only).
 * Removes the start timestamp so the next app interaction starts a fresh trial.
 */
export async function resetTrial(): Promise<void> {
  await AsyncStorage.removeItem(TRIAL_START_KEY);
}

/**
 * Immediately expire the trial (dev / testing only).
 * Sets the start date to 8 days ago so the trial appears expired without
 * needing to manipulate the device clock.
 */
export async function expireTrial(): Promise<void> {
  const expired = new Date(
    Date.now() - TRIAL_DURATION_MS - 24 * 60 * 60 * 1000,
  );
  await AsyncStorage.setItem(TRIAL_START_KEY, expired.toISOString());
}

export async function hasSeenTrialEndedModal(): Promise<boolean> {
  try {
    const val = await AsyncStorage.getItem(TRIAL_ENDED_MODAL_SEEN_KEY);
    return val === "true";
  } catch {
    return false;
  }
}

export async function markTrialEndedModalSeen(): Promise<void> {
  try {
    await AsyncStorage.setItem(TRIAL_ENDED_MODAL_SEEN_KEY, "true");
  } catch {
    // Non-critical
  }
}
