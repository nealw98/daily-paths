import { useState, useEffect, useCallback, useRef } from "react";
import { supabase } from "../lib/supabase";
import { qaLog } from "../utils/qaLog";
import { trackEvent } from "../utils/trackEvent";
import { ANALYTICS_EVENTS } from "../utils/analytics";

const SAVE_REQUEST_TIMEOUT_MS = 6000;
const FETCH_REQUEST_TIMEOUT_MS = 8000;

export interface GratitudeEntry {
  id: string;
  user_id: string;
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

/**
 * Hook for managing gratitude entries and daily quotes.
 * The daily quote is always fetched (public table).
 * Entries require a userId.
 */
export function useGratitude(userId: string | null | undefined) {
  const [todayEntry, setTodayEntry] = useState<GratitudeEntry | null>(null);
  const [history, setHistory] = useState<GratitudeEntry[]>([]);
  const [todayQuote, setTodayQuote] = useState<GratitudeQuote | null>(null);
  const [loading, setLoading] = useState(true);
  const mounted = useRef(true);
  const runWithTimeout = useCallback(
    async <T,>(
      runner: (signal: AbortSignal) => Promise<T>,
      timeoutMs = SAVE_REQUEST_TIMEOUT_MS,
      timeoutLabel = "Request timed out",
    ): Promise<T> => {
      const controller = new AbortController();
      const timer = setTimeout(() => controller.abort(), timeoutMs);
      try {
        return await runner(controller.signal);
      } catch (err) {
        const msg = String(err);
        if (msg.toLowerCase().includes("abort")) {
          throw new Error(timeoutLabel);
        }
        throw err;
      } finally {
        clearTimeout(timer);
      }
    },
    [],
  );

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

  // Fetch user entries (requires auth)
  const fetchEntries = useCallback(async () => {
    if (!userId) {
      setTodayEntry(null);
      setHistory([]);
      setLoading(false);
      return;
    }

    try {
      setLoading(true);

      // Fetch today's entry
      const { data: todayData } = await runWithTimeout(
        (signal) =>
          supabase
            .from("gratitude_entries")
            .select("*")
            .eq("user_id", userId)
            .eq("date", todayStr)
            .single()
            .abortSignal(signal),
        FETCH_REQUEST_TIMEOUT_MS,
        "Fetch timed out",
      );

      if (mounted.current && todayData) {
        setTodayEntry({
          ...todayData,
          items: Array.isArray(todayData.items) ? todayData.items : [],
        });
      } else if (mounted.current) {
        setTodayEntry(null);
      }

      // Fetch history (last 30 entries)
      const { data: historyData } = await runWithTimeout(
        (signal) =>
          supabase
            .from("gratitude_entries")
            .select("*")
            .eq("user_id", userId)
            .order("date", { ascending: false })
            .limit(30)
            .abortSignal(signal),
        FETCH_REQUEST_TIMEOUT_MS,
        "Fetch timed out",
      );

      if (mounted.current) {
        setHistory(
          (historyData || []).map((entry) => ({
            ...entry,
            items: Array.isArray(entry.items) ? entry.items : [],
          }))
        );
      }
    } catch (err) {
      qaLog("gratitude", "Error fetching entries", { error: String(err) });
    } finally {
      if (mounted.current) setLoading(false);
    }
  }, [userId, todayStr, runWithTimeout]);

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
      if (!userId) return false;

      const filteredItems = items.filter((item) => item.trim().length > 0);
      if (filteredItems.length === 0) return false;

      try {
        const { data, error } = await runWithTimeout(
          (signal) =>
            supabase
              .from("gratitude_entries")
              .upsert(
                {
                  user_id: userId,
                  date: todayStr,
                  items: filteredItems,
                },
                { onConflict: "user_id,date" }
              )
              .select()
              .single()
              .abortSignal(signal),
          SAVE_REQUEST_TIMEOUT_MS,
          "Save timed out",
        );

        if (error) {
          qaLog("gratitude", "Error saving entry", { error: error.message });
          return false;
        }

        if (data) {
          const entry = {
            ...data,
            items: Array.isArray(data.items) ? data.items : [],
          };
          setTodayEntry(entry);
          // Update history
          setHistory((prev) => {
            const existing = prev.findIndex((e) => e.date === todayStr);
            if (existing >= 0) {
              const updated = [...prev];
              updated[existing] = entry;
              return updated;
            }
            return [entry, ...prev];
          });
        }

        qaLog("gratitude", "Entry saved", { date: todayStr, itemCount: filteredItems.length });

        // Track create vs edit based on whether an entry existed before save
        const isEdit = !!todayEntry;
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
    [userId, todayStr, todayEntry, runWithTimeout]
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
