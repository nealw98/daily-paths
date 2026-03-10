import { useJournalEntries } from "./useJournalEntries";
import { useLocalJournalEntries } from "./useLocalJournalEntries";
import { useSubscriptionContext } from "../contexts/SubscriptionContext";
import { getSaveRequirement } from "../utils/accessControl";

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
  const { status, trialStatus } = useSubscriptionContext();
  const saveRequirement = getSaveRequirement(status, trialStatus, isAuthenticated);

  if (saveRequirement === "cloud" && isAuthenticated && userId) {
    return supabaseHook;
  }
  if (saveRequirement === "local") return localHook;

  // Entitled-but-signed-out users should not see or write local data.
  return {
    entries: [],
    loading: false,
    error: null,
    createEntry: async () => null,
    updateEntry: async () => null,
    deleteEntry: async () => false,
    searchEntries: async () => [],
    refreshEntries: async () => {},
  };
}
