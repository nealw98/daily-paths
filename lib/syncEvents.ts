type SyncChangeListener = () => void;

const listeners = new Set<SyncChangeListener>();

/**
 * Signals that user-owned data changed locally. Storage remains the source of
 * truth; this event only lets the app-level sync gate debounce a cloud sync.
 */
export function notifyUserDataChanged(): void {
  for (const listener of listeners) listener();
}

export function subscribeToUserDataChanges(listener: SyncChangeListener): () => void {
  listeners.add(listener);
  return () => listeners.delete(listener);
}
