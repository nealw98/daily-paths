# Daily Paths — Android QA Checklist (v2.6.0 build 33)

## Launch & Navigation
- [ ] App launches to Today screen
- [ ] All 5 tabs load (Today, Notebook, Prayers, Speakers, Settings)
- [ ] Tab switching is smooth, no flicker or blank screens

## Today (Daily Reading)
- [ ] Today's reading loads on launch
- [ ] Navigate to past/future dates via date picker
- [ ] Bookmark and unbookmark a reading
- [ ] Share a reading via native share sheet
- [ ] Create a journal entry from the reading screen
- [ ] Bookmark instruction overlay shows on first use only

## Journal / Notebook (Premium)
- [ ] Create an entry for each type: Journal, Gratitude, Reflection, Testimony
- [ ] Edit and save an existing entry
- [ ] Delete an entry (confirm dialog appears)
- [ ] Guided prompt questions render correctly

## Prayers (Premium)
- [ ] Built-in prayers load and expand/collapse
- [ ] Bold phrases render correctly ("Just for today", etc.)
- [ ] Create, edit, and delete a personal prayer
- [ ] Hide/show a built-in prayer
- [ ] Custom text override on a built-in prayer persists

## Speakers / Audio (Premium)
- [ ] Speaker list loads
- [ ] Tap speaker → detail opens, audio auto-plays
- [ ] Play/pause, seek via progress slider
- [ ] Adjust playback speed
- [ ] Audio continues when switching tabs
- [ ] Download a speaker for offline playback
- [ ] Now-playing indicator shows in browse list
- [ ] Audio plays with device on silent/vibrate

## Settings
- [ ] Change text size (all 5 options) — verify across screens
- [ ] Switch themes: Light, Dark, System
- [ ] Premium themes accessible only when subscribed
- [ ] Enable/disable daily reminder, set time
- [ ] Send feedback (with and without email)
- [ ] Rate app link opens Play Store
- [ ] Share app via native share sheet
- [ ] Privacy Policy, Terms, Support links open correctly
- [ ] Version and build number display correctly (2.6.0, build 33)
- [ ] Long-press version number opens QA logs

## Subscription & Paywall
- [ ] Free user sees paywall when tapping premium tabs
- [ ] Trial days remaining display correctly
- [ ] Purchase flow completes successfully
- [ ] Subscription restore works
- [ ] Lifetime purchase unlocks all features
- [ ] Trial expiration modal appears when trial ends

## Notifications
- [ ] Permission request fires on first enable
- [ ] Notification arrives at set time
- [ ] Tapping notification opens today's reading
- [ ] Disabling reminder cancels scheduled notifications

## Dark Mode & Theming
- [ ] System theme toggle (Android dark mode) updates app
- [ ] Text readable in both light and dark modes
- [ ] All screens respect selected theme

## Offline & Network
- [ ] Cached reading loads without network
- [ ] Downloaded speaker audio plays offline
- [ ] Graceful error handling when network is unavailable

## Persistence
- [ ] Journal entries survive app restart
- [ ] Personal prayers survive app restart
- [ ] Theme, text size, reminder settings persist
- [ ] Bookmarks persist

## Background & Lifecycle
- [ ] Audio continues in background
- [ ] App resumes correctly after being backgrounded
- [ ] OTA update banner appears when update available
