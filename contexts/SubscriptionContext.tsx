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
  getSubscriptionStatus,
  getOfferings,
  purchasePackage,
  restorePurchases,
  isRevenueCatInitialized,
  getCachedSubscriptionStatus,
  type SubscriptionStatus,
} from "../lib/subscription";
import {
  ensureTrialStarted,
  getTrialStatus,
  expireTrial,
  type TrialStatus,
} from "../utils/trialTimer";
import { getRequiredGate, type GateType } from "../utils/accessControl";
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
  const [status, setStatus] = useState<SubscriptionStatus>(DEFAULT_STATUS);
  const [trial, setTrial] = useState<TrialStatus>(DEFAULT_TRIAL);
  const [trialLoading, setTrialLoading] = useState(true);
  const [packages, setPackages] = useState<PurchasesPackage[]>([]);
  const [loading, setLoading] = useState(true);
  const [purchasing, setPurchasing] = useState(false);

  const mounted = useRef(true);
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

      // Initialize RC (module-level guard prevents double-init)
      if (!rcInitialized.current) {
        await initializeRevenueCat();
        rcInitialized.current = true;
      }

      // Ensure the trial clock is running
      await ensureTrialStarted();
      const freshTrial = await getTrialStatus();
      if (!cancelled) {
        setTrial(freshTrial);
        setTrialLoading(false);
      }

      // Fetch fresh status from RC — RevenueCat is the sole source of
      // truth for all entitlements including lifetime.
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
  }, []);

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
    return getRequiredGate(status, trial);
  }, [status, trial]);

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
