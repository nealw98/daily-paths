import { useState, useEffect, useCallback, useRef } from "react";
import { supabase } from "../lib/supabase";
import { qaLog } from "../utils/qaLog";

export interface JournalEntry {
  id: string;
  user_id: string;
  content: string;
  created_at: string;
  updated_at: string;
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
        qaLog("journal", "Error fetching entries", { error: fetchError.message });
        setError(fetchError.message);
        return;
      }

      if (mounted.current) {
        setEntries(data || []);
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
    async (content: string): Promise<JournalEntry | null> => {
      if (!userId || !content.trim()) return null;

      try {
        const { data, error: insertError } = await supabase
          .from("journal_entries")
          .insert({
            user_id: userId,
            content: content.trim(),
          })
          .select()
          .single();

        if (insertError) {
          qaLog("journal", "Error creating entry", { error: insertError.message });
          throw new Error(insertError.message);
        }

        if (data) {
          // Prepend new entry to the list
          setEntries((prev) => [data, ...prev]);
          qaLog("journal", "Entry created", { id: data.id });
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
    async (entryId: string, content: string): Promise<JournalEntry | null> => {
      if (!userId || !content.trim()) return null;

      try {
        const { data, error: updateError } = await supabase
          .from("journal_entries")
          .update({ content: content.trim() })
          .eq("id", entryId)
          .eq("user_id", userId)
          .select()
          .single();

        if (updateError) {
          qaLog("journal", "Error updating entry", { error: updateError.message });
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
          qaLog("journal", "Error deleting entry", { error: deleteError.message });
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

  // Search entries by content
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
          qaLog("journal", "Error searching entries", { error: searchError.message });
          return [];
        }

        return data || [];
      } catch (err) {
        qaLog("journal", "Exception searching entries", { error: String(err) });
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
