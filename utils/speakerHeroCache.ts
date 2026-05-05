import {
  documentDirectory,
  getInfoAsync,
  deleteAsync,
  downloadAsync,
  makeDirectoryAsync,
  readDirectoryAsync,
} from "expo-file-system/legacy";
import AsyncStorage from "@react-native-async-storage/async-storage";
import { supabase } from "../lib/supabase";
import { qaLog } from "./qaLog";

const BUCKET = "speaker-hero-images";
const MANIFEST_KEY = "@daily_paths_speaker_hero_manifest";
const CACHE_SUBDIR = "speaker-heroes";
const WEEK_MS = 7 * 24 * 60 * 60 * 1000;
// Same Monday-UTC anchor as useFeaturedSpeaker so the hero image and the
// featured speaker advance on the same weekly cadence.
const ROTATION_EPOCH_MS = Date.UTC(2025, 0, 6);

export interface HeroFile {
  number: number;
  fileName: string;
}

interface HeroManifest {
  files: HeroFile[];
  listedAt: string;
}

const cacheDir = `${documentDirectory}${CACHE_SUBDIR}/`;
const localPathFor = (fileName: string) => `${cacheDir}${fileName}`;

function parseFileNumber(fileName: string): number | null {
  const m = fileName.match(/(\d+)\.webp$/i);
  if (!m) return null;
  const n = parseInt(m[1], 10);
  return Number.isFinite(n) ? n : null;
}

async function readManifest(): Promise<HeroManifest | null> {
  try {
    const raw = await AsyncStorage.getItem(MANIFEST_KEY);
    if (!raw) return null;
    const parsed = JSON.parse(raw);
    if (parsed && Array.isArray(parsed.files)) return parsed as HeroManifest;
    return null;
  } catch {
    return null;
  }
}

async function writeManifest(manifest: HeroManifest): Promise<void> {
  await AsyncStorage.setItem(MANIFEST_KEY, JSON.stringify(manifest));
}

async function ensureCacheDir(): Promise<void> {
  const info = await getInfoAsync(cacheDir);
  if (!info.exists) {
    await makeDirectoryAsync(cacheDir, { intermediates: true });
  }
}

function publicUrlFor(fileName: string): string {
  const base = process.env.EXPO_PUBLIC_SUPABASE_URL || "";
  return `${base}/storage/v1/object/public/${BUCKET}/${encodeURIComponent(fileName)}`;
}

/**
 * List the bucket, download new files, evict files that no longer exist
 * remotely, and update the local manifest. Best-effort: errors are swallowed
 * (logged via qaLog) so a refresh failure leaves the existing cache intact.
 */
export async function refreshSpeakerHeroes(): Promise<{ total: number; cached: number } | null> {
  try {
    qaLog("SpeakerHero", "Listing bucket");
    const { data, error } = await supabase.storage.from(BUCKET).list("", { limit: 100 });
    if (error || !data) {
      qaLog("SpeakerHero", "List failed", { error: error?.message ?? "no data" });
      return null;
    }

    const remoteFiles: HeroFile[] = [];
    for (const item of data) {
      if (!item.name || !item.name.toLowerCase().endsWith(".webp")) continue;
      const num = parseFileNumber(item.name);
      if (num == null) continue;
      remoteFiles.push({ number: num, fileName: item.name });
    }
    remoteFiles.sort((a, b) => a.number - b.number);

    qaLog("SpeakerHero", "Listed", { count: remoteFiles.length });

    await ensureCacheDir();

    const downloadedFiles: HeroFile[] = [];
    for (const f of remoteFiles) {
      const local = localPathFor(f.fileName);
      const info = await getInfoAsync(local);
      if (info.exists) {
        downloadedFiles.push(f);
        continue;
      }
      try {
        const res = await downloadAsync(publicUrlFor(f.fileName), local);
        if (res.status >= 200 && res.status < 300) {
          downloadedFiles.push(f);
        } else {
          qaLog("SpeakerHero", "Download non-2xx", { fileName: f.fileName, status: res.status });
          await deleteAsync(local, { idempotent: true });
        }
      } catch (err) {
        qaLog("SpeakerHero", "Download failed", { fileName: f.fileName, error: String(err) });
        await deleteAsync(local, { idempotent: true });
      }
    }

    const remoteNames = new Set(remoteFiles.map((f) => f.fileName));
    try {
      const dirInfo = await readDirectoryAsync(cacheDir);
      for (const name of dirInfo) {
        if (!remoteNames.has(name)) {
          await deleteAsync(localPathFor(name), { idempotent: true });
          qaLog("SpeakerHero", "Evicted", { fileName: name });
        }
      }
    } catch {
      // Directory may not exist if no downloads ever happened — ignore.
    }

    const manifest: HeroManifest = {
      files: downloadedFiles,
      listedAt: new Date().toISOString(),
    };
    await writeManifest(manifest);
    qaLog("SpeakerHero", "Manifest updated", {
      total: remoteFiles.length,
      cached: downloadedFiles.length,
    });
    return { total: remoteFiles.length, cached: downloadedFiles.length };
  } catch (err) {
    qaLog("SpeakerHero", "Refresh threw", { error: String(err) });
    return null;
  }
}

async function resolveLocal(file: HeroFile | undefined): Promise<{ uri: string } | null> {
  if (!file) return null;
  const local = localPathFor(file.fileName);
  const info = await getInfoAsync(local);
  if (!info.exists) return null;
  return { uri: local };
}

/**
 * Pick the cached hero image for a given date using the same week-index math
 * as useFeaturedSpeaker. Returns null when the manifest is missing/empty or
 * the chosen file isn't on disk — caller falls back to the bundled image.
 */
export async function getSpeakerHeroForDate(date: Date): Promise<{ uri: string } | null> {
  const manifest = await readManifest();
  if (!manifest || manifest.files.length === 0) return null;
  const weekIndex = Math.floor((date.getTime() - ROTATION_EPOCH_MS) / WEEK_MS);
  const len = manifest.files.length;
  const i = ((weekIndex % len) + len) % len;
  return resolveLocal(manifest.files[i]);
}

export async function getSpeakerHeroByNumber(n: number): Promise<{ uri: string } | null> {
  const manifest = await readManifest();
  if (!manifest) return null;
  return resolveLocal(manifest.files.find((f) => f.number === n));
}

export async function getHeroManifestSnapshot(): Promise<{ numbers: number[] } | null> {
  const manifest = await readManifest();
  if (!manifest) return null;
  return { numbers: manifest.files.map((f) => f.number) };
}

/** Compute the current week index — useful for week-boundary triggers. */
export function getCurrentHeroWeekIndex(date: Date): number {
  return Math.floor((date.getTime() - ROTATION_EPOCH_MS) / WEEK_MS);
}
