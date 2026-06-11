import AsyncStorage from "@react-native-async-storage/async-storage";
import Constants from "expo-constants";
import { qaLog } from "./qaLog";

/**
 * Age confirmation (Texas SB 2420 / app-store 13+ compliance).
 *
 * Daily Paths is rated 13+. To satisfy the Texas age-verification requirement
 * we record a one-time affirmation that the user is 13 or older. This is a
 * record-only gate — it never blocks access. The stored record exists so we
 * can demonstrate the user was presented with, and acknowledged, the age
 * requirement.
 */
const AGE_CONFIRMED_KEY = "@daily_paths_age_confirmed_v1";

export interface AgeConfirmationRecord {
  confirmed: true;
  /** ISO timestamp of when the user acknowledged the 13+ requirement. */
  confirmedAt: string;
  /** App version that presented the confirmation, for audit context. */
  appVersion: string | null;
}

/** True once the user has acknowledged the 13+ requirement on this device. */
export async function isAgeConfirmed(): Promise<boolean> {
  try {
    const raw = await AsyncStorage.getItem(AGE_CONFIRMED_KEY);
    if (!raw) return false;
    const parsed = JSON.parse(raw) as Partial<AgeConfirmationRecord>;
    return parsed?.confirmed === true;
  } catch (err) {
    // On a read/parse error, treat as unconfirmed so the gate re-presents
    // rather than silently skipping the requirement.
    qaLog("age", "Failed to read age confirmation — treating as unconfirmed", {
      error: String(err),
    });
    return false;
  }
}

/** Persist the 13+ acknowledgment with a timestamp. */
export async function recordAgeConfirmation(): Promise<void> {
  const record: AgeConfirmationRecord = {
    confirmed: true,
    confirmedAt: new Date().toISOString(),
    appVersion: Constants.expoConfig?.version ?? null,
  };
  try {
    await AsyncStorage.setItem(AGE_CONFIRMED_KEY, JSON.stringify(record));
    qaLog("age", "Age confirmation recorded", record);
  } catch (err) {
    qaLog("age", "Failed to persist age confirmation", { error: String(err) });
  }
}

/** QA-only: clear the stored confirmation so the gate presents again. */
export async function clearAgeConfirmation(): Promise<void> {
  try {
    await AsyncStorage.removeItem(AGE_CONFIRMED_KEY);
    qaLog("age", "Age confirmation cleared (QA)");
  } catch (err) {
    qaLog("age", "Failed to clear age confirmation", { error: String(err) });
  }
}
