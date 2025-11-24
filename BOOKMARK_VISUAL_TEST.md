# Quick Visual Test Guide

## How to Test the Fixes

### 1. Test Glassmorphism Effect on Instruction Overlay

**Steps:**
```bash
# In your terminal/console
AsyncStorage.removeItem('@daily_paths_bookmark_instruction_seen')
```

Then restart the app.

**What to Look For:**
- [ ] Overlay appears in center of screen
- [ ] Background behind overlay is blurred (glassmorphism)
- [ ] Overlay has white border outline (1px, semi-transparent)
- [ ] Overlay background is semi-transparent white
- [ ] Text is dark gray and readable
- [ ] "Got it" button is dark green
- [ ] Overall effect is polished and modern

**If blur doesn't work:**
- Check if `expo-blur` is installed: `npm list expo-blur`
- Rebuild the app: `expo start -c`

---

### 2. Test Bookmark Ribbon Visibility

**Steps:**
1. Open the app
2. View any reading
3. Long press (hold) on the reading text for 600ms (less than 1 second)
4. Keep holding until you see the toast message

**What to Look For:**
- [ ] Background turns light gray while pressing
- [ ] After 600ms, toast appears: "Bookmark added"
- [ ] Small ribbon appears on the calendar card
- [ ] Ribbon is on the RIGHT SIDE of the calendar
- [ ] Ribbon is dark green (matches "NOVEMBER" background)
- [ ] Ribbon is about 14px wide and 22px tall
- [ ] Ribbon has a V-shaped notch at the bottom
- [ ] Ribbon has a subtle shadow

**Ribbon Position:**
```
┌──────────────────┐
│   NOVEMBER    █║ │ ← Ribbon here on the right
├───────────────█║─┤
│             █║   │
│      24     █║   │ ← Extends down into white area
│             █▼   │ ← V-shaped notch at bottom
└──────────────────┘
```

**Console Check:**
Open your console/terminal and you should see:
```
ReadingScreen: Bookmark toggled to: true
```

---

### 3. Test Bookmark Ribbon Persistence

**Steps:**
1. Bookmark a reading (ribbon appears)
2. Tap the left arrow to go to previous date
3. Ribbon should disappear (different date, not bookmarked)
4. Tap right arrow to return to bookmarked date
5. Ribbon should reappear

**What to Look For:**
- [ ] Ribbon appears/disappears as you change dates
- [ ] Ribbon only shows on bookmarked dates
- [ ] Ribbon position is consistent

---

### 4. Test Bookmark Toggle

**Steps:**
1. Bookmark a reading (ribbon appears)
2. Long press again
3. Toast should say "Bookmark removed"
4. Ribbon should disappear
5. Long press again
6. Toast should say "Bookmark added"
7. Ribbon should reappear

**Console Check:**
```
ReadingScreen: Bookmark toggled to: false
ReadingScreen: Bookmark toggled to: true
```

---

## Troubleshooting

### Instruction Overlay Issues

**Problem**: No blur effect
- **Solution**: Make sure `expo-blur` is installed
- Run: `npm install expo-blur`
- Restart: `expo start -c`

**Problem**: No border outline
- **Check**: Look closely - it's subtle (white, semi-transparent)
- **Try**: Dark mode or dark background to see it better

### Bookmark Ribbon Issues

**Problem**: No ribbon appears
- **Check Console**: Look for "ReadingScreen: Bookmark toggled to: true"
- **If missing**: The toggle isn't working - check long press (hold for full 600ms)
- **If present**: The ribbon is rendering but may be hidden

**Problem**: Ribbon is clipped/cut off
- **Check**: The wrapper should have `overflow: visible`
- **Verify**: Ribbon is outside `calendarCard` but inside `calendarCardWrapper`

**Problem**: Ribbon position is wrong
- **Expected**: Right side of calendar, starting at top of white area
- **Check**: `top: 20` and `right: 12` in styles

---

## Quick Visual Checklist

Run through these quick checks:

### Instruction Overlay
- [ ] Has blurred background (glassmorphism)
- [ ] Has white border outline
- [ ] Text is readable
- [ ] Button is dark green
- [ ] Shows only once

### Bookmark Ribbon
- [ ] Appears when bookmarked
- [ ] Dark green color
- [ ] Right side of calendar
- [ ] V-shaped notch at bottom
- [ ] Has shadow
- [ ] Disappears when unbook marked
- [ ] Persists across navigation

---

## Screenshot Locations

Take screenshots of:
1. Instruction overlay (first launch)
2. Calendar with bookmark ribbon visible
3. Calendar without bookmark ribbon
4. Toast notification appearing

This will help verify all visual elements are correct!

---

**All working?** 🎉 You're done!

**Still having issues?** Check the console logs and verify the state changes.

