# Theme: Elements and Colors

Reference only. No overrides—this documents which UI elements use which theme roles and, for Earthy Tones, which palette color is behind each role.

---

## Earthy Tones palette (named colors)

| Name            | Hex       | Role(s) in theme |
|-----------------|-----------|-------------------|
| Cherry Blossom  | `#EDAFB8` | **textSecondary** (dark only) |
| Powder Petal    | `#F7E1D7` | **backgroundSecondary**, **cardBackground**, **text** (dark) |
| Dust Grey       | `#DEDBD2` | **modalBorder**, **border**, **highlight** (dark), **buttonSecondary** (dark) |
| Ash Grey        | `#B0C4B1` | **textSecondary**, **highlight**, **modalBorder** (dark), **buttonPrimary** (dark), **border** (dark), hero gradient end |
| Iron Grey       | `#4A5759` | **text**, **accent**, **buttonPrimary**, hero gradient start, **textOnAccent** (dark) |

*(Earthy Light also uses `#FDF9F7` and `#3d4a4c` for background/modals/cards.)*

---

## Theme roles → Earthy hex (Light / Dark)

| Role                 | Earthy Light | Earthy Dark | Legacy alias in code |
|----------------------|--------------|-------------|-----------------------|
| **accent**           | #4A5759      | #B0C4B1     | deepTeal              |
| **text**             | #4A5759      | #F7E1D7     | ink                   |
| **textSecondary**    | #B0C4B1      | #EDAFB8     | ocean                 |
| **background**       | #FDF9F7      | #4A5759     | pearl                 |
| **backgroundSecondary** | #F7E1D7   | #3d4a4c     | —                     |
| **highlight**        | #B0C4B1      | #DEDBD2     | seafoam               |
| **modalBorder**      | #DEDBD2      | #B0C4B1     | mist                  |
| **cardBackground**   | #F7E1D7      | #3d4a4c     | cloud                 |
| **buttonPrimary**    | #4A5759      | #B0C4B1     | deepTeal              |
| **buttonSecondary**  | #B0C4B1      | #DEDBD2     | —                     |
| **textOnAccent**     | #FFFFFF      | #4A5759     | —                     |
| **border**           | #DEDBD2      | #B0C4B1     | —                     |
| **backdrop**         | rgba(0,0,0,0.5) | rgba(0,0,0,0.6) | —                 |

---

## Elements by color role

### **deepTeal** (= accent / buttonPrimary)
- **Appearance modal:** title “Appearance”, “Done”, section labels “Theme” / “Color palette” / “Text Size”, theme/palette option text (unselected), slider labels “Smaller”/“Larger”, text size slider selected dot
- **Reminder modal:** title “Thought for the Day”, “Done”, primary “Set time” button bg, Switch thumb (when on), time display
- **Settings (SettingsContent):** section titles (About, Rate & Share, Share Feedback), “Rate App” / “Share App” / “Send Feedback” text, link labels (Privacy, Support, Terms), About/feedback icons
- **Settings modal:** “Done”
- **ReadingScreen:** header bookmark/share icons, calendar month bg (light), calendar day number, “Thought of the Day” label, thought card step number
- **ReadingFeedback:** “Thank you” text, positive/negative rating button bg when selected
- **BookmarkListModal:** list item delete icon, “Done”, empty state title
- **DatePickerModal:** month title, weekday/day text

### **ocean** (= textSecondary)
- **Appearance modal:** subtitle “Adjust how large the daily reading appears.”
- **Reminder modal:** subtitle under “Thought for the Day”
- **SettingsContent:** version text
- **ReadingScreen:** **reading title**, application quote label, thought card label (“Step N”)
- **BookmarkListModal:** favorite date text, empty state message
- **DatePickerModal:** month nav arrow, day text, “Today” / “Cancel” button text
- **index:** loading text “Loading reading…”, “Pick a Date” button text, ActivityIndicator

### **ink** (= text)
- **Reminder modal:** “Enable daily notification”, “Notification time”, time value, “Cancel” / secondary text
- **SettingsContent:** About body, section subtitles, Rate & Share / Share Feedback subtitles
- **ReadingScreen:** opening paragraphs, application quote, thought text
- **ReadingFeedback:** question text
- **BookmarkListModal:** favorite title, “No favorites yet” title
- **DatePickerModal:** day number (default)
- **index:** error detail text

### **pearl** (= background)
- **Appearance modal:** modal container bg
- **Reminder modal:** modal container bg
- **Settings modal:** modal container bg
- **SettingsContent:** secondary buttons (Rate App, Share App, Send Feedback) bg
- **ReadingScreen:** safe area, main container, content area
- **ReadingFeedback:** container bg
- **BookmarkListModal:** modal container, list item bg
- **DatePickerModal:** modal content bg
- **index:** loading/error container bg

### **seafoam** (= highlight)
- **Appearance modal:** text size slider “active” dots (left of selected)
- **ReadingScreen:** “Step” / thought label color in one place
- **DatePickerModal:** today’s date border (when not selected)

### **mist** (= modalBorder)
- **Reminder modal:** “Cancel” time button bg, trackColor for Switch
- **SettingsContent:** section card border, section header border, secondary button border, legal section top border
- **BookmarkListModal:** list item border, header border, close icon color
- **ReadingScreen:** application divider line
- **ReadingFeedback:** rating button border (unselected)
- **DatePickerModal:** unavailable day text, button container top border

### **cloud** (= cardBackground)
- **SettingsContent:** section cards (About, Rate & Share, Share Feedback) bg
- **ReadingScreen:** calendar card (dark), calendar day bg (light), thought card bg
- **DatePickerModal:** “Today” / “Cancel” button bg

### **textOnAccent**
- **Appearance modal:** theme/palette option text and icon when selected
- **Reminder modal:** “Set time” button text
- **SettingsContent:** primary button text (e.g. chip selected), time picker primary text (inline)
- **ReadingScreen:** “Al-Anon Daily Paths” logo, header nav chevrons, calendar month text
- **ReadingFeedback:** positive/negative button text when selected
- **NegativeFeedbackModal:** “Submit” text
- **RateAppModal:** “Rate App” text
- **BookmarkInstructionOverlay:** “Got it” text
- **BookmarkToast:** icon and message
- **DismissibleToast:** icon, message, close icon
- **InlineTimePicker:** period label when selected (AM/PM)
- **DatePickerModal:** selected day text
- **index:** “Go to Today” button text

### **border**
- **Appearance modal:** header bottom border, theme/palette option border, text size slider dot border
- **Reminder modal:** header bottom border
- **qa-logs:** log entry border

### **backdrop**
- **Appearance modal:** dim behind modal
- **Reminder modal:** dim
- **Settings modal:** dim
- **SettingsContent:** feedback modal dim
- **NegativeFeedbackModal:** dim
- **RateAppModal:** dim
- **BookmarkListModal:** dim
- **BookmarkInstructionOverlay:** dim
- **DismissibleToast:** toast background

---

## Summary: where palette colors show up

- **Iron Grey #4A5759:** Main text, accent, primary buttons, header gradient (light); text-on-accent (dark). Very visible.
- **Ash Grey #B0C4B1:** Secondary text (ocean), highlights, borders, secondary/primary buttons (dark). Visible.
- **Dust Grey #DEDBD2:** Borders, modal borders (light); highlight, secondary button (dark). Medium visibility.
- **Powder Petal #F7E1D7:** Backgrounds, cards (light); main text (dark). High visibility.
- **Cherry Blossom #EDAFB8:** Only as **textSecondary** in **dark** theme (e.g. subtitles, “Adjust how large…”, version, reminder subtitle, favorite date, empty message, date picker labels). Not used in light theme.

To “see more” of a palette (e.g. Cherry Blossom in Earthy Light), you’d assign that hex to one or more roles (e.g. **textSecondary**, **highlight**, or a new role) in the Earthy Light palette in `constants/theme.ts`.
