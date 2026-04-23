# Visual Redesign — Change Spec for Claude Code

## Summary

This is a comprehensive visual overhaul of the Journal, Prayers, and Bottom Nav. All emoji are replaced with custom SVG icons. All screens get a consistent teal gradient header. The Prayers page is completely redesigned. The bottom nav gets a new icon set.

**Visual reference prototypes** (in order of priority):
- `journal-complete-redesign.html` — Timeline, segmented filter, all four entry forms
- `nav-final-set.html` — Bottom nav with final icon set at multiple sizes
- `prayers-nav-redesign.html` — Prayers page redesign (use new leaf-on-water icon instead of flame)

---

## 1. Custom SVG Icon System

Replace ALL emoji with custom SVG line art icons. Two icon sets: one for **entry types** (used in timeline, segmented filter, form headers, type picker) and one for **bottom nav**.

All icons share these SVG attributes:
```
viewBox="0 0 32 32"
fill="none"
stroke-linecap="round"
stroke-linejoin="round"
```

### Entry Type Icons

**Journal — Feather** (color: `#2C5F5D`)
```svg
<svg viewBox="0 0 32 32">
  <path d="M26 4c-8 2-12 8-14 16l-4 8 8-4c8-2 14-6 16-14"/>
  <path d="M12 20L26 4"/>
</svg>
```

**Gratitude — Seedling** (color: `#8B6E4E`)
```svg
<svg viewBox="0 0 32 32">
  <path d="M16 28V16"/>
  <path d="M16 16c0-6 6-10 12-8-2 6-6 8-12 8Z"/>
  <path d="M16 20c0-5-5-8-10-7 1.5 5 5 7 10 7Z"/>
</svg>
```

**Spot Check — Soft Exhale** (color: `#B8604A`)
```svg
<svg viewBox="0 0 32 32">
  <path d="M6 16c4-6 8-6 10-3s6 3 10-3"/>
  <path d="M6 22c3-4 6-4 8-2s5 2 8-2" opacity="0.55"/>
  <path d="M8 27c2-3 4-3 6-1.5s4 1.5 6-1.5" opacity="0.3"/>
</svg>
```

**Nightly Review — Moon on Water** (color: `#5B6E8A`)
```svg
<svg viewBox="0 0 32 32">
  <path d="M14 5a5.5 5.5 0 0 0 8.5 6.5 7 7 0 1 1-8.5-6.5Z"/>
  <path d="M8 25c3-1.5 5.5 0 8.5-1s5-1.5 7.5 0" opacity="0.5"/>
  <path d="M6 28.5c4-1.5 6 0 10-1s6-1.5 10 0" opacity="0.3"/>
</svg>
```

### Bottom Nav Icons

**Today — Light on Water** (sun with rays above water ripples)
```svg
<svg viewBox="0 0 32 32">
  <circle cx="16" cy="14" r="4" stroke-width="1.5"/>
  <path d="M16 7V5" stroke-width="1.4" opacity="0.6"/>
  <path d="M21.5 9l1.5-1.5" stroke-width="1.3" opacity="0.45"/>
  <path d="M10.5 9l-1.5-1.5" stroke-width="1.3" opacity="0.45"/>
  <path d="M23 14h2" stroke-width="1.3" opacity="0.35"/>
  <path d="M7 14h2" stroke-width="1.3" opacity="0.35"/>
  <path d="M3 20c4-1.5 7 0 13-1s9-1.5 13 0" stroke-width="1.6"/>
  <path d="M4 24c4-1 7 0 12-1s8-1 12 0" opacity="0.4" stroke-width="1.3"/>
  <path d="M6 27.5c3-.8 5 0 10-.8s7-.8 10 0" opacity="0.2" stroke-width="1.2"/>
</svg>
```

**Journal — Feather** (same as entry type icon above)

**Prayers — Leaf on Water** (leaf floating on water ripples)
```svg
<svg viewBox="0 0 32 32">
  <path d="M12 10c4-3 10-3 13 0-3 4-8 6-13 4Z" stroke-width="1.6"/>
  <path d="M12 10c4 1 7 1 10 0" stroke-width="1.2" opacity="0.5"/>
  <path d="M12 10c-1 2-2 4-2 6" stroke-width="1.4"/>
  <path d="M6 20c3-1.5 6 0 10-1s7-1.5 10 0" stroke-width="1.4"/>
  <path d="M4 24c4-1.5 7 0 12-1s8-1.5 12 0" opacity="0.5" stroke-width="1.4"/>
  <path d="M6 28c3-1 5 0 10-1s7-1 10 0" opacity="0.25" stroke-width="1.2"/>
</svg>
```

**More — Stacked Stones** (four ellipses, largest at bottom)
```svg
<svg viewBox="0 0 32 32">
  <ellipse cx="16" cy="25" rx="9" ry="3.5"/>
  <ellipse cx="16" cy="18" rx="6.5" ry="3"/>
  <ellipse cx="16" cy="11.5" rx="4.5" ry="2.5"/>
  <circle cx="16" cy="6" r="2"/>
</svg>
```

### Icon Rendering Rules

- **Bottom nav:** Rendered at 24px, stroke `#2C5F5D`, stroke-width 1.6 (1.8 when active), inactive opacity 0.35
- **Segmented filter:** Rendered at 18px, stroke matches entry type color when active, `#8A8A8A` when inactive
- **Timeline entry cards:** Rendered at 14px inline with type label text, stroke matches entry type color
- **Form headers:** Rendered at 24px in white (`rgba(255,255,255,0.9)`) on teal gradient background, stroke-width 2
- **Type picker cards:** Rendered at 24px, stroke matches entry type color
- **Prayers page cards:** Leaf-on-water icon rendered at 18px in tinted icon square

---

## 2. Teal Gradient Header — All Screens

Every screen gets the same header treatment currently used on the Today reading screen.

### Header Spec
```css
background: linear-gradient(135deg, #2C5F5D 0%, #1E4543 100%);
```
- Height: ~56px (content area, excluding status bar)
- Title: Cormorant Garamond italic, 20px, white, centered
- Shadow: `0 2px 8px rgba(0,0,0,0.15)`

### Header by Screen

**Today screen:** "Daily Paths" title (existing — no change to content, just ensure gradient matches)

**Journal Timeline:** "Journal" title centered. Search icon (magnifying glass) in frosted circle (`rgba(255,255,255,0.15)` background, 32px circle) on the right.

**Journal Entry Forms:** Entry type icon (white, 24px) + type name in Cormorant Garamond italic. Thin colored strip (3px) below header in the entry type's accent color:
- Journal form: `#2C5F5D` strip
- Gratitude form: `#8B6E4E` strip
- Spot Check form: `#B8604A` strip
- Nightly Review form: `#5B6E8A` strip

Back arrow on left, delete icon on right (both white).

**Prayers page:** "Prayers" title centered. Leaf-on-water icon in frosted circle on right (or omit for simplicity).

**More/Settings:** "More" title centered.

---

## 3. Journal Timeline Redesign

### Stats Bar
- Three stats in a row below header: `{N} this month` | `{N} this week` | `{N} today`
- Numbers: 24px, font-weight 600, `#2C5F5D`
- Labels: 10px, uppercase, letter-spacing 1px, `#8A8A8A`
- Background: white, thin border bottom

### Segmented Control Filter (replaces filter chips)
iOS-style segmented control with 5 segments:
```
[ All | feather | seedling | exhale | moon ]
```
- "All" segment shows text "All"
- Other 4 segments show only the entry type SVG icon (no text)
- Active segment: white background, entry type color for icon stroke, subtle shadow
- Inactive segments: transparent background, muted icon color (`#8A8A8A`)
- Background track: `rgba(44, 95, 93, 0.06)` with rounded corners
- Height: ~36px
- Horizontal padding: 16px from screen edges

### Entry Cards
- White background, border-radius 14px
- Left border: 3.5px solid in entry type color (only visual differentiation)
- No colored top strip, no badge pill background
- Entry type label: SVG icon (14px) + type name text, in entry type color, 12px, uppercase, 600 weight, letter-spacing 0.6px
- Time: 12px, `#8A8A8A`, right-aligned
- Preview text: 17px, `#555555`, line-height 1.55, 3 lines max (-webkit-line-clamp: 3)
- Card padding: 16px
- Card shadow: `0 1px 3px rgba(0,0,0,0.04)`
- Gap between cards: 10px

### Date Dividers
- Centered text: "Today — Feb 8", "Yesterday — Feb 7", "Feb 6", etc.
- 11px, uppercase, letter-spacing 1px, `#8A8A8A`
- Thin lines on either side: `rgba(44, 95, 93, 0.08)`

### FAB
- Deep teal circle (52px), white "+" SVG icon
- Shadow: `0 4px 15px rgba(44, 95, 93, 0.4)`
- Position: bottom right, above bottom nav
- Behavior unchanged: opens type picker when filter is "All", opens that type's form when filtered

### Type Picker Bottom Sheet
- 2×2 grid of cards (not a list)
- Each card: entry type icon (24px, in tinted background square) + name + one-line description
- Card backgrounds tinted with entry type color at low opacity
- Sheet title: "What would you like to do?" in Cormorant Garamond italic
- Drag handle, overlay backdrop to dismiss

---

## 4. Journal Entry Forms Redesign

All four entry forms share this structure:

### Common Form Elements

**Header:** Teal gradient with white entry type icon + name. Thin accent color strip below.

**Background:** Pearl (`#F5F0EB`) for the form body area.

**Intro text:** Cormorant Garamond italic, 19px, `#2C5F5D`, with a thin border-bottom to separate from prompts.

**Footer:** White background, border-top. Cancel button (pearl background, text-secondary) and Save button (deep teal background, white text, checkmark icon).

### Journal Form (Freeform)
- Full-screen textarea on pearl background
- Placeholder: "What's on your mind..." in italic
- Font: Source Sans 3, 15px, line-height 1.7
- **No questions accordion** — the structured entry types handle guided reflection now
- That's it. Just the blank page.

### Gratitude Form
- Intro: "What are you grateful for today?"
- 3 starter input slots, each in a white card:
  - Seedling SVG icon (warm brown, 18px) + text input
  - Placeholder: "I'm grateful for..."
  - Remove button: pearl circle (24px) with X icon, subtle, only visible on non-empty items
- "+ add another" button: dashed border, seafoam color text
- Note below: "Write as many or as few as you'd like" in 11px muted italic

### Spot Check Form
- Intro: "Pause. Breathe. Work through what's happening."
- 5 prompts, each in a white card with generous padding:
  - Numbered circle: 22px, `#B8604A` background, white number, 11px font
  - Prompt label: 16px, font-weight 600, `#2C5F5D`
  - Textarea: pearl background (`#F5F0EB`), shifts to white on focus, border `rgba(44,95,93,0.08)`, focus border `#5B9E9B`
  - Textarea font: 15px, line-height 1.6
  - Placeholder: 13px italic
  - Optional hint text: 11px, muted, italic, below textarea

Prompts:
1. "What happened?" — "Just the facts — what triggered this?"
2. "What am I feeling?" — "Name the feelings — fear, anger, hurt..." / hint: "Where is my fear hiding in this?"
3. "Where am I trying to control this?" — "What am I afraid will happen if I let go?"
4. "What's my part?" — "Am I responding or reacting?"
5. "What's the next right thing?" — "One small step I can take right now..."

### Nightly Review Form
- Intro: "Take a quiet moment to review your day with honesty and compassion."
- 5 prompts, same card structure as Spot Check but with `#5B6E8A` numbered circles

Prompts:
1. "What disturbed my serenity today?" — "What situations or people unsettled me?"
2. "Where was I selfish, dishonest, or afraid?" — "Be gentle but honest with yourself..."
3. "Do I owe anyone an amend?" — "Is there something I need to make right?" / hint: "This can wait until tomorrow — just note it here."
4. "What did I do well today?" — "Where did I show up for my recovery?"
5. "What am I grateful for tonight?" — "End the day with gratitude..."

---

## 5. Prayers Page Redesign

Complete visual overhaul of the Prayers screen.

### Header
Same teal gradient as all other screens. "Prayers" in Cormorant Garamond italic, white.

### Intro Text
Below header, on pearl background:
- "A collection of prayers for your recovery journey"
- Cormorant Garamond italic, 19px, `#2C5F5D`
- Padding below, border-bottom

### Prayer Cards
Each prayer is a white card with:
- Left: Leaf-on-water icon (18px) in a tinted square (36px, border-radius 10px, `rgba(44,95,93,0.06)` background)
- Center: Prayer name in Cormorant Garamond, 17px, font-weight 500
- Right: Chevron (down when collapsed, up when expanded)
- Card: white background, border-radius 14px, shadow `0 1px 3px rgba(0,0,0,0.04)`, padding 14-16px
- Gap between cards: 8px

### Expanded Prayer
When tapped, the card expands to show:
- Thin divider line below the title row
- Prayer text: Cormorant Garamond italic, 18px, `#555555`, centered
- Line-height: 1.7
- Text is line-broken for reading aloud (use `<br>` for natural breath pauses)
- Generous padding (20px+ on sides)

### Prayers to Include
1. Serenity Prayer
2. Serenity Prayer (Extended)
3. Prayer of St. Francis
4. Third Step Prayer
5. Seventh Step Prayer
6. Let Go and Let God
7. Just for Today

### Personal Prayer Notes Section
Below the prayer cards, a distinct section:
- Section header: "Personal Prayer Notes" with a pen icon (warm brown `#8B6E4E`) in a tinted square
- Edit button on the right ("Edit" text or pencil icon)
- Content area: Cormorant Garamond italic placeholder "Tap edit to add your personal prayers..."
- White card, same styling as prayer cards but taller
- Saves to user preferences / local storage

---

## 6. Bottom Nav Update

### Structure (unchanged)
4 tabs: Today | Journal | Prayers | More

### Icon Replacement
Replace current icons with the custom SVG set:

| Tab | Old Icon | New Icon | SVG |
|-----|----------|----------|-----|
| Today | Book (Lucide-style) | Light on Water | See Section 1 |
| Journal | Pen (Lucide-style) | Feather | See Section 1 |
| Prayers | Arrow/generic | Leaf on Water | See Section 1 |
| More | Three dots | Stacked Stones | See Section 1 |

### Rendering
- Icon size: 24px
- Stroke: `#2C5F5D`
- Stroke-width: 1.6 (inactive), 1.8 (active)
- Active tab: full opacity
- Inactive tabs: 0.35 opacity
- Label: 10px, font-weight 500, `#2C5F5D`
- Background: white
- Border-top: `rgba(44, 95, 93, 0.08)`
- Height: 65px (with bottom safe area padding)

---

## 7. Color Reference

### Entry Type Colors (unchanged)
| Type | Color | Usage |
|------|-------|-------|
| Journal | `#2C5F5D` | Left border, icon stroke, numbered circles |
| Gratitude | `#8B6E4E` | Left border, icon stroke, accent strip |
| Spot Check | `#B8604A` | Left border, icon stroke, numbered circles, accent strip |
| Nightly Review | `#5B6E8A` | Left border, icon stroke, numbered circles, accent strip |

### App Palette (unchanged)
| Name | Hex | Usage |
|------|-----|-------|
| Deep Teal | `#2C5F5D` | Primary brand, headers, nav, FAB |
| Teal Dark | `#1E4543` | Gradient end |
| Seafoam | `#5B9E9B` | Focus states, links, toggle text |
| Pearl | `#F5F0EB` | Page backgrounds, input backgrounds |
| Pearl Warm | `#EDE7E0` | Hover states |
| Sand | `#D4C9BC` | Dividers, muted elements |
| White | `#FFFFFF` | Cards, nav background, active segments |
| Text Primary | `#2A2A2A` | Main text |
| Text Secondary | `#555555` | Body text, previews |
| Text Muted | `#8A8A8A` | Labels, timestamps, placeholders |

---

## 8. Typography Reference

| Element | Font | Size | Weight | Style |
|---------|------|------|--------|-------|
| Screen titles (header) | Cormorant Garamond | 20px | 500 | italic |
| Form intro text | Cormorant Garamond | 19px | 500 | italic |
| Prayer card names | Cormorant Garamond | 17px | 500 | normal |
| Prayer expanded text | Cormorant Garamond | 18px | 400 | italic |
| Entry preview text | Source Sans 3 | 17px | 400 | normal |
| Prompt labels | Source Sans 3 | 16px | 600 | normal |
| Textarea text | Source Sans 3 | 15px | 400 | normal |
| Placeholder text | Source Sans 3 | 13px | 400 | italic |
| Entry type labels | Source Sans 3 | 12px | 600 | uppercase |
| Stat numbers | Source Sans 3 | 24px | 600 | normal |
| Stat labels | Source Sans 3 | 10px | 400 | uppercase |
| Nav labels | Source Sans 3 | 10px | 500 | normal |
| Hint text | Source Sans 3 | 11px | 400 | italic |

---

## 9. What's NOT Changing

- Entry type colors (teal, warm brown, rust, slate blue)
- Entry types themselves (journal, gratitude, spot check, nightly review)
- Save/Cancel/Discard logic
- Edit flow (tap to edit, Discard/Save replaces Prev/Next)
- Delete confirmation behavior
- Database schema (entry_type, structured_content, content fields)
- Search functionality (uses content field)
- FAB behavior (context-matches active filter)
- Type picker 2×2 grid layout
- Structured content shapes (JSON keys for each type)
- Stats counting (all types combined)
- No auto-save, no tags, no AI features

---

## 10. Implementation Priority

### Phase 1: Icon System + Nav
1. Create SVG icon components for all 8 icons (4 entry type + 4 nav)
2. Replace bottom nav icons with new set
3. Replace all emoji in timeline, type picker, entry forms with SVG icons

### Phase 2: Header + Timeline
4. Add teal gradient header to Journal timeline and all form screens
5. Replace filter chips with segmented control
6. Update entry card styling (17px text, 3 lines, minimal chrome)
7. Update stats bar (24px numbers)

### Phase 3: Form Visual Updates
8. Add accent color strip below form headers
9. Update form backgrounds to pearl
10. Update textarea styling (pearl → white on focus)
11. Update prompt card styling (white cards on pearl background)
12. Remove questions accordion from freeform journal form
13. Add checkmark icon to Save button

### Phase 4: Prayers Page
14. Redesign Prayers page with teal header
15. Replace prayer display with expandable cards (leaf-on-water icon)
16. Add Personal Prayer Notes section
17. Style prayer text (centered, Cormorant Garamond italic, line-broken)

### Phase 5: Polish
18. Verify consistent header treatment across all screens
19. Test icon rendering at all sizes (14px, 18px, 24px, 36px)
20. Ensure smooth transitions between screens
21. Dark mode compatibility for all new elements
