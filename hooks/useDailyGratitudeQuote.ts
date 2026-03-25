import { useCallback, useEffect, useMemo, useState } from "react";
import { formatDateLocal, parseDateLocal } from "../utils/dateUtils";
import {
  fetchAndCacheGratitudeQuote,
  getCachedGratitudeQuote,
  type GratitudeQuote,
} from "../utils/gratitudeQuoteCache";
import { useAppDate } from "../contexts/AppDateContext";

interface UseDailyGratitudeQuoteOptions {
  enabled?: boolean;
}

export function useDailyGratitudeQuote(
  dateOrOptions?: Date | UseDailyGratitudeQuoteOptions,
  maybeOptions: UseDailyGratitudeQuoteOptions = {}
) {
  const date = dateOrOptions instanceof Date ? dateOrOptions : undefined;
  const options =
    dateOrOptions instanceof Date ? maybeOptions : (dateOrOptions ?? {});
  const { enabled = true } = options;
  const { today, todayKey } = useAppDate();
  const hasProvidedDate = typeof date !== "undefined";
  const dateKey = hasProvidedDate ? formatDateLocal(date) : todayKey;
  const targetDate = useMemo(
    () => (hasProvidedDate ? parseDateLocal(dateKey) : today),
    [hasProvidedDate, dateKey, today]
  );
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

    const cached = await getCachedGratitudeQuote(targetDate);
    if (cached?.quote) {
      setQuote(cached.quote);
      finishedFromCache = true;
      setLoading(false);
    }

    const fresh = await fetchAndCacheGratitudeQuote(targetDate);
    if (fresh?.quote) {
      setQuote(fresh.quote);
    }

    if (!finishedFromCache) {
      setLoading(false);
    }
  }, [dateKey, enabled, targetDate]);

  useEffect(() => {
    if (!enabled) {
      setQuote(null);
      setLoading(false);
      return;
    }

    let cancelled = false;

    const run = async () => {
      setLoading(true);

      const cached = await getCachedGratitudeQuote(targetDate);
      if (!cancelled && cached?.quote) {
        setQuote(cached.quote);
        setLoading(false);
      }

      const fresh = await fetchAndCacheGratitudeQuote(targetDate);
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
  }, [dateKey, enabled, targetDate]);

  return {
    quote,
    loading,
    refresh: loadQuote,
  };
}
