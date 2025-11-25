import React from "react";
import AsyncStorage from "@react-native-async-storage/async-storage";

const SETTINGS_STORAGE_KEY = "daily_paths_settings_v1";

export type TextSize = "small" | "medium" | "large" | "extraLarge";

export interface AppSettings {
  textSize: TextSize;
  dailyReminderEnabled: boolean;
  dailyReminderTime: string; // "HH:MM" in 24-hour format
}

const defaultSettings: AppSettings = {
  textSize: "medium",
  dailyReminderEnabled: false,
  dailyReminderTime: "08:00",
};

interface SettingsContextValue {
  settings: AppSettings;
  loading: boolean;
  setTextSize: (size: TextSize) => Promise<void>;
  setDailyReminderEnabled: (enabled: boolean) => Promise<void>;
  setDailyReminderTime: (time: string) => Promise<void>;
}

const SettingsContext = React.createContext<SettingsContextValue | undefined>(
  undefined
);

async function loadSettings(): Promise<AppSettings> {
  try {
    const raw = await AsyncStorage.getItem(SETTINGS_STORAGE_KEY);
    if (!raw) return defaultSettings;
    const parsed = JSON.parse(raw) as Partial<AppSettings>;
    return {
      ...defaultSettings,
      ...parsed,
    };
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
  const [settings, setSettings] = React.useState<AppSettings>(defaultSettings);
  const [loading, setLoading] = React.useState(true);

  React.useEffect(() => {
    let mounted = true;
    (async () => {
      const loaded = await loadSettings();
      if (mounted) {
        setSettings(loaded);
        setLoading(false);
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

  const setDailyReminderEnabled = React.useCallback(
    async (enabled: boolean) => {
      await updateSettings({ dailyReminderEnabled: enabled });
    },
    [updateSettings]
  );

  const setDailyReminderTime = React.useCallback(
    async (time: string) => {
      await updateSettings({ dailyReminderTime: time });
    },
    [updateSettings]
  );

  const value = React.useMemo<SettingsContextValue>(
    () => ({
      settings,
      loading,
      setTextSize,
      setDailyReminderEnabled,
      setDailyReminderTime,
    }),
    [settings, loading, setTextSize, setDailyReminderEnabled, setDailyReminderTime]
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
  bodyFontSize: number;
  bodyLineHeight: number;
  favoriteFontSize: number;
  favoriteLineHeight: number;
  favoriteDateFontSize: number;
} {
  switch (textSize) {
    case "small":
      return {
        bodyFontSize: 17,
        bodyLineHeight: 29,
        favoriteFontSize: 17,
        favoriteLineHeight: 23,
        favoriteDateFontSize: 10,
      };
    case "large":
      return {
        bodyFontSize: 24,
        bodyLineHeight: 40,
        favoriteFontSize: 24,
        favoriteLineHeight: 30,
        favoriteDateFontSize: 14,
      };
    case "extraLarge":
      return {
        bodyFontSize: 28,
        bodyLineHeight: 46,
        favoriteFontSize: 28,
        favoriteLineHeight: 34,
        favoriteDateFontSize: 16,
      };
    case "medium":
    default:
      return {
        bodyFontSize: 20,
        bodyLineHeight: 34,
        favoriteFontSize: 20,
        favoriteLineHeight: 25,
        favoriteDateFontSize: 12,
      };
  }
}



