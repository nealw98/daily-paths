import { useJournalEntries } from "./useJournalEntries";
import { useLocalJournalEntries } from "./useLocalJournalEntries";

/**
 * Unified journal storage hook that delegates to either Supabase or
 * AsyncStorage depending on whether the user is authenticated.
 *
 * Both underlying hooks are always called (React Rules of Hooks require
 * unconditional calls).  `useJournalEntries(null)` gracefully returns an
 * empty array when there is no userId, so the "unused" hook is effectively
 * idle.
 */
export function useJournalStorage(
  userId: string | null | undefined,
  isAuthenticated: boolean,
) {
  // Always call both hooks unconditionally
  const supabaseHook = useJournalEntries(userId);
  const localHook = useLocalJournalEntries();

  // Authenticated users get cloud storage; trial users get local storage
  if (isAuthenticated && userId) {
    return supabaseHook;
  }
  return localHook;
}
