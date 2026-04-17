import { useCallback, useEffect, useState } from "react";
import {
  fetchAndCacheJournalQuotes,
  getCachedJournalQuotes,
  pickJournalQuoteForDate,
  type JournalQuote,
} from "../utils/journalQuoteCache";
import { useAppDate } from "../contexts/AppDateContext";

interface UseDailyJournalQuoteOptions {
  enabled?: boolean;
}

/**
 * Returns the journal quote for today.
 *
 * The full list of journal quotes is fetched once and cached locally; today's
 * pick is computed client-side (epoch-day % list length) so every device sees
 * the same quote on the same day.
 */
export function useDailyJournalQuote(
  options: UseDailyJournalQuoteOptions = {}
) {
  const { enabled = true } = options;
  const { today, todayKey } = useAppDate();
  const [quote, setQuote] = useState<JournalQuote | null>(null);
  const [loading, setLoading] = useState(true);

  const loadQuote = useCallback(async () => {
    if (!enabled) {
      setQuote(null);
      setLoading(false);
      return;
    }

    setLoading(true);
    let finishedFromCache = false;

    const cached = await getCachedJournalQuotes();
    if (cached?.quotes?.length) {
      const pick = pickJournalQuoteForDate(today, cached.quotes);
      if (pick) {
        setQuote(pick);
        finishedFromCache = true;
        setLoading(false);
      }
    }

    const fresh = await fetchAndCacheJournalQuotes();
    if (fresh?.quotes?.length) {
      const pick = pickJournalQuoteForDate(today, fresh.quotes);
      if (pick) {
        setQuote(pick);
      }
    }

    if (!finishedFromCache) {
      setLoading(false);
    }
  }, [todayKey, enabled, today]);

  useEffect(() => {
    if (!enabled) {
      setQuote(null);
      setLoading(false);
      return;
    }

    let cancelled = false;

    const run = async () => {
      setLoading(true);

      const cached = await getCachedJournalQuotes();
      if (!cancelled && cached?.quotes?.length) {
        const pick = pickJournalQuoteForDate(today, cached.quotes);
        if (pick) {
          setQuote(pick);
          setLoading(false);
        }
      }

      const fresh = await fetchAndCacheJournalQuotes();
      if (!cancelled && fresh?.quotes?.length) {
        const pick = pickJournalQuoteForDate(today, fresh.quotes);
        if (pick) {
          setQuote(pick);
        }
      }

      if (!cancelled) {
        setLoading(false);
      }
    };

    void run();

    return () => {
      cancelled = true;
    };
  }, [todayKey, enabled, today]);

  return {
    quote,
    loading,
    refresh: loadQuote,
  };
}
