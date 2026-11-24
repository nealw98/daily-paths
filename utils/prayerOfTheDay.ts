import { PRAYERS, type Prayer } from "../constants/prayers";
import { getScheduledDayOfYear } from "./dateUtils";

/**
 * Today's prayer for the wide layout (Today's prayer card, and the "Today's
 * prayer" label in Prayers): the built-in prayers in turn, one per day, keyed
 * to the same local day-of-year as the reflection image.
 */
export function getPrayerForDate(date: Date): Prayer | null {
  if (PRAYERS.length === 0) return null;
  return PRAYERS[getScheduledDayOfYear(date) % PRAYERS.length];
}
