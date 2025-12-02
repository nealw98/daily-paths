import { useState, useEffect } from "react";
import { supabase } from "../lib/supabase";
import { DailyReading } from "../types/readings";
import { formatDateLocal, getScheduledDayOfYear } from "../utils/dateUtils";
import { getCachedReading, setCachedReading } from "../utils/readingCache";

export function useReading(date: Date) {
  const [reading, setReading] = useState<DailyReading | null>(null);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);

  useEffect(() => {
    fetchReading();
  }, [date]);

  async function fetchReading() {
    try {
      setLoading(true);
      setError(null);

      // 1) Attempt to load from local cache for instant/offline display
      const cached = await getCachedReading(date);
      if (cached?.reading) {
        setReading(cached.reading);
      }

      // 2) Always try to refresh from Supabase when possible
      // Calculate scheduled day of year (1-366), leap-year aware
      const dayOfYear = getScheduledDayOfYear(date);

      console.log("Fetching reading for day of year:", dayOfYear);
      console.log("Date:", formatDateLocal(date));

      const { data, error: fetchError } = await supabase
        .from("readings")
        .select("*")
        .eq("day_of_year", dayOfYear)
        .maybeSingle();

      // If there is a real fetch error (network, permission, etc.), handle it.
      if (fetchError) {
        console.error("Error fetching reading:", fetchError);
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
        return;
      }

      console.log("Fetched data:", data);

      if (data) {
        // If Supabase rows include an updated_at column, use it for freshness checks
        const remoteUpdatedAt =
          (data as { updated_at?: string }).updated_at ?? null;

        const isNewer =
          !cached?.updatedAt ||
          (remoteUpdatedAt && remoteUpdatedAt > cached.updatedAt);

        if (!cached?.reading || isNewer) {
          // Transform the data to match our DailyReading interface
          // Normalize literal "\n" sequences and split body text by double newlines
          const normalizedBody =
            (data.body as string | null | undefined)?.replace(/\\n/g, "\n") ??
            "";
          const bodyParagraphs = normalizedBody
            .split(/\n{2,}/)
            .map((p: string) => p.trim())
            .filter((p: string) => p.length > 0);

          const rawQuote =
            (data as { quote?: string; todays_application?: string }).quote ??
            (data as { quote?: string; todays_application?: string })
              .todays_application ??
            "";

          const transformedReading: DailyReading = {
            id: data.id,
            date: date, // Use the date parameter that was passed in
            title: data.title,
            opening: data.opening,
            body: bodyParagraphs,
            quote: rawQuote,
            thoughtForDay: data.thought_for_day,
          };
          console.log("Transformed reading:", transformedReading);
          setReading(transformedReading);

          await setCachedReading(date, {
            reading: transformedReading,
            updatedAt: remoteUpdatedAt,
          });
        }
      }
    } catch (err) {
      console.error("Error:", err);
      setError(err instanceof Error ? err.message : "Unknown error");
    } finally {
      setLoading(false);
    }
  }

  return { reading, loading, error, refetch: fetchReading };
}

