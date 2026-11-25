# Daily Paths 2.9 — Wide-screen spec (iPad + open iPhone Duo)

Approved by Neal, Nov 24 2026. Mock-ups are in this folder:
- `NN-Screen.png` shows what it should look like (photos are blank in the screenshots; use the same images as the phone app).
- `NN-Screen.html` holds the exact sizes, colors and spacing.
- Live canvas, clickable with Play: https://claude.ai/artifact/N1UwuYpyvjY4NKdXdboKAg (page "Chosen design")

## 0. Read first: follow Hands Off and Sober Dailies

Neal has already shipped iPad + Duo support in **Hands Off** (`~/Projects/hands-off`, v1.5) and is doing the same in **Sober Dailies** (`~/Projects/rork-sober-dailies`). Before writing code, read how those repos handle:
- the iOS 27 SDK / Expo SDK upgrade needed for the Duo inner display
- orientation settings in app.json and the native config
- the width breakpoint that switches between the phone layout and the wide layout
- the right-side tab rail component and the Duo's reserved 84pt side strips
- safe areas, the Duo cover screen and rotation handling

**Reuse those decisions and that code.** Where this spec and those repos disagree on a mechanical detail (breakpoint value, strip sizes, rail offsets), the shipped repos win. Where they disagree on a Daily Paths design choice below, this spec wins. Neal's "Duo Adaptation Playbook" doc also describes the pattern.

## 1. Decisions

| Topic | Decision |
|---|---|
| Devices | Both iPad and the iPhone Duo in 2.9 |
| SDK | Upgrade to the SDK level the Duo needs (as done in Hands Off). Do this first, on its own, and get a clean build before any layout work |
| Orientation | Not locked anywhere, including the Duo's cover screen (needed so the inside display can rotate between portrait and landscape). Replace `"orientation": "portrait"` in app.json the way Hands Off does |
| When the wide layout is used | Same rule as Hands Off and Sober Dailies (width-based, not device-based) |
| Narrow screens (iPhone, Duo cover, narrow iPad windows) | The current phone app, unchanged, except the tab bar moves to the right rail wherever the wide rule says so (same as Hands Off) |
| Tab placement in wide layout | Right-side vertical rail on both iPad and the Duo. One design; match the existing UI wherever possible |
| Home tab name | Stays **Today** |
| Dark mode | Build with the existing theme tokens (`constants/theme.ts`) so Light, Dark and System all keep working. The mock-ups are light only; Neal will review dark on device |
| Text size setting | Reading, prayer and entry text keep following the existing Text Size setting |

## 2. Layout rules (wide layout)

- **Tab rail:** right edge, in the Duo's reserved right strip. Order: Today, Notebook, Speakers, Prayers, Settings, with the same icons as the phone tab bar. The selected tab gets the mint pill (`#BAECE6`) behind its icon. The hidden `reading` route stays hidden.
- **Content starts at the left edge.** There is no empty strip on the left (`left: 28px` in the mock-ups). This is Neal's deliberate exception to the playbook's symmetric strips.
- **Two panes:** a list or hub on the left (about 46%) and detail on the right (about 54%), with a 24px gap. The open item in a list gets a 1.5px teal outline (`#376662`).
- **Cards:** white, 1px `#D9E1DE` border, 12–16px corners. Corners should match the current app, not be rounder.
- **Reading text:** keep line length comfortable (max about 600pt) inside its pane.

## 3. Type scale (use everywhere; don't add other sizes)

| Use | Font | Size / weight |
|---|---|---|
| Big titles (reading title, Today hero card) | Cormorant Garamond | 40 / 600 |
| Screen titles (h1) | Cormorant Garamond | 34 / 600 |
| Pane titles (right side) | Cormorant Garamond | 28 / 600 |
| Card titles, quotes | Cormorant Garamond | 22 / 600 (quotes 500 italic) |
| Reading, prayer and entry text | Lora | 18 (follows Text Size setting) |
| Prompts and previews | Lora italic | 15 |
| Row titles, buttons, questions, Back | Manrope | 16 / 600 |
| Secondary text, links, filter labels | Manrope | 14 / 400 (links 600) |
| Small capitals, list dates | Manrope | 12 / 700 (caps letter-spaced) |
| Tab rail labels | Manrope | 11 / 600 |

Map these onto the existing typography tokens rather than hard-coding them (see `TYPOGRAPHY_AUDIT.md`).

## 4. Navigation

- **Rail tabs never show a Back button.** Today, Notebook, Speakers, Prayers and Settings are reached from the rail.
- **Screens opened on top of a tab show "‹ Back"** top-left (Manrope 16/600, teal). Back returns to the screen you came from, not always to Today. This applies to the Reading and to the four journaling hubs (Gratitude, Journal, Spot Check, Nightly Review).
- **Today's links:**
  - reflection card → Reading
  - the four tool rows → their hubs
  - prayer card → Prayers tab with that prayer open
  - featured speaker → Speakers tab with that talk open
- **Notebook "Would you like to add?" list:** Gratitude opens its form in the Notebook's right pane (07). Journal, Spot Check and Nightly Review do the same. Only Gratitude is mocked up, so use the same pattern for the others.
- There is no "Open your notebook" link on Today (Notebook is on the rail).

## 5. Screen by screen

- **01 Today:**
  - Greeting and date at the top.
  - Left: the hero reflection card (photo, title, quote, Read more).
  - Right: the four tool rows (icon tile, title, one-line description, chevron) with no section heading.
  - Bottom right: the Prayer card and the Featured speaker card side by side.
  - The Prayer card shows today's prayer title and a preview **clamped to 4 lines with "…"**, then Read more.
- **02 Reading:**
  - Top bar: Back, previous/next day, date pill, heart (favorite) and share.
  - Left: title, a quote with a quote glyph and left line (no white box), then body text.
  - Right column, in order: Thought for the day (dark green card, centered text), Today's practice (left teal line, no indent), the "Write about this" row (journal icon; opens Journal), then "Discover related readings and articles" (dailypaths.org).
  - Long readings scroll; the right column stays put.
- **03 Speakers:** list on the left in the phone list style, with the play icon inside the card. The player is on the right, matching the phone player design. Pick a sensible empty state when nothing has been picked yet.
- **04 Settings:** one centered column with the same sections as the phone Settings.
- **05–07 Notebook:**
  - Left: the timeline matching the current phone Notebook (day headers with dots). Under "Today" is a "+ New entry" row.
  - Right: "Would you like to add?" with the four types (05), the open entry (06), or a new entry form (07).
  - Opening an entry shows the same pane as that type's hub while the left stays the Notebook timeline.
  - Every entry has share.
- **08–12 Journaling hubs:**
  - Left: hero image, title, "Past entries" list and "See all in Notebook →".
  - Right: today's entry, dated.
  - Tapping a past entry shows it on the right (09), with a "Write today's entry" button to get back.
  - Share on all four types. Nightly Review is required.
- **13–15 Prayers:**
  - Left: "+ Write your own", then the prayers list with 2-line previews.
  - Right: the open prayer, top-aligned with the list (not centered), with share.
  - "Write your own" opens the create form in the right pane (15).
  - Today's prayer opens first, with no "Today's prayer" label. Your own prayers are labelled "Your prayer".
  - Edit and Delete links sit under the open prayer; editing uses the same form in the right pane.
  - Long prayers (Just for Today) scroll in the right pane.
- **16–17 Expanded prayer — dropped.** There is no expand/collapse. The mixed centered and two-column layouts read inconsistently, so the prayer always shows in the right pane beside the list. Mock-ups 16 and 17 are kept for reference only.

**Not mocked up; follow the patterns above:**
- editing an entry in the Notebook pane
- Notebook search and filters
- Favorites
- the date picker
- Backup & Restore
- Speakers with nothing playing

Show onboarding and the paywall as a centered window, not stretched full width.

## 6. Order of work

1. SDK/iOS 27 upgrade alone, then a build and a smoke test on iPhone.
2. Orientation and wide-layout detection (copy from Hands Off), then the right tab rail.
3. Today and Reading.
4. Prayers.
5. Journaling hubs.
6. Notebook.
7. Speakers and Settings.
8. Dark mode pass, then the test list below.

## 7. Test list

- The longest reading at the largest text size: the reading scrolls and the right column stays fixed.
- Just for Today at default and largest text sizes: it scrolls in the right pane and the list stays put.
- Rotating the Duo inner display: portrait ↔ landscape, and opening/closing the Duo mid-screen (state is kept).
- The Duo cover screen behaves like the phone app.
- iPad portrait, landscape, and Split View/Slide Over widths, crossing the breakpoint both ways.
- In the Notebook pane: a new Journal, Spot Check and Nightly Review entry (only Gratitude was mocked up).
- Back from a hub reached from Today vs from the Notebook.
- Light, Dark and System themes on every screen.
- Onboarding and the paywall on iPad and on the open Duo.

## 8. Later (not in 2.9)

- A photo banner for each prayer.

## 9. Also in 2.9

- Onboarding changes (already in the code).
- The Nov 19 bug fixes already went out as an over-the-air update, so they're in the code.
- **Age assurance for Texas SB 2420: on hold.** Don't build it during the wide-screen work. Neal will start it separately once the wide-screen build is done, before 2.9 is submitted. Spec: `docs/age-assurance/SPEC.md`.
