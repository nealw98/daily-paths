-- RevenueCat expiry webhook queue for idempotent deletion + cron fallback.

CREATE TABLE IF NOT EXISTS subscription_expiry_events (
  event_id text PRIMARY KEY,
  user_id uuid NOT NULL,
  event_type text NOT NULL,
  payload jsonb NOT NULL,
  status text NOT NULL DEFAULT 'pending' CHECK (status IN ('pending', 'processed')),
  error text,
  created_at timestamptz NOT NULL DEFAULT now(),
  processed_at timestamptz
);

CREATE INDEX IF NOT EXISTS idx_subscription_expiry_events_status
  ON subscription_expiry_events(status, created_at);
