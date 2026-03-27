import AsyncStorage from "@react-native-async-storage/async-storage";
import { supabase } from "../lib/supabase";
import { formatDateLocal, getSundayOfWeek, getWeekOfYear } from "./dateUtils";
import { qaLog } from "./qaLog";

const JOURNAL_QUOTE_CACHE_PREFIX = "@daily_paths_journal_quote_v1_";

export interface JournalQuote {
  id: string;
  week_of_year: number;
  quote: string;
  author: string | null;
  updatedAt: string | null;
}

export interface CachedJournalQuote {
  quote: JournalQuote;
  fetchedAt: string;
}

const inFlightFetches = new Map<string, Promise<CachedJournalQuote | null>>();

/** Cache key is the Sunday date string so Mon–Sat reuse the same entry. */
function getCacheKey(date: Date): string {
  const sunday = getSundayOfWeek(date);
  return `${JOURNAL_QUOTE_CACHE_PREFIX}${formatDateLocal(sunday)}`;
}

function normalizeQuoteRow(data: any): JournalQuote {
  let quoteText = String(data?.quote ?? "").trim();
  let authorText = data?.author ? String(data.author).trim() : "";

  const parentheticalMatch = quoteText.match(/^(.*?)(\s*\(([^()]*)\))\s*$/);
  if (parentheticalMatch) {
    quoteText = parentheticalMatch[1].trim();
    if (!authorText) {
      authorText = parentheticalMatch[3].trim();
    }
  }

  return {
    id: String(data?.id ?? `week-${data?.week_of_year ?? "quote"}`),
    week_of_year: Number(data?.week_number ?? 0),
    quote: quoteText,
    author: authorText || null,
    updatedAt: data?.updated_at ? String(data.updated_at) : null,
  };
}

export async function getCachedJournalQuote(
  date: Date
): Promise<CachedJournalQuote | null> {
  try {
    const raw = await AsyncStorage.getItem(getCacheKey(date));
    if (!raw) return null;
    return JSON.parse(raw) as CachedJournalQuote;
  } catch (error) {
    qaLog("journal-quote", "Failed to read cached quote", {
      date: formatDateLocal(date),
      message: error instanceof Error ? error.message : String(error),
    });
    return null;
  }
}

async function setCachedJournalQuote(
  date: Date,
  payload: CachedJournalQuote
): Promise<void> {
  try {
    await AsyncStorage.setItem(getCacheKey(date), JSON.stringify(payload));
  } catch (error) {
    qaLog("journal-quote", "Failed to persist cached quote", {
      date: formatDateLocal(date),
      message: error instanceof Error ? error.message : String(error),
    });
  }
}

async function fetchRemoteJournalQuote(
  date: Date
): Promise<CachedJournalQuote | null> {
  const sunday = getSundayOfWeek(date);
  const weekOfYear = getWeekOfYear(date);
  const sundayStr = formatDateLocal(sunday);

  qaLog("journal-quote", "Fetching remote quote", { sundayStr, weekOfYear });

  try {
    const { data, error } = await supabase
      .from("journal_quotes")
      .select("*")
      .eq("week_number", weekOfYear)
      .maybeSingle();

    if (error) {
      qaLog("journal-quote", "Remote quote fetch error", {
        sundayStr,
        weekOfYear,
        code: (error as any).code,
        message: error.message,
      });
      return null;
    }

    if (!data) {
      qaLog("journal-quote", "No quote found for week", {
        sundayStr,
        weekOfYear,
      });
      return null;
    }

    const payload: CachedJournalQuote = {
      quote: normalizeQuoteRow(data),
      fetchedAt: new Date().toISOString(),
    };

    await setCachedJournalQuote(date, payload);

    qaLog("journal-quote", "Remote quote fetched and cached", {
      sundayStr,
      weekOfYear,
      id: payload.quote.id,
      author: payload.quote.author,
    });

    return payload;
  } catch (error) {
    qaLog("journal-quote", "Unexpected quote fetch error", {
      sundayStr,
      weekOfYear,
      message: error instanceof Error ? error.message : String(error),
    });
    return null;
  }
}

export async function fetchAndCacheJournalQuote(
  date: Date
): Promise<CachedJournalQuote | null> {
  const cacheKey = getCacheKey(date);
  const existing = inFlightFetches.get(cacheKey);
  if (existing) {
    return existing;
  }

  const request = fetchRemoteJournalQuote(date).finally(() => {
    inFlightFetches.delete(cacheKey);
  });

  inFlightFetches.set(cacheKey, request);
  return request;
}
