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

export type ColorPalette = SemanticPalette & LegacyColorNames;

export interface ColorSchemeDef {
  id: string;
  name: string;
  /** Used for BlurView tint, status bar, etc. */
  dark: boolean;
  colors: ColorPalette;
}

function buildPalette(semantic: SemanticPalette): ColorPalette {
  return {
    ...semantic,
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
  heroGradientStart: "#2C5F5D",
  heroGradientEnd: "#4A8B8D",
  background: "#F7FAFA",
  backgroundSecondary: "#E8F3F3",
  text: "#2D3E3F",
  textSecondary: "#4A8B8D",
  accent: "#2C5F5D",
  highlight: "#7EBDC3",
  modalBackground: "#F7FAFA",
  modalBorder: "#B8D8D8",
  cardBackground: "#E8F3F3",
  buttonPrimary: "#2C5F5D",
  buttonSecondary: "#7EBDC3",
  textOnAccent: "#FFFFFF",
  border: "#B8D8D8",
  backdrop: "rgba(0, 0, 0, 0.5)",
  calendarMonthBackground: "#2C5F5D",
  calendarDayBackground: "rgba(255, 255, 255, 0.65)",
  calendarBorder: "rgba(255, 255, 255, 0.25)",
  calendarDayText: "#2C5F5D", // Dark color on light background
};

const oceanDarkSemantic: SemanticPalette = {
  heroGradientStart: "#1A3A3A",
  heroGradientEnd: "#2A4A4B",
  background: "#1A2223",
  backgroundSecondary: "#2A3536",
  text: "#E8F3F3",
  textSecondary: "#5A9B9D",
  accent: "#7EBDC3",
  highlight: "#4A8B8D",
  modalBackground: "#1A2223",
  modalBorder: "#3A4A4B",
  cardBackground: "#2A3536",
  buttonPrimary: "#7EBDC3",
  buttonSecondary: "#4A8B8D",
  textOnAccent: "#FFFFFF",
  border: "#3A4A4B",
  backdrop: "rgba(0, 0, 0, 0.6)",
  calendarMonthBackground: "rgba(74, 139, 141, 0.6)", // Semi-transparent ocean (original from main)
  calendarDayBackground: "#2A3536", // backgroundSecondary/cloud
  calendarBorder: "#3A4A4B", // border/modalBorder/mist
  calendarDayText: "#7EBDC3", // accent/deepTeal in dark mode
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
  calendarMonthBackground: "#4A2040", // Deep Berry
  calendarDayBackground: "rgba(255, 255, 255, 0.65)",
  calendarBorder: "rgba(255, 255, 255, 0.25)",
  calendarDayText: "#4A2040", // Deep berry on light background
};

// ─── Champagne (dark: warm gold accents on rich espresso base) ───────────
// Espresso #2A2118, Dark Roast #3D3128, Warm Cocoa #524538, Toasted Almond #8A7355, Pale Gold #C8B48A, Champagne #E8D9B8
const champagneSemantic: SemanticPalette = {
  heroGradientStart: "#2A2118",  // Espresso (deep, warm dark)
  heroGradientEnd: "#6B5A42",   // Warm Toffee (visible gradient, like Deep Sea's spread)
  background: "#2A2118",         // Espresso
  backgroundSecondary: "#3D3128", // Dark Roast
  text: "#E8D9B8",               // Champagne (warm light on dark — high contrast)
  textSecondary: "#C8B48A",      // Pale Gold (readable on dark)
  accent: "#C8B48A",             // Pale Gold
  highlight: "#8A7355",          // Toasted Almond (muted glow)
  modalBackground: "#3D3128",   // Dark Roast
  modalBorder: "#524538",       // Warm Cocoa
  cardBackground: "#3D3128",    // Dark Roast
  buttonPrimary: "#C8B48A",     // Pale Gold (pops on dark)
  buttonSecondary: "#8A7355",   // Toasted Almond
  textOnAccent: "#FFFFFF",      // White — works on dark header and gold buttons
  border: "#524538",             // Warm Cocoa
  backdrop: "rgba(0, 0, 0, 0.6)",
  calendarMonthBackground: "#524538", // Warm Cocoa
  calendarDayBackground: "#3D3128", // Dark Roast
  calendarBorder: "#524538",     // Warm Cocoa
  calendarDayText: "#E8D9B8", // Champagne on dark
};

// ─── All selectable color schemes ──────────────────────────────────────────
// Ocean is the default palette: "Light" and "Dark" (no named palette in the UI).
// Other entries (Deep Sea, Cotton Candy, etc.) are named color palettes (single theme each).
export const COLOR_SCHEMES: ColorSchemeDef[] = [
  {
    id: "ocean-light",
    name: "Light",
    dark: false,
    colors: buildPalette(oceanLightSemantic),
  },
  {
    id: "ocean-dark",
    name: "Dark",
    dark: true,
    colors: buildPalette(oceanDarkSemantic),
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
    colors: buildPalette(forestDarkSemantic),
  },
  {
    id: "deep-sea",
    name: "Deep Sea",
    dark: true,
    colors: buildPalette(deepSeaSemantic),
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
    name: "Soft Mauve",
    dark: false,
    colors: buildPalette(softMauveSemantic),
  },
  {
    id: "champagne",
    name: "Champagne",
    dark: true,
    colors: buildPalette(champagneSemantic),
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

// Fallback palette for use before SettingsProvider mounts (e.g. loading screen in _layout.tsx).
// Components should use useTheme().colors instead of importing this directly.
export const fallbackColors = COLOR_SCHEMES[0].colors;

// ─── Fonts (for future per-theme overrides) ─────────────────────────────────
export const fonts = {
  headerFamily: "CormorantGaramond_600SemiBold",
  headerFamilyItalic: "CormorantGaramond_600SemiBold_Italic",
  headerFamilyBoldItalic: "CormorantGaramond_700Bold_Italic",
  bodyFamily: "Inter_300Light",
  bodyFamilyRegular: "Inter_400Regular",
  loraRegular: "Lora_400Regular",
  loraItalic: "Lora_400Regular_Italic",
};

export const layout = {
  borderRadius: 12,
  spacing: {
    xs: 4,
    sm: 8,
    md: 16,
    lg: 24,
    xl: 32,
  },
};
