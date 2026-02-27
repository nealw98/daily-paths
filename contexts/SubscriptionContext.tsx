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
  type SubscriptionStatus,
} from "../lib/subscription";
import {
  ensureTrialStarted,
  getTrialStatus,
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

      // Trial status (AsyncStorage — fast)
      await ensureTrialStarted();
      const trialResult = await getTrialStatus();
      if (cancelled) return;
      setTrial(trialResult);
      setTrialLoading(false);

      // Cached subscription status (AsyncStorage — fast)
      const cached = await getCachedSubscriptionStatus();
      if (cancelled) return;
      if (cached) {
        setStatus(cached);
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

      // Restore purchases — may find existing App Store subscription
      restorePurchases()
        .then(async () => {
          if (cancelled) return;
          const restored = await getSubscriptionStatus();
          if (!cancelled) setStatus(restored);
        })
        .catch(() => {});

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
