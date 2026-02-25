import { useState, useEffect, useCallback } from "react";
import AsyncStorage from "@react-native-async-storage/async-storage";
import { qaLog } from "../utils/qaLog";

/**
 * AsyncStorage-backed prayer notes hook for the 7-day free trial period.
 *
 * Prayer notes are a single text blob — simpler than journal entries.
 * This hook mirrors the save/load pattern of PersonalNotes.tsx but targets
 * local storage instead of Supabase.
 */

const STORAGE_KEY = "@daily_paths_local_prayer_notes";

interface LocalPrayerNotes {
  content: string;
  updated_at: string;
}

export function useLocalPrayerNotes() {
  const [content, setContent] = useState("");
  const [loading, setLoading] = useState(true);

  // ── Load ──────────────────────────────────────────────────────────────
  useEffect(() => {
    let mounted = true;
    (async () => {
      try {
        const raw = await AsyncStorage.getItem(STORAGE_KEY);
        if (raw && mounted) {
          const parsed: LocalPrayerNotes = JSON.parse(raw);
          setContent(parsed.content);
        }
      } catch (err) {
        qaLog("prayers", "Error loading local prayer notes", { error: String(err) });
      } finally {
        if (mounted) setLoading(false);
      }
    })();
    return () => { mounted = false; };
  }, []);

  // ── Save ──────────────────────────────────────────────────────────────
  const saveContent = useCallback(async (text: string): Promise<boolean> => {
    try {
      const data: LocalPrayerNotes = {
        content: text.trim(),
        updated_at: new Date().toISOString(),
      };
      await AsyncStorage.setItem(STORAGE_KEY, JSON.stringify(data));
      setContent(data.content);
      qaLog("prayers", "Local prayer notes saved");
      return true;
    } catch (err) {
      qaLog("prayers", "Error saving local prayer notes", { error: String(err) });
      return false;
    }
  }, []);

  // ── Raw access for migration ──────────────────────────────────────────
  const getRaw = useCallback(async (): Promise<LocalPrayerNotes | null> => {
    try {
      const raw = await AsyncStorage.getItem(STORAGE_KEY);
      return raw ? JSON.parse(raw) : null;
    } catch {
      return null;
    }
  }, []);

  return { content, loading, saveContent, getRaw };
}
