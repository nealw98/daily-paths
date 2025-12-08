import { useState, useEffect } from "react";
import { supabase } from "../lib/supabase";
import { DailyReading } from "../types/readings";
import { formatDateLocal, getScheduledDayOfYear } from "../utils/dateUtils";
import {
  getCachedReading,
  setCachedReading,
  type CachedReading,
} from "../utils/readingCache";
import { qaLog } from "../utils/qaLog";

const PREFETCH_WINDOW_DAYS = 6; // today + next 6 days
const prefetchedDateKeys = new Set<string>();

function logCtx(date: Date) {
  return {
    dateLocal: formatDateLocal(date),
    iso: date.toISOString(),
    scheduledDayOfYear: getScheduledDayOfYear(date),
    dayOfMonth: date.getDate(),
    month: date.getMonth() + 1,
    year: date.getFullYear(),
    tzOffsetMinutes: date.getTimezoneOffset(),
  };
}

function transformRowToDailyReading(data: any, date: Date): DailyReading {
  const normalizedBody =
    (data.body as string | null | undefined)?.replace(/\\n/g, "\n") ?? "";
  const bodyParagraphs = normalizedBody
    .split(/\n{2,}/)
    .map((p: string) => p.trim())
    .filter((p: string) => p.length > 0);

  const rawQuote = (data as { quote?: string }).quote ?? "";

  const applicationText =
    (data as { application?: string; todays_application?: string }).application ??
    (data as { application?: string; todays_application?: string })
      .todays_application ??
    "";

  return {
    id: data.id,
    date,
    title: data.title,
    opening: data.opening,
    body: bodyParagraphs,
    quote: rawQuote,
    application: applicationText,
    thoughtForDay: data.thought_for_day,
  };
}

async function prefetchUpcomingReadings(anchorDate: Date) {
  for (let offset = 0; offset <= PREFETCH_WINDOW_DAYS; offset++) {
    const target = new Date(anchorDate);
    target.setDate(target.getDate() + offset);

    const key = formatDateLocal(target);
    if (prefetchedDateKeys.has(key)) {
      continue;
    }
    prefetchedDateKeys.add(key);

    try {
      const cached = await getCachedReading(target);
      if (cached?.reading) {
        qaLog("reading-prefetch", "Skip prefetch; already cached", {
          key,
          id: cached.reading.id,
        });
        continue;
      }

      const dayOfYear = getScheduledDayOfYear(target);
      qaLog("reading-prefetch", "Fetching for prefetch", {
        key,
        dayOfYear,
        ctx: logCtx(target),
      });

      const { data, error } = await supabase
        .from("readings")
        .select("*")
        .eq("day_of_year", dayOfYear)
        .maybeSingle();

      if (error) {
        qaLog("reading-prefetch", "Prefetch error from Supabase", {
          key,
          message: error.message,
          code: (error as any).code,
          ctx: logCtx(target),
        });
        continue;
      }

      if (!data) {
        qaLog("reading-prefetch", "No row to prefetch", {
          key,
          dayOfYear,
          ctx: logCtx(target),
        });
        continue;
      }

      qaLog("reading-prefetch", "Supabase response received (prefetch)", {
        key,
        dayOfYear,
        ctx: logCtx(target),
        id: (data as any)?.id ?? null,
        updated_at: (data as any)?.updated_at ?? null,
        title: (data as any)?.title ?? null,
        has_body: !!(data as any)?.body,
        body_len: typeof (data as any)?.body === "string" ? (data as any).body.length : null,
      });

      const transformed = transformRowToDailyReading(data, target);
      const remoteUpdatedAt =
        (data as { updated_at?: string }).updated_at ?? null;

      await setCachedReading(target, {
        reading: transformed,
        updatedAt: remoteUpdatedAt,
      });

      qaLog("reading-prefetch", "Prefetched and cached", {
        key,
        id: transformed.id,
        updatedAt: remoteUpdatedAt,
        ctx: logCtx(target),
      });
    } catch (err) {
      console.error("Prefetch error:", err);
      qaLog("reading-prefetch", "Unexpected prefetch error", {
        key,
        message: err instanceof Error ? err.message : String(err),
        ctx: logCtx(target),
      });
    }
  }
}

export function useReading(date: Date) {
  const [reading, setReading] = useState<DailyReading | null>(null);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);

  useEffect(() => {
    fetchReading();
  }, [date]);

  // Prefetch today + a short horizon so users can read offline.
  useEffect(() => {
    prefetchUpcomingReadings(date);
  }, [date]);

  async function fetchReading() {
    const ctx = logCtx(date);
    qaLog("reading", "Fetching reading", ctx);

    let cached: CachedReading | null = null;

    try {
      setLoading(true);
      setError(null);

      // 1) Attempt to load from local cache for instant/offline display
      cached = await getCachedReading(date);
      if (cached?.reading) {
        setReading(cached.reading);
        qaLog("reading", "Loaded reading from cache", {
          ...ctx,
          id: cached.reading.id,
          cachedUpdatedAt: cached.updatedAt,
        });
      }

      // 2) Always try to refresh from Supabase when possible
      // Calculate scheduled day of year (1-366), leap-year aware
      const dayOfYear = ctx.scheduledDayOfYear;

      console.log("Fetching reading for day of year:", dayOfYear);
      console.log("Date:", ctx.dateLocal);
      qaLog("reading", "Requesting reading from Supabase", {
        ...ctx,
      });

      const { data, error: fetchError } = await supabase
        .from("readings")
        .select("*")
        .eq("day_of_year", dayOfYear)
        .maybeSingle();

      // If there is a real fetch error (network, permission, etc.), handle it.
      if (fetchError) {
        console.error("Error fetching reading:", fetchError);
        qaLog("reading", "Error fetching reading from Supabase", {
          message: fetchError.message,
          code: (fetchError as any).code,
          ...ctx,
        });
        if (!cached?.reading) {
          setError(fetchError.message);
        }
        return;
      }

      // No row for this date is a valid condition in dev; treat it as "no reading"
      if (!data) {
        if (!cached?.reading) {
          setReading(null);
          setError("No reading available for this date.");
        }
        qaLog("reading", "No reading row found for date", {
          ...ctx,
        });
        return;
      }

      // Log a summary of the row we got back for debugging (no large blobs)
      qaLog("reading", "Supabase response received", {
        ...ctx,
        id: (data as any)?.id ?? null,
        updated_at: (data as any)?.updated_at ?? null,
        title: (data as any)?.title ?? null,
        has_body: !!(data as any)?.body,
        body_len: typeof (data as any)?.body === "string" ? (data as any).body.length : null,
      });

      console.log("Fetched data:", data);

      if (data) {
        // If Supabase rows include an updated_at column, use it for freshness checks
        const remoteUpdatedAt =
          (data as { updated_at?: string }).updated_at ?? null;

        const isNewer =
          !cached?.updatedAt ||
          (remoteUpdatedAt && remoteUpdatedAt > cached.updatedAt);

        if (!cached?.reading || isNewer) {
          const transformedReading = transformRowToDailyReading(data, date);
          console.log("Transformed reading:", transformedReading);
          setReading(transformedReading);

          await setCachedReading(date, {
            reading: transformedReading,
            updatedAt: remoteUpdatedAt,
          });
          qaLog("reading", "Reading fetched and cached", {
            ...ctx,
            id: transformedReading.id,
            remoteUpdatedAt,
            cachedUpdatedAt: cached?.updatedAt,
          });
        } else {
          qaLog("reading", "Cached reading is up to date; skip overwrite", {
            ...ctx,
            cachedUpdatedAt: cached?.updatedAt,
            remoteUpdatedAt,
          });
        }
      }
    } catch (err) {
      console.error("Error:", err);
      qaLog("reading", "Unexpected error while fetching reading", {
        message: err instanceof Error ? err.message : String(err),
        ...ctx,
      });

      // If there's no cached reading for this date, clear any stale reading
      // from the previous date so the UI doesn't keep showing, e.g., Dec 2
      // when the user navigates to another day.
      if (!cached?.reading) {
        setReading(null);
      }

      setError(err instanceof Error ? err.message : "Unknown error");
    } finally {
      setLoading(false);
      qaLog("reading", "Fetch cycle finished", {
        ...ctx,
        hadCached: !!cached?.reading,
      });
    }
  }

  return { reading, loading, error, refetch: fetchReading };
}

