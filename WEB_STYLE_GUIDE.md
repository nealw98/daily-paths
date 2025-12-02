## Daily Paths Web Style Guide

This document captures the core visual language of the Daily Paths app so you can recreate a matching experience at `dailypaths.org`.

---

### Color Palette

All colors are defined in `constants/theme.ts`.

- **Primary Brand Colors**
  - **Deep Teal (`colors.deepTeal`)**: `#2C5F5D`  
    - Primary brand color, ideal for headers, primary buttons, and key accents.
  - **Ocean (`colors.ocean`)**: `#4A8B8D`  
    - Secondary accent, used for interactive states (e.g., loading spinners) and links.
  - **Seafoam (`colors.seafoam`)**: `#7EBDC3`  
    - Soft accent for subtle highlights, secondary buttons, and borders.

- **Neutrals / Backgrounds**
  - **Mist (`colors.mist`)**: `#B8D8D8`  
    - Muted neutral, good for dividers, subtle backgrounds, and low-emphasis UI.
  - **Cloud (`colors.cloud`)**: `#E8F3F3`  
    - Light wash background, for cards or light sections.
  - **Pearl (`colors.pearl`)**: `#F7FAFA`  
    - App-wide background color. Use as the main page background on web.
  - **Ink (`colors.ink`)**: `#2D3E3F`  
    - Primary text color on light backgrounds; also for icons and high-contrast elements.

- **Web Usage Guidelines**
  - **Page background**: `#F7FAFA` (Pearl).
  - **Primary text**: `#2D3E3F` (Ink).
  - **Primary actions / highlights**: `#2C5F5D` (Deep Teal).
  - **Hover states**: Slightly darken Deep Teal or use Ocean (`#4A8B8D`).
  - **Borders / dividers**: Use low-contrast Mist (`#B8D8D8`) with 1px lines.

---

### Typography

Fonts are defined in `constants/theme.ts` and loaded in `app/_layout.tsx`.

- **Font Families**
  - **Headers**
    - **Primary header family (`fonts.headerFamily`)**: `Cormorant Garamond` (600 SemiBold)
    - **Header italic (`fonts.headerFamilyItalic`)**: `Cormorant Garamond` 600 SemiBold Italic
    - **Header bold italic (`fonts.headerFamilyBoldItalic`)**: `Cormorant Garamond` 700 Bold Italic
  - **Body**
    - **Body light (`fonts.bodyFamily`)**: `Inter` 300 Light
    - **Body regular (`fonts.bodyFamilyRegular`)**: `Inter` 400 Regular
  - **Long-form / Devotional Text**
    - **Serif regular (`fonts.loraRegular`)**: `Lora` 400 Regular
    - **Serif italic (`fonts.loraItalic`)**: `Lora` 400 Italic

- **Suggested Web Font Setup**
  - Load `Cormorant Garamond`, `Inter`, and `Lora` from a web font provider (e.g., Google Fonts).
  - **CSS font stacks (examples)**:

```css
:root {
  --font-header: "Cormorant Garamond", "Times New Roman", serif;
  --font-body: "Inter", system-ui, -apple-system, BlinkMacSystemFont, "Segoe UI", sans-serif;
  --font-reading: "Lora", "Georgia", serif;
}
```

- **Recommended Usage**
  - **Top-level headings / date / reading titles**: `var(--font-header)`.
  - **UI labels, navigation, buttons, and settings**: `var(--font-body)`.
  - **Reading content / devotion text**: `var(--font-reading)` for a comfortable, book-like feel.

---

### Typography Scale (Web Approximation)

The app dynamically scales text size; below is a good starting point for web:

- **Page title / Date**: 28–32px, `Cormorant Garamond`, 600.
- **Section headings** (e.g., “Today’s Reading”, “Today’s Application”): 22–24px, `Cormorant Garamond`, 600.
- **Body text (reading paragraphs)**: 18–20px, `Lora` regular, line-height 1.5–1.6.
- **UI body / meta text** (buttons, labels, small descriptions): 14–16px, `Inter` regular, line-height 1.4–1.5.
- **Secondary meta / helper text**: 12–14px, `Inter` 300 Light.

---

### Layout & Spacing

From `constants/theme.ts`:

- **Border Radius**
  - **Default radius (`layout.borderRadius`)**: `12px`
    - Use for cards, modals, buttons, and pill-like surfaces.

- **Spacing Scale (`layout.spacing`)**
  - **XS** (`spacing.xs`): `4px`
  - **SM** (`spacing.sm`): `8px`
  - **MD** (`spacing.md`): `16px`
  - **LG** (`spacing.lg`): `24px`
  - **XL** (`spacing.xl`): `32px`

- **Suggested Web Usage**
  - **Page padding**: 24–32px on desktop, 16–24px on mobile.
  - **Card padding**: 16–24px.
  - **Vertical rhythm**: multiples of 8px for consistency.

---

### Surfaces & Components (Web Parity Recommendations)

These are not strict, but mirror how the app feels visually:

- **Page Background**

```css
body {
  background-color: #F7FAFA; /* Pearl */
  color: #2D3E3F;           /* Ink */
  font-family: var(--font-body);
}
```

- **Cards / Content Panels**
  - Background: `#FFFFFF` or `#F7FAFA`
  - Border radius: `12px`
  - Box shadow: very soft, e.g. `0 12px 30px rgba(0, 0, 0, 0.06)`
  - Optional border: `1px solid #E8F3F3` (Cloud) or `#B8D8D8` (Mist)

- **Primary Buttons**

```css
.btn-primary {
  display: inline-flex;
  align-items: center;
  justify-content: center;
  padding: 0.6rem 1.3rem;
  border-radius: 999px;
  background-color: #2C5F5D; /* Deep Teal */
  color: #F7FAFA;           /* Pearl */
  font-family: var(--font-body);
  font-weight: 400;
  font-size: 0.95rem;
  border: none;
  cursor: pointer;
  transition: background-color 0.15s ease, transform 0.1s ease;
}

.btn-primary:hover {
  background-color: #4A8B8D; /* Ocean */
  transform: translateY(-1px);
}

.btn-primary:active {
  transform: translateY(0);
}
```

- **Links**
  - Color: `#4A8B8D` (Ocean).
  - Hover: darken slightly or underline.

---

### Iconography & Accents

- **Icon color**: Prefer `Ink` (`#2D3E3F`) on light surfaces; use `Deep Teal` or `Ocean` for active states.
- **Subtle gradients / overlays**: If you need gradients (as in parts of the app), keep them within the teal/seafoam family to maintain the soft, contemplative tone.

---

### Implementation Notes

- **Consistency with the app**
  - Keep `Pearl` (`#F7FAFA`) as the default page background.
  - Use `Cormorant Garamond` for major headings and `Lora` for reading content to preserve the app’s editorial feel.
  - Reuse the spacing scale and 12px border radius wherever possible so the web layout feels like a natural extension of the mobile app.









