import { useState, useEffect } from "react";
import { supabase } from "../lib/supabase";

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

      const { data, error: fetchError } = await supabase
        .from("readings")
        .select("day_of_year")
        .order("day_of_year", { ascending: true });

      if (fetchError) {
        console.error("Error fetching available dates:", fetchError);
        setError(fetchError.message);
        return;
      }

      if (data) {
        const days = data.map((row) => row.day_of_year as number);
        setAvailableDaysOfYear(days);
      }
    } catch (err) {
      console.error("Error:", err);
      setError(err instanceof Error ? err.message : "Unknown error");
    } finally {
      setLoading(false);
    }
  }

  return { availableDaysOfYear, loading, error };
}

