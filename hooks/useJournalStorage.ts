import { useJournalEntries } from "./useJournalEntries";
import { canAccessCloudData } from "../utils/accessControl";

/**
 * Unified journal storage hook for cloud-backed notebook data.
 * Cloud operations are auth-scoped and independent from premium entitlement.
 */
export function useJournalStorage(
  userId: string | null | undefined,
  isAuthenticated: boolean,
) {
  const supabaseHook = useJournalEntries(userId);

  if (canAccessCloudData(isAuthenticated, userId)) {
    return supabaseHook;
  }
  
  return {
    entries: [],
    loading: false,
    error: null,
    createEntry: async () => null,
    updateEntry: async () => null,
    deleteEntry: async () => false,
    searchEntries: async () => [],
    refreshEntries: async (_source?: "auto" | "manual" | "retry") => {},
  };
}
