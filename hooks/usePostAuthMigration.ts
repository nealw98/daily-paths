import { useEffect, useRef } from "react";
import { useAuth } from "../contexts/AuthContext";
import { useSubscriptionContext } from "../contexts/SubscriptionContext";
import { migrateTrialDataToSupabase } from "../utils/dataMigration";
import { qaLog } from "../utils/qaLog";

/**
 * Runs one-time post-sign-in tasks after authentication:
 *  1. Migrate local trial data to Supabase
 *  2. Refresh subscription status from RevenueCat
 *
 * This hook lives inside AuthGate, so it only mounts when the user is
 * already authenticated. It runs once per app session; the individual
 * migration functions are internally guarded (AsyncStorage flags) so
 * repeated calls across sessions are safe no-ops.
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

          qaLog("PostAuthMigration", "Migration complete");
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
