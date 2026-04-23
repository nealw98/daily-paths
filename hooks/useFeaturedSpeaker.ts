import { useState, useEffect } from "react";
import AsyncStorage from "@react-native-async-storage/async-storage";
import { getAllSpeakerProgress } from "../utils/speakerProgress";
import type { Speaker } from "../types/speakers";

const FEATURED_IDS_KEY = "@daily_paths_featured_speaker_ids";
const FEATURED_PICK_KEY = "@daily_paths_featured_pick";
const WEEK_MS = 7 * 24 * 60 * 60 * 1000;

interface FeaturedPick {
  speakerId: string;
  pickedAt: string; // ISO timestamp
}

export interface FeaturedSpeakerResult {
  speaker: Speaker | null;
  /** Whether the user has started but not finished this speaker */
  isStarted: boolean;
  /** Whether all speakers are finished (cycling back through) */
  isListenAgain: boolean;
}

/**
 * Sort speakers by date (newest first), falling back to created_at for nulls.
 */
function sortNewest(speakers: Speaker[]): Speaker[] {
  return [...speakers].sort((a, b) =>
    (b.date || b.created_at || "").localeCompare(a.date || a.created_at || "")
  );
}

async function getFeaturedIds(): Promise<Set<string>> {
  const raw = await AsyncStorage.getItem(FEATURED_IDS_KEY);
  if (!raw) return new Set();
  try {
    return new Set(JSON.parse(raw));
  } catch {
    return new Set();
  }
}

async function saveFeaturedIds(ids: Set<string>): Promise<void> {
  await AsyncStorage.setItem(FEATURED_IDS_KEY, JSON.stringify([...ids]));
}

async function getFeaturedPick(): Promise<FeaturedPick | null> {
  const raw = await AsyncStorage.getItem(FEATURED_PICK_KEY);
  if (!raw) return null;
  try {
    const parsed = JSON.parse(raw);
    if (
      parsed &&
      typeof parsed.speakerId === "string" &&
      typeof parsed.pickedAt === "string"
    ) {
      return parsed;
    }
    return null;
  } catch {
    return null;
  }
}

async function saveFeaturedPick(pick: FeaturedPick): Promise<void> {
  await AsyncStorage.setItem(FEATURED_PICK_KEY, JSON.stringify(pick));
}

/**
 * Pick the featured speaker for the home page.
 *
 * Cadence: the featured speaker rotates at most once per week. The currently
 * pinned speaker is kept until 7 days have passed since it was picked (or
 * until that speaker disappears from the catalog).
 *
 * Rotation logic (when a new pick is needed):
 * 1. Sort speakers newest-first.
 * 2. Find the first speaker that is both un-featured and unfinished.
 * 3. If that speaker is started (has progress) → show "Continue".
 * 4. Mark the picked speaker as featured and stamp the pick time.
 * 5. If all speakers have been featured or finished, reset the featured
 *    list and start over from the newest unfinished speaker.
 * 6. If all are finished → show least-recently-finished with "Listen again".
 */
export function useFeaturedSpeaker(speakers: Speaker[]): FeaturedSpeakerResult {
  const [result, setResult] = useState<FeaturedSpeakerResult>({
    speaker: null,
    isStarted: false,
    isListenAgain: false,
  });

  useEffect(() => {
    if (speakers.length === 0) {
      setResult({ speaker: null, isStarted: false, isListenAgain: false });
      return;
    }

    let cancelled = false;

    (async () => {
      const [progressMap, featuredIds, existingPick] = await Promise.all([
        getAllSpeakerProgress(),
        getFeaturedIds(),
        getFeaturedPick(),
      ]);
      if (cancelled) return;

      // If we have a pick from within the last week and the speaker still
      // exists in the catalog, keep it pinned.
      if (existingPick) {
        const pickedTime = Date.parse(existingPick.pickedAt);
        const age = Date.now() - pickedTime;
        const withinWeek =
          !Number.isNaN(pickedTime) && age >= 0 && age < WEEK_MS;
        if (withinWeek) {
          const pinned = speakers.find((s) => s.id === existingPick.speakerId);
          if (pinned) {
            const progress = progressMap[pinned.id];
            const isStarted = !!(
              progress && progress.positionMs > 0 && !progress.didFinish
            );
            // If the user finishes the weekly speaker mid-week, surface the
            // "Listen again" label rather than a blank card.
            const isListenAgain = !!progress?.didFinish;
            if (!cancelled) {
              setResult({ speaker: pinned, isStarted, isListenAgain });
            }
            return;
          }
        }
      }

      // Otherwise, it's time to rotate.
      const sorted = sortNewest(speakers);

      // Find the first speaker that is un-featured AND unfinished
      let picked = sorted.find(
        (s) => !featuredIds.has(s.id) && !progressMap[s.id]?.didFinish
      );

      if (!picked) {
        // All have been featured or finished — reset featured list
        // and find the newest unfinished speaker
        featuredIds.clear();
        picked = sorted.find((s) => !progressMap[s.id]?.didFinish);
      }

      let isListenAgain = false;

      if (!picked) {
        // All are finished — pick least-recently-finished
        const sortedByFinishTime = [...sorted].sort((a, b) => {
          const aTime = progressMap[a.id]?.updatedAt ?? "";
          const bTime = progressMap[b.id]?.updatedAt ?? "";
          return aTime.localeCompare(bTime);
        });
        picked = sortedByFinishTime[0];
        isListenAgain = true;
      }

      // Mark this speaker as featured and stamp the pick time so it stays
      // pinned for the next week.
      featuredIds.add(picked.id);
      await Promise.all([
        saveFeaturedIds(featuredIds),
        saveFeaturedPick({
          speakerId: picked.id,
          pickedAt: new Date().toISOString(),
        }),
      ]);

      const progress = progressMap[picked.id];
      const isStarted = !!(progress && progress.positionMs > 0 && !progress.didFinish);

      if (!cancelled) {
        setResult({ speaker: picked, isStarted, isListenAgain });
      }
    })();

    return () => {
      cancelled = true;
    };
  }, [speakers]);

  return result;
}
