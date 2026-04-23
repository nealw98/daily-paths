import React, {
  createContext,
  useContext,
  useEffect,
  useState,
  useCallback,
  useMemo,
  useRef,
} from "react";
import AsyncStorage from "@react-native-async-storage/async-storage";
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
import { detectLifetimeAccess } from "../utils/paidAppDetector";
import { getRequiredGate, type GateType } from "../utils/accessControl";
import { qaLog } from "../utils/qaLog";
import Purchases, { type PurchasesPackage } from "react-native-purchases";

// ─── Types ───────────────────────────────────────────────────────────────────

interface TrialStatusWithMeta extends TrialStatus {
  loading: boolean;
  refresh: () => Promise<void>;
}

interface SubscriptionContextValue {
  status: SubscriptionStatus;
  trialStatus: TrialStatusWithMeta;
  hasLifetimeAccess: boolean;
  packages: PurchasesPackage[];
  loading: boolean;
  purchasing: boolean;
  gate: GateType;
  purchase: (pkg: PurchasesPackage) => Promise<boolean>;
  restore: () => Promise<boolean>;
  refresh: () => Promise<void>;
  refreshLifetimeAccess: () => Promise<void>;
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
  const [hasLifetimeAccess, setHasLifetimeAccess] = useState(false);
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

      // Lifetime access detection (App Store receipt check)
      const lifetimeStatus = await detectLifetimeAccess();
      if (cancelled) return;
      setHasLifetimeAccess(lifetimeStatus.hasLifetimeAccess);
      qaLog("subscription", "Lifetime access status", lifetimeStatus);

      // Cached subscription status (AsyncStorage — fast)
      const cached = await getCachedSubscriptionStatus();
      if (cancelled) return;
      if (cached) {
        setStatus(cached);
      }

      // Trial status (AsyncStorage — fast)
      // Only relevant for non-lifetime users.
      if (!lifetimeStatus.hasLifetimeAccess) {
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
      } else {
        // Lifetime user — no trial needed, not loading
        setTrialLoading(false);
        setLoading(false);
      }

      // ── Phase 2: RevenueCat (background) ───────────────────────────────

      // Initialize RC (module-level guard prevents double-init)
      if (!rcInitialized.current) {
        qaLog("subscription", "Initializing RevenueCat...");
        await initializeRevenueCat();
        rcInitialized.current = true;
      }

      qaLog("subscription", "RC initialized check", {
        isInitialized: isRevenueCatInitialized(),
      });

      // ── One-time migration: re-link RevenueCat identity after auth removal ─
      // Previously the app called Purchases.logIn(supabaseUserId), so all
      // entitlements (subscriptions, lifetime) are attached to that user ID in
      // RevenueCat. After auth removal the SDK creates a new anonymous user
      // with zero entitlements. We read the old Supabase session (still in
      // AsyncStorage), extract the user ID, and call Purchases.logIn() to
      // re-identify this device with its original RevenueCat user.
      // If no Supabase session exists (new user), we fall back to
      // restorePurchases() to pick up any App Store receipts.
      if (isRevenueCatInitialized()) {
        const MIGRATION_KEY = "@daily_paths_rc_identity_migration_v1";
        try {
          const migrated = await AsyncStorage.getItem(MIGRATION_KEY);
          qaLog("subscription", "Migration status", { alreadyMigrated: !!migrated });

          if (!migrated) {
            qaLog("subscription", "Running one-time RevenueCat identity migration");

            // Try to read the old Supabase session for the user ID
            let oldUserId: string | null = null;
            try {
              const sbSession = await AsyncStorage.getItem(
                "sb-ofmqgqaoubsiwujgvcil-auth-token",
              );
              qaLog("subscription", "Supabase session lookup", {
                found: !!sbSession,
                keyLength: sbSession?.length ?? 0,
              });
              if (sbSession) {
                const parsed = JSON.parse(sbSession);
                oldUserId = parsed?.user?.id || parsed?.currentSession?.user?.id || null;
                qaLog("subscription", "Parsed Supabase session", { oldUserId });
              }
            } catch (parseErr) {
              qaLog("subscription", "Supabase session parse error", { error: String(parseErr) });
            }

            if (oldUserId) {
              qaLog("subscription", "Re-linking RevenueCat with old user ID", { oldUserId });
              const { customerInfo } = await Purchases.logIn(oldUserId);
              qaLog("subscription", "RevenueCat logIn complete", {
                appUserId: oldUserId,
                activeEntitlements: Object.keys(customerInfo.entitlements.active),
              });
            } else {
              qaLog("subscription", "No old Supabase session found, trying restorePurchases");
              const customerInfo = await restorePurchases();
              qaLog("subscription", "restorePurchases complete", {
                activeEntitlements: Object.keys(customerInfo.entitlements.active),
              });
            }

            await AsyncStorage.setItem(MIGRATION_KEY, "done");
            qaLog("subscription", "Migration key saved");
          }
        } catch (err) {
          qaLog("subscription", "RevenueCat identity migration failed", { error: String(err) });
          // Non-fatal — user can still tap Restore Purchases manually
        }
      } else {
        qaLog("subscription", "RevenueCat NOT initialized — skipping migration");
      }

      // Start the trial clock only for non-lifetime users
      if (!lifetimeStatus.hasLifetimeAccess) {
        await ensureTrialStarted();
        const freshTrial = await getTrialStatus();
        if (!cancelled) {
          setTrial(freshTrial);
          setTrialLoading(false);
        }
      }

      // Fetch fresh status from RC — RevenueCat is the sole source of
      // truth for all entitlements including legacy grants.
      if (isRevenueCatInitialized()) {
        try {
          const fresh = await getSubscriptionStatus();
          qaLog("subscription", "Fresh RC status", {
            isSubscribed: fresh.isSubscribed,
            isLegacy: fresh.isLegacy,
            isTrialing: fresh.isTrialing,
            productIdentifier: fresh.productIdentifier,
          });
          if (!cancelled) setStatus(fresh);
        } catch (err) {
          qaLog("subscription", "Error fetching fresh RC status", { error: String(err) });
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

  // ── Lifetime access refresh (for QA override toggle) ──────────────────
  const refreshLifetimeAccess = useCallback(async () => {
    const result = await detectLifetimeAccess();
    setHasLifetimeAccess(result.hasLifetimeAccess);
    qaLog("subscription", "Lifetime access refreshed", result);
  }, []);

  // ── Gate computation ───────────────────────────────────────────────────
  const gate = useMemo<GateType>(() => {
    if (hasLifetimeAccess) return "none";
    if (!isRevenueCatInitialized()) {
      return trial.isInTrial ? "none" : "paywall";
    }
    return getRequiredGate(status, trial, hasLifetimeAccess);
  }, [status, trial, hasLifetimeAccess]);

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
      hasLifetimeAccess,
      packages,
      loading,
      purchasing,
      gate,
      purchase,
      restore,
      refresh,
      refreshLifetimeAccess,
    }),
    [
      status,
      trialStatusValue,
      hasLifetimeAccess,
      packages,
      loading,
      purchasing,
      gate,
      purchase,
      restore,
      refresh,
      refreshLifetimeAccess,
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
