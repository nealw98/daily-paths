/**
 * Theme system: semantic color roles and selectable color schemes.
 * Add new schemes to COLOR_SCHEMES; components use useTheme().colors (semantic or legacy names).
 */

// ─── Semantic color roles (use these for new code) ─────────────────────────
// Core 5: accent, text, surface (card/modal), background, textMuted (textSecondary/heroEnd).
// 6th: textOnAccent (text on primary buttons, selected chips). 7th: border. Optional: backdrop.
export interface SemanticPalette {
  heroGradientStart: string;
  heroGradientEnd: string;
  background: string;
  backgroundSecondary: string;
  text: string;
  textSecondary: string;
  accent: string;
  highlight: string;
  modalBackground: string;
  modalBorder: string;
  cardBackground: string;
  buttonPrimary: string;
  buttonSecondary: string;
  /** Text on primary buttons and selected state (e.g. white or cream). */
  textOnAccent: string;
  /** Dividers, input borders, card outlines. */
  border: string;
  /** Full-screen overlay behind modals (e.g. rgba). */
  backdrop: string;
  /** Destructive actions: delete, sign-out, errors. */
  danger: string;
  /** Calendar month label background. */
  calendarMonthBackground: string;
  /** Calendar day number background. */
  calendarDayBackground: string;
  /** Calendar card border/outline. */
  calendarBorder: string;
  /** Calendar day number text color. */
  calendarDayText: string;
}

// Legacy names (same values as semantic; kept so existing components keep working)
export interface LegacyColorNames {
  deepTeal: string;
  ocean: string;
  seafoam: string;
  mist: string;
  cloud: string;
  pearl: string;
  ink: string;
  headerGradientStart: string;
  headerGradientEnd: string;
}

export interface SanctuaryRoles {
  surface: string;
  surfaceContainerLowest: string;
  surfaceContainerLow: string;
  surfaceContainer: string;
  surfaceContainerHigh: string;
  surfaceContainerHighest: string;
  surfaceGlass: string;
  surfaceGlassStrong: string;
  onSurface: string;
  onSurfaceVariant: string;
  primary: string;
  onPrimary: string;
  primaryContainer: string;
  onPrimaryContainer: string;
  secondary: string;
  onSecondary: string;
  secondaryContainer: string;
  onSecondaryContainer: string;
  outlineVariant: string;
  ghostBorder: string;
  focusRing: string;
  primaryFixed: string;
  primaryFixedDim: string;
  scrim: string;
  ambientShadow: string;
}

function withAlpha(hex: string, alpha: string): string {
  if (!hex.startsWith("#")) return hex;
  const normalized = hex.length === 4
    ? `#${hex[1]}${hex[1]}${hex[2]}${hex[2]}${hex[3]}${hex[3]}`
    : hex;
  return `${normalized}${alpha}`;
}

/**
 * Terracotta subscription palette — same across color schemes so paywall / trial
 * UI stays visually consistent (home unlock pill, trial sheet, etc.).
 */
const SUBSCRIPTION_BAR_HEX = "#8F5546";

export const subscriptionTerracottaColors = {
  /** Wide subscription CTA bar (e.g. home unlock pill). */
  subscriptionBar: SUBSCRIPTION_BAR_HEX,
  /** Lighter terracotta — chip text, secondary accents on subscription UI. */
  subscriptionAccent: "#C58B7B",
  /** Text on `subscriptionBar` (and inverse surfaces like the Subscribe chip). */
  subscriptionOnBar: "#FFFFFF",
  /** Headlines on subscription / trial sheets (deep terracotta). */
  subscriptionTitle: "#6B3D2E",
  /** Same hue as `subscriptionBar` at ~10% opacity (8‑digit hex) for secondary CTAs. */
  subscriptionSecondaryPill: withAlpha(SUBSCRIPTION_BAR_HEX, "1A"),
  /** Body copy on subscription sheets; use `onSurface` in components when the sheet is dark. */
  subscriptionSheetText: "#1A1A1A",
  /** Cream CTA surface (home unlock chip, trial sheet primary). */
  subscriptionCtaCream: "#E8D8D0",
  /** Text on cream CTA — dark for contrast on the light chip. */
  subscriptionOnCream: "#1C2524",
} as const;

export type ColorPalette = SemanticPalette &
  LegacyColorNames &
  SanctuaryRoles &
  typeof subscriptionTerracottaColors;

export interface ColorSchemeDef {
  id: string;
  name: string;
  /** Used for BlurView tint, status bar, etc. */
  dark: boolean;
  colors: ColorPalette;
}

function buildPalette(
  semantic: SemanticPalette,
  overrides: Partial<SanctuaryRoles> = {},
): ColorPalette {
  const sanctuary: SanctuaryRoles = {
    surface: semantic.background,
    surfaceContainerLowest: semantic.modalBackground,
    surfaceContainerLow: semantic.backgroundSecondary,
    surfaceContainer: semantic.cardBackground,
    surfaceContainerHigh: semantic.cardBackground,
    surfaceContainerHighest: semantic.modalBorder,
    surfaceGlass: withAlpha(semantic.background, "CC"),
    surfaceGlassStrong: withAlpha(semantic.background, "E6"),
    onSurface: semantic.text,
    onSurfaceVariant: semantic.textSecondary,
    primary: semantic.heroGradientStart,
    onPrimary: semantic.textOnAccent,
    primaryContainer: semantic.heroGradientEnd,
    onPrimaryContainer: semantic.textOnAccent,
    secondary: semantic.buttonPrimary,
    onSecondary: semantic.textOnAccent,
    secondaryContainer: semantic.buttonSecondary,
    onSecondaryContainer: semantic.text,
    outlineVariant: semantic.border,
    ghostBorder: withAlpha(semantic.border, "26"),
    focusRing: semantic.heroGradientStart,
    primaryFixed: semantic.heroGradientEnd,
    primaryFixedDim: semantic.heroGradientStart,
    scrim: "rgba(0, 0, 0, 0.10)",
    ambientShadow: "rgba(25, 28, 28, 0.06)",
    ...overrides,
  };

  return {
    ...semantic,
    ...sanctuary,
    ...subscriptionTerracottaColors,
    deepTeal: semantic.accent,
    ocean: semantic.textSecondary,
    seafoam: semantic.highlight,
    mist: semantic.modalBorder,
    cloud: semantic.cardBackground,
    pearl: semantic.background,
    ink: semantic.text,
    headerGradientStart: semantic.heroGradientStart,
    headerGradientEnd: semantic.heroGradientEnd,
  };
}

// ─── Ocean (current app palette) ────────────────────────────────────────────
const oceanLightSemantic: SemanticPalette = {
  heroGradientStart: "#2D4C47",
  heroGradientEnd: "#214743",
  background: "#F8FAF9",
  backgroundSecondary: "#F2F4F3",
  text: "#1C2524",
  textSecondary: "#5A6C69",
  accent: "#376662",
  highlight: "#BAECE6",
  modalBackground: "#FFFFFF",
  modalBorder: "#C6D2CF",
  cardBackground: "#EDF1EF",
  buttonPrimary: "#376662",
  buttonSecondary: "#BAECE6",
  textOnAccent: "#FFFFFF",
  border: "#9EAEAA",
  backdrop: "rgba(0, 0, 0, 0.5)",
  danger: "#DC3545",
  calendarMonthBackground: "#2D4C47",
  calendarDayBackground: "#FFFFFF",
  calendarBorder: "rgba(45, 76, 71, 0.10)",
  calendarDayText: "#2D4C47",
};

const oceanDarkSemantic: SemanticPalette = {
  heroGradientStart: "#102725",
  heroGradientEnd: "#163531",
  background: "#111918",
  backgroundSecondary: "#172120",
  text: "#EFF4F2",
  textSecondary: "#A0B5B1",
  accent: "#6EA59F",
  highlight: "#2E4C48",
  modalBackground: "#1B2625",
  modalBorder: "#31403E",
  cardBackground: "#202B2A",
  buttonPrimary: "#6EA59F",
  buttonSecondary: "#23423F",
  textOnAccent: "#FFFFFF",
  border: "#536561",
  backdrop: "rgba(0, 0, 0, 0.6)",
  danger: "#E5585A",
  calendarMonthBackground: "#163531",
  calendarDayBackground: "#202B2A",
  calendarBorder: "#31403E",
  calendarDayText: "#EFF4F2",
};

// ─── Forest (example second theme) ──────────────────────────────────────────
const forestLightSemantic: SemanticPalette = {
  heroGradientStart: "#2D5A2D",
  heroGradientEnd: "#3D7A3D",
  background: "#F5FAF5",
  backgroundSecondary: "#E5F0E5",
  text: "#2A3A2A",
  textSecondary: "#3D7A3D",
  accent: "#2D5A2D",
  highlight: "#5A9A5A",
  modalBackground: "#F5FAF5",
  modalBorder: "#B8D8B8",
  cardBackground: "#E5F0E5",
  buttonPrimary: "#2D5A2D",
  buttonSecondary: "#5A9A5A",
  textOnAccent: "#FFFFFF",
  border: "#B8D8B8",
  backdrop: "rgba(0, 0, 0, 0.5)",
  danger: "#DC3545",
  calendarMonthBackground: "#2D5A2D",
  calendarDayBackground: "rgba(255, 255, 255, 0.65)",
  calendarBorder: "rgba(255, 255, 255, 0.25)",
  calendarDayText: "#2D5A2D", // Dark forest green on light background
};

const forestDarkSemantic: SemanticPalette = {
  heroGradientStart: "#1A3020",
  heroGradientEnd: "#2A4030",
  background: "#1A221C",
  backgroundSecondary: "#252E26",
  text: "#E5F0E5",
  textSecondary: "#5A9A5A",
  accent: "#7EBD7E",
  highlight: "#4A8B4A",
  modalBackground: "#1A221C",
  modalBorder: "#3A4A3A",
  cardBackground: "#252E26",
  buttonPrimary: "#7EBD7E",
  buttonSecondary: "#4A8B4A",
  textOnAccent: "#FFFFFF",
  border: "#3A4A3A",
  backdrop: "rgba(0, 0, 0, 0.6)",
  danger: "#E5585A",
  calendarMonthBackground: "#1A3020", // Dark
  calendarDayBackground: "#E5F0E5", // Light text color
  calendarBorder: "#E5F0E5", // Light text color outline
  calendarDayText: "#1A3020", // Dark color on light background
};

// ─── Deep Sea (dark maritime with better readability) ───────────
// Ink Black #0D1321, Deep Space Blue #1D2D44, Blue Slate #3E5C76, Dusty Denim #748CAB, Eggshell #F0EBD8
const deepSeaSemantic: SemanticPalette = {
  heroGradientStart: "#1D2D44",  // Deep Space Blue
  heroGradientEnd: "#3E5C76",   // Blue Slate (gradient from dark to light)
  background: "#1D2D44",         // Deep Space Blue (was Ink Black - too dark)
  backgroundSecondary: "#2A3D54", // Between Deep Space and Blue Slate
  text: "#F0EBD8",              // Eggshell
  textSecondary: "#748CAB",     // Dusty Denim
  accent: "#748CAB",            // Dusty Denim (lighter, more visible)
  highlight: "#8BA3C4",          // Lighter than Dusty Denim
  modalBackground: "#2A3D54",   // Lighter modal
  modalBorder: "#3E5C76",       // Blue Slate
  cardBackground: "#2A3D54",
  buttonPrimary: "#748CAB",     // Dusty Denim (more prominent)
  buttonSecondary: "#3E5C76",   // Blue Slate
  textOnAccent: "#F0EBD8",      // Eggshell
  border: "#3E5C76",            // Blue Slate
  backdrop: "rgba(0, 0, 0, 0.6)",
  danger: "#E5585A",
  calendarMonthBackground: "#3E5C76", // heroGradientEnd (Blue Slate)
  calendarDayBackground: "#2A3D54", // backgroundSecondary
  calendarBorder: "#3E5C76",     // Blue Slate border
  calendarDayText: "#F0EBD8", // Eggshell for visibility
};

// ─── Burgundy Rose (sophisticated rose tones, elegant and warm) ────────────
// Deep Rose #8B3A52, Rich Rose #A05566, Rose Taupe #C5979D, Blush #E5C7CD, Warm Cream #FAF6F3
const burgundyRoseSemantic: SemanticPalette = {
  heroGradientStart: "#660033",  // Dark Maroon/Burgundy
  heroGradientEnd: "#8B3A52",   // Deep Rose (gradient from dark to rose)
  background: "#FAF6F3",         // Warm Cream
  backgroundSecondary: "#F4E8EB", // Light blush tint
  text: "#5A2636",               // Very deep rose burgundy
  textSecondary: "#8B3A52",      // Deep Rose
  accent: "#8B3A52",             // Deep Rose
  highlight: "#C5979D",          // Rose Taupe
  modalBackground: "#FAF6F3",   // Warm Cream
  modalBorder: "#E5C7CD",       // Blush
  cardBackground: "#F4E8EB",
  buttonPrimary: "#8B3A52",     // Deep Rose
  buttonSecondary: "#C5979D",   // Rose Taupe
  textOnAccent: "#FAF6F3",      // Warm Cream on buttons
  border: "#E5C7CD",             // Blush
  backdrop: "rgba(0, 0, 0, 0.5)",
  danger: "#DC3545",
  calendarMonthBackground: "#660033", // Dark Maroon/Burgundy
  calendarDayBackground: "rgba(255, 255, 255, 0.65)",
  calendarBorder: "rgba(255, 255, 255, 0.25)",
  calendarDayText: "#660033", // Dark maroon on light background
};

// ─── Rose Quartz (soft pink pastels, delicate and feminine) ────────────
// Deep Plum #A8305C, Deep Rose #E85A8F, Medium Pink #FF99CC, Soft Pink #FFB3D9, Light Blush #FFC9E0, Warm Cream #FFF5F0
const roseQuartzSemantic: SemanticPalette = {
  heroGradientStart: "#A8305C",  // Deep Plum (richer, more purple-toned)
  heroGradientEnd: "#E85A8F",   // Deep Rose (gradient from plum to rose)
  background: "#FFF5F0",         // Warm Cream
  backgroundSecondary: "#FFE8F0", // Very light pink tint
  text: "#6B1E3F",               // Very deep burgundy for readability
  textSecondary: "#A8305C",      // Deep Plum
  accent: "#E85A8F",             // Deep Rose
  highlight: "#FF99CC",          // Medium Pink
  modalBackground: "#FFF5F0",   // Warm Cream
  modalBorder: "#FFC9E0",       // Light Blush
  cardBackground: "#FFE8F0",
  buttonPrimary: "#A8305C",     // Deep Plum
  buttonSecondary: "#E85A8F",   // Deep Rose
  textOnAccent: "#FFFFFF",      // White on buttons
  border: "#FFC9E0",             // Light Blush
  backdrop: "rgba(0, 0, 0, 0.5)",
  danger: "#DC3545",
  calendarMonthBackground: "#A8305C", // Deep Plum
  calendarDayBackground: "rgba(255, 255, 255, 0.7)",
  calendarBorder: "rgba(255, 255, 255, 0.3)",
  calendarDayText: "#A8305C", // Deep plum on light background
};

// ─── Desert Twilight (dramatic sunset: purple to orange gradient) ──────────
// Deep Purple #7B4B94, Hot Pink #E74C8C, Vibrant Coral #FF6B6B, Sunset Orange #FF9557, Cream #FFF8F0
const twilightFireSemantic: SemanticPalette = {
  heroGradientStart: "#7B4B94",  // Deep Purple (more saturated twilight)
  heroGradientEnd: "#FF9557",   // Sunset Orange (vibrant)
  background: "#FFF8F0",         // Warm Cream
  backgroundSecondary: "#FFE8D6", // Light peach tint
  text: "#5A2645",               // Deep purple
  textSecondary: "#E74C8C",      // Hot Pink (reading title color)
  accent: "#FF6B6B",             // Vibrant Coral
  highlight: "#FF9557",          // Sunset Orange
  modalBackground: "#FFF8F0",   // Warm Cream
  modalBorder: "#FFC4A8",       // Saturated peach
  cardBackground: "#FFE8D6",
  buttonPrimary: "#FF6B6B",     // Vibrant Coral
  buttonSecondary: "#E74C8C",   // Hot Pink
  textOnAccent: "#FFFFFF",
  border: "#FFC4A8",             // Saturated peach
  backdrop: "rgba(0, 0, 0, 0.5)",
  danger: "#DC3545",
  calendarMonthBackground: "#9B6BB4", // Lighter purple (between deep purple and gradient midpoint)
  calendarDayBackground: "rgba(255, 255, 255, 0.75)",
  calendarBorder: "rgba(255, 255, 255, 0.35)",
  calendarDayText: "#7B4B94", // Deep purple on light background
};

// ─── Cotton Candy (single palette: all 5 colors, candy-sweet light) ───────
// Dust Grey #D6D2D2, Lavender Veil #F1E4F3, Soft Blossom #F4BBD3, Pink Carnation #F686BD, Rose Kiss #FE5D9F
const cottonCandySemantic: SemanticPalette = {
  heroGradientStart: "#FE5D9F",  // Rose Kiss (solid hero)
  heroGradientEnd: "#FE5D9F",   // same = no gradient
  background: "#F1E4F3",         // Lavender Veil
  backgroundSecondary: "#F4BBD3",
  text: "#FE5D9F",               // Rose Kiss
  textSecondary: "#F686BD",      // Pink Carnation
  accent: "#FE5D9F",             // Rose Kiss
  highlight: "#F686BD",          // Pink Carnation
  modalBackground: "#F4BBD3",   // Soft Blossom
  modalBorder: "#D6D2D2",       // Dust Grey
  cardBackground: "#F4BBD3",
  buttonPrimary: "#FE5D9F",     // Rose Kiss
  buttonSecondary: "#F686BD",   // Pink Carnation
  textOnAccent: "#FFFFFF",
  border: "#D6D2D2",             // Dust Grey
  backdrop: "rgba(0, 0, 0, 0.5)",
  danger: "#DC3545",
  calendarMonthBackground: "#FE5D9F", // Rose Kiss
  calendarDayBackground: "rgba(255, 255, 255, 0.65)",
  calendarBorder: "rgba(255, 255, 255, 0.25)",
  calendarDayText: "#FE5D9F", // Rose Kiss on light background
};

// ─── Twilight Sky (single palette: light dreamy blue-purple) ───────────────
// Frozen Lake #97DFFC, Sky Blue #93CAF6, Soft Periwinkle #858AE3, Slate Blue #7364D2, Rebecca Purple #5829A7
const twilightSkySemantic: SemanticPalette = {
  heroGradientStart: "#93CAF6",  // Sky Blue
  heroGradientEnd: "#858AE3",   // Soft Periwinkle
  background: "#F5FBFE",         // Very light blue tint
  backgroundSecondary: "#E8F5FD", // Slightly deeper light blue
  text: "#5829A7",               // Rebecca Purple (rich contrast)
  textSecondary: "#7364D2",      // Slate Blue
  accent: "#7364D2",             // Slate Blue
  highlight: "#93CAF6",          // Sky Blue
  modalBackground: "#F5FBFE",   // Very light blue tint
  modalBorder: "#C8E5F8",       // Soft blue border
  cardBackground: "#E8F5FD",
  buttonPrimary: "#7364D2",     // Slate Blue
  buttonSecondary: "#93CAF6",   // Sky Blue
  textOnAccent: "#FFFFFF",
  border: "#C8E5F8",             // Soft blue border
  backdrop: "rgba(0, 0, 0, 0.5)",
  danger: "#DC3545",
  calendarMonthBackground: "#7364D2", // Slate Blue
  calendarDayBackground: "rgba(255, 255, 255, 0.65)",
  calendarBorder: "rgba(255, 255, 255, 0.25)",
  calendarDayText: "#5829A7", // Rebecca Purple on light background
};

// ─── Soft Mauve (warm plum-to-rose gradient — nurturing and alive) ────────
// Deep Berry #4A2040, Warm Plum #7D4E6A, Rosé Mauve #9E7B8E, Soft Petal #C9AAB8, Blush Mist #E3CED6, Warm Cream #FAF5F2
const softMauveSemantic: SemanticPalette = {
  heroGradientStart: "#4A2040",  // Deep Berry (rich depth)
  heroGradientEnd: "#6B3A58",   // Warm Plum (subtle shift, stays rich)
  background: "#FAF5F2",         // Warm Cream (gentle, alive)
  backgroundSecondary: "#F2E6EB", // Pale rose tint
  text: "#3D2235",               // Deep berry-ink (rich but not harsh)
  textSecondary: "#7D4E6A",      // Warm Plum (vibrant secondary)
  accent: "#7D4E6A",             // Warm Plum (confident, not dusty)
  highlight: "#C9AAB8",          // Soft Petal (luminous highlight)
  modalBackground: "#FAF5F2",   // Warm Cream
  modalBorder: "#E3CED6",       // Blush Mist
  cardBackground: "#F2E6EB",    // Pale rose
  buttonPrimary: "#6B3A58",     // Rich plum (strong, warm)
  buttonSecondary: "#C9AAB8",   // Soft Petal
  textOnAccent: "#FAF5F2",      // Warm Cream on buttons
  border: "#E3CED6",             // Blush Mist
  backdrop: "rgba(0, 0, 0, 0.5)",
  danger: "#DC3545",
  calendarMonthBackground: "#4A2040", // Deep Berry
  calendarDayBackground: "rgba(255, 255, 255, 0.65)",
  calendarBorder: "rgba(255, 255, 255, 0.25)",
  calendarDayText: "#4A2040", // Deep berry on light background
};

// ─── Coffee Break (dark: cream accents on deep coffee base) ─────────────
// Black Coffee #1A1210, Dark Brew #2C2220, Mocha #4A3830, Latte #A88E78, Cream #E8DDD0, Milk Foam #F5F0E8
const champagneSemantic: SemanticPalette = {
  heroGradientStart: "#2C2220",  // Dark Brew (rich coffee)
  heroGradientEnd: "#4A3830",   // Mocha (warm, visible shift)
  background: "#1A1210",         // Black Coffee (deep, clean dark)
  backgroundSecondary: "#2C2220", // Dark Brew
  text: "#F5F0E8",               // Milk Foam (crisp, warm white)
  textSecondary: "#A88E78",      // Latte (warm, readable on dark)
  accent: "#A88E78",             // Latte
  highlight: "#4A3830",          // Mocha (muted glow)
  modalBackground: "#2C2220",   // Dark Brew
  modalBorder: "#4A3830",       // Mocha
  cardBackground: "#2C2220",    // Dark Brew
  buttonPrimary: "#A88E78",     // Latte (pops on dark)
  buttonSecondary: "#4A3830",   // Mocha
  textOnAccent: "#F5F0E8",      // Milk Foam on header and buttons
  border: "#4A3830",             // Mocha
  backdrop: "rgba(0, 0, 0, 0.6)",
  danger: "#E5585A",
  calendarMonthBackground: "#4A3830", // Mocha
  calendarDayBackground: "#2C2220", // Dark Brew
  calendarBorder: "#4A3830",     // Mocha
  calendarDayText: "#F5F0E8", // Milk Foam on dark
};

// ─── Peach Blossom (soft peach-pink pastels — #FFE8DB / #FAF7F3 base) ────
// Rose Clay #9E5A5A, Dusty Rose #B87878, Soft Peach #EDBAAC, Blush Pink #FFE8DB, Petal #FAF7F3, Near White #FEFCFA
const peachBlossomSemantic: SemanticPalette = {
  heroGradientStart: "#F5C4B0",  // Warm peach-pink (richer, more presence)
  heroGradientEnd: "#FFE0D2",   // Soft peach-pink (still pastel, subtle shift)
  background: "#FEFCFA",         // Near White (whisper of warmth)
  backgroundSecondary: "#FAF7F3", // Petal
  text: "#5C3030",               // Deep rose (warm, readable on light)
  textSecondary: "#9E5A5A",      // Rose Clay (pink-leaning, not brown)
  accent: "#B87878",             // Dusty Rose (warm pink, not coral)
  highlight: "#FFE8DB",          // Blush Pink (soft glow)
  modalBackground: "#FEFCFA",   // Near White
  modalBorder: "#FFE8DB",       // Blush Pink
  cardBackground: "#FAF7F3",    // Petal
  buttonPrimary: "#9E5A5A",     // Rose Clay (visible, warm)
  buttonSecondary: "#EDBAAC",   // Soft Peach
  textOnAccent: "#5C3030",      // Deep rose — dark text on pastel header
  border: "#FFE8DB",             // Blush Pink
  backdrop: "rgba(0, 0, 0, 0.5)",
  danger: "#DC3545",
  calendarMonthBackground: "#F5D0C4", // Slightly deeper peach (readable with dark text)
  calendarDayBackground: "rgba(255, 255, 255, 0.65)",
  calendarBorder: "rgba(255, 255, 255, 0.25)",
  calendarDayText: "#5C3030", // Deep rose on light
};

// ─── Morning Light (pastel yellow #FFF2C6/#FFF8DE — sunny, warm, gentle) ─
// Amber Brown #6B5030, Warm Caramel #9A7650, Honey #C4A060, Soft Yellow #FFFDCE, Pastel Yellow #FFF2C6, Light Yellow #FFF8DE, Yellow White #FFFEF5
const morningLightSemantic: SemanticPalette = {
  heroGradientStart: "#F6D27A",  // Warm golden sunrise
  heroGradientEnd: "#FFF1C9",   // Pale morning cream
  background: "#FFFEF5",         // Yellow White (barely there warmth)
  backgroundSecondary: "#FFFBEA", // Lighter morning wash
  text: "#5C4020",               // Amber Brown (warm, high contrast on yellow)
  textSecondary: "#9A7650",      // Warm Caramel (harmonizes with yellow)
  accent: "#9A7650",             // Warm Caramel
  highlight: "#FFFDCE",          // Soft Yellow (gentle glow)
  modalBackground: "#FFFEF5",   // Yellow White
  modalBorder: "#FFF2C6",       // Pastel Yellow
  cardBackground: "#FFFBEA",    // Slightly lighter than before for more contrast with header
  buttonPrimary: "#7A5C38",     // Rich amber (visible, warm)
  buttonSecondary: "#C4A060",   // Honey
  textOnAccent: "#5C4020",      // Amber Brown — dark text on pastel yellow header
  border: "#FFF2C6",             // Pastel Yellow
  backdrop: "rgba(0, 0, 0, 0.5)",
  danger: "#DC3545",
  calendarMonthBackground: "#F5E8A0", // Warm pastel yellow (darker than header, readable with dark text)
  calendarDayBackground: "rgba(255, 255, 255, 0.65)",
  calendarBorder: "rgba(255, 255, 255, 0.25)",
  calendarDayText: "#5C4020", // Amber brown on light
};

// ─── All selectable color schemes ──────────────────────────────────────────
// Ocean is the default palette: "Light" and "Dark" (no named palette in the UI).
// Other entries (Deep Sea, Cotton Candy, etc.) are named color palettes (single theme each).
export const COLOR_SCHEMES: ColorSchemeDef[] = [
  {
    id: "ocean-light",
    name: "Light",
    dark: false,
    colors: buildPalette(oceanLightSemantic, {
      surfaceContainerLowest: "#FFFFFF",
      surfaceContainerLow: "#F2F4F3",
      surfaceContainer: "#EDF1EF",
      surfaceContainerHigh: "#E7ECEA",
      surfaceContainerHighest: "#D9E1DE",
      primary: "#2D4C47",
      primaryContainer: "#214743",
      secondary: "#376662",
      secondaryContainer: "#BAECE6",
      onSecondaryContainer: "#2D514E",
      outlineVariant: "#9EAEAA",
      focusRing: "#214743",
      primaryFixed: "#214743",
      primaryFixedDim: "#2D4C47",
    }),
  },
  {
    id: "ocean-dark",
    name: "Dark",
    dark: true,
    colors: buildPalette(oceanDarkSemantic, {
      surfaceContainerLowest: "#1B2625",
      surfaceContainerLow: "#172120",
      surfaceContainer: "#202B2A",
      surfaceContainerHigh: "#263231",
      surfaceContainerHighest: "#31403E",
      primary: "#6EA59F",
      primaryContainer: "#A0B5B1",
      secondary: "#6EA59F",
      secondaryContainer: "#23423F",
      onSecondaryContainer: "#D7EBE7",
      outlineVariant: "#536561",
      ghostBorder: "rgba(159, 181, 177, 0.15)",
      focusRing: "#6EA59F",
      primaryFixed: "#214743",
      primaryFixedDim: "#163531",
    }),
  },
  {
    id: "forest-light",
    name: "Forest (Light)",
    dark: false,
    colors: buildPalette(forestLightSemantic),
  },
  {
    id: "forest-dark",
    name: "Forest (Dark)",
    dark: true,
    colors: buildPalette(forestDarkSemantic, {
      primary: "#7EBD7E",
      primaryContainer: "#A8D4A8",
    }),
  },
  {
    id: "deep-sea",
    name: "Deep Sea",
    dark: true,
    colors: buildPalette(deepSeaSemantic, {
      primary: "#748CAB",
      primaryContainer: "#A8B8CC",
    }),
  },
  {
    id: "burgundy-rose",
    name: "Rose Garden",
    dark: false,
    colors: buildPalette(burgundyRoseSemantic),
  },
  {
    id: "twilight-fire",
    name: "Desert Twilight",
    dark: false,
    colors: buildPalette(twilightFireSemantic),
  },
  {
    id: "soft-mauve",
    name: "Plum",
    dark: false,
    colors: buildPalette(softMauveSemantic),
  },
  {
    id: "champagne",
    name: "Coffee Break",
    dark: true,
    colors: buildPalette(champagneSemantic, {
      primary: "#A88E78",
      primaryContainer: "#C4AE9A",
    }),
  },
  {
    id: "peach-blossom",
    name: "Peach Blossom",
    dark: false,
    colors: buildPalette(peachBlossomSemantic),
  },
  {
    id: "morning-light",
    name: "Morning Light",
    dark: false,
    colors: buildPalette(morningLightSemantic),
  },
];

const schemeById = new Map(COLOR_SCHEMES.map((s) => [s.id, s]));

export function getColorsForScheme(schemeId: string): ColorPalette {
  const scheme = schemeById.get(schemeId);
  if (scheme) return scheme.colors;
  return COLOR_SCHEMES[0].colors;
}

export function getScheme(schemeId: string): ColorSchemeDef | undefined {
  return schemeById.get(schemeId);
}

export function getHeaderGradientPoints(themeId: string): {
  start: { x: number; y: number };
  end: { x: number; y: number };
} {
  if (themeId === "morning-light") {
    return {
      start: { x: 0.5, y: 0 },
      end: { x: 0.5, y: 1 },
    };
  }

  if (themeId === "twilight-fire") {
    return {
      start: { x: 0, y: 0 },
      end: { x: 0, y: 1 },
    };
  }

  return {
    start: { x: 0, y: 0 },
    end: { x: 1, y: 1 },
  };
}

// Fallback palette for use before SettingsProvider mounts (e.g. loading screen in _layout.tsx).
// Components should use useTheme().colors instead of importing this directly.
export const fallbackColors = COLOR_SCHEMES[0].colors;

// ─── Typography and layout ──────────────────────────────────────────────────
export const fonts = {
  headerFamilyLight: "Manrope_300Light",
  headerFamily: "Manrope_700Bold",
  headerFamilyItalic: "Manrope_700Bold",
  headerFamilyBoldItalic: "Manrope_800ExtraBold",
  bodyFamily: "Manrope_400Regular",
  bodyFamilyRegular: "Manrope_500Medium",
  bodyFamilyMedium: "Manrope_500Medium",
  bodyFamilySemiBold: "Manrope_600SemiBold",
  bodyFamilyBold: "Manrope_700Bold",
  loraRegular: "Manrope_400Regular",
  loraItalic: "Manrope_500Medium",
  loraBold: "Manrope_700Bold",
  labelFamily: "Manrope_600SemiBold",
};

export const layout = {
  borderRadius: 12,
  borderRadiusLarge: 16,
  borderRadiusFull: 999,
  spacing: {
    xs: 4,
    sm: 8,
    md: 16,
    lgPlus: 20,
    lg: 24,
    xl: 32,
    xxl: 40,
  },
};

export const typography = {
  h1: {
    fontFamily: fonts.headerFamilyBoldItalic,
    fontSize: 34,
    lineHeight: 40,
    letterSpacing: -0.6,
  },
  h2: {
    fontFamily: fonts.headerFamily,
    fontSize: 28,
    lineHeight: 34,
    letterSpacing: -0.4,
  },
  h3: {
    fontFamily: fonts.headerFamily,
    fontSize: 21,
    lineHeight: 27,
    letterSpacing: -0.2,
  },
  bodyLarge: {
    fontFamily: fonts.bodyFamilyMedium,
    fontSize: 19,
    lineHeight: 32,
    letterSpacing: -0.1,
  },
  // Quote block variant: tighter leading to visually group quote text.
  quoteBox: {
    fontFamily: fonts.bodyFamilyMedium,
    fontSize: 19,
    lineHeight: 26,
    letterSpacing: -0.1,
  },
  body: {
    fontFamily: fonts.bodyFamilyRegular,
    fontSize: 17,
    lineHeight: 28,
    letterSpacing: -0.1,
  },
  bodySmall: {
    fontFamily: fonts.bodyFamily,
    fontSize: 15,
    lineHeight: 24,
    letterSpacing: -0.08,
  },
  label: {
    fontFamily: fonts.labelFamily,
    fontSize: 13,
    lineHeight: 20,
    letterSpacing: -0.05,
  },
  caption: {
    fontFamily: fonts.bodyFamily,
    fontSize: 12,
    lineHeight: 16,
    letterSpacing: 0.4,
  },
  // Legacy mappings (deprecated)
  displayLarge: {
    fontFamily: fonts.headerFamilyBoldItalic,
    fontSize: 34,
    lineHeight: 40,
    letterSpacing: -0.6,
  },
  displayMedium: {
    fontFamily: fonts.headerFamily,
    fontSize: 28,
    lineHeight: 34,
    letterSpacing: -0.4,
  },
  headlineMedium: {
    fontFamily: fonts.headerFamily,
    fontSize: 24,
    lineHeight: 30,
    letterSpacing: -0.3,
  },
  titleLarge: {
    fontFamily: fonts.headerFamily,
    fontSize: 20,
    lineHeight: 26,
    letterSpacing: -0.2,
  },
  titleMedium: {
    fontFamily: fonts.bodyFamilySemiBold,
    fontSize: 16,
    lineHeight: 22,
    letterSpacing: -0.1,
  },
  bodyMedium: {
    fontFamily: fonts.bodyFamilyRegular,
    fontSize: 17,
    lineHeight: 28,
    letterSpacing: -0.1,
  },
  labelMedium: {
    fontFamily: fonts.labelFamily,
    fontSize: 12,
    lineHeight: 16,
    letterSpacing: 0.4,
  },
};

export const shadows = {
  ambient: {
    shadowColor: "#191C1C",
    shadowOpacity: 0.06,
    shadowRadius: 32,
    shadowOffset: { width: 0, height: 12 },
    elevation: 6,
  },
  floating: {
    shadowColor: "#191C1C",
    shadowOpacity: 0.08,
    shadowRadius: 24,
    shadowOffset: { width: 0, height: 10 },
    elevation: 5,
  },
  /** Elevated `SanctuaryCard` — same lift + edge as Daily Tools on home */
  homeSurface: {
    borderRadius: 10,
    borderWidth: 0.5,
    borderColor: "#c5dedd",
    shadowColor: "#000000",
    shadowOpacity: 0.1,
    shadowRadius: 12,
    shadowOffset: { width: 0, height: 4 },
    elevation: 4,
  },
};
