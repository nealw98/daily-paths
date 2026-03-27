import { useCallback, useEffect, useState } from "react";
import {
  fetchAndCacheJournalQuote,
  getCachedJournalQuote,
  type JournalQuote,
} from "../utils/journalQuoteCache";
import { useAppDate } from "../contexts/AppDateContext";

interface UseWeeklyJournalQuoteOptions {
  enabled?: boolean;
}

export function useWeeklyJournalQuote(
  options: UseWeeklyJournalQuoteOptions = {}
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

    const cached = await getCachedJournalQuote(today);
    if (cached?.quote) {
      setQuote(cached.quote);
      finishedFromCache = true;
      setLoading(false);
    }

    const fresh = await fetchAndCacheJournalQuote(today);
    if (fresh?.quote) {
      setQuote(fresh.quote);
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

      const cached = await getCachedJournalQuote(today);
      if (!cancelled && cached?.quote) {
        setQuote(cached.quote);
        setLoading(false);
      }

      const fresh = await fetchAndCacheJournalQuote(today);
      if (!cancelled && fresh?.quote) {
        setQuote(fresh.quote);
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
