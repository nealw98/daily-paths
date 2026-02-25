import { useState, useEffect, useCallback } from "react";
import {
  ensureTrialStarted,
  getTrialStatus,
  type TrialStatus,
} from "../utils/trialTimer";

/**
 * React hook wrapping the local 7-day trial timer.
 *
 * Initialises the trial on first mount (safe to call repeatedly) and
 * exposes the current status plus a manual `refresh` function.
 */
export function useTrialStatus() {
  const [status, setStatus] = useState<TrialStatus>({
    isInTrial: false,
    trialExpired: false,
    neverStarted: true,
    trialStartDate: null,
    daysRemaining: 7,
  });
  const [loading, setLoading] = useState(true);

  const refresh = useCallback(async () => {
    const s = await getTrialStatus();
    setStatus(s);
  }, []);

  useEffect(() => {
    let mounted = true;
    (async () => {
      await ensureTrialStarted();
      const s = await getTrialStatus();
      if (mounted) {
        setStatus(s);
        setLoading(false);
      }
    })();
    return () => {
      mounted = false;
    };
  }, []);

  return { ...status, loading, refresh };
}
