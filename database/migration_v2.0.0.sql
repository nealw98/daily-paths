-- Daily Paths Plus Database Schema Migration
-- Version 2.0.0
-- Run this in Supabase SQL Editor

-- User profiles (extends Supabase auth.users)
CREATE TABLE IF NOT EXISTS user_profiles (
  id uuid PRIMARY KEY REFERENCES auth.users(id) ON DELETE CASCADE,
  device_id text, -- link to legacy device tracking
  created_at timestamptz DEFAULT now(),
  legacy_user boolean DEFAULT false, -- grandfathered lifetime access
  updated_at timestamptz DEFAULT now()
);

-- Journal entries
CREATE TABLE IF NOT EXISTS journal_entries (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  user_id uuid REFERENCES auth.users(id) ON DELETE CASCADE,
  content text NOT NULL,
  created_at timestamptz DEFAULT now(),
  updated_at timestamptz DEFAULT now()
);

CREATE INDEX IF NOT EXISTS idx_journal_user_created ON journal_entries(user_id, created_at DESC);

-- Gratitude entries
CREATE TABLE IF NOT EXISTS gratitude_entries (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  user_id uuid REFERENCES auth.users(id) ON DELETE CASCADE,
  date date NOT NULL, -- one entry per day
  items jsonb NOT NULL, -- array of gratitude items
  created_at timestamptz DEFAULT now(),
  CONSTRAINT unique_user_date UNIQUE(user_id, date)
);

CREATE INDEX IF NOT EXISTS idx_gratitude_user_date ON gratitude_entries(user_id, date DESC);

-- Gratitude quotes (static content)
CREATE TABLE IF NOT EXISTS gratitude_quotes (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  day_of_year integer UNIQUE NOT NULL CHECK (day_of_year >= 1 AND day_of_year <= 366),
  quote text NOT NULL,
  author text
);

-- Personal prayer notes
CREATE TABLE IF NOT EXISTS prayer_notes (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  user_id uuid REFERENCES auth.users(id) ON DELETE CASCADE,
  content text NOT NULL,
  created_at timestamptz DEFAULT now(),
  updated_at timestamptz DEFAULT now(),
  CONSTRAINT one_note_per_user UNIQUE(user_id)
);

-- User preferences (check if exists, add columns if needed)
DO $$ 
BEGIN
    IF NOT EXISTS (SELECT FROM pg_tables WHERE schemaname = 'public' AND tablename = 'user_preferences') THEN
        CREATE TABLE user_preferences (
            user_id uuid PRIMARY KEY REFERENCES auth.users(id) ON DELETE CASCADE,
            subscription_status text,
            trial_start_date timestamptz,
            has_rated boolean DEFAULT false,
            last_rating_prompt timestamptz,
            days_used integer DEFAULT 0,
            total_readings integer DEFAULT 0,
            bookmarks_count integer DEFAULT 0,
            app_opens integer DEFAULT 0,
            created_at timestamptz DEFAULT now(),
            updated_at timestamptz DEFAULT now()
        );
    ELSE
        -- Add columns if table exists but columns don't
        ALTER TABLE user_preferences ADD COLUMN IF NOT EXISTS subscription_status text;
        ALTER TABLE user_preferences ADD COLUMN IF NOT EXISTS trial_start_date timestamptz;
        ALTER TABLE user_preferences ADD COLUMN IF NOT EXISTS has_rated boolean DEFAULT false;
        ALTER TABLE user_preferences ADD COLUMN IF NOT EXISTS last_rating_prompt timestamptz;
    END IF;
END $$;

-- RLS Policies
ALTER TABLE journal_entries ENABLE ROW LEVEL SECURITY;
ALTER TABLE gratitude_entries ENABLE ROW LEVEL SECURITY;
ALTER TABLE prayer_notes ENABLE ROW LEVEL SECURITY;
ALTER TABLE user_profiles ENABLE ROW LEVEL SECURITY;

-- Drop existing policies if they exist (for idempotency)
DROP POLICY IF EXISTS "Users can manage their own journal entries" ON journal_entries;
DROP POLICY IF EXISTS "Users can manage their own gratitude entries" ON gratitude_entries;
DROP POLICY IF EXISTS "Users can manage their own prayer notes" ON prayer_notes;
DROP POLICY IF EXISTS "Users can read their own profile" ON user_profiles;
DROP POLICY IF EXISTS "Users can update their own profile" ON user_profiles;
DROP POLICY IF EXISTS "Users can insert their own profile" ON user_profiles;

-- Create policies
CREATE POLICY "Users can manage their own journal entries"
  ON journal_entries FOR ALL
  USING (auth.uid() = user_id);

CREATE POLICY "Users can manage their own gratitude entries"
  ON gratitude_entries FOR ALL
  USING (auth.uid() = user_id);

CREATE POLICY "Users can manage their own prayer notes"
  ON prayer_notes FOR ALL
  USING (auth.uid() = user_id);

CREATE POLICY "Users can read their own profile"
  ON user_profiles FOR SELECT
  USING (auth.uid() = id);

CREATE POLICY "Users can update their own profile"
  ON user_profiles FOR UPDATE
  USING (auth.uid() = id);

CREATE POLICY "Users can insert their own profile"
  ON user_profiles FOR INSERT
  WITH CHECK (auth.uid() = id);

-- Trigger to update updated_at timestamp
CREATE OR REPLACE FUNCTION update_updated_at_column()
RETURNS TRIGGER AS $$
BEGIN
    NEW.updated_at = now();
    RETURN NEW;
END;
$$ language 'plpgsql';

-- Apply triggers
DROP TRIGGER IF EXISTS update_journal_entries_updated_at ON journal_entries;
CREATE TRIGGER update_journal_entries_updated_at BEFORE UPDATE ON journal_entries
FOR EACH ROW EXECUTE FUNCTION update_updated_at_column();

DROP TRIGGER IF EXISTS update_prayer_notes_updated_at ON prayer_notes;
CREATE TRIGGER update_prayer_notes_updated_at BEFORE UPDATE ON prayer_notes
FOR EACH ROW EXECUTE FUNCTION update_updated_at_column();

DROP TRIGGER IF EXISTS update_user_profiles_updated_at ON user_profiles;
CREATE TRIGGER update_user_profiles_updated_at BEFORE UPDATE ON user_profiles
FOR EACH ROW EXECUTE FUNCTION update_updated_at_column();

-- Grant public read access to gratitude_quotes (static content)
ALTER TABLE gratitude_quotes ENABLE ROW LEVEL SECURITY;
DROP POLICY IF EXISTS "Anyone can read gratitude quotes" ON gratitude_quotes;
CREATE POLICY "Anyone can read gratitude quotes"
  ON gratitude_quotes FOR SELECT
  USING (true);
