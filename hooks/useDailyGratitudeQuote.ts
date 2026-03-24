import { useCallback, useEffect, useState } from "react";
import { formatDateLocal } from "../utils/dateUtils";
import {
  fetchAndCacheGratitudeQuote,
  getCachedGratitudeQuote,
  type GratitudeQuote,
} from "../utils/gratitudeQuoteCache";

interface UseDailyGratitudeQuoteOptions {
  enabled?: boolean;
}

export function useDailyGratitudeQuote(
  date: Date = new Date(),
  options: UseDailyGratitudeQuoteOptions = {}
) {
  const { enabled = true } = options;
  const dateKey = formatDateLocal(date);
  const [quote, setQuote] = useState<GratitudeQuote | null>(null);
  const [loading, setLoading] = useState(true);

  const loadQuote = useCallback(async () => {
    if (!enabled) {
      setQuote(null);
      setLoading(false);
      return;
    }

    let finishedFromCache = false;
    setLoading(true);

    const cached = await getCachedGratitudeQuote(date);
    if (cached?.quote) {
      setQuote(cached.quote);
      finishedFromCache = true;
      setLoading(false);
    }

    const fresh = await fetchAndCacheGratitudeQuote(date);
    if (fresh?.quote) {
      setQuote(fresh.quote);
    }

    if (!finishedFromCache) {
      setLoading(false);
    }
  }, [date, enabled]);

  useEffect(() => {
    if (!enabled) {
      setQuote(null);
      setLoading(false);
      return;
    }

    let cancelled = false;

    const run = async () => {
      setLoading(true);

      const cached = await getCachedGratitudeQuote(date);
      if (!cancelled && cached?.quote) {
        setQuote(cached.quote);
        setLoading(false);
      }

      const fresh = await fetchAndCacheGratitudeQuote(date);
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
  }, [date, dateKey, enabled]);

  return {
    quote,
    loading,
    refresh: loadQuote,
  };
}
