-- Server-side audit trail for Android active-subscription to lifetime grants.
--
-- Access remains sourced from RevenueCat. This table records which legacy
-- subscribers were granted promotional lifetime, and whether they were
-- monthly or annual for Modal A / gift-code follow-up.

CREATE TABLE IF NOT EXISTS android_subscriber_lifetime_grants (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  rc_app_user_id text NOT NULL UNIQUE,
  subscription_product_identifier text,
  subscription_plan text NOT NULL CHECK (subscription_plan IN ('monthly', 'annual', 'unknown')),
  subscription_purchased_at timestamptz,
  subscription_original_purchased_at timestamptz,
  subscription_expiration_at timestamptz,
  subscription_will_renew boolean NOT NULL DEFAULT false,
  store_transaction_id text,
  raw_subscription_entitlement jsonb,
  rc_first_seen_at timestamptz,
  status text NOT NULL CHECK (status IN ('granted', 'denied', 'grant_failed')),
  decision_reason text NOT NULL,
  last_checked_at timestamptz NOT NULL DEFAULT now(),
  granted_at timestamptz,
  denied_at timestamptz,
  last_error text,
  created_at timestamptz NOT NULL DEFAULT now(),
  updated_at timestamptz NOT NULL DEFAULT now()
);

CREATE INDEX IF NOT EXISTS idx_android_subscriber_lifetime_grants_status
  ON android_subscriber_lifetime_grants(status, updated_at);

CREATE INDEX IF NOT EXISTS idx_android_subscriber_lifetime_grants_plan
  ON android_subscriber_lifetime_grants(subscription_plan, status);

ALTER TABLE android_subscriber_lifetime_grants ENABLE ROW LEVEL SECURITY;

