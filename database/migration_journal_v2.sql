-- Journal V2: Recovery Notebook with multiple entry types
-- Run in Supabase SQL Editor after migration_add_category.sql
--
-- Adds entry_type column (replaces category) and structured_content (JSONB).
-- entry_type values: 'journal', 'gratitude', 'spot_check', 'nightly_review'
-- structured_content shapes:
--   journal:        null (uses content field only)
--   gratitude:      { "items": ["item 1", "item 2", ...] }
--   spot_check:     { "what_happened": "...", "feeling": "...", "control": "...", "my_part": "...", "next_right_thing": "..." }
--   nightly_review: { "serenity": "...", "selfish_dishonest_afraid": "...", "amends": "...", "did_well": "...", "grateful": "..." }

-- 1. Add entry_type column with default 'journal'
ALTER TABLE journal_entries ADD COLUMN IF NOT EXISTS entry_type text NOT NULL DEFAULT 'journal';

-- 2. Migrate existing category values to entry_type
UPDATE journal_entries SET entry_type = category WHERE category IS NOT NULL AND entry_type = 'journal';

-- 3. Add structured_content JSONB column for structured entry types
ALTER TABLE journal_entries ADD COLUMN IF NOT EXISTS structured_content jsonb;

-- 4. Allow content to be nullable (structured entries populate it for search but primarily use structured_content)
ALTER TABLE journal_entries ALTER COLUMN content DROP NOT NULL;

-- 5. Index for filtering by entry_type
CREATE INDEX IF NOT EXISTS idx_journal_entry_type ON journal_entries(user_id, entry_type, created_at DESC);
