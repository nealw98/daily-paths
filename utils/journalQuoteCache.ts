import AsyncStorage from "@react-native-async-storage/async-storage";
import { supabase } from "../lib/supabase";
import { getScheduledDayOfYear } from "./dateUtils";
import { qaLog } from "./qaLog";

// One cache key holds the full list of journal quotes. The per-day pick is
// computed client-side from this list, so we only need a single fetch.
const JOURNAL_QUOTES_LIST_CACHE_KEY = "@daily_paths_journal_quotes_list_v1";

export interface JournalQuote {
  id: string;
  week_of_year: number;
  quote: string;
  author: string | null;
  updatedAt: string | null;
}

export interface CachedJournalQuotes {
  quotes: JournalQuote[];
  fetchedAt: string;
}

let inFlightListFetch: Promise<CachedJournalQuotes | null> | null = null;

function normalizeQuoteRow(data: any): JournalQuote {
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
    id: String(data?.id ?? `week-${data?.week_number ?? "quote"}`),
    week_of_year: Number(data?.week_number ?? 0),
    quote: quoteText,
    author: authorText || null,
    updatedAt: data?.updated_at ? String(data.updated_at) : null,
  };
}

export async function getCachedJournalQuotes(): Promise<CachedJournalQuotes | null> {
  try {
    const raw = await AsyncStorage.getItem(JOURNAL_QUOTES_LIST_CACHE_KEY);
    if (!raw) return null;
    return JSON.parse(raw) as CachedJournalQuotes;
  } catch (error) {
    qaLog("journal-quote", "Failed to read cached quotes list", {
      message: error instanceof Error ? error.message : String(error),
    });
    return null;
  }
}

async function setCachedJournalQuotes(
  payload: CachedJournalQuotes
): Promise<void> {
  try {
    await AsyncStorage.setItem(
      JOURNAL_QUOTES_LIST_CACHE_KEY,
      JSON.stringify(payload)
    );
  } catch (error) {
    qaLog("journal-quote", "Failed to persist cached quotes list", {
      message: error instanceof Error ? error.message : String(error),
    });
  }
}

async function fetchRemoteJournalQuotes(): Promise<CachedJournalQuotes | null> {
  qaLog("journal-quote", "Fetching all journal quotes");
  try {
    const { data, error } = await supabase
      .from("journal_quotes")
      .select("*")
      // Stable order so the day→quote mapping is identical across devices.
      .order("week_number", { ascending: true });

    if (error) {
      qaLog("journal-quote", "Remote quotes fetch error", {
        code: (error as any).code,
        message: error.message,
      });
      return null;
    }

    if (!data || data.length === 0) {
      qaLog("journal-quote", "No quotes returned from remote");
      return null;
    }

    const payload: CachedJournalQuotes = {
      quotes: data.map(normalizeQuoteRow),
      fetchedAt: new Date().toISOString(),
    };

    await setCachedJournalQuotes(payload);

    qaLog("journal-quote", "Remote quotes fetched and cached", {
      count: payload.quotes.length,
    });

    return payload;
  } catch (error) {
    qaLog("journal-quote", "Unexpected quotes fetch error", {
      message: error instanceof Error ? error.message : String(error),
    });
    return null;
  }
}

export async function fetchAndCacheJournalQuotes(): Promise<CachedJournalQuotes | null> {
  if (inFlightListFetch) {
    return inFlightListFetch;
  }

  const request = fetchRemoteJournalQuotes().finally(() => {
    inFlightListFetch = null;
  });

  inFlightListFetch = request;
  return request;
}

/**
 * Deterministically pick a journal quote for a given date.
 *
 * Uses the local-calendar day-of-year (1-366, with Feb 29 stably pinned to
 * slot 60 across leap and non-leap years) modulo the list length. Every
 * device on the same local calendar date resolves to the same quote, and
 * the rollover happens at each user's local midnight.
 */
export function pickJournalQuoteForDate(
  date: Date,
  quotes: JournalQuote[]
): JournalQuote | null {
  if (!quotes || quotes.length === 0) return null;
  const dayIndex = getScheduledDayOfYear(date);
  const idx =
    ((dayIndex % quotes.length) + quotes.length) % quotes.length;
  return quotes[idx];
}
