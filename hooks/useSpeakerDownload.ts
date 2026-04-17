import { useState, useEffect, useCallback, useRef } from "react";
import {
  documentDirectory,
  getInfoAsync,
  deleteAsync,
  createDownloadResumable,
  DownloadResumable,
} from "expo-file-system/legacy";
import type { DownloadProgressData } from "expo-file-system/legacy";
import AsyncStorage from "@react-native-async-storage/async-storage";
import { qaLog } from "../utils/qaLog";

// ─── Types ─────────────────────────────────────────────────────────────────

export type DownloadStatus = "not_downloaded" | "downloading" | "downloaded";

/**
 * Distinguishes user-initiated downloads from silent prefetches.
 * - "manual": user tapped the Download button — surfaced in UI (badge, status).
 * - "prefetch": app pre-cached the file in the background — invisible to the
 *   user; the file is still used transparently for playback via resolveAudioUri.
 * A missing `source` is treated as "manual" for back-compat with records
 * written before prefetching existed.
 */
export type DownloadSource = "manual" | "prefetch";

interface DownloadRecord {
  downloaded: boolean;
  localPath: string;
  downloadedAt: string;
  source?: DownloadSource;
}

type DownloadMap = Record<string, DownloadRecord>;

function getRecordSource(record: DownloadRecord | undefined): DownloadSource {
  return record?.source ?? "manual";
}

// ─── Constants ─────────────────────────────────────────────────────────────

const STORAGE_KEY = "speaker_downloads";

function getLocalPath(speakerId: string): string {
  return `${documentDirectory}speaker_${speakerId}.m4a`;
}

// ─── Shared AsyncStorage helpers ───────────────────────────────────────────

async function loadDownloadMap(): Promise<DownloadMap> {
  try {
    const raw = await AsyncStorage.getItem(STORAGE_KEY);
    return raw ? JSON.parse(raw) : {};
  } catch {
    return {};
  }
}

async function saveDownloadMap(map: DownloadMap): Promise<void> {
  await AsyncStorage.setItem(STORAGE_KEY, JSON.stringify(map));
}

// ─── Hook: useSpeakerDownload (single speaker) ────────────────────────────

/**
 * Manages download state for a single speaker recording.
 * Used on the detail screen for full download UI and on the browse screen
 * for the downloaded badge indicator.
 */
export function useSpeakerDownload(speakerId: string, audioUrl: string) {
  const [downloadStatus, setDownloadStatus] = useState<DownloadStatus>("not_downloaded");
  const [downloadProgress, setDownloadProgress] = useState(0);
  const [localPath, setLocalPath] = useState<string | null>(null);
  const downloadResumableRef = useRef<DownloadResumable | null>(null);
  const mountedRef = useRef(true);

  // Check existing download state on mount
  useEffect(() => {
    mountedRef.current = true;
    checkDownloadState();
    return () => {
      mountedRef.current = false;
    };
  }, [speakerId]); // eslint-disable-line react-hooks/exhaustive-deps

  const checkDownloadState = useCallback(async () => {
    try {
      const map = await loadDownloadMap();
      const record = map[speakerId];

      // Only user-initiated "manual" downloads surface as "downloaded" in the
      // UI. Prefetched files live in the same place on disk (and are still
      // used for playback via resolveAudioUri) but must not show the badge or
      // flip the download button — the user didn't ask to download them.
      if (
        record?.downloaded &&
        record.localPath &&
        getRecordSource(record) === "manual"
      ) {
        // Verify file actually exists on disk
        const info = await getInfoAsync(record.localPath);
        if (info.exists) {
          if (mountedRef.current) {
            setDownloadStatus("downloaded");
            setLocalPath(record.localPath);
          }
          return;
        }
        // File is gone — clean up stale record
        delete map[speakerId];
        await saveDownloadMap(map);
      }

      if (mountedRef.current) {
        setDownloadStatus("not_downloaded");
        setLocalPath(null);
      }
    } catch (err) {
      qaLog("download", "Error checking download state", { speakerId, error: String(err) });
    }
  }, [speakerId]);

  const startDownload = useCallback(async () => {
    if (downloadStatus === "downloading") return;

    const filePath = getLocalPath(speakerId);

    // Check if file already exists (e.g. from a previous session, or from a
    // background prefetch). Either way, upgrade/mark as "manual" so the UI
    // reflects that this is now a user-owned download.
    try {
      const info = await getInfoAsync(filePath);
      if (info.exists) {
        const map = await loadDownloadMap();
        map[speakerId] = {
          downloaded: true,
          localPath: filePath,
          downloadedAt: new Date().toISOString(),
          source: "manual",
        };
        await saveDownloadMap(map);
        if (mountedRef.current) {
          setDownloadStatus("downloaded");
          setLocalPath(filePath);
        }
        return;
      }
    } catch {
      // Continue to download
    }

    if (mountedRef.current) {
      setDownloadStatus("downloading");
      setDownloadProgress(0);
    }

    const progressCallback = (data: DownloadProgressData) => {
      if (!mountedRef.current) return;
      if (data.totalBytesExpectedToWrite > 0) {
        const pct = Math.round(
          (data.totalBytesWritten / data.totalBytesExpectedToWrite) * 100,
        );
        setDownloadProgress(pct);
      }
    };

    const resumable = createDownloadResumable(
      audioUrl,
      filePath,
      {},
      progressCallback,
    );
    downloadResumableRef.current = resumable;

    try {
      qaLog("download", "Starting download", { speakerId, audioUrl: audioUrl.slice(-40) });
      const result = await resumable.downloadAsync();

      if (!result) {
        // Download was cancelled
        if (mountedRef.current) {
          setDownloadStatus("not_downloaded");
          setDownloadProgress(0);
        }
        return;
      }

      // Save to AsyncStorage
      const map = await loadDownloadMap();
      map[speakerId] = {
        downloaded: true,
        localPath: filePath,
        downloadedAt: new Date().toISOString(),
        source: "manual",
      };
      await saveDownloadMap(map);

      if (mountedRef.current) {
        setDownloadStatus("downloaded");
        setLocalPath(filePath);
        setDownloadProgress(100);
      }

      qaLog("download", "Download complete", { speakerId });
    } catch (err) {
      qaLog("download", "Download failed", { speakerId, error: String(err) });
      // Clean up partial file
      try {
        await deleteAsync(filePath, { idempotent: true });
      } catch {
        // Ignore cleanup errors
      }
      if (mountedRef.current) {
        setDownloadStatus("not_downloaded");
        setDownloadProgress(0);
      }
    } finally {
      downloadResumableRef.current = null;
    }
  }, [speakerId, audioUrl, downloadStatus]);

  const cancelDownload = useCallback(async () => {
    if (downloadResumableRef.current) {
      try {
        await downloadResumableRef.current.pauseAsync();
      } catch {
        // Ignore
      }
      downloadResumableRef.current = null;
    }

    // Remove partial file
    const filePath = getLocalPath(speakerId);
    try {
      await deleteAsync(filePath, { idempotent: true });
    } catch {
      // Ignore
    }

    if (mountedRef.current) {
      setDownloadStatus("not_downloaded");
      setDownloadProgress(0);
    }

    qaLog("download", "Download cancelled", { speakerId });
  }, [speakerId]);

  const deleteDownload = useCallback(async () => {
    const filePath = getLocalPath(speakerId);

    try {
      await deleteAsync(filePath, { idempotent: true });
    } catch {
      // Ignore
    }

    // Update AsyncStorage
    try {
      const map = await loadDownloadMap();
      delete map[speakerId];
      await saveDownloadMap(map);
    } catch {
      // Ignore
    }

    if (mountedRef.current) {
      setDownloadStatus("not_downloaded");
      setLocalPath(null);
      setDownloadProgress(0);
    }

    qaLog("download", "Download deleted", { speakerId });
  }, [speakerId]);

  return {
    downloadStatus,
    downloadProgress,
    startDownload,
    cancelDownload,
    deleteDownload,
    localPath,
  };
}

// ─── Hook: useDownloadedSpeakerIds (browse screen) ────────────────────────

/**
 * Returns a Set of speaker IDs that have been downloaded.
 * Lightweight hook for the browse screen badge indicator.
 */
export function useDownloadedSpeakerIds() {
  const [downloadedIds, setDownloadedIds] = useState<Set<string>>(new Set());
  const mountedRef = useRef(true);

  const refresh = useCallback(async () => {
    try {
      const map = await loadDownloadMap();
      const ids = new Set<string>();

      for (const [id, record] of Object.entries(map)) {
        // Prefetched files live on disk but must not appear in the UI badge
        // — the user didn't explicitly download them.
        if (
          record.downloaded &&
          record.localPath &&
          getRecordSource(record) === "manual"
        ) {
          // Verify file exists
          const info = await getInfoAsync(record.localPath);
          if (info.exists) {
            ids.add(id);
          }
        }
      }

      if (mountedRef.current) {
        setDownloadedIds(ids);
      }
    } catch {
      // Ignore
    }
  }, []);

  useEffect(() => {
    mountedRef.current = true;
    refresh();
    return () => {
      mountedRef.current = false;
    };
  }, [refresh]);

  return { downloadedIds, refresh };
}

// ─── Background prefetch (silent, for featured speaker) ───────────────────

/**
 * Module-level dedup: if a prefetch is already in flight for a given
 * speakerId, a second call is a no-op. Survives as long as the JS context
 * does (i.e. for the life of the app session).
 */
const inFlightPrefetches = new Map<string, DownloadResumable>();

/**
 * Silently pre-cache a speaker's audio file to disk so the first tap into
 * the player is instant. Intended for the featured-speaker card on home —
 * fire and forget; failures are swallowed.
 *
 * - Skips if the file is already on disk (from a prior manual download,
 *   prior prefetch, or a same-session in-flight prefetch).
 * - Writes the AsyncStorage record with `source: "prefetch"` so the file
 *   does NOT show up with the "downloaded" badge in the UI.
 * - If the user later taps the manual Download button for the same speaker,
 *   `startDownload` detects the on-disk file and upgrades the record to
 *   `source: "manual"` without re-downloading.
 */
export async function prefetchSpeakerAudio(
  speakerId: string,
  audioUrl: string
): Promise<void> {
  if (!speakerId || !audioUrl) return;
  if (inFlightPrefetches.has(speakerId)) return;

  const filePath = getLocalPath(speakerId);

  try {
    // Already-tracked on disk — nothing to do.
    const map = await loadDownloadMap();
    const existing = map[speakerId];
    if (existing?.downloaded && existing.localPath) {
      const info = await getInfoAsync(existing.localPath);
      if (info.exists) return;
    }

    // File present on disk but not tracked — register it as a prefetch
    // record so resolveAudioUri can find it, and skip the download.
    const untrackedInfo = await getInfoAsync(filePath);
    if (untrackedInfo.exists) {
      const updated: DownloadMap = { ...map };
      updated[speakerId] = {
        downloaded: true,
        localPath: filePath,
        downloadedAt: new Date().toISOString(),
        source: "prefetch",
      };
      await saveDownloadMap(updated);
      return;
    }
  } catch {
    // Best-effort; fall through to download.
  }

  const resumable = createDownloadResumable(audioUrl, filePath, {});
  inFlightPrefetches.set(speakerId, resumable);

  try {
    qaLog("download", "Starting prefetch", {
      speakerId,
      audioUrl: audioUrl.slice(-40),
    });
    const result = await resumable.downloadAsync();
    if (!result) {
      qaLog("download", "Prefetch cancelled or empty", { speakerId });
      return;
    }

    const map = await loadDownloadMap();
    // If a manual download beat us to it mid-flight, don't overwrite the
    // "manual" record with a "prefetch" one.
    if (getRecordSource(map[speakerId]) === "manual" && map[speakerId]?.downloaded) {
      qaLog("download", "Manual download present — skipping prefetch record", {
        speakerId,
      });
      return;
    }
    map[speakerId] = {
      downloaded: true,
      localPath: filePath,
      downloadedAt: new Date().toISOString(),
      source: "prefetch",
    };
    await saveDownloadMap(map);
    qaLog("download", "Prefetch complete", { speakerId });
  } catch (err) {
    qaLog("download", "Prefetch failed", { speakerId, error: String(err) });
    // Clean up any partial file so a later download starts fresh.
    try {
      await deleteAsync(filePath, { idempotent: true });
    } catch {
      // Ignore cleanup errors
    }
  } finally {
    inFlightPrefetches.delete(speakerId);
  }
}

// ─── Helper: resolve audio URI for playback ───────────────────────────────

/**
 * Returns the local file path if downloaded and still on disk,
 * otherwise returns the remote URL. Used by the audio player to
 * transparently play from local storage when available.
 */
export async function resolveAudioUri(
  speakerId: string,
  remoteUrl: string,
): Promise<string> {
  try {
    const map = await loadDownloadMap();
    const record = map[speakerId];
    if (record?.downloaded && record.localPath) {
      const info = await getInfoAsync(record.localPath);
      if (info.exists) {
        return record.localPath;
      }
      // Stale record — clean up
      delete map[speakerId];
      await saveDownloadMap(map);
    }
  } catch {
    // Fall through to remote
  }
  return remoteUrl;
}
