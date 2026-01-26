/**
 * Formats a Date object to YYYY-MM-DD string in local timezone
 * (not UTC, which toISOString() would give us)
 */
export function formatDateLocal(date: Date): string {
  const year = date.getFullYear();
  const month = String(date.getMonth() + 1).padStart(2, "0");
  const day = String(date.getDate()).padStart(2, "0");
  return `${year}-${month}-${day}`;
}

/**
 * Parses a YYYY-MM-DD date string as local date (not UTC)
 */
export function parseDateLocal(dateString: string): Date {
  const [year, month, day] = dateString.split("-").map(Number);
  return new Date(year, month - 1, day);
}

/**
 * Gets the day of year (1-366) for a given date.
 *
 * Uses a UTC-based calculation so that daylight‑saving time changes
 * (23/25‑hour days) do NOT introduce off‑by‑one errors.
 *
 * January 1 = 1, December 31 = 365 (or 366 in leap year)
 */
export function getDayOfYear(date: Date): number {
  const year = date.getFullYear();

  const startUtc = Date.UTC(year, 0, 1); // Jan 1, 00:00 UTC
  const currentUtc = Date.UTC(year, date.getMonth(), date.getDate());

  const oneDay = 1000 * 60 * 60 * 24;
  return Math.floor((currentUtc - startUtc) / oneDay) + 1;
}

/**
 * Converts a day of year (1-366) to a Date in the specified year
 * Day 1 = January 1, Day 365/366 = December 31
 */
export function dateFromDayOfYear(dayOfYear: number, year: number): Date {
  return new Date(year, 0, dayOfYear);
}

/**
 * Leap‑year helper.
 */
export function isLeapYear(year: number): boolean {
  return (year % 4 === 0 && year % 100 !== 0) || year % 400 === 0;
}

/**
 * Returns the "scheduled" day_of_year for a given calendar date,
 * assuming the `readings.day_of_year` column is keyed as if EVERY
 * year were a leap year:
 *
 * - 59 → Feb 28
 * - 60 → Feb 29
 * - 61 → Mar 1
 *
 * Behaviour:
 * - In a **leap year**, we just use the real calendar day‑of‑year.
 * - In a **non‑leap year**, days **after Feb 28** are shifted by +1 so
 *   that Mar 1 (real day 60) maps to 61, and the Feb 29 slot (60)
 *   is effectively skipped.
 *
 * Result: Mar 1 always uses `day_of_year = 61` in BOTH leap and
 * non‑leap years; `day_of_year = 60` is only ever used on Feb 29
 * in leap years.
 */
export function getScheduledDayOfYear(date: Date): number {
  const real = getDayOfYear(date);
  const year = date.getFullYear();

  if (isLeapYear(year) || real <= 59) {
    return real;
  }

  // Non‑leap year and after Feb 28 → shift by +1 (skip 60).
  return real + 1;
}
