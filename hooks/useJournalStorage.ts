/**
 * Unified journal storage hook — delegates to local AsyncStorage.
 * This module exists so consumers can import from a stable path.
 */
export { useLocalJournalEntries as useJournalStorage } from "./useLocalJournalEntries";
export type { JournalEntry, EntryType } from "./useLocalJournalEntries";
