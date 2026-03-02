import { useEffect, useRef } from "react";
import { useAuth } from "../contexts/AuthContext";
import { useSubscriptionContext } from "../contexts/SubscriptionContext";
import { migrateTrialDataToSupabase } from "../utils/dataMigration";
import {
  performLegacyMigration,
  grantLifetimeEntitlement,
  markLegacyMigrationDone,
} from "../utils/legacyUserMigration";
import { qaLog } from "../utils/qaLog";

/**
 * Runs one-time post-sign-in tasks after authentication:
 *  1. Migrate local trial data to Supabase
 *  2. Detect legacy users via App Store receipt
 *  3. Grant RevenueCat lifetime entitlement if legacy
 *  4. Refresh subscription status
 *
 * This hook lives inside AuthGate, so it only mounts when the user is
 * already authenticated. It runs once per app session; the individual
 * migration functions are internally guarded (AsyncStorage flags) so
 * repeated calls across sessions are safe no-ops.
 *
 * Waits for SubscriptionContext to finish loading (RevenueCat initialized)
 * before running legacy detection so the receipt check can succeed.
 */
export function usePostAuthMigration(): void {
  const { user, isAuthenticated } = useAuth();
  const { loading: subLoading, refresh: refreshSub } =
    useSubscriptionContext();
  const migrated = useRef(false);

  useEffect(() => {
    if (isAuthenticated && user?.id && !subLoading && !migrated.current) {
      migrated.current = true;
      (async () => {
        try {
          qaLog("PostAuthMigration", "Running post-auth migration", {
            userId: user.id,
          });
          await migrateTrialDataToSupabase(user.id);

          const isLegacy = await performLegacyMigration(user.id);
          if (isLegacy) {
            qaLog(
              "PostAuthMigration",
              "Legacy user detected, granting lifetime entitlement",
            );
            const granted = await grantLifetimeEntitlement(user.id);
            if (granted) {
              await markLegacyMigrationDone();
              qaLog("PostAuthMigration", "Legacy migration marked done");
            } else {
              qaLog(
                "PostAuthMigration",
                "Entitlement grant failed — will retry next session",
              );
            }
          }

          qaLog("PostAuthMigration", "Migration complete", { isLegacy });
          refreshSub();
        } catch (err) {
          qaLog("PostAuthMigration", "Post-sign-in error", {
            error: String(err),
          });
        }
      })();
    }
  }, [isAuthenticated, user?.id, subLoading, refreshSub]);
}
