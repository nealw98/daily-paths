import { useSubscriptionContext } from "../contexts/SubscriptionContext";

/**
 * React hook wrapping the local 7-day trial timer.
 * Thin wrapper over SubscriptionContext — trial state is shared app-wide.
 */
export function useTrialStatus() {
  const ctx = useSubscriptionContext();
  return ctx.trialStatus;
}
