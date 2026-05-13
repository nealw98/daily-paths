-- Audit trail for QA-driven RevenueCat lifetime entitlement revocations.
-- Production code never writes to this table; only the QA tool does.

CREATE TABLE IF NOT EXISTS android_lifetime_revocations (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  rc_app_user_id text NOT NULL,
  status text NOT NULL CHECK (status IN ('revoked', 'revoke_failed')),
  last_error text,
  created_at timestamptz NOT NULL DEFAULT now()
);

CREATE INDEX IF NOT EXISTS idx_android_lifetime_revocations_user
  ON android_lifetime_revocations(rc_app_user_id, created_at DESC);

ALTER TABLE android_lifetime_revocations ENABLE ROW LEVEL SECURITY;
