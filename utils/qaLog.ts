import { useEffect, useState } from "react";
import AsyncStorage from "@react-native-async-storage/async-storage";

export interface QaLogEntry {
  id: number;
  timestamp: string;
  scope: string;
  message: string;
  details?: string;
}

const QA_LOG_KEY = "@daily_paths_qa_logs_v1";
const MAX_LOGS = 400;

let counter = 0;
let entries: QaLogEntry[] = [];
const listeners = new Set<(items: QaLogEntry[]) => void>();
let hydrated = false;
let hydrating: Promise<void> | null = null;

async function persistLogs() {
  try {
    await AsyncStorage.setItem(QA_LOG_KEY, JSON.stringify(entries));
  } catch (err) {
    // best-effort only
    // eslint-disable-next-line no-console
    console.error("Failed to persist QA logs", err);
  }
}

async function hydrateLogs() {
  if (hydrated || hydrating) return hydrating;
  hydrating = (async () => {
    try {
      const raw = await AsyncStorage.getItem(QA_LOG_KEY);
      if (raw) {
        const parsed = JSON.parse(raw) as QaLogEntry[];
        entries = parsed;
        // Keep counter ahead of highest id to avoid collisions
        counter = parsed.reduce((max, item) => Math.max(max, item.id), counter);
        listeners.forEach((listener) => {
          try {
            listener(entries);
          } catch {
            // ignore
          }
        });
      }
    } catch (err) {
      // eslint-disable-next-line no-console
      console.error("Failed to hydrate QA logs", err);
    } finally {
      hydrated = true;
      hydrating = null;
    }
  })();
  return hydrating;
}

// Fire-and-forget hydration so logs survive restarts/crashes.
hydrateLogs();

export function qaLog(scope: string, message: string, details?: unknown) {
  const entry: QaLogEntry = {
    id: ++counter,
    timestamp: new Date().toISOString(),
    scope,
    message,
    details:
      details == null
        ? undefined
        : typeof details === "string"
        ? details
        : JSON.stringify(details, null, 2),
  };

  // Keep the newest entries first; cap to a reasonable history.
  entries = [entry, ...entries].slice(0, MAX_LOGS);

  listeners.forEach((listener) => {
    try {
      listener(entries);
    } catch {
      // best-effort only
    }
  });

  // Persist for post-crash inspection
  void persistLogs();

  // Mirror into the native console for easier debugging when attached.
  // eslint-disable-next-line no-console
  console.log(`[QA][${scope}] ${message}`, details);
}

export function useQaLogs(): QaLogEntry[] {
  const [data, setData] = useState<QaLogEntry[]>(entries);

  useEffect(() => {
    // Ensure hydration when a subscriber mounts
    void hydrateLogs();
    const listener = (items: QaLogEntry[]) => setData(items);
    listeners.add(listener);
    return () => {
      listeners.delete(listener);
    };
  }, []);

  return data;
}

export function clearQaLogs() {
  entries = [];
  counter = 0;
  void AsyncStorage.removeItem(QA_LOG_KEY);
  listeners.forEach((listener) => {
    try {
      listener(entries);
    } catch {
      // ignore
    }
  });
}


