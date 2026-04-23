# Daily Paths Plus - Project Specification

## Overview
Transitioning Daily Paths from $3.99 one-time purchase to subscription model with premium features. Core addition is a comprehensive journal toolkit designed specifically for Al-Anon recovery.

---

## Business Model

### Pricing
- **Monthly:** $3.99/month
- **Annual:** $29.99/year (save $18, ~37% discount)
- **14-day free trial**
- **No lifetime option** (can add later if needed)

### Existing Users
- **~current paid users** get lifetime Plus access free via revenuecat entitlement
- Shows appreciation for early support
- Announced 60 days before subscription launch

## MVP Feature Set

### 1. Daily Reader (Existing)
- All 366 original reflections
- Bookmarking, sharing
- Daily reminders
- Dark mode

### 2. Journal (NEW - Core Feature)
**Entry Creation:**
- Immediate blank page on open (no friction)
- Free-form writing (no tags)
- "Questions to ask myself" link opens accordion
- Bottom bar: `[Cancel]` `[Save]`
- No auto-save (user controls when to commit)

**Questions to Ask Myself:**
Five categories (accordion): 
There will revision and finetuning to these categories and questions.  Make them a file that can be edited.
1. **Control & Powerlessness** (4 questions)
   - Where am I trying to control what I can't control?
   - What am I afraid will happen if I let go?
   - What would change if I accepted powerlessness here?
   - If this situation never changes, what needs to change in me?

2. **My Part** (4 questions)
   - What's my part in this?
   - How am I making this about me when it's not about me?
   - What am I getting out of staying in this pattern?
   - Am I responding or reacting?

3. **Fear & Resentment** (3 questions)
   - What am I really afraid of here?
   - Where is my fear hiding in this resentment?
   - What's the cost of holding onto this?

4. **Acceptance & Growth** (4 questions)
   - What do I need to accept that I'm refusing to accept?
   - What does "detachment with love" look like right now?
   - What would it look like to trust the process here?
   - What is this situation teaching me?
   
5. **Nightly Review
    - tbd

**Timeline View:**
- Stats bar: "47 this month, 12 this week, 3 today"
- Persistent buttons: `[+ New Entry]` `[🔍 Search]`
- Entries truncated (2-3 lines)
- Tap to open full entry
- Trash icon on each card

**Entry Detail View:**
- **Read mode:**
  - Top: `← Back` | `🗑️ Delete`
  - Bottom: `[← Prev]` `[Next →]`
  - Tap in text to edit
  
- **Edit mode:**
  - Top: `← Back` | `🗑️ Delete` (unchanged)
  - Bottom: `[Discard]` `[Save]` (replaces Prev/Next)
  - No "Questions to ask myself" in edit mode
  - Save keeps original timestamp

**Features:**
- Unlimited entries
- Search all entries
- Edit/delete any entry
- Progress stats
- No tags (just free-form)

### 3. Gratitude List (Port from Sober Dailies)
- Daily gratitude entries
- Daily Gratitude Quote - content in table in Supabase
- History view


### 4. Prayers Page
- Serenity Prayer
- Al-Anon prayers collection
- Personal prayer notes space
- Static content (easy to implement)

### 5. Sync & Backup
- Cross-device sync (iPhone, iPad)
- Cloud storage via Supabase
- Essential for subscription model
- User account and password, Google, Apple ID login

### 6. Export
- Export journal to PDF
- Email entries
- Essential for data ownership

### 7. Progress Stats
- Journal entries this month/week
- Streak tracking
- **Feeds into rating modal** (important for conversion)

---

## NOT in MVP

### Step Work (Phase 2)
- Too complex for MVP
- Will use NotebookLM + Paths to Recovery to generate questions
- 12 Steps, 5-7 questions each
- Progress tracking
- Major feature release 3-6 months post-launch
- Potential to justify price increase ($34.99/year for new users)

---

## Navigation Structure

### Bottom Nav
```
📖 Today  |  ✍️ Journal  |  🪜 Steps (future)  |  ⚙️ More
```

### Journal Navigation
- Timeline is separate layer from individual entries
- `← Back` is only way to return to timeline
- `Prev/Next` stays within entry navigation
- Clean separation of concerns

### No Journal Button on Reading Page
- Keep daily reading focused
- Journal is accessed via bottom nav
- Separate practices, not integrated

---

## Rating/Review Strategy

### Custom Modal (Not Apple Native)
**Trigger Conditions:**
- 7 days used OR
- 3+ bookmarks OR
- 10+ app opens
- Not shown if already rated
- Min 30 days between prompts

**Dynamic Messaging:**
Uses actual user stats:
```
"You've read Daily Paths for 15 days! 🌟

If it's been helpful in your Al-Anon 
journey, would you rate it?

Your rating helps others discover 
Daily Paths."

[Yes, I'll rate it]
[Maybe later]
[Already rated]
```

**On "Yes":**
- Deep link directly to App Store rating page
- Analytics track: `Rating_Yes` with stats
- Don't show again for 90 days

**On "Maybe later":**
- Analytics track: `Rating_Later`
- Show again in 30 days

**On "Already rated":**
- Analytics track: `Rating_Already`
- Never show again

**Why Custom vs Apple Native:**
- Full control over timing
- Can track metrics
- Al-Anon-specific messaging
- Evidence-based (show stats)
- Higher conversion (2-3x better)

---

## Database Schema

### Journal Entries
```sql
journal_entries
- id (uuid)
- user_id (uuid)
- content (text)
- created_at (timestamp)
- updated_at (timestamp)
```

### Gratitude Entries
```sql
gratitude_entries
- id (uuid)
- user_id (uuid)
- items (jsonb) -- array of gratitude items
- created_at (timestamp)
```

### User Preferences
```sql
user_preferences
- user_id (uuid)
- has_rated (boolean)
- last_rating_prompt (timestamp)
- days_used (integer)
- total_readings (integer)
- bookmarks_count (integer)
- app_opens (integer)
```

### Future: Step Work (Phase 2)
```sql
step_work
- id (uuid)
- user_id (uuid)
- step_number (1-12)
- question_number (1-7)
- response_text (text)
- created_at (timestamp)
- updated_at (timestamp)
```

---

## User Experience Flows

### Save/Cancel Logic

**Save Button:**
- Has content → saves and returns to timeline
- Blank entry → "Nothing to save" popup, return to timeline

**Cancel Button:**
- Blank entry → returns to timeline (no popup)
- Has content → "Discard this entry?" popup
  - `[Keep Writing]` stays on screen
  - `[Discard]` deletes and returns to timeline

### Edit Entry Logic
- No separate "Edit" button
- Tap in text to start editing
- Once editing: Prev/Next disappear, Discard/Save appear
- Save commits changes (keeps original timestamp)
- Discard reverts changes (with confirmation if unsaved)

---

## Design Philosophy

### Core Principles
- **Daily practice tool** 
- Help users go deeper in reflection
- Evidence of progress over time
- No over-engineering
- User controls everything (no auto-save surprises)

### Al-Anon Voice
- Contemplative, honest, vulnerable
- Service-oriented ("help other members find us")
- Not gimmicky or sales-y
- "Attraction not promotion"
- Professional and clean

### UI Aesthetic
- Serene waters palette: deep teal (#2C5F5D), seafoam, pearl
- Typography: Cormorant Garamond italic (titles), Inter (body)
- Minimal but not sterile
- Breathing room
- Gentle animations
- Will need to be setup so we can apply the themes for design
---

## Competitive Landscape

### Current Al-Anon Apps
1. **Official Al-Anon App** - Free, website wrapper
2. **Today's Hope** - Free, 32 ratings, abandoned (last update 1 year ago)
3. **Speaker Tapes** - $3.99/month for 100 recordings (collected from web)
4. **AA Spiritual Toolkit** - Retitled, not Al-Anon specific

### Your Position
- **Only serious Al-Anon app** with active development
- **Original content** (366 reflections you wrote)
- **Complete toolkit** (reader + journal + practices)
- **Category leader** by default (minimal competition)
- $3.99/month is justified and competitive

---

## Technical Stack

### Current
- React Native with Expo SDK
- Supabase (backend, auth, database)
- Anonymous auth with optional email signup
- PostHog (analytics)

### New Requirements
- Subscription management - RevenueCat
- Trial period handling
- Cross-device sync (already supported via Supabase)
- PDF generation for export
- Deep linking (for App Store ratings)

---

## Version History
- **v1.0:** Initial release (daily reader, $3.99 one-time)
- **v1.1.0:** Dark mode, notifications, analytics
- **v2.0:** Plus subscription launch (this document)
- **v2.5:** Step Work feature (planned)

---

*Last Updated: February 5, 2026*
