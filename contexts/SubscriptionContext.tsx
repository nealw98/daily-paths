import React, {
  createContext,
  useContext,
  useEffect,
  useState,
  useCallback,
  useMemo,
  useRef,
} from "react";
import {
  initializeRevenueCat,
  loginRevenueCat,
  logoutRevenueCat,
  getSubscriptionStatus,
  getOfferings,
  purchasePackage,
  restorePurchases,
  isRevenueCatInitialized,
  getCachedSubscriptionStatus,
  cacheSubscriptionStatus,
  clearSubscriptionCache,
  checkReceiptForLegacyStatus,
  markLifetimeRevoked,
  type SubscriptionStatus,
} from "../lib/subscription";
import {
  ensureTrialStarted,
  getTrialStatus,
  expireTrial,
  type TrialStatus,
} from "../utils/trialTimer";
import { getRequiredGate, type GateType } from "../utils/accessControl";
import { useAuth } from "./AuthContext";
import { qaLog } from "../utils/qaLog";
import type { PurchasesPackage } from "react-native-purchases";

// ─── Types ───────────────────────────────────────────────────────────────────

interface TrialStatusWithMeta extends TrialStatus {
  loading: boolean;
  refresh: () => Promise<void>;
}

interface SubscriptionContextValue {
  status: SubscriptionStatus;
  trialStatus: TrialStatusWithMeta;
  packages: PurchasesPackage[];
  loading: boolean;
  purchasing: boolean;
  gate: GateType;
  purchase: (pkg: PurchasesPackage) => Promise<boolean>;
  restore: () => Promise<boolean>;
  refresh: () => Promise<void>;
  logout: () => Promise<void>;
  cleanupAfterDeletion: () => Promise<void>;
}

const DEFAULT_STATUS: SubscriptionStatus = {
  isSubscribed: false,
  isTrialing: false,
  isLegacy: false,
  expirationDate: null,
  productIdentifier: null,
  willRenew: false,
};

const DEFAULT_TRIAL: TrialStatus = {
  isInTrial: false,
  trialExpired: false,
  neverStarted: true,
  trialStartDate: null,
  daysRemaining: 7,
};

// ─── Context ─────────────────────────────────────────────────────────────────

const SubscriptionContext = createContext<SubscriptionContextValue | undefined>(
  undefined,
);

// ─── Provider ────────────────────────────────────────────────────────────────

export const SubscriptionProvider: React.FC<{ children: React.ReactNode }> = ({
  children,
}) => {
  const { user, isAuthenticated } = useAuth();
  const userId = user?.id ?? null;

  const [status, setStatus] = useState<SubscriptionStatus>(DEFAULT_STATUS);
  const [trial, setTrial] = useState<TrialStatus>(DEFAULT_TRIAL);
  const [trialLoading, setTrialLoading] = useState(true);
  const [packages, setPackages] = useState<PurchasesPackage[]>([]);
  const [loading, setLoading] = useState(true);
  const [purchasing, setPurchasing] = useState(false);

  const mounted = useRef(true);
  const prevUserId = useRef<string | null>(userId);
  const rcInitialized = useRef(false);

  // ── Main init effect ─────────────────────────────────────────────────────
  useEffect(() => {
    mounted.current = true;
    let cancelled = false;

    const init = async () => {
      // ── Phase 1: cached / local state (instant) ────────────────────────

      // Cached subscription status (AsyncStorage — fast)
      const cached = await getCachedSubscriptionStatus();
      if (cancelled) return;
      if (cached) {
        setStatus(cached);
      }

      // Trial status (AsyncStorage — fast)
      // Don't start the trial yet — wait for receipt check in Phase 2.
      const trialResult = await getTrialStatus();
      if (cancelled) return;
      setTrial(trialResult);
      setTrialLoading(false);

      if (cached) {
        setLoading(false);
      } else if (trialResult.isInTrial) {
        // No cache, but trial is active → gate = "none" from trial alone
        setLoading(false);
      }

      // ── Phase 2: RevenueCat (background) ───────────────────────────────

      // If userId went from a value to null (sign-out), preserve device
      // entitlements — don't call logoutRevenueCat.
      if (prevUserId.current && !userId && isRevenueCatInitialized()) {
        prevUserId.current = userId;
        try {
          const fresh = await getSubscriptionStatus();
          if (!cancelled) setStatus(fresh);
        } catch {
          // cached status already set above
        }
        if (!cancelled) setLoading(false);
        return;
      }
      prevUserId.current = userId;

      // Initialize RC (module-level guard prevents double-init)
      if (!rcInitialized.current) {
        await initializeRevenueCat(userId || undefined);
        rcInitialized.current = true;
      }

      // Login RC if user is authenticated
      if (userId && isRevenueCatInitialized()) {
        await loginRevenueCat(userId);
      }

      // ── Receipt-based legacy check (before starting trial) ─────────────
      // On iOS, check the App Store receipt for users who purchased the
      // original paid app. If detected, skip the trial entirely — they
      // have lifetime access. This runs before ensureTrialStarted() so
      // legacy users never see the trial countdown.
      if (isRevenueCatInitialized()) {
        try {
          const isLegacyReceipt = await checkReceiptForLegacyStatus();
          if (!cancelled && isLegacyReceipt) {
            qaLog("SubscriptionContext", "Legacy user detected via receipt — skipping trial");
            let fresh = await getSubscriptionStatus();

            // On an anonymous RC user the lifetime entitlement (which is
            // tied to the authenticated user ID) won't appear in
            // getSubscriptionStatus().  Override with a synthetic legacy
            // status so the UI shows "Lifetime Access" immediately.  The
            // next effect run (after auth loads) will replace this with
            // the canonical status from RevenueCat.
            if (!fresh.isLegacy) {
              fresh = {
                ...fresh,
                isSubscribed: true,
                isLegacy: true,
              };
              // Cache the synthetic override so Phase 1 picks it up
              // on subsequent effect runs (e.g. when auth resolves and
              // userId changes, triggering a re-run).
              await cacheSubscriptionStatus(fresh);
            }

            if (!cancelled) {
              setStatus(fresh);
              setLoading(false);

              // Pre-fetch packages in background, then done — no trial needed
              getOfferings()
                .then((pkgs) => { if (!cancelled) setPackages(pkgs); })
                .catch(() => {});
              return;
            }
          }
        } catch {
          // Receipt check failed — fall through to normal flow
        }
      }

      // No legacy receipt found — ensure the trial clock is running
      await ensureTrialStarted();
      const freshTrial = await getTrialStatus();
      if (!cancelled) {
        setTrial(freshTrial);
        setTrialLoading(false);
      }

      // Fetch fresh status from RC
      if (isRevenueCatInitialized()) {
        try {
          const fresh = await getSubscriptionStatus();
          if (!cancelled) setStatus(fresh);
        } catch {
          // cached status already set above
        }
      }

      if (!cancelled) setLoading(false);

      // ── Background tasks (don't block gate/content) ────────────────────
      if (!isRevenueCatInitialized()) return;

      // Pre-fetch packages for the paywall
      getOfferings()
        .then((pkgs) => {
          if (!cancelled) setPackages(pkgs);
        })
        .catch(() => {});
    };

    init();

    return () => {
      cancelled = true;
      mounted.current = false;
    };
  }, [userId]);

  // ── Trial refresh ──────────────────────────────────────────────────────
  const refreshTrial = useCallback(async () => {
    const s = await getTrialStatus();
    setTrial(s);
  }, []);

  // ── Gate computation ───────────────────────────────────────────────────
  const gate = useMemo<GateType>(() => {
    if (!isRevenueCatInitialized()) {
      return trial.isInTrial ? "none" : "paywall";
    }
    return getRequiredGate(status, trial, isAuthenticated);
  }, [status, trial, isAuthenticated]);

  // ── Actions ────────────────────────────────────────────────────────────
  const purchase = useCallback(
    async (pkg: PurchasesPackage): Promise<boolean> => {
      setPurchasing(true);
      try {
        const customerInfo = await purchasePackage(pkg);
        if (customerInfo) {
          const newStatus = await getSubscriptionStatus();
          setStatus(newStatus);

          // Expire the local trial once the user subscribes so the
          // subscription entitlement takes over immediately. This matters
          // because subscribers get features (e.g. speaker downloads)
          // that trial users don't.
          if (newStatus.isSubscribed) {
            await expireTrial();
            const freshTrial = await getTrialStatus();
            setTrial(freshTrial);
          }

          return newStatus.isSubscribed;
        }
        return false;
      } catch (err) {
        qaLog("subscription", "Purchase error", { error: String(err) });
        throw err;
      } finally {
        setPurchasing(false);
      }
    },
    [],
  );

  const restore = useCallback(async (): Promise<boolean> => {
    setLoading(true);
    try {
      await restorePurchases();
      const newStatus = await getSubscriptionStatus();
      setStatus(newStatus);
      return newStatus.isSubscribed;
    } catch (err) {
      qaLog("subscription", "Restore error", { error: String(err) });
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
      qaLog("subscription", "Refresh error", { error: String(err) });
    }
  }, []);

  const logout = useCallback(async () => {
    await logoutRevenueCat();
    setStatus(DEFAULT_STATUS);
  }, []);

  /**
   * Full cleanup after account deletion. Unlike `logout` (which is for
   * sign-out and preserves trial state), this:
   *  1. Logs out RevenueCat and resets subscription status
   *  2. Expires the local trial so `getRequiredGate` shows the paywall
   *  3. Marks lifetime as revoked so the permanent Apple receipt doesn't
   *     re-detect the user as legacy on the next launch
   *  4. Clears the subscription cache to prevent stale state
   */
  const cleanupAfterDeletion = useCallback(async () => {
    await logoutRevenueCat();
    setStatus(DEFAULT_STATUS);

    // Expire the local trial so the paywall appears immediately
    await expireTrial();
    const freshTrial = await getTrialStatus();
    setTrial(freshTrial);

    // Prevent the permanent Apple receipt from re-granting lifetime access
    await markLifetimeRevoked();

    // Clear cached subscription status
    await clearSubscriptionCache();

    qaLog("subscription", "Account deletion cleanup complete");
  }, []);

  // ── Context value ──────────────────────────────────────────────────────
  const trialStatusValue = useMemo<TrialStatusWithMeta>(
    () => ({ ...trial, loading: trialLoading, refresh: refreshTrial }),
    [trial, trialLoading, refreshTrial],
  );

  const value = useMemo<SubscriptionContextValue>(
    () => ({
      status,
      trialStatus: trialStatusValue,
      packages,
      loading,
      purchasing,
      gate,
      purchase,
      restore,
      refresh,
      logout,
      cleanupAfterDeletion,
    }),
    [
      status,
      trialStatusValue,
      packages,
      loading,
      purchasing,
      gate,
      purchase,
      restore,
      refresh,
      logout,
      cleanupAfterDeletion,
    ],
  );

  return React.createElement(SubscriptionContext.Provider, { value }, children);
};

// ─── Hook ────────────────────────────────────────────────────────────────────

export function useSubscriptionContext(): SubscriptionContextValue {
  const ctx = useContext(SubscriptionContext);
  if (!ctx) {
    throw new Error(
      "useSubscriptionContext must be used within a SubscriptionProvider",
    );
  }
  return ctx;
}
