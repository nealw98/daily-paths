import { useState, useEffect } from "react";
import { supabase } from "../lib/supabase";
import { dateFromDayOfYear } from "../utils/dateUtils";

export function useAvailableDates() {
  const [availableDates, setAvailableDates] = useState<Date[]>([]);
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
        // Convert day_of_year to dates in the current year
        const currentYear = new Date().getFullYear();
        const dates = data.map((row) => 
          dateFromDayOfYear(row.day_of_year, currentYear)
        );
        setAvailableDates(dates);
      }
    } catch (err) {
      console.error("Error:", err);
      setError(err instanceof Error ? err.message : "Unknown error");
    } finally {
      setLoading(false);
    }
  }

  return { availableDates, loading, error };
}

