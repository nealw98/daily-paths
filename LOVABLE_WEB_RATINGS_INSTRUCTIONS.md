# Add Reading Ratings to Website - Instructions for Lovable

## Overview

Add the same reading feedback/rating system that exists in the mobile app to the website reading view. Users should be able to rate readings directly on the website using the same UI pattern and database structure.

## Current Website Reading View

The website already displays daily readings at `dailypaths.org` with:
- Date navigation (previous/next day)
- Reading title
- Reading content (opening, body, application, thought for the day)
- Edit button (for authenticated users)
- Thumbs up/down icons (currently non-functional)

## Requirements

### 1. Add Rating UI Below Reading Content

Add the rating interface at the bottom of each reading (above or below the "Thought for the Day" section):

**Visual Design:**
```
┌─────────────────────────────────────┐
│     Was this reading helpful?       │
│                                     │
│    [👍]    [👌]    [👎]            │
│  Positive  Neutral  Negative        │
│                                     │
│  Thanks for your feedback! 💚       │
│  (shows after rating, fades out)    │
└─────────────────────────────────────┐
```

**Button States:**
- Default: All three buttons show as outlined circles with icons in ocean blue
- Selected: Chosen button fills with deep teal background, white icon, other buttons fade to 30% opacity
- All buttons remain clickable to change rating
- Hover state: Slight scale/shadow effect

**Icon Sizes:**
- Buttons: 56px × 56px circles
- Icons: 24px
- Question text: 16px (or match body text size)
- Thank you text: 14px

### 2. Negative Feedback Modal

When user clicks thumbs down (👎), immediately show a modal asking for reasons:

**Modal Title:** "What could be improved?"

**Checkbox Options:**
- ☐ Content is unclear
- ☐ Too long or wordy
- ☐ Not relevant
- ☐ Language/tone issues

**Text Input:**
- "Other (optional)" - multiline text area
- Placeholder: "Tell us more..."

**Buttons:**
- "Cancel" (secondary) - closes modal without saving
- "Submit" (primary) - saves negative rating with reasons

**Behavior:**
- If user clicks Cancel: Don't save any rating, reset UI
- If user clicks Submit: Save negative rating with selected reasons, show thank you message

### 3. Database Integration

Use the existing Supabase tables created for the mobile app:

**Tables:**
- `app_devices` - For device tracking
- `app_reading_feedback` - For storing ratings

**CRITICAL: How Upsert Works**

The `app_reading_feedback` table has a **UNIQUE constraint** on `(reading_id, device_id)`. This means:
- Only ONE row can exist per device per reading
- When you call `upsert()` with `onConflict: 'reading_id,device_id'`:
  - If no row exists → INSERT new row
  - If row exists → UPDATE that existing row
- This is why users can change their ratings - it updates the same row instead of creating duplicates

**Database Constraint (already exists in Supabase):**
```sql
unique(reading_id, device_id)
```

This constraint ensures:
- Device A rating Reading 1 → 1 row
- Device A changing rating on Reading 1 → Same row updated
- Device A rating Reading 2 → New row (different reading)
- Device B rating Reading 1 → New row (different device)

**Device ID Management:**
For the website, generate and store a device ID:
```javascript
// Check localStorage for existing device_id
let deviceId = localStorage.getItem('daily_paths_device_id');

// If none exists, generate a UUID and store it
if (!deviceId) {
  deviceId = crypto.randomUUID();
  localStorage.setItem('daily_paths_device_id', deviceId);
  
  // Register in app_devices table
  await supabase.from('app_devices').insert({
    device_id: deviceId,
    platform: 'web',
    app_version: '1.0' // or get from your app config
  });
}
```

**On Page Load:**
```javascript
// Fetch existing rating for this reading from this device
const { data } = await supabase
  .from('app_reading_feedback')
  .select('rating')
  .eq('reading_id', currentReading.id)
  .eq('device_id', deviceId)
  .maybeSingle();

// If data exists, show the selected rating state
if (data) {
  setCurrentRating(data.rating); // 'positive', 'neutral', or 'negative'
}
```

**On Rating Click:**
```javascript
// For positive or neutral - CRITICAL: Use upsert with onConflict
const { error } = await supabase
  .from('app_reading_feedback')
  .upsert({
    device_id: deviceId,
    reading_id: currentReading.id,
    day_of_year: getDayOfYear(currentReading.date),
    reading_title: currentReading.title,
    rating: 'positive', // or 'neutral'
    updated_at: new Date().toISOString()
  }, {
    onConflict: 'reading_id,device_id'  // THIS IS CRITICAL!
  });

// The onConflict parameter tells Supabase:
// "If a row already exists with this reading_id AND device_id, UPDATE it"
// "Otherwise, INSERT a new row"

// This is why users can change their ratings without creating duplicates

// Show thank you message
setShowThankYou(true);
setTimeout(() => setShowThankYou(false), 2000);
```

**For Negative Rating (after modal submission):**
```javascript
// SAME PATTERN: Use upsert with onConflict
const { error } = await supabase
  .from('app_reading_feedback')
  .upsert({
    device_id: deviceId,
    reading_id: currentReading.id,
    day_of_year: getDayOfYear(currentReading.date),
    reading_title: currentReading.title,
    rating: 'negative',
    reason_unclear: reasons.unclear || false,
    reason_too_long: reasons.tooLong || false,
    reason_not_applicable: reasons.notApplicable || false,
    reason_language: reasons.language || false,
    reason_other_text: reasons.otherText || null,
    updated_at: new Date().toISOString()
  }, {
    onConflict: 'reading_id,device_id'  // MUST include this!
  });

// Without onConflict, you'd get database errors when trying to insert
// a second rating for the same reading from the same device
```

### 4. Helper Function for Day of Year

```javascript
function getDayOfYear(dateString) {
  const date = new Date(dateString);
  const start = new Date(date.getFullYear(), 0, 0);
  const diff = date - start;
  const oneDay = 1000 * 60 * 60 * 24;
  return Math.floor(diff / oneDay);
}
```

### 5. UI States & Behavior

**Initial Load:**
- Fetch existing rating for current device_id + reading_id
- If rating exists, show selected state
- If no rating, show default state

**After Rating:**
- Update UI immediately (optimistic update)
- Save to database in background
- Show "Thanks for your feedback! 💚" message
- Fade out thank you message after 2 seconds
- Keep selected rating visible

**Changing Rating:**
- User can click any button to change their rating
- Update database with new rating (upsert)
- Show thank you message again

**Navigation:**
- When user navigates to a different day/reading, fetch that reading's rating
- Reset UI to show new reading's rating state

### 6. Styling to Match Mobile App

Use the same color scheme from the mobile app:
```javascript
const colors = {
  deepTeal: '#1a5557',
  ocean: '#4a7c7e',
  seafoam: '#87b5b7',
  pearl: '#f8f9fa',
  mist: '#e5e9ec',
  ink: '#1f2937'
};
```

**Button Styles:**
- Default: White background, mist border, ocean icon color
- Selected: Deep teal background, white icon, thicker border
- Inactive (when another selected): 30% opacity
- Shadow: Subtle shadow on default, enhanced on selected

**Modal Styles:**
- Backdrop: rgba(0, 0, 0, 0.5)
- Container: White, rounded corners, centered
- Use existing modal component if available
- Match checkbox styling to mobile app

### 7. Error Handling

- If database save fails, revert UI to previous state
- Show error toast (optional): "Unable to save rating. Please try again."
- Log errors for debugging
- Ensure device_id is always available before attempting to save

### 8. Positioning on Page

Place the rating UI:
- **Option A (Recommended):** Right after the "Thought for the Day" box, before any footer
- **Option B:** In a fixed position at bottom of viewport (like mobile app action bar)
- **Option C:** As a floating card on the right side of the reading (desktop only)

Use Option A for consistency with mobile app placement.

## Implementation Checklist

- [ ] Add rating UI component below reading content
- [ ] Create negative feedback modal component
- [ ] Implement device_id management with localStorage
- [ ] Add Supabase queries for fetching existing ratings
- [ ] Add Supabase upsert for saving ratings
- [ ] Implement optimistic UI updates
- [ ] Add thank you message with fade animation
- [ ] Style buttons with selected/unselected states
- [ ] Handle rating changes (allow users to change their mind)
- [ ] Test with different readings to ensure rating persists per reading
- [ ] Add error handling for failed database operations
- [ ] Ensure works on mobile web browsers
- [ ] Match styling to mobile app design

## Testing

After implementation, test:
1. Rate a reading with thumbs up → Check database for entry
2. Refresh page → Verify rating state persists
3. Change rating to neutral → Verify database updates
4. Rate with thumbs down → Verify modal opens
5. Submit negative feedback with reasons → Verify all fields save
6. Navigate to different reading → Verify new rating state loads
7. Close negative modal with Cancel → Verify no rating saved
8. Test on mobile browser → Verify touch interactions work
9. Test with same device_id across browser sessions → Verify persistence

## Notes

- Use the same `app_reading_feedback` table as mobile app - no separate web table needed
- Device IDs from web will have `platform: 'web'` to differentiate from mobile
- Web and mobile ratings are separate (different device_ids) which is correct behavior
- If user rates on both web and mobile, both ratings are stored separately
- Admin feedback page will show all ratings regardless of platform

## HOW RATING UPDATES WORK (Important!)

### The Magic of Upsert with onConflict

**Without upsert (WRONG):**
```javascript
// This would fail with "duplicate key" error on second rating
await supabase.from('app_reading_feedback').insert({ ... });
```

**With upsert but no onConflict (WRONG):**
```javascript
// Supabase won't know which row to update - might create duplicates or fail
await supabase.from('app_reading_feedback').upsert({ ... });
```

**With upsert AND onConflict (CORRECT):**
```javascript
// Supabase knows: "Update the row where reading_id AND device_id match"
await supabase.from('app_reading_feedback').upsert({
  device_id: 'abc-123',
  reading_id: 'xyz-789',
  rating: 'positive'
  // ... other fields
}, {
  onConflict: 'reading_id,device_id'  // ← THIS IS THE KEY!
});
```

### What Happens Step by Step

**User rates Reading A for the first time:**
1. No row exists with this `(reading_id, device_id)` combination
2. Upsert sees no conflict → **INSERT** new row
3. Database now has 1 row

**User changes rating on Reading A from positive to negative:**
1. Row exists with this `(reading_id, device_id)` combination
2. Upsert detects conflict on unique constraint
3. Because of `onConflict: 'reading_id,device_id'` → **UPDATE** existing row
4. Database still has 1 row (same row, updated rating field)

**User rates Reading B:**
1. Different `reading_id`, so no conflict
2. Upsert → **INSERT** new row
3. Database now has 2 rows (one per reading)

### Why This Works

The database table has this constraint (already created):
```sql
unique(reading_id, device_id)
```

This means the database will REJECT any attempt to create a second row with the same `(reading_id, device_id)` pair.

By using `onConflict: 'reading_id,device_id'`, you're telling Supabase:
- "I know there might be a conflict"
- "If there is, update the existing row instead of failing"
- "Use these two columns to identify which row to update"

### Mobile App Implementation (Reference)

This is exactly how the mobile app does it (from `hooks/useReadingFeedback.ts`):

```typescript
const { error } = await supabase
  .from('app_reading_feedback')
  .upsert(feedbackData, {
    onConflict: 'reading_id,device_id',
  });
```

**Implement it exactly the same way on the website!**

