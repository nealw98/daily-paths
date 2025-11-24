import { useState, useEffect } from "react";
import { supabase } from "../lib/supabase";
import { DailyReading } from "../types/readings";
import { formatDateLocal, getDayOfYear } from "../utils/dateUtils";

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

      // Calculate day of year (1-366)
      const dayOfYear = getDayOfYear(date);
      
      console.log("Fetching reading for day of year:", dayOfYear);
      console.log("Date:", formatDateLocal(date));

      const { data, error: fetchError } = await supabase
        .from("readings")
        .select("*")
        .eq("day_of_year", dayOfYear)
        .single();

      if (fetchError) {
        console.error("Error fetching reading:", fetchError);
        setError(fetchError.message);
        return;
      }

      console.log("Fetched data:", data);

      if (data) {
        // Transform the data to match our DailyReading interface
        // Split body text by double newlines to create paragraphs
        const bodyParagraphs = data.body
          .split(/\n\n+/)
          .map((p: string) => p.trim())
          .filter((p: string) => p.length > 0);

        const transformedReading: DailyReading = {
          id: data.id,
          date: date, // Use the date parameter that was passed in
          title: data.title,
          opening: data.opening,
          body: bodyParagraphs,
          todaysApplication: data.todays_application,
          thoughtForDay: data.thought_for_day,
        };
        console.log("Transformed reading:", transformedReading);
        setReading(transformedReading);
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

