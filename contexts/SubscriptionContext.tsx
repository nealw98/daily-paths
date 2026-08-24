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
} from "../lib/grandfather";
import {
  attemptSubscriberLifetimeGrantIfEligible,
} from "../lib/subscriberMigration";
import {
  fetchPendingModal,
  acknowledgePendingModal,
  type PendingModal,
} from "../lib/modalDecision";
import { detectLifetimeAccess } from "../utils/paidAppDetector";
import { getRequiredGate, type GateType } from "../utils/accessControl";
import { qaLog } from "../utils/qaLog";
import { trackEvent } from "../utils/trackEvent";
import { ANALYTICS_EVENTS } from "../utils/analytics";
import Purchases, { type PurchasesPackage } from "react-native-purchases";

// ─── Types ───────────────────────────────────────────────────────────────────

interface SubscriptionContextValue {
  status: SubscriptionStatus;
  hasLifetimeAccess: boolean;
  /** Server-decided one-time modal to show, or null. The server inspects
   *  RevenueCat entitlements + grant tables and returns at most one — so
   *  Modal A and Modal B can never collide. */
  pendingModal: PendingModal | null;
  /** RC offering packages retained for QA and legacy callers. */
  packages: PurchasesPackage[];
  loading: boolean;
  purchasing: boolean;
  gate: GateType;
  /** Programmatic package purchase used by native purchase surfaces. */
  purchase: (pkg: PurchasesPackage) => Promise<boolean>;
  restore: () => Promise<boolean>;
  refresh: () => Promise<void>;
  refreshLifetimeAccess: () => Promise<void>;
  /** Refetch the server modal decision (after a QA reset, after a fresh grant). */
  refreshPendingModal: () => Promise<void>;
  /** Marks the modal acknowledged on the server and clears local state. */
  acknowledgePendingModal: () => Promise<void>;
}

const DEFAULT_STATUS: SubscriptionStatus = {
  isSubscribed: false,
  expirationDate: null,
  productIdentifier: null,
  willRenew: false,
};

function summarizeSubscriptionStatus(s: SubscriptionStatus) {
  return {
    isSubscribed: s.isSubscribed,
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
  const [hasLifetimeAccess, setHasLifetimeAccess] = useState(false);
  const [pendingModal, setPendingModal] = useState<PendingModal | null>(null);
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
      // Retire old QA access overrides. Store receipts and RevenueCat are
      // authoritative; a local developer setting must never suppress them.
      await AsyncStorage.multiRemove([
        "@daily_paths_subscription_override",
        "@daily_paths_ignore_grandfather_for_testing",
      ]);

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

      if (!lifetimeStatus.hasLifetimeAccess) {
        // Only a cached entitlement can resolve access before RevenueCat has
        // refreshed.
        if (cached?.isSubscribed) {
          qaLog("access-init", "Ending initial loading from local state", {
            reason: "cached_subscribed",
          });
          setLoading(false);
        } else {
          qaLog("access-init", "Keeping loading until RevenueCat resolves", {
            reason: cached ? "cached_not_subscribed" : "no_cache",
          });
        }
      } else {
        // Lifetime user — local access is already resolved.
        qaLog("access-init", "Ending loading from platform lifetime access");
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
      //
      // TODO(2027-Q1): Remove this block once 2.7 has rolled out widely. It is
      // needed only for in-place upgraders from 2.6.x → 2.7; new installs and
      // already-migrated users skip it via the MIGRATION_KEY guard.
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

            let migrationPath: "logIn_with_supabase_session" | "restore_no_session";
            if (oldUserId) {
              qaLog("subscription", "Re-linking RevenueCat with old user ID", { oldUserId });
              const { customerInfo } = await Purchases.logIn(oldUserId);
              qaLog("subscription", "RevenueCat logIn complete", {
                appUserId: oldUserId,
                activeEntitlements: Object.keys(customerInfo.entitlements.active),
              });
              migrationPath = "logIn_with_supabase_session";
            } else {
              qaLog("subscription", "No old Supabase session found, trying restorePurchases");
              const customerInfo = await restorePurchases();
              qaLog("subscription", "restorePurchases complete", {
                activeEntitlements: Object.keys(customerInfo.entitlements.active),
              });
              migrationPath = "restore_no_session";
            }

            await AsyncStorage.setItem(MIGRATION_KEY, "done");
            qaLog("subscription", "Migration key saved");

            // One-time analytics event per device. Counts taper as 2.6.x →
            // 2.7 in-place upgrades complete; near-zero after ~30 days is
            // the signal that the migration code can be safely removed.
            trackEvent(ANALYTICS_EVENTS.RC_IDENTITY_MIGRATION_RAN, {
              path: migrationPath,
            }, true);
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

      // Fetch fresh status from RC — RevenueCat is the sole source of
      // truth for all entitlements including legacy grants.
      if (isRevenueCatInitialized()) {
        try {
          const fresh = await getSubscriptionStatus();
          qaLog("subscription", "Fresh RC status", {
            ...summarizeSubscriptionStatus(fresh),
          });
          if (!cancelled) setStatus(fresh);

          // Android: always run restorePurchases() on cold launch so a user
          // who has previously purchased on this Google account never sees
          // the paywall by accident. The previous gated condition missed
          // reinstalls and device changes.
          if (Platform.OS === "android" && !cancelled) {
            try {
              qaLog("subscription", "Android cold-launch always-restore");
              await restorePurchases();
              const after = await getSubscriptionStatus();
              qaLog("subscription", "Status after Android cold-launch restore", summarizeSubscriptionStatus(after));
              if (!cancelled) setStatus(after);
            } catch (re) {
              qaLog("subscription", "Android cold-launch restore failed", { error: String(re) });
            }
          }
        } catch (err) {
          qaLog("subscription", "Error fetching fresh RC status", { error: String(err) });
        }

        // Subscriber-to-lifetime migration attempt (only fires for active
        // legacy subscribers without lifetime). Modal decision happens via
        // the server below — no local flag plumbing.
        try {
          const raw = await getRawEntitlements();
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
            }
          }
        } catch {
          // Non-critical
        }
      }

      // Server-decided pending modal (Modal A or Modal B — exactly one or
      // none). The server checks RC entitlements + grant tables and returns
      // at most one modal, so collisions are structurally impossible.
      //
      // Skip the call when the user has no lifetime entitlement. The server
      // would return `no_lifetime` anyway, and we can save ~300ms of
      // first-install splash time for users who can't possibly have a
      // congratulatory modal pending.
      try {
        const rawForModalDecision = await getRawEntitlements();
        if (rawForModalDecision.hasLifetime) {
          const decision = await fetchPendingModal();
          if (!cancelled) {
            qaLog("access-init", "Applying server modal decision", { decision });
            setPendingModal(decision);
          }
        } else {
          qaLog("access-init", "Skipping modal decision: no lifetime entitlement");
        }
      } catch (err) {
        qaLog("access-init", "Pending modal fetch failed", { error: String(err) });
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

    // RevenueCat pushes a CustomerInfo update whenever entitlements change
    // (purchase completes, restore lands, promotional grant). Re-read the
    // collapsed status + raw entitlements + pending modal so the gate and
    // modal state stay current without manual post-purchase polling.
    const onCustomerInfoUpdate = async () => {
      qaLog("subscription", "RC customerInfo update event received");
      try {
        const fresh = await getSubscriptionStatus();
        if (!cancelled) setStatus(fresh);

        // Server may have a new pending modal (e.g. user just bought lifetime
        // and now has both unlimited + lifetime).
        try {
          const decision = await fetchPendingModal();
          if (!cancelled) setPendingModal(decision);
        } catch {
          // Non-critical
        }
      } catch (err) {
        qaLog("subscription", "RC update handler error", { error: String(err) });
      }
    };
    Purchases.addCustomerInfoUpdateListener(onCustomerInfoUpdate);

    return () => {
      cancelled = true;
      mounted.current = false;
      Purchases.removeCustomerInfoUpdateListener(onCustomerInfoUpdate);
    };
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
    // RC not yet initialized: trust only a cached entitlement. Final fallback
    // is onboarding/checkout (fail-closed without an entitlement).
    if (!isRevenueCatInitialized()) {
      if (status.isSubscribed) return "none";
      return "paywall";
    }
    return getRequiredGate(status, hasLifetimeAccess);
  }, [status, hasLifetimeAccess]);

  useEffect(() => {
    qaLog("access-gate", "Gate snapshot", {
      gate,
      loading,
      status: summarizeSubscriptionStatus(status),
      hasLifetimeAccess,
      pendingModal,
      platform: Platform.OS,
    });
  }, [
    gate,
    loading,
    status,
    hasLifetimeAccess,
    pendingModal,
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
      try {
        const raw = await getRawEntitlements();
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
          }
        }
      } catch {
        // Non-critical
      }
    } catch (err) {
      qaLog("subscription", "Refresh error", { error: String(err) });
    }
  }, []);

  const refreshPendingModal = useCallback(async () => {
    try {
      const decision = await fetchPendingModal();
      setPendingModal(decision);
      qaLog("modal-decision", "refreshPendingModal", { decision });
    } catch (err) {
      qaLog("modal-decision", "refreshPendingModal error", { error: String(err) });
    }
  }, []);

  const acknowledgePendingModalAction = useCallback(async () => {
    const current = pendingModal;
    if (!current) return;
    setPendingModal(null);
    await acknowledgePendingModal(current.modal);
  }, [pendingModal]);

  // ── Context value ──────────────────────────────────────────────────────
  const value = useMemo<SubscriptionContextValue>(
    () => ({
      status,
      hasLifetimeAccess,
      pendingModal,
      packages,
      loading,
      purchasing,
      gate,
      purchase,
      restore,
      refresh,
      refreshLifetimeAccess,
      refreshPendingModal,
      acknowledgePendingModal: acknowledgePendingModalAction,
    }),
    [
      status,
      hasLifetimeAccess,
      pendingModal,
      packages,
      loading,
      purchasing,
      gate,
      purchase,
      restore,
      refresh,
      refreshLifetimeAccess,
      refreshPendingModal,
      acknowledgePendingModalAction,
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
