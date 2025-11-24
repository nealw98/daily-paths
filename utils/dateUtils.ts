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
 * Gets the day of year (1-366) for a given date
 * January 1 = 1, December 31 = 365 (or 366 in leap year)
 */
export function getDayOfYear(date: Date): number {
  const start = new Date(date.getFullYear(), 0, 0);
  const diff = date.getTime() - start.getTime();
  const oneDay = 1000 * 60 * 60 * 24;
  return Math.floor(diff / oneDay);
}

/**
 * Converts a day of year (1-366) to a Date in the specified year
 * Day 1 = January 1, Day 365/366 = December 31
 */
export function dateFromDayOfYear(dayOfYear: number, year: number): Date {
  return new Date(year, 0, dayOfYear);
}

