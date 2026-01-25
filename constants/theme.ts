// Light theme colors (default)
export const lightColors = {
  deepTeal: "#2C5F5D",
  ocean: "#4A8B8D",
  seafoam: "#7EBDC3",
  mist: "#B8D8D8",
  cloud: "#E8F3F3",
  pearl: "#F7FAFA",
  ink: "#2D3E3F",
  // Light mode gradient colors (same as deepTeal/ocean)
  headerGradientStart: "#2C5F5D",
  headerGradientEnd: "#4A8B8D",
};

// Dark theme colors
export const darkColors = {
  deepTeal: "#7EBDC3",    // Inverted: seafoam becomes primary accent
  ocean: "#5A9B9D",       // Slightly lighter for dark mode
  seafoam: "#4A8B8D",     // Adjusted for dark backgrounds
  mist: "#3A4A4B",        // Dark muted background
  cloud: "#2A3536",       // Darker card background
  pearl: "#1A2223",       // Dark background
  ink: "#E8F3F3",         // Light text on dark
  // Dark mode specific gradient colors (darker teal)
  headerGradientStart: "#1A3A3A",
  headerGradientEnd: "#2A4A4B",
};

// Color palette type for type safety
export type ColorPalette = typeof lightColors;

// Legacy export for backward compatibility (will be removed after migration)
export const colors = lightColors;

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

