import { useSubscriptionContext } from "../contexts/SubscriptionContext";
import type { SubscriptionStatus } from "../lib/subscription";
import type { PurchasesPackage } from "react-native-purchases";

/**
 * Hook for managing subscription state and actions.
 * Thin wrapper over SubscriptionContext — all state is shared app-wide.
 */
export function useSubscription() {
  const ctx = useSubscriptionContext();
  return {
    status: ctx.status,
    packages: ctx.packages,
    loading: ctx.loading,
    purchasing: ctx.purchasing,
    purchase: ctx.purchase,
    restore: ctx.restore,
    refresh: ctx.refresh,
  };
}
