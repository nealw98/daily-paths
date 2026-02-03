import { useColorScheme } from "react-native";
import { useSettings } from "./useSettings";
import { getColorsForScheme, getScheme, ColorPalette } from "../constants/theme";

/**
 * Returns the current color palette and theme state.
 * When colorScheme is "system", resolves theme from device appearance; otherwise uses settings.themeId.
 */
export function useTheme(): {
  colors: ColorPalette;
  isDark: boolean;
  themeId: string;
  colorScheme: "light" | "dark" | "system";
} {
  const { settings } = useSettings();
  const deviceColorScheme = useColorScheme();
  const themeId = settings.themeId ?? "ocean-light";
  // Deep Sea, Rose Garden, Rose Quartz, and Desert Twilight have no light/dark; only Ocean uses system/light/dark.
  const effectiveThemeId =
    themeId === "deep-sea" || themeId === "burgundy-rose" || themeId === "rose-quartz" || themeId === "twilight-fire"
      ? themeId
      : settings.colorScheme === "system"
        ? deviceColorScheme === "dark"
          ? "ocean-dark"
          : "ocean-light"
        : themeId;
  const colors = getColorsForScheme(effectiveThemeId);
  const scheme = getScheme(effectiveThemeId);
  const isDark = scheme?.dark ?? false;

  return {
    colors,
    isDark,
    themeId: effectiveThemeId,
    colorScheme: settings.colorScheme,
  };
}
