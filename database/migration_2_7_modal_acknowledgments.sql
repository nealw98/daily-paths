-- 2.7 hardening migration.
--
-- 1. Server-owned acknowledgment for Modal A (subscriber-to-lifetime) and
--    Modal B (grandfathered). Replaces local AsyncStorage seen-flags so the
--    same congratulatory modal cannot fire twice (e.g. after reinstall) and
--    Modal A / Modal B can no longer collide for migrated subscribers.
-- 2. Relax the grandfather table's `legacy_trial_start_at NOT NULL` constraint:
--    eligibility can now also come from RC `first_seen` for users whose
--    AsyncStorage was wiped.

ALTER TABLE android_grandfather_grants
  ADD COLUMN IF NOT EXISTS modal_acknowledged_at timestamptz;

ALTER TABLE android_grandfather_grants
  ALTER COLUMN legacy_trial_start_at DROP NOT NULL;

ALTER TABLE android_subscriber_lifetime_grants
  ADD COLUMN IF NOT EXISTS modal_acknowledged_at timestamptz;

CREATE INDEX IF NOT EXISTS idx_android_grandfather_grants_modal_ack
  ON android_grandfather_grants(rc_app_user_id, modal_acknowledged_at);

CREATE INDEX IF NOT EXISTS idx_android_subscriber_lifetime_grants_modal_ack
  ON android_subscriber_lifetime_grants(rc_app_user_id, modal_acknowledged_at);
