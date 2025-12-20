# Admin Feedback Page - Update Instructions

## Problem with Current Implementation

The current admin page needs to be redesigned to focus on a **per-reading workflow** where I can see feedback for each reading and directly edit the reading content based on that feedback.

## Updated Requirements

### Main Page Layout: Per-Reading List with Feedback

The main view should be a **list of readings** (one per row) with feedback displayed inline. Each row should show:

**Reading Information:**
- Day of year (e.g., "Day 342")
- Reading title (prominent, clickable)
- Date (e.g., "December 8")

**Feedback Summary (inline in the row):**
- Total ratings count (e.g., "12 ratings")
- Visual rating breakdown: 
  - 👍 5 positive (42%)
  - 👌 4 neutral (33%)
  - 👎 3 negative (25%)

**Action Buttons (right side of row):**
- "View Feedback" button → Opens feedback details modal
- "Edit Reading" button → Opens reading editor
- Priority indicator (e.g., red flag if >30% negative, yellow if >20% negative)

### Sort/Filter Options (Top of Page)

- **Sort by:**
  - Most negative feedback % (default)
  - Most total ratings
  - Day of year
  - Most recent feedback
- **Filter by:**
  - Only show readings with feedback
  - Only show readings with negative feedback
  - Minimum feedback count (e.g., 3+ ratings)

### Feedback Details Modal

When clicking "View Feedback" on a reading, show a modal/side panel with:

**Reading Context (top of modal):**
- Full reading title
- Day of year
- Current content preview (first 150 characters)

**Feedback Breakdown:**

1. **Rating Summary**
   - Positive: 5 (42%)
   - Neutral: 4 (33%)
   - Negative: 3 (25%)

2. **Negative Feedback Reasons** (if any negative ratings)
   - ☐ Content is unclear: 2 people
   - ☐ Too long or wordy: 1 person
   - ☐ Not relevant: 0 people
   - ☐ Language/tone issues: 1 person
   - 💬 Other comments:
     - "The connection to recovery wasn't clear" (Dec 8, 3:45pm)
     - "Too focused on one specific situation" (Dec 7, 10:23am)

3. **Recent Feedback Timeline**
   - Dec 8, 3:45pm: 👎 Negative (unclear, other)
   - Dec 8, 11:20am: 👍 Positive
   - Dec 7, 10:23am: 👎 Negative (other)
   - Dec 7, 8:15am: 👌 Neutral
   - Dec 6, 9:00pm: 👍 Positive
   - (show last 10-15)

**Action at Bottom of Modal:**
- "Edit This Reading" button (primary CTA) → Opens reading editor
- "Dismiss" button → Closes modal

### Reading Editor

When clicking "Edit Reading" (from list or from feedback modal), open the reading editor:

**Editor Layout:**
- Side-by-side view (if screen is wide enough):
  - LEFT: Feedback summary (same as modal, but condensed)
  - RIGHT: Editable reading fields

**Editable Fields:**
- Title
- Opening text
- Body paragraphs
- Application text
- Quote
- Thought for the Day

**Editor Actions:**
- "Save Changes" button → Updates reading in database
- "Cancel" button → Discards changes
- "View Live Reading" button → Opens reading in app view
- Indication of last edited date/time

**After Saving:**
- Show success message
- Option to "Mark feedback as addressed" (optional feature)
- Return to main list

## Updated Queries Needed

### Main list with feedback per reading:
```sql
SELECT 
  r.id,
  r.title,
  r.day_of_year,
  r.date,
  r.opening,
  r.body,
  r.application,
  r.quote,
  r.thought_for_day,
  COUNT(f.id) as total_ratings,
  COUNT(*) FILTER (WHERE f.rating = 'positive') as positive_count,
  COUNT(*) FILTER (WHERE f.rating = 'neutral') as neutral_count,
  COUNT(*) FILTER (WHERE f.rating = 'negative') as negative_count,
  ROUND(100.0 * COUNT(*) FILTER (WHERE f.rating = 'negative') / NULLIF(COUNT(f.id), 0), 1) as negative_pct,
  MAX(f.created_at) as most_recent_feedback
FROM readings r
LEFT JOIN app_reading_feedback f ON r.id = f.reading_id
GROUP BY r.id, r.title, r.day_of_year, r.date, r.opening, r.body, r.application, r.quote, r.thought_for_day
HAVING COUNT(f.id) >= 3  -- Only show readings with 3+ ratings
ORDER BY negative_pct DESC NULLS LAST, total_ratings DESC;
```

### Detailed feedback for a specific reading:
```sql
SELECT 
  f.id,
  f.rating,
  f.reason_unclear,
  f.reason_too_long,
  f.reason_not_applicable,
  f.reason_language,
  f.reason_other_text,
  f.created_at,
  d.platform
FROM app_reading_feedback f
LEFT JOIN app_devices d ON f.device_id = d.device_id
WHERE f.reading_id = :reading_id
ORDER BY f.created_at DESC;
```

### Update reading content:
```sql
UPDATE readings
SET 
  title = :title,
  opening = :opening,
  body = :body,
  application = :application,
  quote = :quote,
  thought_for_day = :thought_for_day,
  updated_at = now()
WHERE id = :reading_id
RETURNING *;
```

## Key Workflow

The admin experience should be:

1. **Land on page** → See list of readings sorted by worst feedback
2. **Scan the list** → Quickly identify which readings need attention (red flags, high negative %)
3. **Click "View Feedback"** → See detailed breakdown of why users didn't like it
4. **Click "Edit Reading"** → Make improvements based on feedback
5. **Save changes** → Reading is updated in database
6. **Repeat** for next reading needing attention

## UI/UX Updates

- **Focus on efficiency**: Minimize clicks to get from feedback → editing
- **Context is king**: Always show feedback when editing
- **Visual priority**: Use color coding (red/yellow/green) to show which readings need attention most
- **Inline actions**: Put "Edit" buttons everywhere for quick access
- **Keyboard shortcuts** (optional): 'E' to edit, 'Esc' to close modals
- **Auto-save drafts** (optional): Save editor state in localStorage

## Mobile Responsive

- On mobile/tablet: Stack feedback and editor vertically
- Condensed view: Show fewer details in the list, expand on tap
- Swipe actions (optional): Swipe right on reading to edit, left to view feedback

## Notes

- The current Supabase connection should already have access to the `readings` table for editing
- Make sure to handle rich text/multiline content properly in the editor
- Consider adding markdown support if readings use markdown
- Keep feedback visible while editing so I can reference it
- Don't delete feedback when a reading is edited - keep it for historical context

## Implementation Priority

1. First: Build the per-reading list with inline feedback summary
2. Second: Add "View Feedback" modal with detailed breakdown
3. Third: Integrate reading editor with save functionality
4. Optional: Add "mark as addressed" feature to track which readings have been reviewed



