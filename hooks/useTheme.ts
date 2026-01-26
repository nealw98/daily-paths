import { useColorScheme } from "react-native";
import { useSettings, ColorScheme } from "./useSettings";
import { lightColors, darkColors, ColorPalette } from "../constants/theme";

/**
 * Hook that returns the current color palette based on user preference.
 * 
 * - If colorScheme is "light", returns lightColors
 * - If colorScheme is "dark", returns darkColors  
 * - If colorScheme is "system", follows the device's dark mode setting
 */
export function useTheme(): { colors: ColorPalette; isDark: boolean; colorScheme: ColorScheme } {
  const { settings } = useSettings();
  const systemColorScheme = useColorScheme();
  
  // Determine if we should use dark mode
  let isDark: boolean;
  if (settings.colorScheme === "system") {
    isDark = systemColorScheme === "dark";
  } else {
    isDark = settings.colorScheme === "dark";
  }
  
  return {
    colors: isDark ? darkColors : lightColors,
    isDark,
    colorScheme: settings.colorScheme,
  };
}
