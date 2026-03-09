import { useSubscriptionContext } from "../contexts/SubscriptionContext";
import type { SubscriptionStatus } from "../lib/subscription";
import type { PurchasesPackage } from "react-native-purchases";

/**
 * Hook for managing subscription state and actions.
 * Thin wrapper over SubscriptionContext — all state is shared app-wide.
 *
 * @param _userId - Ignored. Kept for backward compatibility during migration.
 */
export function useSubscription(_userId?: string | null) {
  const ctx = useSubscriptionContext();
  return {
    status: ctx.status,
    packages: ctx.packages,
    loading: ctx.loading,
    purchasing: ctx.purchasing,
    purchase: ctx.purchase,
    restore: ctx.restore,
    refresh: ctx.refresh,
    logout: ctx.logout,
    cleanupAfterDeletion: ctx.cleanupAfterDeletion,
  };
}
