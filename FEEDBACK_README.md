# Reading Feedback Feature

Anonymous user feedback system for daily readings to help identify and improve content quality.

## Features

✅ **Per-Reading Ratings**
- Three-option rating: Thumbs up 👍, Neutral 😐, Thumbs down 👎
- Appears at bottom of every reading
- Users can change their rating anytime

✅ **Detailed Negative Feedback**
- When user taps thumbs down, modal appears with:
  - ☐ Content is unclear
  - ☐ Too long or wordy
  - ☐ Not relevant
  - ☐ Language/tone issues
  - ☐ Other (with text field)

✅ **Anonymous Tracking**
- Device ID (UUID) generated on first app launch
- No login required
- No personal information collected
- Ratings persist across app sessions

✅ **Thank You Message**
- After any rating: "Thanks for helping improve Daily Paths 💚"
- Fades in/out automatically
- Positive reinforcement for participation

## Files Created

### Core Components
- `components/ReadingFeedback.tsx` - Main feedback UI with rating buttons
- `components/NegativeFeedbackModal.tsx` - Modal for detailed negative feedback
- `hooks/useReadingFeedback.ts` - Hook for loading/submitting ratings
- `utils/deviceIdentity.ts` - Anonymous device ID management

### Documentation
- `FEEDBACK_DATABASE_SETUP.md` - Complete Supabase schema and admin queries

### Integration
- Modified `components/ReadingScreen.tsx` - Added ReadingFeedback at bottom of readings

## Usage

The feedback component is automatically included at the bottom of every reading. No additional setup needed in the app code.

### For Users
1. Read the daily content
2. Scroll to bottom
3. Tap one of three rating buttons
4. If thumbs down, optionally provide detailed reasons
5. See thank you message

### For Admins
1. Set up Supabase tables (see `FEEDBACK_DATABASE_SETUP.md`)
2. Use provided SQL queries to analyze feedback on dailypaths.org admin dashboard
3. Identify readings with high negative ratings
4. Review specific feedback reasons
5. Update readings in database (no app update needed)

## Database Schema

Two tables in Supabase:

1. **`app_devices`** - Tracks anonymous device identifiers
2. **`app_reading_feedback`** - Stores ratings and feedback details

See `FEEDBACK_DATABASE_SETUP.md` for complete schema and setup instructions.

## Admin Queries

Common queries for analyzing feedback (all in `FEEDBACK_DATABASE_SETUP.md`):

- Worst performing readings (highest % negative)
- Common reasons for negative feedback
- Recent feedback activity
- Readings needing attention (multiple "unclear" ratings)
- Overall rating distribution
- Active user count by platform

## Privacy

- ✅ Truly anonymous (random UUID, not tied to any personal info)
- ✅ No emails or names collected
- ✅ No account required
- ✅ Data used only for content improvement
- ✅ Compatible with paid app model (no user sign-up)

## Future Enhancements (Not Implemented)

These can be added later if needed:

1. **App Feedback** - Overall satisfaction survey in Settings
2. **App Store Review Prompt** - Trigger after positive engagement
3. **User Accounts** - Optional sign-in for cross-device sync
4. **Aggregate Counts** - Show "42 people found this helpful"

## Implementation Notes

- Feedback loads automatically when reading is displayed
- Upsert pattern allows users to change their rating
- QA logging integrated for debugging
- Works offline (caches in AsyncStorage, syncs when online)
- Respects 82px bottom margin for action bar

## Testing Checklist

- [ ] Device ID created on first app launch
- [ ] Device registered in Supabase `app_devices` table
- [ ] Positive rating saves correctly
- [ ] Neutral rating saves correctly
- [ ] Negative rating opens modal
- [ ] Modal checkboxes work
- [ ] Optional "other" text field works
- [ ] Feedback saves to Supabase `app_reading_feedback` table
- [ ] User can change rating (upsert works)
- [ ] Thank you message appears and fades
- [ ] Previous rating is highlighted correctly
- [ ] Works offline (AsyncStorage caching)
- [ ] QA logs show feedback events

## Troubleshooting

### Feedback not saving:
1. Check Supabase tables exist (see `FEEDBACK_DATABASE_SETUP.md`)
2. Verify RLS policies are enabled
3. Check app QA logs for Supabase errors
4. Ensure `.env` has correct `EXPO_PUBLIC_SUPABASE_URL` and `EXPO_PUBLIC_SUPABASE_ANON_KEY`

### Device ID issues:
1. Check AsyncStorage key `@daily_paths_device_id`
2. Verify device appears in `app_devices` table
3. Review QA logs for device registration errors

### Modal not appearing:
1. Ensure thumbs down button is tapped (not positive/neutral)
2. Check console for React errors
3. Verify `NegativeFeedbackModal` component imported correctly

## Analytics Ideas

Track these metrics over time:
- % positive vs negative vs neutral
- Most common negative reasons
- Readings with consistent negative feedback
- Platform differences (iOS vs Android)
- Rating patterns by day of year
- Time to first rating (engagement metric)

