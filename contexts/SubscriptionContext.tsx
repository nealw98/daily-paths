import React, {
  createContext,
  useContext,
  useEffect,
  useState,
  useCallback,
  useMemo,
  useRef,
} from "react";
import { Platform } from "react-native";
import AsyncStorage from "@react-native-async-storage/async-storage";
import {
  initializeRevenueCat,
  getSubscriptionStatus,
  getOfferings,
  purchasePackage,
  restorePurchases,
  isRevenueCatInitialized,
  getCachedSubscriptionStatus,
  getRawEntitlements,
  type SubscriptionStatus,
} from "../lib/subscription";
import {
  attemptGrandfatherGrantIfEligible,
  isGrandfatherModalPending,
  clearGrandfatherModalPending,
  queueGrandfatherModalForExistingLifetime,
} from "../lib/grandfather";
import {
  attemptSubscriberLifetimeGrantIfEligible,
  getSubscriberPlanFromRaw,
} from "../lib/subscriberMigration";
import {
  ensureTrialStarted,
  getTrialStatus,
  expireTrial,
  type TrialStatus,
} from "../utils/trialTimer";
import { clearSubscriptionOverride } from "../utils/subscriptionOverride";
import { detectLifetimeAccess } from "../utils/paidAppDetector";
import { getRequiredGate, type GateType } from "../utils/accessControl";
import { qaLog } from "../utils/qaLog";
import { trackEvent } from "../utils/trackEvent";
import { ANALYTICS_EVENTS } from "../utils/analytics";
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
  /** True when both `unlimited` and `lifetime` entitlements are active —
   *  legacy subscribers whose subscription has been converted to lifetime. */
  hasSubAndLifetime: boolean;
  /** True when the active `unlimited` subscription is annual (expiry >60d
   *  out). Used to gate the gift-codes offer in Modal A — only annuals get
   *  it; the single monthly subscriber does not. */
  isAnnualSubscriber: boolean;
  /** True when a grandfather grant just succeeded and the welcome modal
   *  has not yet been shown. */
  showGrandfatherModal: boolean;
  /** RC offering packages — unused by main UI (Android uses RC Paywall UI). QA / future. */
  packages: PurchasesPackage[];
  loading: boolean;
  purchasing: boolean;
  gate: GateType;
  /** Programmatic package purchase — Android production IAP uses RC Paywall UI. */
  purchase: (pkg: PurchasesPackage) => Promise<boolean>;
  restore: () => Promise<boolean>;
  refresh: () => Promise<void>;
  refreshLifetimeAccess: () => Promise<void>;
  acknowledgeGrandfatherModal: () => Promise<void>;
}

const DEFAULT_STATUS: SubscriptionStatus = {
  isSubscribed: false,
  isTrialing: false,
  expirationDate: null,
  productIdentifier: null,
  willRenew: false,
};

const DEFAULT_TRIAL: TrialStatus = {
  isInTrial: false,
  trialExpired: false,
  neverStarted: true,
  trialStartDate: null,
  daysRemaining: 3,
};

function hasActiveRevenueCatAccess(raw: {
  hasUnlimited: boolean;
  hasLifetime: boolean;
}): boolean {
  return raw.hasUnlimited || raw.hasLifetime;
}

function summarizeTrialStatus(t: TrialStatus) {
  return {
    isInTrial: t.isInTrial,
    trialExpired: t.trialExpired,
    neverStarted: t.neverStarted,
    daysRemaining: t.daysRemaining,
    trialStartDate: t.trialStartDate,
  };
}

function summarizeSubscriptionStatus(s: SubscriptionStatus) {
  return {
    isSubscribed: s.isSubscribed,
    isTrialing: s.isTrialing,
    expirationDate: s.expirationDate,
    productIdentifier: s.productIdentifier,
    willRenew: s.willRenew,
  };
}

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
  const [hasSubAndLifetime, setHasSubAndLifetime] = useState(false);
  const [isAnnualSubscriber, setIsAnnualSubscriber] = useState(false);
  const [showGrandfatherModal, setShowGrandfatherModal] = useState(false);
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
      qaLog("access-init", "Subscription init started", {
        platform: Platform.OS,
      });
      // ── Phase 1: cached / local state (instant) ────────────────────────

      // Lifetime access detection (App Store receipt check)
      const lifetimeStatus = await detectLifetimeAccess();
      if (cancelled) return;
      setHasLifetimeAccess(lifetimeStatus.hasLifetimeAccess);
      qaLog("subscription", "Lifetime access status", lifetimeStatus);

      // Cached subscription status (AsyncStorage — fast)
      const cached = await getCachedSubscriptionStatus();
      if (cancelled) return;
      qaLog("access-init", "Cached subscription status read", {
        hasCachedStatus: !!cached,
        cached: cached ? summarizeSubscriptionStatus(cached) : null,
      });
      if (cached) {
        setStatus(cached);
      }

      // Trial status (AsyncStorage — fast)
      // Only relevant for non-lifetime users.
      if (!lifetimeStatus.hasLifetimeAccess) {
        const trialResult = await getTrialStatus();
        if (cancelled) return;
        qaLog("access-init", "Initial trial status read", summarizeTrialStatus(trialResult));
        setTrial(trialResult);
        setTrialLoading(false);

        // Do not end loading on "cached not subscribed" alone: trial may still be
        // `neverStarted` until ensureTrialStarted runs — otherwise gate can read
        // paywall briefly and auto-present the hard paywall on Android.
        if (cached?.isSubscribed || trialResult.isInTrial) {
          qaLog("access-init", "Ending initial loading from local state", {
            reason: cached?.isSubscribed ? "cached_subscribed" : "trial_active",
          });
          setLoading(false);
        } else {
          qaLog("access-init", "Keeping loading until RC/trial start resolves", {
            reason: cached ? "cached_not_subscribed_and_trial_not_active" : "no_cache_and_trial_not_active",
          });
        }
      } else {
        // Lifetime user — no trial needed, not loading
        qaLog("access-init", "Ending loading from platform lifetime access");
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

      // Android grandfather grant (no-op on iOS).
      // Must run after migration so we use the post-migration app_user_id.
      // A successful grant materializes a real `lifetime` entitlement in RC,
      // so the fresh status fetch below will pick it up automatically.
      if (isRevenueCatInitialized()) {
        try {
          const granted = await attemptGrandfatherGrantIfEligible();
          qaLog("subscription", "Grandfather grant attempt", { granted });
        } catch (err) {
          qaLog("subscription", "Grandfather grant unexpected error", { error: String(err) });
        }
      }

      // Start the trial clock only for non-lifetime users
      if (!lifetimeStatus.hasLifetimeAccess) {
        await ensureTrialStarted();
        const freshTrial = await getTrialStatus();
        qaLog("access-init", "Trial status after ensureTrialStarted", summarizeTrialStatus(freshTrial));
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
            ...summarizeSubscriptionStatus(fresh),
          });
          if (!cancelled) setStatus(fresh);

          // Android: Google Play may already have the lifetime SKU for this Google
          // account while RevenueCat's anonymous customer is empty until restore.
          // If we are not in the local trial and RC says not subscribed, sync once.
          if (
            Platform.OS === "android" &&
            !cancelled &&
            !fresh.isSubscribed
          ) {
            const postTrial = await getTrialStatus();
            qaLog("subscription", "Post-RC trial status before Android silent restore", summarizeTrialStatus(postTrial));
            if (!cancelled && !postTrial.isInTrial) {
              try {
                qaLog("subscription", "Android silent restore (no RC entitlement, trial not active)");
                await restorePurchases();
                const rawAfterRestore = await getRawEntitlements();
                if (hasActiveRevenueCatAccess(rawAfterRestore)) {
                  await clearSubscriptionOverride();
                  qaLog("subscription", "Cleared QA subscription override after Android restore");
                }
                const after = await getSubscriptionStatus();
                qaLog("subscription", "Status after Android silent restore", summarizeSubscriptionStatus(after));
                if (!cancelled) setStatus(after);
              } catch (re) {
                qaLog("subscription", "Android silent restore skipped", { error: String(re) });
              }
            }
          }
        } catch (err) {
          qaLog("subscription", "Error fetching fresh RC status", { error: String(err) });
        }

        // Detect dual entitlement (sub→lifetime conversion) for Modal A.
        try {
          let raw = await getRawEntitlements();
          if (raw.hasUnlimited && !raw.hasLifetime) {
            const migratedSubscriber =
              await attemptSubscriberLifetimeGrantIfEligible(raw);
            qaLog("subscription", "Subscriber lifetime migration attempt", {
              migratedSubscriber,
              rawBeforeMigration: raw,
            });
            if (migratedSubscriber) {
              const after = await getSubscriptionStatus();
              if (!cancelled) setStatus(after);
              raw = await getRawEntitlements();
            }
          }
          if (!cancelled) {
            setHasSubAndLifetime(raw.hasUnlimited && raw.hasLifetime);
            setIsAnnualSubscriber(raw.hasUnlimited && getSubscriberPlanFromRaw(raw) === "annual");
            const queuedExistingGrandfatherModal =
              await queueGrandfatherModalForExistingLifetime(raw.lifetimeProductIdentifier);
            qaLog("access-init", "Raw entitlements processed for modal decisions", {
              raw,
              hasSubAndLifetime: raw.hasUnlimited && raw.hasLifetime,
              subscriberPlan: getSubscriberPlanFromRaw(raw),
              isAnnualSubscriber: raw.hasUnlimited && getSubscriberPlanFromRaw(raw) === "annual",
              queuedExistingGrandfatherModal,
            });
          }
        } catch {
          // Non-critical
        }
      }

      // Modal B (grandfathered welcome) — set from local pending flag.
      try {
        const pending = await isGrandfatherModalPending();
        if (!cancelled) {
          qaLog("access-init", "Applying Modal B pending state", { pending });
          setShowGrandfatherModal(pending);
        }
      } catch {
        // Non-critical
      }

      if (!cancelled) {
        qaLog("access-init", "Subscription init completed; clearing loading");
        setLoading(false);
      }

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
    // RC not yet initialized: trust the trial; otherwise fall back to a
    // cached entitlement (handled inside getSubscriptionStatus on error).
    // Final fallback: paywall (fail-closed without cache or trial).
    if (!isRevenueCatInitialized()) {
      if (trial.isInTrial) return "none";
      if (status.isSubscribed) return "none";
      return "paywall";
    }
    return getRequiredGate(status, trial, hasLifetimeAccess);
  }, [status, trial, hasLifetimeAccess]);

  useEffect(() => {
    qaLog("access-gate", "Gate snapshot", {
      gate,
      loading,
      trialLoading,
      status: summarizeSubscriptionStatus(status),
      trial: summarizeTrialStatus(trial),
      hasLifetimeAccess,
      hasSubAndLifetime,
      isAnnualSubscriber,
      showGrandfatherModal,
      platform: Platform.OS,
    });
  }, [
    gate,
    loading,
    trialLoading,
    status,
    trial,
    hasLifetimeAccess,
    hasSubAndLifetime,
    isAnnualSubscriber,
    showGrandfatherModal,
  ]);

  // ── Actions ────────────────────────────────────────────────────────────
  const purchase = useCallback(
    async (pkg: PurchasesPackage): Promise<boolean> => {
      setPurchasing(true);
      try {
        const customerInfo = await purchasePackage(pkg);
        if (customerInfo) {
          const newStatus = await getSubscriptionStatus();
          setStatus(newStatus);

          // Expire the local trial once the user becomes entitled (sub or
          // lifetime), so the entitlement takes over immediately.
          if (newStatus.isSubscribed) {
            await expireTrial();
            const freshTrial = await getTrialStatus();
            setTrial(freshTrial);
          }

          // Refresh dual-entitlement flag — purchase may flip it.
          try {
            const raw = await getRawEntitlements();
            setHasSubAndLifetime(raw.hasUnlimited && raw.hasLifetime);
            setIsAnnualSubscriber(raw.hasUnlimited && getSubscriberPlanFromRaw(raw) === "annual");
          } catch {
            // Non-critical
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
      await trackEvent(ANALYTICS_EVENTS.RESTORE_INITIATED, {}, true);
      await restorePurchases();
      const rawAfterRestore = await getRawEntitlements();
      if (hasActiveRevenueCatAccess(rawAfterRestore)) {
        await clearSubscriptionOverride();
        qaLog("subscription", "Cleared QA subscription override after restore");
      }
      const newStatus = await getSubscriptionStatus();
      setStatus(newStatus);
      try {
        setHasSubAndLifetime(rawAfterRestore.hasUnlimited && rawAfterRestore.hasLifetime);
        setIsAnnualSubscriber(rawAfterRestore.hasUnlimited && getSubscriberPlanFromRaw(rawAfterRestore) === "annual");
      } catch {
        // Non-critical
      }
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
      try {
        let raw = await getRawEntitlements();
        if (raw.hasUnlimited && !raw.hasLifetime) {
          const migratedSubscriber =
            await attemptSubscriberLifetimeGrantIfEligible(raw);
          qaLog("subscription", "Subscriber lifetime migration attempt during refresh", {
            migratedSubscriber,
            rawBeforeMigration: raw,
          });
          if (migratedSubscriber) {
            const after = await getSubscriptionStatus();
            setStatus(after);
            raw = await getRawEntitlements();
          }
        }
        setHasSubAndLifetime(raw.hasUnlimited && raw.hasLifetime);
        setIsAnnualSubscriber(raw.hasUnlimited && getSubscriberPlanFromRaw(raw) === "annual");
      } catch {
        // Non-critical
      }
    } catch (err) {
      qaLog("subscription", "Refresh error", { error: String(err) });
    }
  }, []);

  const acknowledgeGrandfatherModal = useCallback(async () => {
    await clearGrandfatherModalPending();
    setShowGrandfatherModal(false);
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
      hasSubAndLifetime,
      isAnnualSubscriber,
      showGrandfatherModal,
      packages,
      loading,
      purchasing,
      gate,
      purchase,
      restore,
      refresh,
      refreshLifetimeAccess,
      acknowledgeGrandfatherModal,
    }),
    [
      status,
      trialStatusValue,
      hasLifetimeAccess,
      hasSubAndLifetime,
      isAnnualSubscriber,
      showGrandfatherModal,
      packages,
      loading,
      purchasing,
      gate,
      purchase,
      restore,
      refresh,
      refreshLifetimeAccess,
      acknowledgeGrandfatherModal,
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
