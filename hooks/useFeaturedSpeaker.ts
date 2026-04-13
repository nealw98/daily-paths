import { useState, useEffect } from "react";
import { getAllSpeakerProgress, type SpeakerProgress } from "../utils/speakerProgress";
import type { Speaker } from "../types/speakers";

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

/**
 * Determine which "week index" we're in since epoch, rolling every 7 days.
 * Uses a fixed epoch so the rotation is consistent for all users.
 */
function getWeekIndex(): number {
  const MS_PER_WEEK = 7 * 24 * 60 * 60 * 1000;
  // Epoch: Jan 1, 2024 — arbitrary fixed start
  const epoch = new Date("2024-01-01T00:00:00Z").getTime();
  return Math.floor((Date.now() - epoch) / MS_PER_WEEK);
}

/**
 * Pick the featured speaker for the home page.
 *
 * Logic:
 * 1. Sort speakers newest-first by date (null date falls back to created_at).
 * 2. Filter out any speakers the user has finished.
 * 3. Rotate through the remaining unfinished speakers weekly (rolling 7 days).
 * 4. If all are finished, cycle through finished speakers starting from the
 *    one finished least recently (earliest updatedAt), using the same weekly rotation.
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
      const progressMap = await getAllSpeakerProgress();
      if (cancelled) return;

      const sorted = sortNewest(speakers);
      const weekIndex = getWeekIndex();

      // Separate finished vs unfinished
      const unfinished = sorted.filter((s) => !progressMap[s.id]?.didFinish);
      const finished = sorted.filter((s) => progressMap[s.id]?.didFinish);

      let picked: Speaker;
      let isListenAgain = false;

      if (unfinished.length > 0) {
        // Rotate through unfinished speakers weekly
        const idx = weekIndex % unfinished.length;
        picked = unfinished[idx];
      } else {
        // All finished — cycle through by least-recently-finished first
        const sortedByFinishTime = [...finished].sort((a, b) => {
          const aTime = progressMap[a.id]?.updatedAt ?? "";
          const bTime = progressMap[b.id]?.updatedAt ?? "";
          return aTime.localeCompare(bTime); // oldest finish first
        });
        const idx = weekIndex % sortedByFinishTime.length;
        picked = sortedByFinishTime[idx];
        isListenAgain = true;
      }

      // Check if the picked speaker has been started (has position > 0 but not finished)
      const progress = progressMap[picked.id];
      const isStarted = !!(progress && progress.positionMs > 0 && !progress.didFinish);

      setResult({ speaker: picked, isStarted, isListenAgain });
    })();

    return () => {
      cancelled = true;
    };
  }, [speakers]);

  return result;
}
