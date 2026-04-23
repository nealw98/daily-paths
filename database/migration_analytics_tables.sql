-- Daily Paths: Analytics Tables Migration
-- Creates daily_active_users and reading_views tables
-- Run this in Supabase SQL Editor

-- ── daily_active_users ─────────────────────────────────────────────────────
-- Tracks one row per device per day for DAU metrics.
-- The table may already exist with incorrect RLS; this migration is idempotent.

CREATE TABLE IF NOT EXISTS daily_active_users (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  device_id text NOT NULL,
  date date NOT NULL,
  app_version text,
  platform text,
  created_at timestamptz DEFAULT now(),
  CONSTRAINT unique_device_date UNIQUE (device_id, date)
);

CREATE INDEX IF NOT EXISTS idx_dau_date ON daily_active_users(date);
CREATE INDEX IF NOT EXISTS idx_dau_device ON daily_active_users(device_id);

ALTER TABLE daily_active_users ENABLE ROW LEVEL SECURITY;

-- Drop any existing policies (idempotent)
DROP POLICY IF EXISTS "Allow daily activity insert" ON daily_active_users;
DROP POLICY IF EXISTS "Allow daily activity upsert" ON daily_active_users;
DROP POLICY IF EXISTS "Authenticated users can insert daily activity" ON daily_active_users;
DROP POLICY IF EXISTS "Authenticated users can update daily activity" ON daily_active_users;

-- Authenticated users can insert and update their device activity
CREATE POLICY "Authenticated users can insert daily activity"
  ON daily_active_users FOR INSERT
  TO authenticated
  WITH CHECK (true);

CREATE POLICY "Authenticated users can update daily activity"
  ON daily_active_users FOR UPDATE
  TO authenticated
  USING (true);


-- ── reading_views ──────────────────────────────────────────────────────────
-- Tracks unique viewers per reading (one row per device per reading).
-- first_viewed_at is set by DB default on insert; last_viewed_at updated on upsert.

CREATE TABLE IF NOT EXISTS reading_views (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  device_id text NOT NULL,
  reading_id uuid NOT NULL,
  first_viewed_at timestamptz DEFAULT now(),
  last_viewed_at timestamptz DEFAULT now(),
  app_version text,
  platform text,
  CONSTRAINT unique_device_reading UNIQUE (device_id, reading_id)
);

CREATE INDEX IF NOT EXISTS idx_rv_reading ON reading_views(reading_id);
CREATE INDEX IF NOT EXISTS idx_rv_device ON reading_views(device_id);

ALTER TABLE reading_views ENABLE ROW LEVEL SECURITY;

-- Drop any existing policies (idempotent)
DROP POLICY IF EXISTS "Authenticated users can insert reading views" ON reading_views;
DROP POLICY IF EXISTS "Authenticated users can update reading views" ON reading_views;

-- Authenticated users can insert and update reading views
CREATE POLICY "Authenticated users can insert reading views"
  ON reading_views FOR INSERT
  TO authenticated
  WITH CHECK (true);

CREATE POLICY "Authenticated users can update reading views"
  ON reading_views FOR UPDATE
  TO authenticated
  USING (true);
