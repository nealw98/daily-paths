import AsyncStorage from "@react-native-async-storage/async-storage";
import { supabase } from "../lib/supabase";
import { qaLog } from "./qaLog";

/**
 * Every reading's Thought for the Day, keyed by scheduled day_of_year.
 *
 * Readings are static and keyed by day of year, so one small query (~15 KB)
 * lets every scheduled notification — including the lapsed window weeks
 * out — carry the real Thought instead of a generic fallback phrasing.
 */
const STORAGE_KEY = "thoughts_for_day_v1";
const REFRESH_INTERVAL_MS = 24 * 60 * 60 * 1000;

type ThoughtsByDay = Record<number, string>;

interface StoredThoughts {
  fetchedAt: number;
  byDay: ThoughtsByDay;
}

let memory: StoredThoughts | null = null;

async function readStored(): Promise<StoredThoughts | null> {
  if (memory) return memory;
  try {
    const raw = await AsyncStorage.getItem(STORAGE_KEY);
    if (raw) memory = JSON.parse(raw) as StoredThoughts;
  } catch (e) {
    console.warn("[Thoughts] Failed to read cache", e);
  }
  return memory;
}

async function fetchRemote(): Promise<StoredThoughts | null> {
  const { data, error } = await supabase
    .from("readings")
    .select("day_of_year, thought_for_day");

  if (error || !data) {
    qaLog("thoughts", "Fetch failed", { message: error?.message ?? "no data" });
    return null;
  }

  const byDay: ThoughtsByDay = {};
  for (const row of data as { day_of_year: number; thought_for_day: string | null }[]) {
    const thought = row.thought_for_day?.trim();
    if (thought) byDay[row.day_of_year] = thought;
  }

  const stored: StoredThoughts = { fetchedAt: Date.now(), byDay };
  memory = stored;
  try {
    await AsyncStorage.setItem(STORAGE_KEY, JSON.stringify(stored));
  } catch (e) {
    console.warn("[Thoughts] Failed to write cache", e);
  }
  qaLog("thoughts", "Fetched thoughts", { count: Object.keys(byDay).length });
  return stored;
}

/**
 * Returns the thoughts table, refreshing it from Supabase at most once a
 * day. Falls back to the last cached copy when offline; null only if we've
 * never fetched it successfully.
 */
export async function getThoughtsByDay(): Promise<ThoughtsByDay | null> {
  const stored = await readStored();
  if (stored && Date.now() - stored.fetchedAt < REFRESH_INTERVAL_MS) {
    return stored.byDay;
  }
  try {
    const fresh = await fetchRemote();
    if (fresh) return fresh.byDay;
  } catch (e) {
    qaLog("thoughts", "Fetch threw", {
      message: e instanceof Error ? e.message : String(e),
    });
  }
  return stored?.byDay ?? null;
}
