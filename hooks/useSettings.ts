import React from "react";
import { Platform } from "react-native";
import AsyncStorage from "@react-native-async-storage/async-storage";
import { ensureNotificationPermissions, cancelDailyReminder } from "../utils/dailyReminder";

console.log("[STARTUP] useSettings.ts module loading...");

const SETTINGS_STORAGE_KEY = "daily_paths_settings_v2";

export type TextSize = "extraSmall" | "small" | "medium" | "large" | "extraLarge";
export type ColorScheme = "light" | "dark" | "system";

export interface AppSettings {
  textSize: TextSize;
  /** Selected color scheme id (e.g. "ocean-light", "forest-dark"). */
  themeId: string;
  /** Kept for backward compat and analytics; derived from theme when using themeId. */
  colorScheme: ColorScheme;
  dailyReminderEnabled: boolean;
  dailyReminderTime: string; // "HH:MM" in 24-hour format
}

const defaultSettings: AppSettings = {
  textSize: "medium",
  themeId: "ocean-light",
  colorScheme: "light",
  dailyReminderEnabled: false,
  dailyReminderTime: "08:00",
};

interface SettingsContextValue {
  settings: AppSettings;
  loading: boolean;
  setTextSize: (size: TextSize) => Promise<void>;
  setThemeId: (themeId: string) => Promise<void>;
  setColorScheme: (scheme: ColorScheme) => Promise<void>;
  setDailyReminderEnabled: (enabled: boolean) => Promise<void>;
  setDailyReminderTime: (time: string) => Promise<void>;
}

const SettingsContext = React.createContext<SettingsContextValue | undefined>(
  undefined
);

async function loadSettings(): Promise<AppSettings> {
  try {
    const rawV2 = await AsyncStorage.getItem(SETTINGS_STORAGE_KEY);
    if (rawV2) {
      const parsed = JSON.parse(rawV2) as Partial<AppSettings>;
      const loaded = { ...defaultSettings, ...parsed };
      if (loaded.themeId == null || loaded.themeId === "") {
        loaded.themeId = parsed.colorScheme === "dark" ? "ocean-dark" : "ocean-light";
      }
      // Migrate legacy palettes to current ids
      if (loaded.themeId === "bold-berry-light" || loaded.themeId === "bold-berry-dark" || loaded.themeId === "bold-berry") loaded.themeId = "ocean-light";
      if (loaded.themeId === "rose-petal" || loaded.themeId === "purple-sunset") loaded.themeId = "ocean-light";
      if (loaded.themeId === "earthy-light" || loaded.themeId === "earthy-dark" || loaded.themeId === "earthy") loaded.themeId = "deep-sea";
      if (loaded.themeId === "cotton-candy" || loaded.themeId === "twilight-sky" || loaded.themeId === "desert-sunset" || loaded.themeId === "rose-quartz") loaded.themeId = "ocean-light";
      return loaded;
    }
    const rawV1 = await AsyncStorage.getItem("daily_paths_settings_v1");
    if (rawV1) {
      const parsed = JSON.parse(rawV1) as Partial<AppSettings>;
      const themeId =
        parsed.colorScheme === "dark"
          ? "ocean-dark"
          : parsed.colorScheme === "light"
            ? "ocean-light"
            : "ocean-light";
      const migrated: AppSettings = {
        ...defaultSettings,
        textSize: parsed.textSize ?? defaultSettings.textSize,
        themeId,
        colorScheme: themeId === "ocean-dark" ? "dark" : "light",
        dailyReminderEnabled: parsed.dailyReminderEnabled ?? defaultSettings.dailyReminderEnabled,
        dailyReminderTime: parsed.dailyReminderTime ?? defaultSettings.dailyReminderTime,
      };
      await AsyncStorage.setItem(SETTINGS_STORAGE_KEY, JSON.stringify(migrated));
      return migrated;
    }
    return defaultSettings;
  } catch (e) {
    console.warn("Failed to load app settings, using defaults", e);
    return defaultSettings;
  }
}

async function saveSettings(next: AppSettings) {
  try {
    await AsyncStorage.setItem(SETTINGS_STORAGE_KEY, JSON.stringify(next));
  } catch (e) {
    console.warn("Failed to save app settings", e);
  }
}

export const SettingsProvider: React.FC<{ children: React.ReactNode }> = ({
  children,
}) => {
  console.log("[STARTUP] SettingsProvider rendering...");
  const [settings, setSettings] = React.useState<AppSettings>(defaultSettings);
  const [loading, setLoading] = React.useState(true);

  React.useEffect(() => {
    console.log("[STARTUP] SettingsProvider useEffect running - loading settings...");
    let mounted = true;
    (async () => {
      try {
        const loaded = await loadSettings();
        console.log("[STARTUP] Settings loaded successfully:", loaded);
        if (mounted) {
          setSettings(loaded);
          setLoading(false);
        }
      } catch (err) {
        console.error("[STARTUP] ERROR loading settings:", err);
      }
    })();
    return () => {
      mounted = false;
    };
  }, []);

  const updateSettings = React.useCallback(
    async (partial: Partial<AppSettings>) => {
      setSettings((prev) => {
        const next = { ...prev, ...partial };
        // Fire and forget save
        saveSettings(next);
        return next;
      });
    },
    []
  );

  const setTextSize = React.useCallback(
    async (size: TextSize) => {
      await updateSettings({ textSize: size });
    },
    [updateSettings]
  );

  const setThemeId = React.useCallback(
    async (themeId: string) => {
      const colorScheme: ColorScheme = themeId.endsWith("-dark") ? "dark" : "light";
      await updateSettings({ themeId, colorScheme });
    },
    [updateSettings]
  );

  const setColorScheme = React.useCallback(
    async (scheme: ColorScheme) => {
      if (scheme === "system") {
        await updateSettings({ ...settings, colorScheme: "system" });
      } else {
        const themeId = scheme === "dark" ? "ocean-dark" : "ocean-light";
        await updateSettings({ colorScheme: scheme, themeId });
      }
    },
    [updateSettings, settings]
  );

  const setDailyReminderEnabled = React.useCallback(
    async (enabled: boolean) => {
      if (enabled) {
        const ok = await ensureNotificationPermissions();
        await updateSettings({ dailyReminderEnabled: ok });
      } else {
        await cancelDailyReminder();
        await updateSettings({ dailyReminderEnabled: false });
      }
    },
    [updateSettings]
  );

  const setDailyReminderTime = React.useCallback(
    async (time: string) => {
      await updateSettings({ dailyReminderTime: time });
      // Actual scheduling is handled by callers via scheduleWeekOfNotifications()
    },
    [updateSettings]
  );

  const value = React.useMemo<SettingsContextValue>(
    () => ({
      settings,
      loading,
      setTextSize,
      setThemeId,
      setColorScheme,
      setDailyReminderEnabled,
      setDailyReminderTime,
    }),
    [settings, loading, setTextSize, setThemeId, setColorScheme, setDailyReminderEnabled, setDailyReminderTime]
  );

  return React.createElement(SettingsContext.Provider, { value }, children);
};

export function useSettings(): SettingsContextValue {
  const ctx = React.useContext(SettingsContext);
  if (!ctx) {
    throw new Error("useSettings must be used within a SettingsProvider");
  }
  return ctx;
}

export function getTextSizeMetrics(textSize: TextSize): {
  h3FontSize: number;
  h3LineHeight: number;
  bodyLargeFontSize: number;
  bodyLargeLineHeight: number;
  bodyFontSize: number;
  bodyLineHeight: number;
  bodySmallFontSize: number;
  bodySmallLineHeight: number;
  labelFontSize: number;
  labelLineHeight: number;
  captionFontSize: number;
  captionLineHeight: number;
  // Deprecated legacy metrics
  favoriteFontSize: number;
  favoriteLineHeight: number;
  favoriteDateFontSize: number;
} {
  // Android renders fonts visually smaller than iOS at the same point size.
  // Set to 2 to compensate if needed; 0 for identical sizing across platforms.
  const androidBump = 0;
  
  switch (textSize) {
    case "extraSmall":
      return {
        h3FontSize: 20 + androidBump,
        h3LineHeight: 26 + androidBump,
        bodyLargeFontSize: 15 + androidBump,
        bodyLargeLineHeight: 26 + androidBump,
        bodyFontSize: 13 + androidBump,
        bodyLineHeight: 23 + androidBump,
        bodySmallFontSize: 12 + androidBump,
        bodySmallLineHeight: 20 + androidBump,
        labelFontSize: 11 + androidBump,
        labelLineHeight: 16 + androidBump,
        captionFontSize: 10 + androidBump,
        captionLineHeight: 14 + androidBump,
        favoriteFontSize: 14 + androidBump,
        favoriteLineHeight: 18 + androidBump,
        favoriteDateFontSize: 12 + androidBump,
      };
    case "small":
      return {
        h3FontSize: 22 + androidBump,
        h3LineHeight: 28 + androidBump,
        bodyLargeFontSize: 17 + androidBump,
        bodyLargeLineHeight: 29 + androidBump,
        bodyFontSize: 15 + androidBump,
        bodyLineHeight: 26 + androidBump,
        bodySmallFontSize: 13 + androidBump,
        bodySmallLineHeight: 22 + androidBump,
        labelFontSize: 12 + androidBump,
        labelLineHeight: 18 + androidBump,
        captionFontSize: 11 + androidBump,
        captionLineHeight: 15 + androidBump,
        favoriteFontSize: 15 + androidBump,
        favoriteLineHeight: 20 + androidBump,
        favoriteDateFontSize: 13 + androidBump,
      };
    case "large":
      return {
        h3FontSize: 28 + androidBump,
        h3LineHeight: 36 + androidBump,
        bodyLargeFontSize: 24 + androidBump,
        bodyLargeLineHeight: 40 + androidBump,
        bodyFontSize: 22 + androidBump,
        bodyLineHeight: 37 + androidBump,
        bodySmallFontSize: 18 + androidBump,
        bodySmallLineHeight: 28 + androidBump,
        labelFontSize: 16 + androidBump,
        labelLineHeight: 24 + androidBump,
        captionFontSize: 14 + androidBump,
        captionLineHeight: 20 + androidBump,
        favoriteFontSize: 18 + androidBump,
        favoriteLineHeight: 24 + androidBump,
        favoriteDateFontSize: 16 + androidBump,
      };
    case "extraLarge":
      return {
        h3FontSize: 32 + androidBump,
        h3LineHeight: 42 + androidBump,
        bodyLargeFontSize: 28 + androidBump,
        bodyLargeLineHeight: 46 + androidBump,
        bodyFontSize: 26 + androidBump,
        bodyLineHeight: 43 + androidBump,
        bodySmallFontSize: 22 + androidBump,
        bodySmallLineHeight: 34 + androidBump,
        labelFontSize: 18 + androidBump,
        labelLineHeight: 28 + androidBump,
        captionFontSize: 16 + androidBump,
        captionLineHeight: 22 + androidBump,
        favoriteFontSize: 20 + androidBump,
        favoriteLineHeight: 26 + androidBump,
        favoriteDateFontSize: 18 + androidBump,
      };
    case "medium":
    default:
      return {
        h3FontSize: 24 + androidBump,
        h3LineHeight: 30 + androidBump,
        bodyLargeFontSize: 19 + androidBump,
        bodyLargeLineHeight: 32 + androidBump,
        bodyFontSize: 18 + androidBump,
        bodyLineHeight: 31 + androidBump,
        bodySmallFontSize: 15 + androidBump,
        bodySmallLineHeight: 24 + androidBump,
        labelFontSize: 13 + androidBump,
        labelLineHeight: 20 + androidBump,
        captionFontSize: 12 + androidBump,
        captionLineHeight: 16 + androidBump,
        favoriteFontSize: 16 + androidBump,
        favoriteLineHeight: 21 + androidBump,
        favoriteDateFontSize: 14 + androidBump,
      };
  }
}



