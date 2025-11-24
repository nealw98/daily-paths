# Bookmark Feature - Testing Checklist

## ✅ Manual Testing Guide

### 1. Initial Setup Tests

#### Test 1.1: First Launch Experience
- [ ] Open app for the first time (clear AsyncStorage if needed)
- [ ] Verify instruction overlay appears centered on screen
- [ ] Verify overlay has glassmorphism styling (semi-transparent white)
- [ ] Verify text reads "👆 Long press the reading to bookmark"
- [ ] Verify "Got it" button is visible with dark green background

#### Test 1.2: Instruction Dismissal - Button
- [ ] Tap "Got it" button
- [ ] Verify overlay disappears
- [ ] Close and reopen app
- [ ] Verify overlay does NOT appear again

#### Test 1.3: Instruction Dismissal - Auto (Reset AsyncStorage first)
- [ ] Clear AsyncStorage to reset instruction
- [ ] Open app, see instruction overlay
- [ ] Long press on reading text (hold for 600ms)
- [ ] Verify overlay disappears automatically
- [ ] Close and reopen app
- [ ] Verify overlay does NOT appear again

---

### 2. Long Press Gesture Tests

#### Test 2.1: Basic Long Press - Add Bookmark
- [ ] View any reading (without bookmark)
- [ ] Long press anywhere on reading text for 600ms+
- [ ] During press: verify background changes to light gray (#f9fafb)
- [ ] After 600ms: verify background returns to normal
- [ ] Verify toast appears saying "Bookmark added"
- [ ] Verify bookmark ribbon appears on calendar month section
- [ ] Verify ribbon is dark green, 14px wide, 22px tall
- [ ] Verify ribbon hangs from bottom right of month section

#### Test 2.2: Long Press - Remove Bookmark
- [ ] On a bookmarked reading (ribbon visible)
- [ ] Long press on reading text for 600ms+
- [ ] Verify toast says "Bookmark removed"
- [ ] Verify bookmark ribbon disappears

#### Test 2.3: Short Press (Cancel)
- [ ] Start pressing on reading text
- [ ] Release before 600ms (e.g., at 300ms)
- [ ] Verify bookmark does NOT toggle
- [ ] Verify toast does NOT appear
- [ ] Verify background returns to normal

#### Test 2.4: Press and Scroll (Cancel)
- [ ] Start pressing on reading text
- [ ] Try to scroll before 600ms
- [ ] Verify long press cancels
- [ ] Verify bookmark does NOT toggle

#### Test 2.5: Multiple Rapid Long Presses
- [ ] Long press to add bookmark (wait for completion)
- [ ] Immediately long press again to remove
- [ ] Immediately long press again to add
- [ ] Verify each toggle works correctly
- [ ] Verify toast appears for each action
- [ ] Verify ribbon updates correctly each time

---

### 3. Toast Notification Tests

#### Test 3.1: Toast Appearance
- [ ] Trigger a bookmark toggle
- [ ] Verify toast appears in center of screen
- [ ] Verify toast has dark background rgba(0, 0, 0, 0.85)
- [ ] Verify toast has white text
- [ ] Verify bookmark icon appears
- [ ] Verify text is either "Bookmark added" or "Bookmark removed"

#### Test 3.2: Toast Animation
- [ ] Trigger a bookmark toggle
- [ ] Verify toast fades in smoothly (200ms)
- [ ] Verify toast stays visible for ~1.5 seconds
- [ ] Verify toast fades out smoothly (200ms)
- [ ] Verify toast disappears completely after animation

#### Test 3.3: Toast During Rapid Toggles
- [ ] Toggle bookmark quickly multiple times
- [ ] Verify only one toast shows at a time
- [ ] Verify latest message is displayed

---

### 4. Bookmark Ribbon Tests

#### Test 4.1: Ribbon Visibility
- [ ] Navigate to unbookmarked reading → no ribbon
- [ ] Toggle bookmark → ribbon appears
- [ ] Navigate to different reading → ribbon disappears
- [ ] Navigate back to bookmarked reading → ribbon appears

#### Test 4.2: Ribbon Styling
- [ ] Verify ribbon width is 14px
- [ ] Verify ribbon height is 22px
- [ ] Verify ribbon color is rgba(90, 124, 126, 1) (dark green)
- [ ] Verify ribbon has drop shadow
- [ ] Verify ribbon position is bottom: -18px, right: 12px
- [ ] Verify ribbon has rounded bottom corners

#### Test 4.3: Ribbon Position
- [ ] Verify ribbon hangs from month section ("NOVEMBER")
- [ ] Verify ribbon extends into the white date area below
- [ ] Verify ribbon doesn't overlap with month text
- [ ] Verify ribbon is visible and not cut off

---

### 5. Bookmark List Modal Tests

#### Test 5.1: Opening Modal
- [ ] Tap bookmarks icon (leftmost button in bottom nav)
- [ ] Verify modal slides up from bottom
- [ ] Verify animation is smooth (spring effect)
- [ ] Verify backdrop appears (semi-transparent black)
- [ ] Verify modal has rounded top corners (20px)

#### Test 5.2: Modal Header
- [ ] Verify header shows "Bookmarks" title
- [ ] Verify title uses Cormorant Garamond Bold Italic font
- [ ] Verify title color is teal
- [ ] Verify close button (X) is visible on right
- [ ] Tap close button → modal closes

#### Test 5.3: Bookmark List Items
- [ ] Create 3+ bookmarks on different dates
- [ ] Open bookmark list
- [ ] Verify each bookmark shows:
  - [ ] Small bookmark icon (dark green)
  - [ ] Date (formatted, uppercase)
  - [ ] Reading title (italic, teal)
- [ ] Verify items are listed newest first
- [ ] Verify items are clickable

#### Test 5.4: Empty State
- [ ] Remove all bookmarks
- [ ] Open bookmark list
- [ ] Verify empty state appears
- [ ] Verify empty state shows:
  - [ ] Large bookmark icon (gray)
  - [ ] "No bookmarks yet" heading
  - [ ] Helpful message about long pressing

#### Test 5.5: Bookmark Navigation
- [ ] Bookmark reading on Dec 1st
- [ ] Navigate to Dec 7th (different date)
- [ ] Open bookmark list
- [ ] Tap Dec 1st bookmark
- [ ] Verify modal closes
- [ ] Verify app navigates to Dec 1st reading
- [ ] Verify bookmark ribbon is visible

#### Test 5.6: Closing Modal
- [ ] Open bookmark list
- [ ] Tap backdrop (dark area) → modal closes
- [ ] Open bookmark list again
- [ ] Tap X button → modal closes
- [ ] Verify closing animation is smooth

---

### 6. Data Persistence Tests

#### Test 6.1: Basic Persistence
- [ ] Bookmark 3 different readings
- [ ] Close app completely (kill process)
- [ ] Reopen app
- [ ] Navigate to each bookmarked date
- [ ] Verify ribbons appear on all 3

#### Test 6.2: Bookmark List Persistence
- [ ] Create 5 bookmarks
- [ ] Close and reopen app
- [ ] Open bookmark list
- [ ] Verify all 5 bookmarks are listed
- [ ] Verify dates and titles are correct

#### Test 6.3: Instruction Persistence
- [ ] See instruction and dismiss it
- [ ] Close and reopen app multiple times
- [ ] Verify instruction never appears again

#### Test 6.4: AsyncStorage Keys
- [ ] Use React Native debugger or dev tools
- [ ] Check AsyncStorage contains:
  - [ ] `@daily_paths_bookmarks` (array)
  - [ ] `@daily_paths_bookmark_instruction_seen` ("true")

---

### 7. Navigation Tests

#### Test 7.1: Date Navigation with Bookmarks
- [ ] Bookmark current reading
- [ ] Tap left arrow (previous day)
- [ ] Verify ribbon disappears (if prev day not bookmarked)
- [ ] Tap right arrow (next day - back to bookmarked)
- [ ] Verify ribbon reappears

#### Test 7.2: Calendar Picker with Bookmarks
- [ ] Bookmark Dec 1st
- [ ] Open calendar picker
- [ ] Select Dec 7th
- [ ] Verify no ribbon on Dec 7th
- [ ] Open calendar picker again
- [ ] Select Dec 1st
- [ ] Verify ribbon appears

#### Test 7.3: Bookmark List Navigation Loop
- [ ] Bookmark Dec 1, 3, 5
- [ ] Open bookmark list
- [ ] Tap Dec 3 → navigates to Dec 3
- [ ] Tap bookmarks icon again
- [ ] Tap Dec 5 → navigates to Dec 5
- [ ] Verify each navigation works correctly

---

### 8. Bottom Navigation Tests

#### Test 8.1: Bookmarks Button
- [ ] Verify leftmost button shows bookmarks-outline icon
- [ ] Verify icon color is deepTeal when not active
- [ ] Verify button has white circular background
- [ ] Verify button has subtle shadow
- [ ] Tap button → bookmark list opens

#### Test 8.2: No Count Badge
- [ ] Create 0 bookmarks → no badge
- [ ] Create 5 bookmarks → still no badge
- [ ] Create 20 bookmarks → still no badge
- [ ] Verify count is never displayed on button

#### Test 8.3: Button Styling Consistency
- [ ] Compare bookmarks button with other buttons
- [ ] Verify all have same size (48×48px)
- [ ] Verify all have same border radius (24px)
- [ ] Verify all have same background and shadow
- [ ] Verify only icons differ

---

### 9. Edge Cases & Error Handling

#### Test 9.1: Missing Reading Data
- [ ] Navigate to date with no reading
- [ ] Try to long press (if content exists)
- [ ] Verify no errors in console
- [ ] Verify graceful handling

#### Test 9.2: Very Long Reading Titles
- [ ] Create bookmark with very long title (if possible)
- [ ] Open bookmark list
- [ ] Verify title truncates with ellipsis
- [ ] Verify layout doesn't break

#### Test 9.3: Rapid Modal Open/Close
- [ ] Tap bookmarks button
- [ ] Immediately tap close (before animation completes)
- [ ] Repeat 5 times quickly
- [ ] Verify no crashes or visual glitches

#### Test 9.4: Long Press During Scroll
- [ ] Start scrolling reading content
- [ ] Try to long press while scrolling
- [ ] Verify long press doesn't trigger
- [ ] Verify no conflicts

#### Test 9.5: AsyncStorage Errors
- [ ] (Advanced) Simulate AsyncStorage failure
- [ ] Verify errors are caught and logged
- [ ] Verify app doesn't crash
- [ ] Verify user sees graceful fallback

---

### 10. Cross-Platform Tests

#### Test 10.1: iOS Specific
- [ ] Test on iOS simulator/device
- [ ] Verify blur effects work correctly
- [ ] Verify shadows render properly
- [ ] Verify touch gestures work smoothly
- [ ] Verify SafeAreaView works correctly

#### Test 10.2: Android Specific
- [ ] Test on Android emulator/device
- [ ] Verify elevation (shadows) work correctly
- [ ] Verify touch ripple effects are appropriate
- [ ] Verify back button behavior
- [ ] Verify modal dismissal

#### Test 10.3: Different Screen Sizes
- [ ] Test on small phone (iPhone SE)
- [ ] Test on large phone (iPhone Pro Max)
- [ ] Test on tablet
- [ ] Verify modal sizing is appropriate
- [ ] Verify instruction overlay is centered
- [ ] Verify ribbon is positioned correctly

---

## 📊 Test Results Summary

| Category | Tests | Passed | Failed | Notes |
|----------|-------|--------|--------|-------|
| Initial Setup | 3 | | | |
| Long Press | 5 | | | |
| Toast | 3 | | | |
| Ribbon | 3 | | | |
| Modal | 6 | | | |
| Persistence | 4 | | | |
| Navigation | 3 | | | |
| Bottom Nav | 3 | | | |
| Edge Cases | 5 | | | |
| Cross-Platform | 3 | | | |
| **TOTAL** | **38** | | | |

---

## 🐛 Known Issues / Limitations

1. React Native doesn't support CSS `clip-path`, so ribbon uses rounded corners instead of notched bottom
2. Glassmorphism on instruction overlay is CSS-based, not BlurView (for compatibility)
3. Long press doesn't work on text selection handles (expected behavior)
4. AsyncStorage is limited to ~6MB on iOS/Android (unlikely to hit limit with bookmarks)

---

## 🔄 Regression Testing

After any code changes, retest these critical paths:

1. [ ] Long press to toggle bookmark (add & remove)
2. [ ] Ribbon appears/disappears correctly
3. [ ] Bookmark list opens and navigates
4. [ ] Bookmarks persist after app restart
5. [ ] Instruction overlay shows once and never again

---

**Testing Date**: _____________
**Tested By**: _____________
**Platform**: iOS / Android / Both
**Result**: Pass / Fail
**Notes**: _____________________________________________

---

Good luck with testing! 🎉

