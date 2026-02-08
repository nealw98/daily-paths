import { useState, useEffect, useCallback, useRef } from "react";
import { supabase } from "../lib/supabase";
import { qaLog } from "../utils/qaLog";
import type { EntryType } from "../constants/journalCategories";

export type { EntryType };

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

  // Fetch all entries for the current user
  const fetchEntries = useCallback(async () => {
    if (!userId) {
      setEntries([]);
      setLoading(false);
      return;
    }

    try {
      setLoading(true);
      setError(null);

      const { data, error: fetchError } = await supabase
        .from("journal_entries")
        .select("*")
        .eq("user_id", userId)
        .order("created_at", { ascending: false });

      if (fetchError) {
        qaLog("journal", "Error fetching entries", {
          error: fetchError.message,
        });
        setError(fetchError.message);
        return;
      }

      if (mounted.current) {
        // Normalize legacy entries: if entry_type is missing, derive from category or default to 'journal'
        const normalized = (data || []).map((entry: any) => ({
          ...entry,
          entry_type: entry.entry_type || entry.category || "journal",
        }));
        setEntries(normalized);
      }
    } catch (err) {
      qaLog("journal", "Exception fetching entries", { error: String(err) });
      if (mounted.current) setError(String(err));
    } finally {
      if (mounted.current) setLoading(false);
    }
  }, [userId]);

  useEffect(() => {
    mounted.current = true;
    fetchEntries();
    return () => {
      mounted.current = false;
    };
  }, [fetchEntries]);

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

      try {
        const insertData: Record<string, unknown> = {
          user_id: userId,
          entry_type: entryType,
          content: content?.trim() || null,
        };
        if (structuredContent) {
          insertData.structured_content = structuredContent;
        }

        const { data, error: insertError } = await supabase
          .from("journal_entries")
          .insert(insertData)
          .select()
          .single();

        if (insertError) {
          qaLog("journal", "Error creating entry", {
            error: insertError.message,
          });
          throw new Error(insertError.message);
        }

        if (data) {
          setEntries((prev) => [data, ...prev]);
          qaLog("journal", "Entry created", {
            id: data.id,
            type: entryType,
          });
        }

        return data;
      } catch (err) {
        qaLog("journal", "Exception creating entry", { error: String(err) });
        throw err;
      }
    },
    [userId]
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

        const { data, error: updateError } = await supabase
          .from("journal_entries")
          .update(updateData)
          .eq("id", entryId)
          .eq("user_id", userId)
          .select()
          .single();

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
        }

        return data;
      } catch (err) {
        qaLog("journal", "Exception updating entry", { error: String(err) });
        throw err;
      }
    },
    [userId]
  );

  // Delete a journal entry
  const deleteEntry = useCallback(
    async (entryId: string): Promise<boolean> => {
      if (!userId) return false;

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
