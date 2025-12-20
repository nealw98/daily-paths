# Feedback System Upgrade

## Problem
The app's feedback system was using `mailto:` links, which:
1. **Exposed your developer email** in the client code
2. **Required user email setup** - didn't work if they had no email app
3. **Asked for email twice** - once in the form, then again in their mail app
4. **Provided no analytics** - couldn't track feedback trends
5. **Poor UX** - created a draft email instead of direct submission

## Solution
Upgraded to a **database-backed feedback system** using your existing Supabase infrastructure.

## What Changed

### 1. New Database Table: `app_feedback`
- Stores all feedback submissions
- Links to anonymous `device_id` (from existing `app_devices` table)
- Captures app version, build, platform for debugging
- Optional contact info (email) that user can provide

### 2. New Hook: `useAppFeedback`
Created `/hooks/useAppFeedback.ts` that:
- Submits feedback directly to Supabase
- Tracks device info automatically
- Handles errors gracefully
- Logs everything for debugging

### 3. Updated Component: `SettingsContent`
Modified the feedback modal to:
- Use the new hook instead of `mailto:`
- Show confirmation alert on success
- Show error alert if submission fails
- Better placeholder text: "Optional: your email if you'd like a reply"
- No longer creates email drafts

## Benefits

✅ **Your email stays hidden** - Never exposed in client code  
✅ **Works for everyone** - No email app required  
✅ **Better UX** - Direct submission with confirmation  
✅ **Analytics ready** - Query trends, volumes, platforms  
✅ **Organized** - All feedback in one queryable database  
✅ **Optional contact** - Users can truly submit anonymously  
✅ **Admin dashboard ready** - Build feedback viewer on dailypaths.org

## Setup Required

### Step 1: Run SQL in Supabase
Open your Supabase SQL Editor and run the script from `APP_FEEDBACK_DATABASE_SETUP.md`:

```sql
-- Create app_feedback table
create table app_feedback (
  id uuid primary key default uuid_generate_v4(),
  device_id text not null references app_devices(device_id) on delete cascade,
  feedback_text text not null,
  contact_info text,
  app_version text,
  build_number text,
  platform text check (platform in ('ios', 'android', 'web')),
  created_at timestamp with time zone default now()
);

-- Create indexes
create index idx_app_feedback_created on app_feedback(created_at desc);
create index idx_app_feedback_device on app_feedback(device_id);
create index idx_app_feedback_platform on app_feedback(platform);

-- Enable RLS
alter table app_feedback enable row level security;

-- Policies
create policy "Allow feedback submission"
  on app_feedback for insert
  with check (true);

create policy "Allow feedback reads"
  on app_feedback for select
  using (true);
```

### Step 2: Test in the App
1. Go to Settings → Send Feedback
2. Type some test feedback
3. Optionally add your email
4. Submit
5. Should see "Thank you!" confirmation

### Step 3: Verify in Supabase
Go to Supabase → Table Editor → `app_feedback` and you should see your test submission.

## Viewing Feedback

### Option 1: Supabase Dashboard
Go to Table Editor → `app_feedback` to see all submissions.

### Option 2: SQL Queries
See `APP_FEEDBACK_DATABASE_SETUP.md` for useful queries like:

```sql
-- Recent feedback
SELECT 
  created_at,
  feedback_text,
  contact_info,
  app_version,
  platform
FROM app_feedback
ORDER BY created_at DESC
LIMIT 50;
```

### Option 3: Admin Dashboard (Future)
Build a feedback viewer into your admin dashboard at dailypaths.org:

```typescript
const { data } = await supabase
  .from('app_feedback')
  .select('*')
  .order('created_at', { ascending: false });
```

## Optional: Email Notifications
If you want to receive emails when new feedback arrives, set up a Supabase Database Webhook (instructions in `APP_FEEDBACK_DATABASE_SETUP.md`).

## Files Changed
- ✅ Created: `hooks/useAppFeedback.ts` - Hook for submitting feedback
- ✅ Created: `APP_FEEDBACK_DATABASE_SETUP.md` - Database setup guide
- ✅ Modified: `components/SettingsContent.tsx` - Updated feedback modal

## Testing Checklist
- [ ] Run SQL script in Supabase SQL Editor
- [ ] Verify `app_feedback` table exists in Table Editor
- [ ] Test feedback submission in app
- [ ] Check Supabase table for the submission
- [ ] Test with empty feedback (should be disabled)
- [ ] Test with contact info provided
- [ ] Test without contact info (anonymous)
- [ ] Verify app version/build/platform captured correctly

## Rollback (If Needed)
If you need to revert to email-based feedback:

1. The old code is in git history (commit before this change)
2. Or just revert the `handleSubmitFeedback` function in `SettingsContent.tsx`

But honestly, this new system is way better! 🎉


