import AsyncStorage from "@react-native-async-storage/async-storage";

const STORAGE_KEY = "@daily_paths_speaker_progress";

export interface SpeakerProgress {
  positionMs: number;
  durationMs: number;
  rate: number;
  didFinish: boolean;
  updatedAt: string;
}

type ProgressMap = Record<string, SpeakerProgress>;

async function readMap(): Promise<ProgressMap> {
  try {
    const raw = await AsyncStorage.getItem(STORAGE_KEY);
    return raw ? JSON.parse(raw) : {};
  } catch {
    return {};
  }
}

async function writeMap(map: ProgressMap): Promise<void> {
  await AsyncStorage.setItem(STORAGE_KEY, JSON.stringify(map));
}

/**
 * Get saved progress for a single speaker.
 */
export async function getSpeakerProgress(
  speakerId: string
): Promise<SpeakerProgress | null> {
  const map = await readMap();
  return map[speakerId] ?? null;
}

/**
 * Save progress for a single speaker.
 * Merges into the existing map so other speakers are unaffected.
 */
export async function saveSpeakerProgress(
  speakerId: string,
  data: Omit<SpeakerProgress, "updatedAt">
): Promise<void> {
  const map = await readMap();
  map[speakerId] = {
    ...data,
    updatedAt: new Date().toISOString(),
  };
  await writeMap(map);
}

/**
 * Get progress for all speakers.
 */
export async function getAllSpeakerProgress(): Promise<ProgressMap> {
  return readMap();
}

/**
 * Clear saved progress for a single speaker.
 */
export async function clearSpeakerProgress(
  speakerId: string
): Promise<void> {
  const map = await readMap();
  delete map[speakerId];
  await writeMap(map);
}
