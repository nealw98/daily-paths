# Reading Feedback System - Supabase Setup

This document contains the SQL schema and setup instructions for the reading feedback system.

## Overview

The feedback system consists of two main tables:
1. **`app_devices`** - Tracks anonymous device identifiers
2. **`app_reading_feedback`** - Stores per-reading ratings and feedback

## Database Schema

### 1. App Devices Table

Tracks device information for anonymous but consistent user identification.

```sql
-- Create app_devices table
create table app_devices (
  id uuid primary key default uuid_generate_v4(),
  device_id text unique not null,
  platform text check (platform in ('ios', 'android')),
  app_version text,
  first_seen_at timestamp with time zone default now(),
  last_active_at timestamp with time zone default now()
);

-- Create index for fast device lookup
create index idx_app_devices_device_id on app_devices(device_id);

-- Enable Row Level Security
alter table app_devices enable row level security;

-- Policy: Anyone can insert new devices
create policy "Allow device registration"
  on app_devices for insert
  with check (true);

-- Policy: Devices can update their own last_active
create policy "Allow device updates"
  on app_devices for update
  using (true);

-- Policy: Allow reading device data (for checking existence)
create policy "Allow device reads"
  on app_devices for select
  using (true);
```

### 2. Reading Feedback Table

Stores per-reading ratings with optional negative feedback reasons.

```sql
-- Create reading feedback table
create table app_reading_feedback (
  id uuid primary key default uuid_generate_v4(),
  device_id text not null references app_devices(device_id) on delete cascade,
  
  -- Reading identification
  reading_id uuid not null,  -- Will reference readings(id) - update if you add FK
  day_of_year int not null,
  reading_title text,  -- Denormalized for easier admin queries
  
  -- Rating
  rating text not null check (rating in ('positive', 'neutral', 'negative')),
  
  -- Negative feedback reasons (only populated if rating = 'negative')
  reason_unclear boolean default false,
  reason_too_long boolean default false,
  reason_not_applicable boolean default false,
  reason_language boolean default false,
  reason_other_text text,
  
  -- Metadata
  created_at timestamp with time zone default now(),
  updated_at timestamp with time zone default now(),
  
  -- One rating per device per reading
  unique(reading_id, device_id)
);

-- Create indexes for fast queries
create index idx_reading_feedback_reading on app_reading_feedback(reading_id);
create index idx_reading_feedback_rating on app_reading_feedback(rating);
create index idx_reading_feedback_negative on app_reading_feedback(rating) 
  where rating = 'negative';
create index idx_reading_feedback_created on app_reading_feedback(created_at desc);
create index idx_reading_feedback_day on app_reading_feedback(day_of_year);

-- Enable Row Level Security
alter table app_reading_feedback enable row level security;

-- Policy: Anyone can insert feedback
create policy "Allow feedback submission"
  on app_reading_feedback for insert
  with check (true);

-- Policy: Devices can update their own feedback
create policy "Allow feedback updates"
  on app_reading_feedback for update
  using (true);

-- Policy: Allow reading feedback (for loading existing ratings)
create policy "Allow feedback reads"
  on app_reading_feedback for select
  using (true);
```

## Setup Instructions

1. **Open Supabase SQL Editor**
   - Go to your Supabase project dashboard
   - Navigate to "SQL Editor" in the left sidebar

2. **Run the SQL Scripts**
   - Copy and paste the "App Devices Table" script
   - Click "Run" or press Cmd+Enter (Mac) / Ctrl+Enter (Windows)
   - Repeat for the "Reading Feedback Table" script

3. **Verify Tables Created**
   - Navigate to "Table Editor" in the left sidebar
   - You should see `app_devices` and `app_reading_feedback` tables

4. **Test Connection** (Optional)
   - The app will automatically create device records on first launch
   - Check the tables after running the app to verify data is being inserted

## Admin Queries

Use these queries on your admin dashboard (dailypaths.org) to analyze feedback.

### Worst Performing Readings

```sql
-- Find readings with highest percentage of negative ratings
SELECT 
  r.id,
  r.title,
  r.day_of_year,
  COUNT(*) FILTER (WHERE f.rating = 'negative') as negative_count,
  COUNT(*) FILTER (WHERE f.rating = 'positive') as positive_count,
  COUNT(*) FILTER (WHERE f.rating = 'neutral') as neutral_count,
  COUNT(*) as total_ratings,
  ROUND(100.0 * COUNT(*) FILTER (WHERE f.rating = 'negative') / NULLIF(COUNT(*), 0), 1) as negative_pct
FROM readings r
LEFT JOIN app_reading_feedback f ON r.id = f.reading_id
GROUP BY r.id, r.title, r.day_of_year
HAVING COUNT(*) >= 5  -- At least 5 ratings for statistical significance
ORDER BY negative_pct DESC NULLS LAST, total_ratings DESC
LIMIT 20;
```

### Common Negative Feedback Reasons

```sql
-- Aggregate reasons across all negative feedback
SELECT 
  SUM(reason_unclear::int) as unclear_count,
  SUM(reason_too_long::int) as too_long_count,
  SUM(reason_not_applicable::int) as not_applicable_count,
  SUM(reason_language::int) as language_count,
  COUNT(*) FILTER (WHERE reason_other_text IS NOT NULL AND reason_other_text != '') as other_specified_count,
  COUNT(*) as total_negative_ratings
FROM app_reading_feedback
WHERE rating = 'negative';
```

### Reasons for Specific Reading

```sql
-- Get detailed negative feedback for a specific reading
SELECT 
  f.reason_unclear,
  f.reason_too_long,
  f.reason_not_applicable,
  f.reason_language,
  f.reason_other_text,
  f.created_at
FROM app_reading_feedback f
WHERE f.reading_id = 'YOUR_READING_ID_HERE'
  AND f.rating = 'negative'
ORDER BY f.created_at DESC;
```

### Overall Rating Distribution

```sql
-- Get overall rating distribution across all readings
SELECT 
  rating,
  COUNT(*) as count,
  ROUND(100.0 * COUNT(*) / SUM(COUNT(*)) OVER (), 1) as percentage
FROM app_reading_feedback
GROUP BY rating
ORDER BY 
  CASE rating 
    WHEN 'positive' THEN 1 
    WHEN 'neutral' THEN 2 
    WHEN 'negative' THEN 3 
  END;
```

### Recent Feedback Activity

```sql
-- See most recent feedback submissions
SELECT 
  f.reading_title,
  f.rating,
  f.created_at,
  CASE 
    WHEN f.reason_unclear THEN 'Unclear' 
    WHEN f.reason_too_long THEN 'Too Long'
    WHEN f.reason_not_applicable THEN 'Not Applicable'
    WHEN f.reason_language THEN 'Language'
    WHEN f.reason_other_text IS NOT NULL THEN 'Other: ' || f.reason_other_text
    ELSE NULL
  END as negative_reason
FROM app_reading_feedback f
ORDER BY f.created_at DESC
LIMIT 50;
```

### Readings Needing Attention

```sql
-- Find readings with multiple "unclear" feedback
SELECT 
  r.title,
  r.day_of_year,
  COUNT(*) as unclear_count,
  array_agg(f.reason_other_text) FILTER (WHERE f.reason_other_text IS NOT NULL) as other_comments
FROM readings r
JOIN app_reading_feedback f ON r.id = f.reading_id
WHERE f.rating = 'negative' AND f.reason_unclear = true
GROUP BY r.id, r.title, r.day_of_year
HAVING COUNT(*) >= 2
ORDER BY unclear_count DESC;
```

### Active Users (Devices)

```sql
-- Count devices by platform
SELECT 
  platform,
  COUNT(*) as device_count,
  COUNT(*) FILTER (WHERE last_active_at > now() - interval '7 days') as active_last_7_days,
  COUNT(*) FILTER (WHERE last_active_at > now() - interval '30 days') as active_last_30_days
FROM app_devices
GROUP BY platform;
```

## Data Export

To export feedback for analysis:

```sql
-- Export all feedback with reading details
SELECT 
  r.day_of_year,
  r.title as reading_title,
  f.rating,
  f.reason_unclear,
  f.reason_too_long,
  f.reason_not_applicable,
  f.reason_language,
  f.reason_other_text,
  f.created_at,
  d.platform
FROM app_reading_feedback f
JOIN readings r ON f.reading_id = r.id
LEFT JOIN app_devices d ON f.device_id = d.device_id
ORDER BY f.created_at DESC;
```

Export as CSV from Supabase dashboard or use in your admin dashboard.

## Maintenance

### Clean Up Old Data (Optional)

If you want to remove old feedback after it's been addressed:

```sql
-- Delete feedback older than 6 months (only run if desired)
DELETE FROM app_reading_feedback
WHERE created_at < now() - interval '6 months';
```

### Update Reading After Improvements

When you update a reading based on feedback, you might want to track it:

```sql
-- Option 1: Add a column to readings table
ALTER TABLE readings ADD COLUMN last_updated timestamp with time zone;

-- Option 2: Create a separate improvements log table
CREATE TABLE reading_improvements (
  id uuid primary key default uuid_generate_v4(),
  reading_id uuid references readings(id),
  improvement_notes text,
  updated_at timestamp with time zone default now()
);
```

## Troubleshooting

### If feedback isn't being saved:

1. Check Supabase logs in dashboard → "Logs" section
2. Verify RLS policies are created correctly
3. Ensure app has correct Supabase URL and anon key in `.env`
4. Check app QA logs for any Supabase errors

### If duplicate feedback errors:

The `unique(reading_id, device_id)` constraint ensures one rating per device per reading. The app uses `upsert` which will update existing ratings, so this should not be an issue.

## Privacy Notes

- Device IDs are randomly generated UUIDs, not tied to personal information
- No email addresses or names are collected
- Feedback is truly anonymous
- Consider adding a privacy policy note about anonymous usage analytics

## Future Enhancements

If you later add user accounts:

```sql
-- Add optional user_id to app_devices
ALTER TABLE app_devices ADD COLUMN user_id uuid;
ALTER TABLE app_devices ADD COLUMN email text;
ALTER TABLE app_devices ADD COLUMN is_anonymous boolean default true;

-- This allows linking anonymous device to account later
-- while preserving all historical feedback
```


