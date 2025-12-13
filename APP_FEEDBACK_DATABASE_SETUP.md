# App Feedback System - Supabase Setup

This document contains the SQL schema and setup instructions for the general app feedback system (from Settings → Send Feedback).

## Overview

The app feedback system allows users to submit general feedback, bug reports, and feature requests directly to your Supabase database without exposing your developer email.

## Database Schema

### App Feedback Table

Stores general feedback from users with optional contact information.

```sql
-- Create app_feedback table
create table app_feedback (
  id uuid primary key default uuid_generate_v4(),
  device_id text not null references app_devices(device_id) on delete cascade,
  
  -- Feedback content
  feedback_text text not null,
  contact_info text,  -- Optional email or other contact method
  
  -- Device/App metadata (for debugging)
  app_version text,
  build_number text,
  platform text check (platform in ('ios', 'android', 'web')),
  
  -- Timestamps
  created_at timestamp with time zone default now()
);

-- Create indexes for fast queries
create index idx_app_feedback_created on app_feedback(created_at desc);
create index idx_app_feedback_device on app_feedback(device_id);
create index idx_app_feedback_platform on app_feedback(platform);

-- Enable Row Level Security
alter table app_feedback enable row level security;

-- Policy: Anyone can insert feedback
create policy "Allow feedback submission"
  on app_feedback for insert
  with check (true);

-- Policy: Allow reading feedback (for admin dashboard)
create policy "Allow feedback reads"
  on app_feedback for select
  using (true);
```

## Setup Instructions

1. **Open Supabase SQL Editor**
   - Go to your Supabase project dashboard
   - Navigate to "SQL Editor" in the left sidebar

2. **Run the SQL Script**
   - Copy and paste the "App Feedback Table" script above
   - Click "Run" or press Cmd+Enter (Mac) / Ctrl+Enter (Windows)

3. **Verify Table Created**
   - Navigate to "Table Editor" in the left sidebar
   - You should see the `app_feedback` table
   - Verify that `app_devices` table already exists (from reading feedback setup)

4. **Test Connection** (Optional)
   - Submit feedback through the app after deploying changes
   - Check the table to verify data is being inserted

## Admin Queries

Use these queries to view and manage feedback.

### Recent Feedback

```sql
-- View most recent feedback submissions
SELECT 
  f.created_at,
  f.feedback_text,
  f.contact_info,
  f.app_version,
  f.build_number,
  f.platform,
  d.first_seen_at as user_first_seen
FROM app_feedback f
LEFT JOIN app_devices d ON f.device_id = d.device_id
ORDER BY f.created_at DESC
LIMIT 50;
```

### Feedback by Platform

```sql
-- Count feedback by platform
SELECT 
  platform,
  COUNT(*) as feedback_count
FROM app_feedback
GROUP BY platform
ORDER BY feedback_count DESC;
```

### Feedback with Contact Info

```sql
-- Get feedback where users provided contact info (for follow-up)
SELECT 
  created_at,
  feedback_text,
  contact_info,
  app_version,
  platform
FROM app_feedback
WHERE contact_info IS NOT NULL 
  AND contact_info != ''
ORDER BY created_at DESC;
```

### Recent User Feedback History

```sql
-- See all feedback from a specific user (by device_id)
SELECT 
  created_at,
  feedback_text,
  contact_info,
  app_version
FROM app_feedback
WHERE device_id = 'YOUR_DEVICE_ID_HERE'
ORDER BY created_at DESC;
```

### Feedback Volume Over Time

```sql
-- Daily feedback volume for the last 30 days
SELECT 
  DATE(created_at) as feedback_date,
  COUNT(*) as feedback_count,
  COUNT(*) FILTER (WHERE contact_info IS NOT NULL) as with_contact_count
FROM app_feedback
WHERE created_at > now() - interval '30 days'
GROUP BY DATE(created_at)
ORDER BY feedback_date DESC;
```

### Export All Feedback

```sql
-- Export all feedback for external analysis
SELECT 
  f.id,
  f.created_at,
  f.feedback_text,
  f.contact_info,
  f.app_version,
  f.build_number,
  f.platform,
  d.platform as device_platform,
  d.first_seen_at as user_first_seen,
  d.last_active_at as user_last_active
FROM app_feedback f
LEFT JOIN app_devices d ON f.device_id = d.device_id
ORDER BY f.created_at DESC;
```

Export as CSV from Supabase dashboard or use in your admin dashboard at dailypaths.org.

## Integration with Admin Dashboard

You can add a feedback viewer to your admin dashboard (dailypaths.org) to review submissions. Example React component:

```typescript
// Example: FeedbackViewer.tsx for your admin dashboard
interface FeedbackItem {
  id: string;
  created_at: string;
  feedback_text: string;
  contact_info?: string;
  app_version: string;
  platform: string;
}

async function loadFeedback() {
  const { data, error } = await supabase
    .from('app_feedback')
    .select('*')
    .order('created_at', { ascending: false })
    .limit(100);
  
  return data;
}
```

## Privacy & Security

- **Device IDs**: Anonymous UUIDs, not tied to personal information
- **Contact Info**: Completely optional, only stored if user provides it
- **Email Not Required**: Users can submit feedback anonymously
- **No Dev Email Exposure**: Your email is never sent to the client
- **Row Level Security**: Ensures data access is controlled

## Benefits Over Email

1. ✅ **Developer email stays hidden** - No exposure in client code
2. ✅ **Better organization** - All feedback in one queryable database
3. ✅ **Analytics** - Can track trends, volume, platforms
4. ✅ **Optional contact** - Users aren't forced to provide email
5. ✅ **No email client required** - Works even if user has no email app
6. ✅ **Admin dashboard** - Build custom feedback viewer on dailypaths.org

## Notifications (Optional)

If you want email notifications when feedback is submitted, you can set up a Supabase Database Webhook:

1. Go to Database → Webhooks in Supabase
2. Create a webhook on `app_feedback` table for INSERT events
3. Point it to an email service (SendGrid, Mailgun, etc.) or a simple webhook handler

Example webhook handler (Node.js):

```javascript
// Webhook endpoint to notify you of new feedback
app.post('/webhooks/feedback', async (req, res) => {
  const { record } = req.body;
  
  // Send yourself an email
  await sendEmail({
    to: 'soberdailies@gmail.com',
    subject: 'New Al-Anon Daily Paths Feedback',
    body: `
      Feedback: ${record.feedback_text}
      Contact: ${record.contact_info || 'Not provided'}
      Version: ${record.app_version} (${record.build_number})
      Platform: ${record.platform}
      Time: ${record.created_at}
    `
  });
  
  res.json({ success: true });
});
```

## Maintenance

### Archive Old Feedback (Optional)

If you want to keep the table clean:

```sql
-- Archive feedback older than 1 year
CREATE TABLE app_feedback_archive AS 
SELECT * FROM app_feedback 
WHERE created_at < now() - interval '1 year';

DELETE FROM app_feedback 
WHERE created_at < now() - interval '1 year';
```

## Troubleshooting

### If feedback isn't being saved:

1. Check Supabase logs in dashboard → "Logs" section
2. Verify RLS policies are created correctly
3. Ensure app has correct Supabase URL and anon key in `.env`
4. Check app QA logs (`/qa-logs`) for any Supabase errors
5. Verify `app_devices` table exists (created during reading feedback setup)

### If getting device_id errors:

The `app_feedback` table references `app_devices(device_id)`. Make sure the reading feedback system is set up first (which creates the `app_devices` table).

