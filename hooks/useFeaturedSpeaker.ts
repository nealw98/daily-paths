import { useEffect, useMemo } from "react";
import AsyncStorage from "@react-native-async-storage/async-storage";
import type { Speaker } from "../types/speakers";

const DAY_MS = 24 * 60 * 60 * 1000;

// Monday 2025-01-06 00:00 UTC. The rotation index is the number of whole
// days since this anchor, so every user sees the same featured speaker on
// any given calendar day (timezone differences may shift the moment of
// transition by a few hours but not the chosen speaker within a day).
const ROTATION_EPOCH_MS = Date.UTC(2025, 0, 6);

// Storage keys from the previous per-user rotation logic. Removed once per
// app process so users upgrading from <=2.6.6 don't carry stale data.
const LEGACY_KEYS = [
  "@daily_paths_featured_speaker_ids",
  "@daily_paths_featured_pick",
];
let legacyCleanupRan = false;

function sortNewest(speakers: Speaker[]): Speaker[] {
  return [...speakers].sort((a, b) =>
    (b.date || b.created_at || "").localeCompare(a.date || a.created_at || "")
  );
}

/**
 * Pick the featured speaker for the home page.
 *
 * Deterministic, global rotation: one speaker per day, identical for every
 * user, advancing through the catalog newest-first. After the list is
 * exhausted it wraps back to the start. No per-user state — listening
 * progress and "featured before" history do not influence the pick.
 */
export function useFeaturedSpeaker(speakers: Speaker[]): Speaker | null {
  useEffect(() => {
    if (legacyCleanupRan) return;
    legacyCleanupRan = true;
    AsyncStorage.multiRemove(LEGACY_KEYS).catch(() => {});
  }, []);

  return useMemo(() => {
    if (speakers.length === 0) return null;
    const sorted = sortNewest(speakers);
    const dayIndex = Math.floor((Date.now() - ROTATION_EPOCH_MS) / DAY_MS);
    const len = sorted.length;
    const i = ((dayIndex % len) + len) % len;
    return sorted[i];
  }, [speakers]);
}
