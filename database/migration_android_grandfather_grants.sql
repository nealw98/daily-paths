-- Server-side audit trail for Android free-user grandfather grants.
--
-- Access remains sourced from RevenueCat. This table records why the
-- Supabase edge function did or did not grant a promotional lifetime
-- entitlement for an old 2.6.x install.

CREATE TABLE IF NOT EXISTS android_grandfather_grants (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  rc_app_user_id text NOT NULL UNIQUE,
  legacy_trial_start_at timestamptz NOT NULL,
  migration_cutoff_at timestamptz NOT NULL,
  rc_first_seen_at timestamptz,
  status text NOT NULL CHECK (status IN ('granted', 'denied', 'grant_failed')),
  decision_reason text NOT NULL,
  has_active_subscription boolean NOT NULL DEFAULT false,
  has_lifetime boolean NOT NULL DEFAULT false,
  last_checked_at timestamptz NOT NULL DEFAULT now(),
  granted_at timestamptz,
  denied_at timestamptz,
  last_error text,
  created_at timestamptz NOT NULL DEFAULT now(),
  updated_at timestamptz NOT NULL DEFAULT now()
);

CREATE INDEX IF NOT EXISTS idx_android_grandfather_grants_status
  ON android_grandfather_grants(status, updated_at);

ALTER TABLE android_grandfather_grants ENABLE ROW LEVEL SECURITY;

