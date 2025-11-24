import { useState, useEffect, useCallback } from "react";
import {
  getBookmarks,
  isDateBookmarked,
  toggleBookmark as toggleBookmarkStorage,
  BookmarkData,
} from "../utils/bookmarkStorage";

interface UseBookmarkManagerReturn {
  bookmarks: BookmarkData[];
  isBookmarked: boolean;
  loading: boolean;
  toggleBookmark: () => Promise<boolean>;
  refreshBookmarks: () => Promise<void>;
  checkBookmarkStatus: (date: Date) => Promise<void>;
}

export function useBookmarkManager(
  currentDate: Date,
  readingId: string,
  readingTitle: string
): UseBookmarkManagerReturn {
  const [bookmarks, setBookmarks] = useState<BookmarkData[]>([]);
  const [isBookmarked, setIsBookmarked] = useState(false);
  const [loading, setLoading] = useState(false);

  // Load all bookmarks
  const refreshBookmarks = useCallback(async () => {
    try {
      const allBookmarks = await getBookmarks();
      // Sort by timestamp, newest first
      allBookmarks.sort((a, b) => b.timestamp - a.timestamp);
      setBookmarks(allBookmarks);
    } catch (error) {
      console.error("Error refreshing bookmarks:", error);
    }
  }, []);

  // Check if current date is bookmarked
  const checkBookmarkStatus = useCallback(
    async (date: Date) => {
      try {
        const bookmarked = await isDateBookmarked(date);
        setIsBookmarked(bookmarked);
      } catch (error) {
        console.error("Error checking bookmark status:", error);
      }
    },
    []
  );

  // Toggle bookmark for current date
  const toggleBookmark = useCallback(async (): Promise<boolean> => {
    if (!readingId || !readingTitle) {
      console.warn("Cannot toggle bookmark: missing reading data");
      return false;
    }

    try {
      setLoading(true);
      const newBookmarkState = await toggleBookmarkStorage(
        currentDate,
        readingId,
        readingTitle
      );
      setIsBookmarked(newBookmarkState);
      await refreshBookmarks();
      return newBookmarkState;
    } catch (error) {
      console.error("Error toggling bookmark:", error);
      return isBookmarked;
    } finally {
      setLoading(false);
    }
  }, [currentDate, readingId, readingTitle, isBookmarked, refreshBookmarks]);

  // Initial load
  useEffect(() => {
    refreshBookmarks();
  }, [refreshBookmarks]);

  // Check bookmark status when date changes
  useEffect(() => {
    if (currentDate) {
      checkBookmarkStatus(currentDate);
    }
  }, [currentDate, checkBookmarkStatus]);

  return {
    bookmarks,
    isBookmarked,
    loading,
    toggleBookmark,
    refreshBookmarks,
    checkBookmarkStatus,
  };
}

