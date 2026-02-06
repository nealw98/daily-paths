import { useMemo } from "react";
import type { JournalEntry } from "./useJournalEntries";

export interface JournalStats {
  total: number;
  thisMonth: number;
  thisWeek: number;
  today: number;
}

/**
 * Hook that computes journal entry statistics from the entries array.
 */
export function useJournalStats(entries: JournalEntry[]): JournalStats {
  return useMemo(() => {
    const now = new Date();
    const todayStr = now.toISOString().split("T")[0];

    // Start of current week (Sunday)
    const weekStart = new Date(now);
    weekStart.setDate(weekStart.getDate() - weekStart.getDay());
    weekStart.setHours(0, 0, 0, 0);

    // Start of current month
    const monthStart = new Date(now.getFullYear(), now.getMonth(), 1);

    let thisMonth = 0;
    let thisWeek = 0;
    let today = 0;

    for (const entry of entries) {
      const entryDate = new Date(entry.created_at);
      const entryDateStr = entryDate.toISOString().split("T")[0];

      if (entryDateStr === todayStr) {
        today++;
      }

      if (entryDate >= weekStart) {
        thisWeek++;
      }

      if (entryDate >= monthStart) {
        thisMonth++;
      }
    }

    return {
      total: entries.length,
      thisMonth,
      thisWeek,
      today,
    };
  }, [entries]);
}
