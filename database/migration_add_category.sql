-- Add category column to journal_entries
-- Allows entries to be categorized as "gratitude", "nightly_review", "spot_check", or NULL (plain journal)
ALTER TABLE journal_entries ADD COLUMN IF NOT EXISTS category text;
CREATE INDEX IF NOT EXISTS idx_journal_category ON journal_entries(user_id, category, created_at DESC);
