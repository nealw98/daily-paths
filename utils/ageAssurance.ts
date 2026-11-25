/**
 * Store age assurance (docs/age-assurance/SPEC.md): Texas SB 2420 now, and
 * California, Alabama, Utah and Louisiana as they take effect.
 *
 * One code path for every user; the stores decide who is covered. Apple only
 * reports that age features apply for accounts in a regulated region, and
 * Google only returns age signals where the law requires it, so users
 * elsewhere are never prompted.
 *
 * Privacy rules (the laws and both stores require them):
 *   · the age range is used in memory and discarded — never stored on the
 *     device, in Supabase, RevenueCat or Mixpanel;
 *   · logs record only the outcome bucket (ok / blocked / unavailable).
 * The only things saved are when the last check ran and which significant
 * change the user has acknowledged — neither is age data.
 *
 * Any error or timeout counts as "unavailable" and never blocks the app.
 */
import { Platform } from "react-native";
import AsyncStorage from "@react-native-async-storage/async-storage";
import * as AgeRange from "expo-age-range";
import { qaLog } from "./qaLog";

/**
 * Raise only in a release Neal marks as a significant change (new paid
 * features or products, new kinds of personal data, ads, social features, a
 * higher age rating). Layout changes, bug fixes and new content don't count.
 * 2.9 is not a significant change.
 */
export const SIGNIFICANT_CHANGE_VERSION = 1;

/** Short description shown in Apple's acknowledgment sheet when the version is raised. */
const SIGNIFICANT_CHANGE_DESCRIPTION = "";

/** Why the app can't be used yet. */
export type AgeBlockReason =
  /** A parent or guardian hasn't approved (or withdrew approval for) the app. */
  | "parentApproval"
  /** The store needs the user to confirm their age before the app can tell. */
  | "verificationRequired";

export type AgeCheckResult =
  | { outcome: "ok" }
  | { outcome: "unavailable" }
  | { outcome: "blocked"; reason: AgeBlockReason };

const LAST_CHECK_KEY = "ageAssurance.lastCheckAt";
const ACKNOWLEDGED_CHANGE_KEY = "ageAssurance.acknowledgedChangeVersion";
const CHECK_INTERVAL_MS = 24 * 60 * 60 * 1000;
const TIMEOUT_MS = 15_000;

// Apple's and Texas's age categories: under 13, 13–15, 16–17, 18+.
const AGE_GATES = { threshold1: 13, threshold2: 16, threshold3: 18 };

function withTimeout<T>(promise: Promise<T>): Promise<T> {
  return Promise.race([
    promise,
    new Promise<T>((_, reject) => setTimeout(() => reject(new Error("timeout")), TIMEOUT_MS)),
  ]);
}

/** Whether the once-a-day check is due. Always true after a blocked result. */
export async function isAgeCheckDue(): Promise<boolean> {
  try {
    const last = Number(await AsyncStorage.getItem(LAST_CHECK_KEY));
    return !last || Date.now() - last >= CHECK_INTERVAL_MS;
  } catch {
    return true;
  }
}

async function acknowledgedChangeVersion(): Promise<number> {
  try {
    const stored = Number(await AsyncStorage.getItem(ACKNOWLEDGED_CHANGE_KEY));
    // A fresh install has nothing to acknowledge: start at the current version.
    return stored || SIGNIFICANT_CHANGE_VERSION;
  } catch {
    return SIGNIFICANT_CHANGE_VERSION;
  }
}

async function recordAcknowledgedChange() {
  try {
    await AsyncStorage.setItem(ACKNOWLEDGED_CHANGE_KEY, String(SIGNIFICANT_CHANGE_VERSION));
  } catch {}
}

async function checkIOS(): Promise<AgeCheckResult> {
  // iOS 26.2+: does age-assurance regulation apply to this account at all?
  let eligible: boolean | null = null;
  try {
    eligible = await withTimeout(AgeRange.isEligibleForAgeFeaturesAsync());
  } catch {}
  if (eligible === false) return { outcome: "ok" };
  if (eligible === null) {
    // Older iOS, or Apple couldn't say: no signal to act on.
    return { outcome: "unavailable" };
  }

  // Covered account: the law requires reading the age category. Apple itself
  // stops the app launching when a parent withdraws consent, so a minor who
  // gets here is approved.
  const range = await withTimeout(AgeRange.requestAgeRangeAsync(AGE_GATES));
  const isAdult = (range.lowerBound ?? 0) >= 18;

  if ((await acknowledgedChangeVersion()) < SIGNIFICANT_CHANGE_VERSION) {
    let features: AgeRange.AgeRangeRegulatoryFeature[] | null = null;
    try {
      features = await withTimeout(AgeRange.getRequiredRegulatoryFeaturesAsync());
    } catch {}
    if (isAdult && features?.includes("significantAppChangeRequiresAdultNotification")) {
      await AgeRange.showSignificantUpdateAcknowledgmentAsync(SIGNIFICANT_CHANGE_DESCRIPTION);
      await recordAcknowledgedChange();
    } else if (!isAdult && features?.includes("significantAppChangeRequiresParentalConsent")) {
      // Asking a parent goes through Apple's PermissionKit, which
      // expo-age-range doesn't expose yet. Wire it up before ever raising
      // SIGNIFICANT_CHANGE_VERSION; until then the version stays at 1.
      qaLog("age", "Significant change needs parental consent (PermissionKit not wired)");
    } else {
      await recordAcknowledgedChange();
    }
  }
  return { outcome: "ok" };
}

async function checkAndroid(): Promise<AgeCheckResult> {
  // Shows Google's age-sharing consent screen when it's needed.
  const status = await withTimeout(AgeRange.requestAgeSignalsAccessAsync());
  if (status === "VERIFICATION_REQUIRED") {
    return { outcome: "blocked", reason: "verificationRequired" };
  }
  if (status !== "SHARED") {
    // NOT_SHARED (declined) or no status (not a covered region): nothing to act on.
    return { outcome: "unavailable" };
  }

  const range = await withTimeout(AgeRange.requestAgeRangeAsync(AGE_GATES));
  // A parent declined, or hasn't yet approved, the app or a significant change.
  // Google reports the change status for supervised (minor) accounts only.
  if (range.significantChangeStatus === "DECLINED" || range.significantChangeStatus === "PENDING") {
    return { outcome: "blocked", reason: "parentApproval" };
  }
  return { outcome: "ok" };
}

/** Runs the store age check once. Never throws. */
export async function runAgeCheck(): Promise<AgeCheckResult> {
  let result: AgeCheckResult;
  try {
    if (Platform.OS === "ios") result = await checkIOS();
    else if (Platform.OS === "android") result = await checkAndroid();
    else result = { outcome: "unavailable" };
  } catch (error) {
    qaLog("age", "Age check failed; not blocking", { error: String(error) });
    result = { outcome: "unavailable" };
  }
  // A blocked user is checked again on every launch and return to the app,
  // so the notice lifts as soon as a parent approves.
  try {
    if (result.outcome === "blocked") await AsyncStorage.removeItem(LAST_CHECK_KEY);
    else await AsyncStorage.setItem(LAST_CHECK_KEY, String(Date.now()));
  } catch {}
  // The outcome bucket only — never the age range.
  qaLog("age", `age_check: ${result.outcome}`, result.outcome === "blocked" ? { reason: result.reason } : undefined);
  return result;
}

/** QA: forget when the last check ran so the next launch checks again. */
export async function resetAgeCheckSchedule() {
  try {
    await AsyncStorage.multiRemove([LAST_CHECK_KEY, ACKNOWLEDGED_CHANGE_KEY]);
  } catch {}
}
