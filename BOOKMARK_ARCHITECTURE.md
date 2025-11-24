# Bookmark Feature - Visual Component Map

## Component Architecture

```
app/index.tsx (Main Container)
├── ReadingScreen (Reading Display + Long Press)
│   ├── Header (with Calendar)
│   │   └── BookmarkRibbon (Conditional - when bookmarked)
│   ├── Pressable (Long Press Detection)
│   │   └── ScrollView (Reading Content)
│   ├── ActionBar (Bottom Navigation)
│   │   ├── Bookmarks Button ← Opens BookmarkListModal
│   │   ├── Highlight Button
│   │   ├── Share Button
│   │   └── Settings Button
│   ├── BookmarkToast (Floating Notification)
│   └── BookmarkInstructionOverlay (First-Time Only)
│
├── DatePickerModal (Date Selection)
└── BookmarkListModal (Bookmark List)
```

## State Flow

```
┌─────────────────┐
│  User Action    │
│  (Long Press)   │
└────────┬────────┘
         │
         ↓
┌─────────────────────────┐
│  handlePressIn          │
│  - Set isPressing       │
│  - Start 600ms timer    │
└────────┬────────────────┘
         │
         ↓ (600ms elapsed)
┌─────────────────────────┐
│  handleBookmarkToggle   │
│  - Call toggleBookmark  │
│  - Update local state   │
│  - Show toast           │
└────────┬────────────────┘
         │
         ↓
┌─────────────────────────┐
│  useBookmarkManager     │
│  - toggleBookmarkStorage│
│  - Update AsyncStorage  │
│  - Refresh bookmarks    │
└────────┬────────────────┘
         │
         ↓
┌─────────────────────────┐
│  UI Updates             │
│  - Ribbon shows/hides   │
│  - Toast animates       │
│  - Instruction dismisses│
└─────────────────────────┘
```

## Data Structure

### AsyncStorage Keys
```javascript
@daily_paths_bookmarks
  → Array<BookmarkData>
  
@daily_paths_bookmark_instruction_seen
  → "true" | null
```

### BookmarkData Interface
```typescript
{
  date: string;        // "2024-12-07" (YYYY-MM-DD)
  readingId: string;   // UUID from database
  title: string;       // Reading title
  timestamp: number;   // Unix timestamp for sorting
}
```

## Layout Details

### Calendar with Bookmark Ribbon

```
┌─────────────────────┐
│     NOVEMBER        │ ← Dark green background
│                   ┃ │ ← Bookmark ribbon (14×22px)
├─────────────────────┤   extends down into white area
│                     │
│         24          │ ← White/blur background
│                     │
└─────────────────────┘
```

### Long Press Visual Feedback

```
Before Press:
┌─────────────────────────┐
│ Reading Text            │ ← Pearl background (#F7FAFA)
│                         │
│ Lorem ipsum dolor...    │
└─────────────────────────┘

During Press (600ms):
┌─────────────────────────┐
│ Reading Text            │ ← Light gray (#f9fafb)
│                         │
│ Lorem ipsum dolor...    │
└─────────────────────────┘

After Press:
┌─────────────────────────┐
│    [Toast Center]       │ ← Appears in center
│  ┌──────────────────┐   │
│  │ 📑 Bookmark added│   │ ← Dark overlay
│  └──────────────────┘   │
└─────────────────────────┘
```

## Component Props Flow

### ReadingScreen Props
```typescript
reading: DailyReading          ← From useReading hook
isBookmarked: boolean          ← From useBookmarkManager
onBookmarkToggle: () => Promise<void>  ← Triggers storage update
showInstruction: boolean       ← From local state
onDismissInstruction: () => void  ← Marks as seen
onOpenBookmarks: () => void    ← Opens bookmark list
```

### BookmarkListModal Props
```typescript
visible: boolean               ← Controls modal visibility
bookmarks: BookmarkData[]      ← From useBookmarkManager
onClose: () => void           ← Dismisses modal
onSelectBookmark: (date) => void  ← Navigates to date
```

## Animation Timeline

### Long Press Flow
```
0ms    → User touches down (onPressIn)
       → Background starts changing
       → Timer starts
       
600ms  → Timer completes
       → Toggle bookmark
       → Background returns to normal
       
700ms  → Toast fades in (200ms animation)
       
2200ms → Toast fades out (200ms animation)
       
2400ms → Toast removed from DOM
```

### Modal Slide-Up
```
0ms    → Modal visible=true
       → Backdrop fades in
       → Modal starts at translateY(600)
       
300ms  → Spring animation completes
       → Modal at translateY(0)
```

## File Organization

```
daily-paths/
├── app/
│   └── index.tsx                    (Main app logic)
│
├── components/
│   ├── BookmarkInstructionOverlay.tsx  (First-time help)
│   ├── BookmarkListModal.tsx           (Bookmark browser)
│   ├── BookmarkToast.tsx               (Feedback message)
│   ├── DatePickerModal.tsx             (Existing)
│   └── ReadingScreen.tsx               (Main reading view)
│
├── hooks/
│   ├── useBookmarkManager.ts           (NEW - Main bookmark logic)
│   ├── useBookmark.ts                  (Existing - Supabase)
│   ├── useReading.ts                   (Existing)
│   └── useAvailableDates.ts            (Existing)
│
├── utils/
│   ├── bookmarkStorage.ts              (NEW - AsyncStorage helpers)
│   └── dateUtils.ts                    (Existing)
│
└── constants/
    └── theme.ts                        (Existing - Colors & fonts)
```

## Color Palette Used

```css
/* Bookmark Elements */
Ribbon:       rgba(90, 124, 126, 1)   /* Dark green */
Button:       rgba(90, 124, 126, 1)   /* Same as ribbon */

/* Toast */
Background:   rgba(0, 0, 0, 0.85)     /* Dark overlay */
Text:         #fff                     /* White */

/* Instruction Overlay */
Background:   rgba(255, 255, 255, 0.25)  /* Glassmorphism */
Border:       rgba(255, 255, 255, 0.4)   /* Light border */
Text:         #2d3748                    /* Dark gray */

/* Long Press Feedback */
Normal:       #F7FAFA                  /* Pearl */
Pressing:     #f9fafb                  /* Light gray */

/* Theme Colors (from constants) */
deepTeal:     #2C5F5D                  /* Headers */
ocean:        #4A8B8D                  /* Accents */
pearl:        #F7FAFA                  /* Background */
```

## Key Interactions

1. **Long Press** → Toggles bookmark, shows toast
2. **Tap Calendar** → Opens date picker (existing)
3. **Tap Bookmarks Icon** → Opens bookmark list
4. **Tap Bookmark in List** → Navigates to that date
5. **Tap "Got it"** → Dismisses instruction forever
6. **Start Long Press** → Auto-dismisses instruction

## Performance Notes

- Toast uses `Animated.Value` for smooth animations
- Modal uses spring animation for natural feel
- AsyncStorage operations are async to prevent blocking
- Long press timer is properly cleaned up on unmount
- Scrolling is disabled during long press to prevent conflicts

---

This visual guide should help you understand how all the components work together! 🎯

