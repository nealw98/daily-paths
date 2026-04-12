import { useState, useEffect, useCallback, useRef } from "react";
import { supabase } from "../lib/supabase";
import { qaLog } from "../utils/qaLog";
import type { Speaker } from "../types/speakers";

/**
 * Construct the full audio URL for a speaker.
 * Prefers `audio_url` from the DB; falls back to building it from `youtube_id`.
 */
export function getSpeakerAudioUrl(speaker: Speaker): string {
  if (speaker.audio_url) return speaker.audio_url;
  const supabaseUrl = process.env.EXPO_PUBLIC_SUPABASE_URL || "";
  return `${supabaseUrl}/storage/v1/object/public/speaker-audio/${speaker.youtube_id}.m4a`;
}

/**
 * Hook for fetching all speaker recordings from Supabase.
 * Small dataset (~13-20 records) — fetched in full on mount, no pagination.
 */
export function useSpeakers() {
  const [speakers, setSpeakers] = useState<Speaker[]>([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);
  const mounted = useRef(true);

  const fetchSpeakers = useCallback(async () => {
    try {
      setLoading(true);
      setError(null);

      const { data, error: fetchError } = await supabase
        .from("speakers")
        .select("*")
        .order("date", { ascending: true, nullsFirst: true })
        .order("created_at", { ascending: true });

      if (fetchError) {
        qaLog("speakers", "Error fetching speakers", {
          error: fetchError.message,
        });
        if (mounted.current) setError(fetchError.message);
        return;
      }

      if (mounted.current) {
        setSpeakers(data || []);
        qaLog("speakers", "Fetched speakers", {
          count: (data || []).length,
          ...(data?.length === 0 && { warning: "0 rows returned — check Supabase RLS on speakers table" }),
        });
      }
    } catch (err) {
      qaLog("speakers", "Exception fetching speakers", { error: String(err) });
      if (mounted.current) setError(String(err));
    } finally {
      if (mounted.current) setLoading(false);
    }
  }, []);

  useEffect(() => {
    mounted.current = true;
    fetchSpeakers();
    return () => {
      mounted.current = false;
    };
  }, [fetchSpeakers]);

  return { speakers, loading, error, refresh: fetchSpeakers };
}
