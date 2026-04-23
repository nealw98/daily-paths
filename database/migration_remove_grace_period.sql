-- Migration: Remove grace-period account deletion infrastructure
--
-- The deletion model has been simplified to immediate deletion.
-- These RPCs are no longer called by the app.
--
-- The columns (deletion_requested_at, deletion_scheduled_for) on user_profiles
-- are left in place — they are harmless and may still be referenced by the
-- process-account-deletions cron (kept temporarily as a safety net).

DROP FUNCTION IF EXISTS request_account_deletion();
DROP FUNCTION IF EXISTS cancel_account_deletion();
DROP FUNCTION IF EXISTS check_deletion_status();
