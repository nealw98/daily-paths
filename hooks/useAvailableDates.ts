import { useState, useEffect } from "react";
import { supabase } from "../lib/supabase";
import { qaLog } from "../utils/qaLog";

export function useAvailableDates() {
  const [availableDaysOfYear, setAvailableDaysOfYear] = useState<number[]>([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);

  useEffect(() => {
    fetchAvailableDates();
  }, []);

  async function fetchAvailableDates() {
    try {
      setLoading(true);
      setError(null);

      qaLog("dates", "Fetching available day_of_year values");

      const { data, error: fetchError } = await supabase
        .from("readings")
        .select("day_of_year")
        .order("day_of_year", { ascending: true });

      if (fetchError) {
        console.error("Error fetching available dates:", fetchError);
        qaLog("dates", "Error fetching available dates", {
          message: fetchError.message,
          code: (fetchError as any).code,
        });
        setError(fetchError.message);
        return;
      }

      if (data) {
        const days = data.map((row) => row.day_of_year as number);
        setAvailableDaysOfYear(days);
        qaLog("dates", "Available dates loaded", {
          count: days.length,
        });
      }
    } catch (err) {
      console.error("Error:", err);
      qaLog("dates", "Unexpected error while fetching dates", {
        message: err instanceof Error ? err.message : String(err),
      });
      setError(err instanceof Error ? err.message : "Unknown error");
    } finally {
      setLoading(false);
    }
  }

  return { availableDaysOfYear, loading, error };
}

