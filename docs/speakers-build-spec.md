# Speakers Feature — Build Spec

## Overview

Add a Speakers screen to the app for browsing and playing Al-Anon speaker recordings. Audio files are M4A hosted in Supabase Storage. Metadata is in the `speakers` table. This is a read-only feature — no user-generated content.

---

## Data Source

**Table:** `speakers` (already created in Supabase)

**Fields:**
- `id` (uuid)
- `speaker` (text) — name, e.g. "Linda M."
- `hometown` (text, nullable) — e.g. "Salt Lake City, UT"
- `meeting` (text) — e.g. "SNL AA Speaker Meeting"
- `date` (date) — recording date
- `title` (text) — talk title
- `subtitle` (text) — one-sentence description of the talk
- `core_themes` (text) — comma-separated, e.g. "Control, Fear, Family"
- `explicit` (boolean) — content warning flag
- `youtube_id` (text) — used for audio filename
- `youtube_url` (text) — original YouTube link (not used in app)
- `audio_url` (text) — full Supabase Storage URL to M4A file
- `quote` (text, nullable) — pull quote from the talk

**Storage bucket:** `speaker-audio` (public)
**File naming:** `{youtube_id}.m4a`

---

## Navigation

**Change bottom nav from 4 tabs to 4 tabs (swap):**
- Before: Today | Journal | Prayers | Settings
- After: Today | Journal | Speakers | Settings
- Prayers moves into Settings/More as a menu item

Speakers tab uses a microphone icon.

---

## Screen 1: Speakers Browse

This is what the user sees when tapping the Speakers tab.

### Layout (top to bottom)

1. **Header:** "Speakers" title with microphone icon (same header style as Journal and Today screens)

2. **Search bar:** Text input with search icon, placeholder "Search speakers..."
   - Searches across: speaker name, title, subtitle, quote, core_themes
   - Filter results as user types
   - Clear button when text is entered

3. **Sort toggle:** Three text buttons in a row, centered
   - **Newest** (default) — sort by date descending
   - **Oldest** — sort by date ascending
   - **A–Z** — sort by speaker name alphabetically
   - Active sort has visual indicator (underline or similar)

4. **Speaker card list:** Scrollable list of cards
   - Each card shows:
     - Top accent border (thin horizontal line, like journal entry cards)
     - Type label row: microphone icon + "AL-ANON SPEAKER" in small caps
     - Speaker name (largest text, bold)
     - Hometown (smaller, muted — skip this line if null)
     - Title (medium text, italic)
     - Quote (one line, truncated — skip if null)
     - Explicit badge: small "E" badge, only shown when `explicit === true`
   - Right side of card: circular play button (outlined, with play triangle)
   - Tapping the card opens the detail screen
   - Tapping the play button starts playback AND opens the detail screen

### Data fetching
- Fetch all speakers on mount (only ~13-20 records)
- No pagination needed at this scale
- Cache locally for the session

---

## Screen 2: Speaker Detail / Player

Opens when user taps a card on the browse screen.

### Layout (top to bottom)

1. **Header area:**
   - Back button: "← Back" or just "←" (returns to browse)
   - Speaker name (large, prominent)
   - Hometown below name (smaller, muted — skip if null)

2. **Accent strip:** Thin horizontal line below header (same pattern as journal forms)

3. **Content area** (scrollable):
   - **Title** (large, italic)
   - **Subtitle** (body text, the one-sentence talk description)
   - **Quote block** (if quote exists):
     - Tinted background card
     - Quote text in serif italic
   - **Meta row:**
     - Recorded date (formatted: "November 22, 2025")
     - Explicit badge if applicable

4. **Player card:**
   - **Now Playing indicator:** animated equalizer bars (3-5 thin bars bouncing) + "Now Playing" label when playing. Shows "Paused" with static bars when paused.
   - **Progress bar:**
     - Track with fill and draggable thumb
     - Current time on left, total duration on right
     - Tapping/dragging seeks to position
   - **Transport controls** (centered row):
     - Skip back 15 seconds (icon + "15s" label)
     - Play/Pause button (large circle, centered)
     - Skip forward 30 seconds (icon + "30s" label)
   - **Speed selector:** Row of buttons
     - 0.75× | 1× | 1.25× | 1.5×
     - 1× is default
     - Active speed has filled/highlighted state

### Audio behavior
- Use `expo-av` Audio.Sound for playback
- Enable background audio: `Audio.setAudioModeAsync({ staysActiveInBackground: true, playsInSilentModeOnIOS: true })`
- Audio continues when screen is locked or app is backgrounded
- Lock screen controls (play/pause, skip) via expo-av's built-in support
- When navigating away from detail screen: audio stops (v1 — no persistent mini-player)
- Handle loading state (show spinner while audio loads)
- Handle errors gracefully (show message if audio fails to load)

### Playback state
- Play/pause toggles the icon and equalizer animation
- Progress bar updates in real-time during playback
- Speed change takes effect immediately
- If user tapped play button on browse card, audio should auto-play when detail screen opens

---

## What NOT to Build

- No download/offline support
- No favorites or bookmarks (v1)
- No persistent mini-player on other screens
- No streaming progress save (resumes from beginning each time)
- No comments or user interaction with speakers
- No admin/upload interface (content managed directly in Supabase)

---

## Files to Create

- `screens/SpeakersScreen.tsx` — Browse screen with search, sort, card list
- `screens/SpeakerDetailScreen.tsx` — Detail view with content + player
- `components/SpeakerCard.tsx` — Individual card component for browse list
- `components/SpeakerPlayer.tsx` — Audio player controls component

---

## Style Notes

Match the existing app design system. Reference the Journal timeline and form screens for patterns:
- Header style should match Journal and Today headers
- Card style should match journal entry cards (top accent border, type label, content hierarchy)
- Button and input styles should use existing app components/stylesheets
- Typography hierarchy should follow established patterns (serif italic for titles, sans-serif for body)
- The Speakers feature gets its own accent color to distinguish it from Journal entry types — choose something that complements the existing palette without clashing
