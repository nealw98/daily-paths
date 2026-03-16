import { useState, useEffect, useCallback, useRef } from "react";
import AsyncStorage from "@react-native-async-storage/async-storage";
import { supabase } from "../lib/supabase";
import { qaLog } from "../utils/qaLog";
import { trackEvent } from "../utils/trackEvent";
import { ANALYTICS_EVENTS } from "../utils/analytics";

const STORAGE_KEY = "@daily_paths_gratitude_entries";

export interface GratitudeEntry {
  id: string;
  date: string; // YYYY-MM-DD
  items: string[]; // Array of gratitude items
  created_at: string;
}

export interface GratitudeQuote {
  id: string;
  day_of_year: number;
  quote: string;
  author: string | null;
}

// ── Local storage helpers ───────────────────────────────────────────────────

function localId(): string {
  return `grat_${Date.now().toString(36)}_${Math.random().toString(36).slice(2, 8)}`;
}

async function readAllEntries(): Promise<GratitudeEntry[]> {
  try {
    const raw = await AsyncStorage.getItem(STORAGE_KEY);
    return raw ? JSON.parse(raw) : [];
  } catch {
    return [];
  }
}

async function writeAllEntries(entries: GratitudeEntry[]): Promise<void> {
  await AsyncStorage.setItem(STORAGE_KEY, JSON.stringify(entries));
}

// ── Hook ────────────────────────────────────────────────────────────────────

/**
 * Hook for managing gratitude entries (AsyncStorage) and daily quotes (Supabase).
 * The daily quote is fetched from the public `gratitude_quotes` table.
 * Entries are stored locally in AsyncStorage.
 */
export function useGratitude() {
  const [todayEntry, setTodayEntry] = useState<GratitudeEntry | null>(null);
  const [history, setHistory] = useState<GratitudeEntry[]>([]);
  const [todayQuote, setTodayQuote] = useState<GratitudeQuote | null>(null);
  const [loading, setLoading] = useState(true);
  const mounted = useRef(true);

  const todayStr = new Date().toISOString().split("T")[0];

  // Always fetch today's quote (public table, no auth required)
  useEffect(() => {
    const fetchQuote = async () => {
      try {
        const dayOfYear = getDayOfYear(new Date());
        qaLog("gratitude", "Fetching quote", { dayOfYear });

        const { data: quoteData, error } = await supabase
          .from("gratitude_quotes")
          .select("*")
          .eq("day_of_year", dayOfYear)
          .single();

        if (error) {
          qaLog("gratitude", "Quote fetch error", {
            code: error.code,
            message: error.message,
            dayOfYear,
          });
        }

        if (mounted.current && quoteData) {
          qaLog("gratitude", "Quote loaded", { dayOfYear, author: quoteData.author });
          setTodayQuote(quoteData);
        } else if (mounted.current) {
          qaLog("gratitude", "No quote data returned", { dayOfYear });
        }
      } catch (err) {
        qaLog("gratitude", "Exception fetching quote", { error: String(err) });
      }
    };

    fetchQuote();
  }, []);

  // Fetch entries from AsyncStorage
  const fetchEntries = useCallback(async () => {
    try {
      setLoading(true);
      const all = await readAllEntries();

      if (mounted.current) {
        // Sort by date descending
        const sorted = all.sort((a, b) => b.date.localeCompare(a.date));
        setHistory(sorted.slice(0, 30));
        const today = sorted.find((e) => e.date === todayStr) ?? null;
        setTodayEntry(today);
      }
    } catch (err) {
      qaLog("gratitude", "Error fetching entries", { error: String(err) });
    } finally {
      if (mounted.current) setLoading(false);
    }
  }, [todayStr]);

  useEffect(() => {
    mounted.current = true;
    fetchEntries();
    return () => {
      mounted.current = false;
    };
  }, [fetchEntries]);

  // Save today's gratitude items
  const saveTodayItems = useCallback(
    async (items: string[]): Promise<boolean> => {
      const filteredItems = items.filter((item) => item.trim().length > 0);
      if (filteredItems.length === 0) return false;

      try {
        const all = await readAllEntries();
        const existingIdx = all.findIndex((e) => e.date === todayStr);

        const isEdit = existingIdx >= 0;
        let entry: GratitudeEntry;

        if (isEdit) {
          entry = { ...all[existingIdx], items: filteredItems };
          all[existingIdx] = entry;
        } else {
          entry = {
            id: localId(),
            date: todayStr,
            items: filteredItems,
            created_at: new Date().toISOString(),
          };
          all.unshift(entry);
        }

        await writeAllEntries(all);
        setTodayEntry(entry);

        // Update history
        const sorted = all.sort((a, b) => b.date.localeCompare(a.date));
        setHistory(sorted.slice(0, 30));

        qaLog("gratitude", "Entry saved", { date: todayStr, itemCount: filteredItems.length });

        trackEvent(
          isEdit ? ANALYTICS_EVENTS.GRATITUDE_ENTRY_EDITED : ANALYTICS_EVENTS.GRATITUDE_ENTRY_CREATED,
          {
            entry_type: 'gratitude',
            item_count: filteredItems.length,
            date: todayStr,
          },
        );

        return true;
      } catch (err) {
        qaLog("gratitude", "Exception saving entry", { error: String(err) });
        return false;
      }
    },
    [todayStr, todayEntry]
  );

  return {
    todayEntry,
    history,
    todayQuote,
    loading,
    saveTodayItems,
    refreshData: fetchEntries,
  };
}

function getDayOfYear(date: Date): number {
  const start = new Date(date.getFullYear(), 0, 0);
  const diff = date.getTime() - start.getTime();
  const oneDay = 1000 * 60 * 60 * 24;
  return Math.floor(diff / oneDay);
}
