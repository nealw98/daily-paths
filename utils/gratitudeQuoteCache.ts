import AsyncStorage from "@react-native-async-storage/async-storage";
import { supabase } from "../lib/supabase";
import { formatDateLocal, getScheduledDayOfYear } from "./dateUtils";
import { qaLog } from "./qaLog";

const GRATITUDE_QUOTE_CACHE_PREFIX = "@daily_paths_gratitude_quote_v1_";

export interface GratitudeQuote {
  id: string;
  day_of_year: number;
  quote: string;
  author: string | null;
  updatedAt: string | null;
}

export interface CachedGratitudeQuote {
  quote: GratitudeQuote;
  fetchedAt: string;
}

const inFlightFetches = new Map<string, Promise<CachedGratitudeQuote | null>>();

function getCacheKey(date: Date): string {
  return `${GRATITUDE_QUOTE_CACHE_PREFIX}${formatDateLocal(date)}`;
}

function normalizeQuoteRow(data: any): GratitudeQuote {
  let quoteText = String(data?.quote ?? "").trim();
  let authorText = data?.author ? String(data.author).trim() : "";

  // Keep quote/author formatting consistent anywhere this quote is shown.
  const parentheticalMatch = quoteText.match(/^(.*?)(\s*\(([^()]*)\))\s*$/);
  if (parentheticalMatch) {
    quoteText = parentheticalMatch[1].trim();
    if (!authorText) {
      authorText = parentheticalMatch[3].trim();
    }
  }

  return {
    id: String(data?.id ?? `${data?.day_of_year ?? "quote"}`),
    day_of_year: Number(data?.day_of_year ?? 0),
    quote: quoteText,
    author: authorText || null,
    updatedAt: data?.updated_at ? String(data.updated_at) : null,
  };
}

export async function getCachedGratitudeQuote(
  date: Date
): Promise<CachedGratitudeQuote | null> {
  try {
    const raw = await AsyncStorage.getItem(getCacheKey(date));
    if (!raw) return null;
    return JSON.parse(raw) as CachedGratitudeQuote;
  } catch (error) {
    qaLog("gratitude-quote", "Failed to read cached quote", {
      date: formatDateLocal(date),
      message: error instanceof Error ? error.message : String(error),
    });
    return null;
  }
}

async function setCachedGratitudeQuote(
  date: Date,
  payload: CachedGratitudeQuote
): Promise<void> {
  try {
    await AsyncStorage.setItem(getCacheKey(date), JSON.stringify(payload));
  } catch (error) {
    qaLog("gratitude-quote", "Failed to persist cached quote", {
      date: formatDateLocal(date),
      message: error instanceof Error ? error.message : String(error),
    });
  }
}

async function fetchRemoteGratitudeQuote(
  date: Date
): Promise<CachedGratitudeQuote | null> {
  const dateLocal = formatDateLocal(date);
  const dayOfYear = getScheduledDayOfYear(date);

  qaLog("gratitude-quote", "Fetching remote quote", {
    dateLocal,
    dayOfYear,
  });

  try {
    const { data, error } = await supabase
      .from("gratitude_quotes")
      .select("*")
      .eq("day_of_year", dayOfYear)
      .maybeSingle();

    if (error) {
      qaLog("gratitude-quote", "Remote quote fetch error", {
        dateLocal,
        dayOfYear,
        code: (error as any).code,
        message: error.message,
      });
      return null;
    }

    if (!data) {
      qaLog("gratitude-quote", "No quote found for date", {
        dateLocal,
        dayOfYear,
      });
      return null;
    }

    const payload: CachedGratitudeQuote = {
      quote: normalizeQuoteRow(data),
      fetchedAt: new Date().toISOString(),
    };

    await setCachedGratitudeQuote(date, payload);

    qaLog("gratitude-quote", "Remote quote fetched and cached", {
      dateLocal,
      dayOfYear,
      id: payload.quote.id,
      author: payload.quote.author,
      updatedAt: payload.quote.updatedAt,
    });

    return payload;
  } catch (error) {
    qaLog("gratitude-quote", "Unexpected quote fetch error", {
      dateLocal,
      dayOfYear,
      message: error instanceof Error ? error.message : String(error),
    });
    return null;
  }
}

export async function fetchAndCacheGratitudeQuote(
  date: Date
): Promise<CachedGratitudeQuote | null> {
  const cacheKey = getCacheKey(date);
  const existing = inFlightFetches.get(cacheKey);
  if (existing) {
    return existing;
  }

  const request = fetchRemoteGratitudeQuote(date).finally(() => {
    inFlightFetches.delete(cacheKey);
  });

  inFlightFetches.set(cacheKey, request);
  return request;
}
