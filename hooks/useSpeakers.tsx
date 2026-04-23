import React, {
  createContext,
  useCallback,
  useContext,
  useEffect,
  useMemo,
  useRef,
  useState,
} from "react";
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

// ─── Context ───────────────────────────────────────────────────────────────

interface SpeakersContextValue {
  speakers: Speaker[];
  loading: boolean;
  error: string | null;
  refresh: () => Promise<void>;
}

const SpeakersContext = createContext<SpeakersContextValue | null>(null);

// ─── Provider ──────────────────────────────────────────────────────────────

/**
 * Holds the shared speaker list for the whole app. Mount once at the tabs
 * layout so every screen that consumes `useSpeakers()` sees the same
 * already-fetched list — this is what makes the first "tap featured speaker
 * on home → speakers detail" transition instant, instead of the tab having
 * to re-fetch before it can resolve the deep-link.
 */
export function SpeakersProvider({ children }: { children: React.ReactNode }) {
  const [speakers, setSpeakers] = useState<Speaker[]>([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);
  const mountedRef = useRef(true);
  // Dedupe concurrent refresh() calls (tab focus + app foreground can race,
  // and React Strict Mode double-invokes effects in dev).
  const inFlightRef = useRef(false);

  const fetchSpeakers = useCallback(async () => {
    if (inFlightRef.current) return;
    inFlightRef.current = true;
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
        if (mountedRef.current) setError(fetchError.message);
        return;
      }

      if (mountedRef.current) {
        setSpeakers(data || []);
        qaLog("speakers", "Fetched speakers", {
          count: (data || []).length,
          ...(data?.length === 0 && {
            warning: "0 rows returned — check Supabase RLS on speakers table",
          }),
        });
      }
    } catch (err) {
      qaLog("speakers", "Exception fetching speakers", { error: String(err) });
      if (mountedRef.current) setError(String(err));
    } finally {
      if (mountedRef.current) setLoading(false);
      inFlightRef.current = false;
    }
  }, []);

  useEffect(() => {
    mountedRef.current = true;
    void fetchSpeakers();
    return () => {
      mountedRef.current = false;
    };
  }, [fetchSpeakers]);

  const value = useMemo<SpeakersContextValue>(
    () => ({ speakers, loading, error, refresh: fetchSpeakers }),
    [speakers, loading, error, fetchSpeakers]
  );

  return (
    <SpeakersContext.Provider value={value}>
      {children}
    </SpeakersContext.Provider>
  );
}

// ─── Hook ──────────────────────────────────────────────────────────────────

/**
 * Read the shared speaker list. Must be used inside a <SpeakersProvider>
 * (mounted at the tabs layout). Returns the same shape as before the
 * provider was introduced, so call sites don't need to change.
 */
export function useSpeakers(): SpeakersContextValue {
  const ctx = useContext(SpeakersContext);
  if (!ctx) {
    throw new Error("useSpeakers must be used within a SpeakersProvider");
  }
  return ctx;
}
