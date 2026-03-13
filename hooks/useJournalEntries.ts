import { useState, useEffect, useCallback, useRef } from "react";
import { supabase } from "../lib/supabase";
import { qaLog } from "../utils/qaLog";
import { trackEvent } from "../utils/trackEvent";
import { ANALYTICS_EVENTS } from "../utils/analytics";
import type { EntryType } from "../constants/journalCategories";

export type { EntryType };
const SAVE_REQUEST_TIMEOUT_MS = 6000;
const FETCH_REQUEST_TIMEOUT_MS = 8000;

export interface JournalEntry {
  id: string;
  user_id: string;
  entry_type: EntryType;
  content: string | null;
  structured_content: Record<string, any> | null;
  created_at: string;
  updated_at: string;
  // Legacy field — kept for backward compat during migration
  category?: string | null;
}

/**
 * Hook for managing journal entries with full CRUD operations.
 */
export function useJournalEntries(userId: string | null | undefined) {
  const [entries, setEntries] = useState<JournalEntry[]>([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);
  const mounted = useRef(true);
  const entriesRef = useRef<JournalEntry[]>([]);

  const runWithTimeout = useCallback(
    async <T,>(
      runner: (signal: AbortSignal) => Promise<T>,
      timeoutMs = SAVE_REQUEST_TIMEOUT_MS,
      timeoutLabel = "Request timed out",
    ): Promise<T> => {
      const controller = new AbortController();
      const timer = setTimeout(() => controller.abort(), timeoutMs);
      try {
        return await runner(controller.signal);
      } catch (err) {
        const msg = String(err);
        if (msg.toLowerCase().includes("abort")) {
          throw new Error(timeoutLabel);
        }
        throw err;
      } finally {
        clearTimeout(timer);
      }
    },
    [],
  );

  // Fetch all entries for the current user
  const fetchEntries = useCallback(async () => {
    if (!userId) {
      setEntries([]);
      setLoading(false);
      return;
    }

    const isLikelySessionError = (message: string) =>
      /jwt|token|session|auth/i.test(message);

    const fetchOnce = async (): Promise<JournalEntry[]> => {
      const { data, error: fetchError } = await runWithTimeout(
        (signal) =>
          supabase
            .from("journal_entries")
            .select("*")
            .eq("user_id", userId)
            .order("created_at", { ascending: false })
            .abortSignal(signal)
            .then((result) => result),
        FETCH_REQUEST_TIMEOUT_MS,
        "Fetch timed out",
      );

      if (fetchError) {
        throw new Error(fetchError.message);
      }

      return (data || []) as JournalEntry[];
    };

    try {
      setLoading(true);
      setError(null);

      const startedAt = Date.now();
      let data: JournalEntry[] = [];

      try {
        data = await fetchOnce();
      } catch (firstErr) {
        const message = String(firstErr);
        qaLog("journal", "First fetch entries attempt failed", {
          userId,
          elapsedMs: Date.now() - startedAt,
          error: message,
        });

        if (!isLikelySessionError(message)) {
          throw firstErr;
        }

        const { error: refreshError } = await supabase.auth.refreshSession();
        if (refreshError) {
          qaLog("journal", "Session refresh before fetch retry failed", {
            error: refreshError.message,
          });
          throw firstErr;
        }

        qaLog("journal", "Retrying fetch entries after session refresh", {
          userId,
        });
        data = await fetchOnce();
      }

      if (mounted.current) {
        // Normalize legacy entries: if entry_type is missing, derive from category or default to 'journal'
        const normalized = (data || []).map((entry: any) => ({
          ...entry,
          entry_type: entry.entry_type || entry.category || "journal",
        }));
        setEntries(normalized);
        qaLog("journal", "Entries fetched", {
          userId,
          count: normalized.length,
          elapsedMs: Date.now() - startedAt,
        });
      }
    } catch (err) {
      qaLog("journal", "Exception fetching entries", { error: String(err) });
      if (mounted.current) setError(String(err));
    } finally {
      if (mounted.current) setLoading(false);
    }
  }, [userId, runWithTimeout]);

  useEffect(() => {
    mounted.current = true;
    fetchEntries();
    return () => {
      mounted.current = false;
    };
  }, [fetchEntries]);

  // Keep entriesRef in sync for use in deleteEntry without adding entries to deps
  useEffect(() => {
    entriesRef.current = entries;
  }, [entries]);

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

  // Create a new journal entry
  const createEntry = useCallback(
    async (
      entryType: EntryType,
      content: string | null,
      structuredContent?: Record<string, any> | null
    ): Promise<JournalEntry | null> => {
      if (!userId) return null;
      // Must have either content or structured_content
      if (!content?.trim() && !structuredContent) return null;

      const isLikelySessionError = (message: string) =>
        /jwt|token|session|auth/i.test(message);

      const insertOnce = async (): Promise<JournalEntry | null> => {
        const insertData: Record<string, unknown> = {
          user_id: userId,
          entry_type: entryType,
          content: content?.trim() || null,
        };
        if (structuredContent) {
          insertData.structured_content = structuredContent;
        }

        const { data, error: insertError } = await runWithTimeout((signal) =>
          supabase
            .from("journal_entries")
            .insert(insertData)
            .select()
            .single()
            .abortSignal(signal)
            .then((result) => result),
        );

        if (insertError) {
          throw new Error(insertError.message);
        }
        return data;
      };

      try {
        const startedAt = Date.now();
        let data: JournalEntry | null = null;
        try {
          data = await insertOnce();
        } catch (firstErr) {
          const message = String(firstErr);
          qaLog("journal", "First create entry attempt failed", {
            userId,
            entryType,
            elapsedMs: Date.now() - startedAt,
            error: message,
          });

          if (!isLikelySessionError(message)) {
            throw firstErr;
          }

          // On mobile, a stale token can fail writes after a long wait.
          // Refresh once and retry before surfacing the error.
          const { error: refreshError } = await supabase.auth.refreshSession();
          if (refreshError) {
            qaLog("journal", "Session refresh before retry failed", {
              error: refreshError.message,
            });
            throw firstErr;
          }

          qaLog("journal", "Retrying create entry after session refresh", {
            userId,
            entryType,
          });
          data = await insertOnce();
        }

        if (data) {
          setEntries((prev) => [data, ...prev]);
          qaLog("journal", "Entry created", {
            id: data.id,
            type: entryType,
            elapsedMs: Date.now() - startedAt,
          });

          const eventName = entryEventName(entryType, 'created');
          if (eventName) {
            trackEvent(eventName, {
              entry_id: data.id,
              entry_type: entryType,
              has_structured_content: !!structuredContent,
            });
          }
        }

        return data;
      } catch (err) {
        qaLog("journal", "Exception creating entry", { error: String(err) });
        throw err;
      }
    },
    [userId, runWithTimeout]
  );

  // Update an existing journal entry
  const updateEntry = useCallback(
    async (
      entryId: string,
      content: string | null,
      structuredContent?: Record<string, any> | null
    ): Promise<JournalEntry | null> => {
      if (!userId) return null;

      try {
        const updateData: Record<string, unknown> = {
          content: content?.trim() || null,
        };
        if (structuredContent !== undefined) {
          updateData.structured_content = structuredContent;
        }

        const { data, error: updateError } = await runWithTimeout((signal) =>
          supabase
            .from("journal_entries")
            .update(updateData)
            .eq("id", entryId)
            .eq("user_id", userId)
            .select()
            .single()
            .abortSignal(signal)
            .then((result) => result),
        );

        if (updateError) {
          qaLog("journal", "Error updating entry", {
            error: updateError.message,
          });
          throw new Error(updateError.message);
        }

        if (data) {
          setEntries((prev) =>
            prev.map((entry) => (entry.id === entryId ? data : entry))
          );
          qaLog("journal", "Entry updated", { id: entryId });

          const entryType = data.entry_type || 'journal';
          const eventName = entryEventName(entryType, 'edited');
          if (eventName) {
            trackEvent(eventName, {
              entry_id: entryId,
              entry_type: entryType,
            });
          }
        }

        return data;
      } catch (err) {
        qaLog("journal", "Exception updating entry", { error: String(err) });
        throw err;
      }
    },
    [userId, runWithTimeout]
  );

  // Delete a journal entry
  const deleteEntry = useCallback(
    async (entryId: string): Promise<boolean> => {
      if (!userId) return false;

      // Capture entry_type before deletion for analytics
      const entryToDelete = entriesRef.current.find((e) => e.id === entryId);

      try {
        const { error: deleteError } = await supabase
          .from("journal_entries")
          .delete()
          .eq("id", entryId)
          .eq("user_id", userId);

        if (deleteError) {
          qaLog("journal", "Error deleting entry", {
            error: deleteError.message,
          });
          throw new Error(deleteError.message);
        }

        setEntries((prev) => prev.filter((entry) => entry.id !== entryId));
        qaLog("journal", "Entry deleted", { id: entryId });

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
        qaLog("journal", "Exception deleting entry", { error: String(err) });
        throw err;
      }
    },
    [userId]
  );

  // Search entries by content (searches the text content field, which all types populate)
  const searchEntries = useCallback(
    async (query: string): Promise<JournalEntry[]> => {
      if (!userId || !query.trim()) return entries;

      try {
        const { data, error: searchError } = await supabase
          .from("journal_entries")
          .select("*")
          .eq("user_id", userId)
          .ilike("content", `%${query.trim()}%`)
          .order("created_at", { ascending: false });

        if (searchError) {
          qaLog("journal", "Error searching entries", {
            error: searchError.message,
          });
          return [];
        }

        return data || [];
      } catch (err) {
        qaLog("journal", "Exception searching entries", {
          error: String(err),
        });
        return [];
      }
    },
    [userId, entries]
  );

  return {
    entries,
    loading,
    error,
    createEntry,
    updateEntry,
    deleteEntry,
    searchEntries,
    refreshEntries: fetchEntries,
  };
}
