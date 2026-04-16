/**
 * Shared journal streak calculation.
 *
 * Extracted verbatim from JournalTimeline's inline useMemo so both the
 * Notebook screen and the Home screen compute the same value from the
 * same input. Any change to the algorithm must happen here only.
 *
 * Assumes `entries` is the full list returned by useJournalStorage()
 * (unfiltered, every entry type). The caller is responsible for passing
 * the entries in that shape — the Notebook tab passes them unfiltered,
 * so Home must too.
 */

export interface StreakEntry {
  created_at: string;
}

/** YYYY-MM-DD key from a Date (local timezone). */
function toDateKey(d: Date): string {
  const y = d.getFullYear();
  const m = String(d.getMonth() + 1).padStart(2, "0");
  const day = String(d.getDate()).padStart(2, "0");
  return `${y}-${m}-${day}`;
}

/**
 * Count consecutive days, ending today, that have at least one entry.
 * Returns 0 if there are no entries or today has no entry.
 */
export function computeJournalStreak(entries: StreakEntry[]): number {
  if (entries.length === 0) return 0;

  const entryDays = new Set<string>(
    entries.map((entry) => toDateKey(new Date(entry.created_at)))
  );

  const cursor = new Date();
  cursor.setHours(0, 0, 0, 0);

  let streak = 0;
  while (entryDays.has(toDateKey(cursor))) {
    streak += 1;
    cursor.setDate(cursor.getDate() - 1);
  }

  return streak;
}
