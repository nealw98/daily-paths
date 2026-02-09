import { useState, useEffect, useCallback, useRef } from "react";
import {
  initializeRevenueCat,
  loginRevenueCat,
  logoutRevenueCat,
  getSubscriptionStatus,
  getOfferings,
  purchasePackage,
  restorePurchases,
  isRevenueCatInitialized,
  type SubscriptionStatus,
} from "../lib/subscription";
import type { PurchasesPackage } from "react-native-purchases";
import { qaLog } from "../utils/qaLog";

/**
 * Hook for managing subscription state and actions.
 * Wraps RevenueCat with React state management.
 */
export function useSubscription(userId?: string | null) {
  const [status, setStatus] = useState<SubscriptionStatus>({
    isSubscribed: false,
    isTrialing: false,
    isLegacy: false,
    expirationDate: null,
    productIdentifier: null,
    willRenew: false,
  });
  const [packages, setPackages] = useState<PurchasesPackage[]>([]);
  const [loading, setLoading] = useState(true);
  const [purchasing, setPurchasing] = useState(false);
  const initialized = useRef(false);
  const prevUserId = useRef<string | null | undefined>(userId);

  // Initialize RevenueCat and fetch status when user changes
  useEffect(() => {
    let cancelled = false;

    const init = async () => {
      try {
        // If userId went from a value to null/undefined (sign-out),
        // DON'T logout from RevenueCat — entitlements are device-level.
        // Just re-fetch status so the device's entitlement is still recognized.
        if (prevUserId.current && !userId && isRevenueCatInitialized()) {
          prevUserId.current = userId;
          const currentStatus = await getSubscriptionStatus();
          if (!cancelled) {
            setStatus(currentStatus);
            setLoading(false);
          }
          return;
        }
        prevUserId.current = userId;

        if (!initialized.current) {
          await initializeRevenueCat(userId || undefined);
          initialized.current = true;

          // On first init (fresh install), restore purchases so RevenueCat
          // picks up existing subscriptions tied to the App Store / Play Store
          // account before we decide whether to show the paywall.
          if (isRevenueCatInitialized()) {
            try {
              await restorePurchases();
            } catch {
              // Restore can fail silently — we'll still check status below
            }
          }
        }

        if (userId && isRevenueCatInitialized()) {
          await loginRevenueCat(userId);
        }

        // Fetch current status
        const currentStatus = await getSubscriptionStatus();
        if (!cancelled) setStatus(currentStatus);

        // Fetch available packages
        const availablePackages = await getOfferings();
        if (!cancelled) setPackages(availablePackages);
      } catch (err) {
        qaLog("subscription", "Hook init error", { error: String(err) });
      } finally {
        if (!cancelled) setLoading(false);
      }
    };

    init();

    return () => {
      cancelled = true;
    };
  }, [userId]);

  const purchase = useCallback(
    async (pkg: PurchasesPackage): Promise<boolean> => {
      setPurchasing(true);
      try {
        const customerInfo = await purchasePackage(pkg);
        if (customerInfo) {
          // Refresh status after purchase
          const newStatus = await getSubscriptionStatus();
          setStatus(newStatus);
          return newStatus.isSubscribed;
        }
        return false;
      } catch (err) {
        qaLog("subscription", "Purchase hook error", { error: String(err) });
        throw err;
      } finally {
        setPurchasing(false);
      }
    },
    []
  );

  const restore = useCallback(async (): Promise<boolean> => {
    setLoading(true);
    try {
      await restorePurchases();
      const newStatus = await getSubscriptionStatus();
      setStatus(newStatus);
      return newStatus.isSubscribed;
    } catch (err) {
      qaLog("subscription", "Restore hook error", { error: String(err) });
      throw err;
    } finally {
      setLoading(false);
    }
  }, []);

  const refresh = useCallback(async () => {
    try {
      const newStatus = await getSubscriptionStatus();
      setStatus(newStatus);
    } catch (err) {
      qaLog("subscription", "Refresh status error", { error: String(err) });
    }
  }, []);

  const logout = useCallback(async () => {
    await logoutRevenueCat();
    setStatus({
      isSubscribed: false,
      isTrialing: false,
      isLegacy: false,
      expirationDate: null,
      productIdentifier: null,
      willRenew: false,
    });
  }, []);

  return {
    status,
    packages,
    loading,
    purchasing,
    purchase,
    restore,
    refresh,
    logout,
  };
}
