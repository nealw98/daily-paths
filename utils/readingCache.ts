import AsyncStorage from "@react-native-async-storage/async-storage";
import { DailyReading } from "../types/readings";

// Bump this suffix any time we change how readings are fetched / mapped
// (e.g., changes to day_of_year scheduling logic) so that we don't
// accidentally reuse stale cached entries tied to an older scheme.
// v5: updated reading shape (separate quote + application fields).
const READING_CACHE_PREFIX = "@daily_paths_reading_v5_";

export interface CachedReading {
  reading: DailyReading;
  updatedAt: string | null;
}

function getKey(date: Date): string {
  const iso = date.toISOString().split("T")[0]; // YYYY-MM-DD (local date already baked into reading)
  return `${READING_CACHE_PREFIX}${iso}`;
}

export async function getCachedReading(
  date: Date
): Promise<CachedReading | null> {
  try {
    const raw = await AsyncStorage.getItem(getKey(date));
    if (!raw) return null;

    const parsed = JSON.parse(raw) as CachedReading;

    // Rehydrate Date instance
    if (parsed?.reading?.date) {
      parsed.reading.date = new Date(parsed.reading.date);
    }

    // Normalize any literal "\n\n" sequences that may have been cached
    // before we added proper paragraph handling.
    if (parsed?.reading) {
      // Fix body paragraphs
      parsed.reading.body =
        parsed.reading.body?.flatMap((p) => {
          const normalized = (p || "").replace(/\\n/g, "\n");
          return normalized
            .split(/\n{2,}/)
            .map((t) => t.trim())
            .filter((t) => t.length > 0);
        }) ?? [];
    }

    return parsed;
  } catch (error) {
    console.error("Error reading cached reading:", error);
    return null;
  }
}

export async function setCachedReading(
  date: Date,
  payload: CachedReading
): Promise<void> {
  try {
    await AsyncStorage.setItem(getKey(date), JSON.stringify(payload));
  } catch (error) {
    console.error("Error caching reading:", error);
  }
}



