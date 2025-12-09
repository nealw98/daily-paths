import * as FileSystem from "expo-file-system";
import { qaLog } from "./qaLog";

export interface JsErrorEntry {
  timestamp: string;
  message: string;
  stack?: string | null;
  isFatal: boolean;
}

const LOG_PATH =
  (FileSystem.documentDirectory || FileSystem.cacheDirectory || "") +
  "js-errors.json";
const MAX_ENTRIES = 50;

async function readEntries(): Promise<JsErrorEntry[]> {
  try {
    const info = await FileSystem.getInfoAsync(LOG_PATH);
    if (!info.exists) {
      return [];
    }
    const raw = await FileSystem.readAsStringAsync(LOG_PATH);
    const parsed = JSON.parse(raw) as JsErrorEntry[];
    return Array.isArray(parsed) ? parsed : [];
  } catch {
    // If the log is corrupt, start fresh to avoid repeated crashes.
    return [];
  }
}

async function writeEntries(entries: JsErrorEntry[]) {
  try {
    await FileSystem.writeAsStringAsync(
      LOG_PATH,
      JSON.stringify(entries.slice(0, MAX_ENTRIES)),
    );
  } catch (err) {
    // eslint-disable-next-line no-console
    console.warn("[ErrorLogger] Failed to write log", err);
  }
}

export async function recordJsError(
  error: unknown,
  isFatal: boolean,
): Promise<void> {
  const normalized =
    error instanceof Error
      ? { message: error.message, stack: error.stack }
      : { message: String(error), stack: undefined };

  const entry: JsErrorEntry = {
    timestamp: new Date().toISOString(),
    message: normalized.message,
    stack: normalized.stack,
    isFatal,
  };

  // Persist to disk (best effort)
  const existing = await readEntries();
  await writeEntries([entry, ...existing]);

  // Also surface in QA logs for quick visibility
  qaLog("js-error", normalized.message, normalized.stack);
}

export async function getJsErrorLog(): Promise<JsErrorEntry[]> {
  return readEntries();
}

export async function clearJsErrorLog(): Promise<void> {
  await writeEntries([]);
}

export async function getErrorLogText(limit = 20): Promise<string> {
  const entries = await readEntries();
  return entries
    .slice(0, limit)
    .map((entry) => {
      const header = `[${entry.timestamp}] ${entry.isFatal ? "FATAL " : ""}${
        entry.message
      }`;
      return entry.stack ? `${header}\n${entry.stack}` : header;
    })
    .join("\n\n");
}

let installed = false;

export function installGlobalErrorHandler() {
  if (installed) return;
  installed = true;

  // eslint-disable-next-line @typescript-eslint/no-var-requires
  const ErrorUtils = (global as any).ErrorUtils;
  const previousHandler = ErrorUtils?.getGlobalHandler?.();

  if (ErrorUtils?.setGlobalHandler) {
    ErrorUtils.setGlobalHandler((error: unknown, isFatal?: boolean) => {
      // Fire and forget; we don't block the native crash path.
      recordJsError(error, !!isFatal).catch(() => {});
      try {
        previousHandler?.(error, isFatal);
      } catch {
        // ignore failures in the previous handler
      }
    });
  }

  // Capture unhandled promise rejections where supported.
  const globalAny = global as any;
  const previousRejection = globalAny.onunhandledrejection;
  globalAny.onunhandledrejection = (event: any) => {
    const reason = event?.reason ?? event;
    recordJsError(reason, false).catch(() => {});
    previousRejection?.(event);
  };
}



