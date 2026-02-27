import { useState, useEffect, useCallback, useRef } from "react";
import AsyncStorage from "@react-native-async-storage/async-storage";
import type { JournalEntry, EntryType } from "./useJournalEntries";
import { qaLog } from "../utils/qaLog";
import { trackEvent } from "../utils/trackEvent";
import { ANALYTICS_EVENTS } from "../utils/analytics";

/**
 * AsyncStorage-backed journal entries hook for the 7-day free trial period.
 *
 * Mirrors the interface of `useJournalEntries` so the rest of the app can
 * swap between local and cloud storage transparently via `useJournalStorage`.
 */

const STORAGE_KEY = "@daily_paths_local_journal";

// Simple ID generator (no crypto dependency needed for local-only IDs)
function localId(): string {
  return `local_${Date.now().toString(36)}_${Math.random().toString(36).slice(2, 8)}`;
}

async function readEntries(): Promise<JournalEntry[]> {
  try {
    const raw = await AsyncStorage.getItem(STORAGE_KEY);
    return raw ? JSON.parse(raw) : [];
  } catch {
    return [];
  }
}

async function writeEntries(entries: JournalEntry[]): Promise<void> {
  await AsyncStorage.setItem(STORAGE_KEY, JSON.stringify(entries));
}

// Map entry_type to the correct analytics event name
const entryEventName = (
  entryType: string,
  action: 'created' | 'edited' | 'deleted',
): string | null => {
  const map: Record<string, Record<string, string>> = {
    created: {
      journal: ANALYTICS_EVENTS.JOURNAL_ENTRY_CREATED,
      spot_check: ANALYTICS_EVENTS.SPOT_CHECK_CREATED,
      nightly_review: ANALYTICS_EVENTS.NIGHTLY_REVIEW_CREATED,
      gratitude: ANALYTICS_EVENTS.GRATITUDE_ENTRY_CREATED,
    },
    edited: {
      journal: ANALYTICS_EVENTS.JOURNAL_ENTRY_EDITED,
      spot_check: ANALYTICS_EVENTS.SPOT_CHECK_EDITED,
      nightly_review: ANALYTICS_EVENTS.NIGHTLY_REVIEW_EDITED,
      gratitude: ANALYTICS_EVENTS.GRATITUDE_ENTRY_EDITED,
    },
    deleted: {
      journal: ANALYTICS_EVENTS.JOURNAL_ENTRY_DELETED,
      spot_check: ANALYTICS_EVENTS.SPOT_CHECK_DELETED,
      nightly_review: ANALYTICS_EVENTS.NIGHTLY_REVIEW_DELETED,
      gratitude: ANALYTICS_EVENTS.GRATITUDE_ENTRY_DELETED,
    },
  };
  return map[action]?.[entryType] ?? null;
};

export function useLocalJournalEntries() {
  const [entries, setEntries] = useState<JournalEntry[]>([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);
  const mounted = useRef(true);

  // ── Fetch ────────────────────────────────────────────────────────────
  const fetchEntries = useCallback(async () => {
    try {
      setLoading(true);
      setError(null);
      const data = await readEntries();
      if (mounted.current) setEntries(data);
    } catch (err) {
      if (mounted.current) setError(String(err));
    } finally {
      if (mounted.current) setLoading(false);
    }
  }, []);

  useEffect(() => {
    mounted.current = true;
    fetchEntries();
    return () => { mounted.current = false; };
  }, [fetchEntries]);

  // ── Create ───────────────────────────────────────────────────────────
  const createEntry = useCallback(
    async (
      entryType: EntryType,
      content: string | null,
      structuredContent?: Record<string, any> | null,
    ): Promise<JournalEntry | null> => {
      if (!content?.trim() && !structuredContent) return null;

      const now = new Date().toISOString();
      const entry: JournalEntry = {
        id: localId(),
        user_id: "local",
        entry_type: entryType,
        content: content?.trim() || null,
        structured_content: structuredContent || null,
        created_at: now,
        updated_at: now,
      };

      try {
        const current = await readEntries();
        const updated = [entry, ...current];
        await writeEntries(updated);
        setEntries(updated);
        qaLog("journal", "Local entry created", { id: entry.id, type: entryType });

        const eventName = entryEventName(entryType, 'created');
        if (eventName) {
          trackEvent(eventName, {
            entry_id: entry.id,
            entry_type: entryType,
            has_structured_content: !!structuredContent,
          });
        }

        return entry;
      } catch (err) {
        qaLog("journal", "Error creating local entry", { error: String(err) });
        throw err;
      }
    },
    [],
  );

  // ── Update ───────────────────────────────────────────────────────────
  const updateEntry = useCallback(
    async (
      entryId: string,
      content: string | null,
      structuredContent?: Record<string, any> | null,
    ): Promise<JournalEntry | null> => {
      try {
        const current = await readEntries();
        const idx = current.findIndex((e) => e.id === entryId);
        if (idx === -1) return null;

        const updated: JournalEntry = {
          ...current[idx],
          content: content?.trim() || null,
          ...(structuredContent !== undefined && { structured_content: structuredContent }),
          updated_at: new Date().toISOString(),
        };
        current[idx] = updated;
        await writeEntries(current);
        setEntries([...current]);
        qaLog("journal", "Local entry updated", { id: entryId });

        const entryType = updated.entry_type || 'journal';
        const eventName = entryEventName(entryType, 'edited');
        if (eventName) {
          trackEvent(eventName, {
            entry_id: entryId,
            entry_type: entryType,
          });
        }

        return updated;
      } catch (err) {
        qaLog("journal", "Error updating local entry", { error: String(err) });
        throw err;
      }
    },
    [],
  );

  // ── Delete ───────────────────────────────────────────────────────────
  const deleteEntry = useCallback(async (entryId: string): Promise<boolean> => {
    try {
      const current = await readEntries();
      // Capture entry_type before filtering for analytics
      const entryToDelete = current.find((e) => e.id === entryId);
      const filtered = current.filter((e) => e.id !== entryId);
      await writeEntries(filtered);
      setEntries(filtered);
      qaLog("journal", "Local entry deleted", { id: entryId });

      const entryType = entryToDelete?.entry_type || 'journal';
      const eventName = entryEventName(entryType, 'deleted');
      if (eventName) {
        trackEvent(eventName, {
          entry_id: entryId,
          entry_type: entryType,
        });
      }

      return true;
    } catch (err) {
      qaLog("journal", "Error deleting local entry", { error: String(err) });
      throw err;
    }
  }, []);

  // ── Search ───────────────────────────────────────────────────────────
  const searchEntries = useCallback(
    async (query: string): Promise<JournalEntry[]> => {
      if (!query.trim()) return entries;
      const lower = query.trim().toLowerCase();
      return entries.filter(
        (e) => e.content?.toLowerCase().includes(lower),
      );
    },
    [entries],
  );

  // ── Raw access for migration ─────────────────────────────────────────
  const getAllRaw = useCallback(async (): Promise<JournalEntry[]> => {
    return readEntries();
  }, []);

  return {
    entries,
    loading,
    error,
    createEntry,
    updateEntry,
    deleteEntry,
    searchEntries,
    refreshEntries: fetchEntries,
    getAllRaw,
  };
}
