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

interface DownloadRecord {
  downloaded: boolean;
  localPath: string;
  downloadedAt: string;
}

type DownloadMap = Record<string, DownloadRecord>;

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

      if (record?.downloaded && record.localPath) {
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

    // Check if file already exists (e.g. from a previous session)
    try {
      const info = await getInfoAsync(filePath);
      if (info.exists) {
        const map = await loadDownloadMap();
        map[speakerId] = {
          downloaded: true,
          localPath: filePath,
          downloadedAt: new Date().toISOString(),
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
        if (record.downloaded && record.localPath) {
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
