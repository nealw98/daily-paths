import { useEffect, useRef } from "react";
import { AppState, AppStateStatus } from "react-native";
import {
  addFeatureTime,
  shouldShowRatePrompt,
  markRatePromptShown,
  requestReview,
  type FeatureTimeKey,
} from "../utils/rateShareTracking";
import { qaLog } from "../utils/qaLog";

/**
 * Tracks foreground time spent in a feature tab for rate-prompt eligibility.
 *
 * - notebook & prayer: cumulative across sessions (many short visits count)
 * - speaker: only counts continuous sessions of 10+ minutes (sampling doesn't count)
 *
 * When the threshold is reached, triggers the native review dialog.
 *
 * @param feature - which feature to track time for
 * @param active - whether tracking is currently active (e.g., tab is focused)
 */
export function useFeatureTimeTracker(
  feature: FeatureTimeKey,
  active: boolean = true
): void {
  const sessionStart = useRef<number | null>(null);
  const isContinuous = feature === "speaker";

  // For continuous mode: accumulate time within a single active period
  // (background pauses reset the continuous counter)
  const continuousElapsed = useRef(0);

  const flushTime = (elapsed: number) => {
    if (elapsed <= 1) return;

    if (isContinuous) {
      // Speaker: only record if this single continuous session was 10+ min
      continuousElapsed.current += elapsed;
      // Don't persist yet — wait for session end
    } else {
      // Notebook/prayer: accumulate all time
      addFeatureTime(feature, elapsed);
    }
  };

  const finishSession = () => {
    if (sessionStart.current !== null) {
      const elapsed = (Date.now() - sessionStart.current) / 1000;
      sessionStart.current = null;

      if (isContinuous) {
        continuousElapsed.current += Math.max(0, elapsed);
        const total = continuousElapsed.current;
        continuousElapsed.current = 0;

        // Only record if this continuous session was 10+ minutes
        if (total >= 600) {
          qaLog("rate", `Speaker continuous session: ${Math.round(total)}s — recording`);
          addFeatureTime(feature, total).then(async (crossedThreshold) => {
            if (crossedThreshold) {
              await tryRequestReview();
            }
          });
        } else {
          qaLog("rate", `Speaker session too short: ${Math.round(total)}s — skipping`);
        }
      } else if (elapsed > 1) {
        addFeatureTime(feature, elapsed).then(async (crossedThreshold) => {
          if (crossedThreshold) {
            await tryRequestReview();
          }
        });
      }
    } else if (isContinuous) {
      // Reset continuous counter even if no active session
      continuousElapsed.current = 0;
    }
  };

  useEffect(() => {
    if (!active) {
      finishSession();
      return;
    }

    // Start tracking
    sessionStart.current = Date.now();
    if (isContinuous) {
      continuousElapsed.current = 0;
    }

    // Pause on app background, resume on foreground
    const handleAppState = (state: AppStateStatus) => {
      if (state === "active") {
        sessionStart.current = Date.now();
      } else if (sessionStart.current !== null) {
        const elapsed = (Date.now() - sessionStart.current) / 1000;
        sessionStart.current = null;
        flushTime(elapsed);
      }
    };

    const subscription = AppState.addEventListener("change", handleAppState);

    // Flush time on cleanup (tab blur, unmount)
    return () => {
      subscription.remove();
      finishSession();
    };
  }, [feature, active]); // eslint-disable-line react-hooks/exhaustive-deps
}

async function tryRequestReview(): Promise<void> {
  qaLog("rate", "Feature time threshold crossed, checking review");
  const shouldShow = await shouldShowRatePrompt();
  if (shouldShow) {
    await markRatePromptShown();
    qaLog("rate", "Requesting native review after feature time threshold");
    await requestReview();
  }
}
