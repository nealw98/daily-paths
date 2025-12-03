import { useEffect, useState } from "react";

export interface QaLogEntry {
  id: number;
  timestamp: string;
  scope: string;
  message: string;
  details?: string;
}

let counter = 0;
let entries: QaLogEntry[] = [];
const listeners = new Set<(items: QaLogEntry[]) => void>();

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
  entries = [entry, ...entries].slice(0, 200);

  listeners.forEach((listener) => {
    try {
      listener(entries);
    } catch {
      // best-effort only
    }
  });

  // Mirror into the native console for easier debugging when attached.
  // eslint-disable-next-line no-console
  console.log(`[QA][${scope}] ${message}`, details);
}

export function useQaLogs(): QaLogEntry[] {
  const [data, setData] = useState<QaLogEntry[]>(entries);

  useEffect(() => {
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
  listeners.forEach((listener) => {
    try {
      listener(entries);
    } catch {
      // ignore
    }
  });
}


