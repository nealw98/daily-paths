# Admin Feedback Page - Instructions for Lovable

Create an admin page at `/admin/feedback` that displays analytics from the app's reading feedback system. The page should connect to our existing Supabase database.

## Database Schema (Already Exists)

We have these tables:
- `app_devices` - Device tracking with columns: device_id, platform, app_version, first_seen_at, last_active_at
- `app_reading_feedback` - Feedback with columns: id, device_id, reading_id, day_of_year, reading_title, rating (positive/neutral/negative), reason_unclear, reason_too_long, reason_not_applicable, reason_language, reason_other_text, created_at, updated_at
- `readings` - Existing readings table with columns: id, date, title, body, etc.

## Page Requirements

### 1. Overview Section (Top Cards)
- Total feedback count
- Rating distribution: Show counts and percentages for positive, neutral, negative
- Display as colored cards (green for positive, yellow for neutral, red for negative)

### 2. Readings Needing Attention (Main Table)
Display a sortable table with columns:
- Reading Title (with day of year)
- Total Ratings Count
- Positive Count & %
- Neutral Count & %
- Negative Count & %
- Actions (View Details button)

Default sort: Highest negative percentage first
Filter: Only show readings with 3+ total ratings

### 3. Expandable Details for Each Reading
When clicking "View Details" on a reading, show:
- All negative feedback reasons broken down:
  - Content is unclear (count)
  - Too long or wordy (count)
  - Not relevant (count)
  - Language/tone issues (count)
  - Other comments (list each text entry)
- Recent feedback timeline (last 10 ratings with timestamps)

### 4. Common Issues Section (Bottom)
Aggregate view across ALL negative feedback:
- Bar chart or simple counts showing:
  - Total "unclear" flags
  - Total "too long" flags
  - Total "not relevant" flags
  - Total "language/tone" flags
  - Count of "other" text entries provided

## Supabase Queries Needed

### Main readings table query:
```sql
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
HAVING COUNT(*) >= 3
ORDER BY negative_pct DESC NULLS LAST, total_ratings DESC;
```

### Overall rating distribution:
```sql
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

### Common negative reasons:
```sql
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

### Details for specific reading:
```sql
SELECT 
  f.reason_unclear,
  f.reason_too_long,
  f.reason_not_applicable,
  f.reason_language,
  f.reason_other_text,
  f.rating,
  f.created_at
FROM app_reading_feedback f
WHERE f.reading_id = :reading_id
ORDER BY f.created_at DESC;
```

## UI/UX Requirements

- **Authentication**: Add basic password protection or admin-only access
- **Responsive design**: Should work on desktop and tablet
- **Color coding**: 
  - Green/positive vibes for positive ratings
  - Yellow/neutral for neutral ratings  
  - Red/attention needed for negative ratings
- **Loading states**: Show skeleton or spinner while fetching data
- **Empty states**: Handle readings with no feedback gracefully
- **Refresh button**: Allow manual data refresh
- **Date range filter** (optional): Filter feedback by date range

## Styling Suggestions

- Use shadcn/ui components if available (Table, Card, Badge, Button)
- Clean, minimal design matching the existing Daily Paths aesthetic
- Use color scheme: Deep teal (#1a5557) for primary, pearl/mist colors for backgrounds
- Make the table scrollable on small screens
- Use icons for ratings (thumbs up, neutral hand, thumbs down)

## Example Component Structure

```
/admin/feedback
  ├── FeedbackOverview (overview cards)
  ├── ReadingsTable (main sortable table)
  │   └── ReadingDetailModal (expandable details)
  └── CommonIssues (aggregate negative reasons)
```

## Notes

- Use the existing Supabase client connection from the project
- The app uses anonymous device_id tracking (UUID), no user emails
- Feedback is being collected from the React Native mobile app
- Each reading can have multiple feedback entries from different devices
- The `reading_title` is denormalized in the feedback table for easier queries

## Implementation Instructions

Please create this admin page with proper TypeScript types, error handling, and the Lovable-standard UI components. Make it look professional and easy to use for reviewing and improving readings based on user feedback.



