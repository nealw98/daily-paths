import React, {
  createContext,
  useCallback,
  useContext,
  useMemo,
  useState,
} from "react";
import { formatDateLocal, parseDateLocal } from "../utils/dateUtils";

/**
 * Holds the calendar day whose reading is currently being viewed.
 *
 * This lives in a provider rather than in the reading screen's own state
 * because several screens outside the tab navigator need to change it —
 * the date picker (`app/select-date.tsx`) and Favorites (`app/favorites.tsx`).
 * Those screens used to hand the date back through route params combined
 * with `router.replace("/(tabs)/reading", ...)`, but `reading` is a hidden
 * tab (`href: null`) rather than a stack route, so the replace never
 * delivered the params to the already-mounted screen and the reading stayed
 * on today. Sharing the state directly removes that round-trip entirely.
 *
 * The date is stored as a `YYYY-MM-DD` key so that `selectedDate` keeps a
 * stable object identity between renders — `useReading(date)` keys its
 * fetch effect on the Date instance, so handing it a fresh object every
 * render would refetch forever.
 */
interface ReadingDateContextValue {
  /** Local-midnight Date for the reading currently being viewed. */
  selectedDate: Date;
  /** `YYYY-MM-DD` form of `selectedDate`. */
  selectedDateKey: string;
  setSelectedDate: (date: Date) => void;
  goToToday: () => void;
}

const ReadingDateContext = createContext<ReadingDateContextValue | null>(null);

export const ReadingDateProvider: React.FC<{ children: React.ReactNode }> = ({
  children,
}) => {
  const [selectedDateKey, setSelectedDateKey] = useState<string>(() =>
    formatDateLocal(new Date())
  );

  const setSelectedDate = useCallback((date: Date) => {
    const next = formatDateLocal(date);
    setSelectedDateKey((prev) => (prev === next ? prev : next));
  }, []);

  const goToToday = useCallback(() => {
    setSelectedDate(new Date());
  }, [setSelectedDate]);

  const value = useMemo<ReadingDateContextValue>(
    () => ({
      selectedDate: parseDateLocal(selectedDateKey),
      selectedDateKey,
      setSelectedDate,
      goToToday,
    }),
    [selectedDateKey, setSelectedDate, goToToday]
  );

  return (
    <ReadingDateContext.Provider value={value}>
      {children}
    </ReadingDateContext.Provider>
  );
};

export function useReadingDate(): ReadingDateContextValue {
  const context = useContext(ReadingDateContext);
  if (!context) {
    throw new Error(
      "useReadingDate must be used within a ReadingDateProvider"
    );
  }
  return context;
}
