import React, {
  createContext,
  useCallback,
  useContext,
  useEffect,
  useMemo,
  useState,
} from "react";
import { AppState, type AppStateStatus } from "react-native";
import { formatDateLocal, parseDateLocal } from "../utils/dateUtils";

interface AppDateContextValue {
  today: Date;
  todayKey: string;
  refreshToday: () => void;
}

const AppDateContext = createContext<AppDateContextValue | null>(null);

function getTodayKeyNow(): string {
  return formatDateLocal(new Date());
}

export const AppDateProvider: React.FC<{ children: React.ReactNode }> = ({
  children,
}) => {
  const [todayKey, setTodayKey] = useState<string>(() => getTodayKeyNow());

  const refreshToday = useCallback(() => {
    const next = getTodayKeyNow();
    setTodayKey((prev) => (prev === next ? prev : next));
  }, []);

  useEffect(() => {
    const appStateSub = AppState.addEventListener(
      "change",
      (nextAppState: AppStateStatus) => {
        if (nextAppState === "active") {
          refreshToday();
        }
      }
    );

    const intervalId = setInterval(() => {
      refreshToday();
    }, 60_000);

    return () => {
      appStateSub.remove();
      clearInterval(intervalId);
    };
  }, [refreshToday]);

  const value = useMemo<AppDateContextValue>(
    () => ({
      today: parseDateLocal(todayKey),
      todayKey,
      refreshToday,
    }),
    [todayKey, refreshToday]
  );

  return (
    <AppDateContext.Provider value={value}>{children}</AppDateContext.Provider>
  );
};

export function useAppDate(): AppDateContextValue {
  const context = useContext(AppDateContext);
  if (!context) {
    throw new Error("useAppDate must be used within an AppDateProvider");
  }
  return context;
}
