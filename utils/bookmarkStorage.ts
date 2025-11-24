import AsyncStorage from "@react-native-async-storage/async-storage";

const BOOKMARKS_KEY = "@daily_paths_bookmarks";
const INSTRUCTION_SEEN_KEY = "@daily_paths_bookmark_instruction_seen";

export interface BookmarkData {
  date: string; // ISO date string
  readingId: string;
  title: string;
  timestamp: number;
}

/**
 * Get all bookmarks
 */
export async function getBookmarks(): Promise<BookmarkData[]> {
  try {
    const data = await AsyncStorage.getItem(BOOKMARKS_KEY);
    return data ? JSON.parse(data) : [];
  } catch (error) {
    console.error("Error getting bookmarks:", error);
    return [];
  }
}

/**
 * Check if a date is bookmarked
 */
export async function isDateBookmarked(date: Date): Promise<boolean> {
  try {
    const bookmarks = await getBookmarks();
    const dateStr = date.toISOString().split("T")[0]; // YYYY-MM-DD
    return bookmarks.some((bookmark) => bookmark.date === dateStr);
  } catch (error) {
    console.error("Error checking bookmark:", error);
    return false;
  }
}

/**
 * Add a bookmark
 */
export async function addBookmark(
  date: Date,
  readingId: string,
  title: string
): Promise<void> {
  try {
    const bookmarks = await getBookmarks();
    const dateStr = date.toISOString().split("T")[0];
    
    // Don't add duplicate
    if (bookmarks.some((b) => b.date === dateStr)) {
      return;
    }

    const newBookmark: BookmarkData = {
      date: dateStr,
      readingId,
      title,
      timestamp: Date.now(),
    };

    await AsyncStorage.setItem(
      BOOKMARKS_KEY,
      JSON.stringify([...bookmarks, newBookmark])
    );
  } catch (error) {
    console.error("Error adding bookmark:", error);
    throw error;
  }
}

/**
 * Remove a bookmark
 */
export async function removeBookmark(date: Date): Promise<void> {
  try {
    const bookmarks = await getBookmarks();
    const dateStr = date.toISOString().split("T")[0];
    const filtered = bookmarks.filter((bookmark) => bookmark.date !== dateStr);
    await AsyncStorage.setItem(BOOKMARKS_KEY, JSON.stringify(filtered));
  } catch (error) {
    console.error("Error removing bookmark:", error);
    throw error;
  }
}

/**
 * Toggle bookmark for a date
 */
export async function toggleBookmark(
  date: Date,
  readingId: string,
  title: string
): Promise<boolean> {
  const isBookmarked = await isDateBookmarked(date);
  
  if (isBookmarked) {
    await removeBookmark(date);
    return false;
  } else {
    await addBookmark(date, readingId, title);
    return true;
  }
}

/**
 * Check if user has seen the instruction overlay
 */
export async function hasSeenInstruction(): Promise<boolean> {
  try {
    const seen = await AsyncStorage.getItem(INSTRUCTION_SEEN_KEY);
    return seen === "true";
  } catch (error) {
    console.error("Error checking instruction seen:", error);
    return false;
  }
}

/**
 * Mark instruction as seen
 */
export async function markInstructionSeen(): Promise<void> {
  try {
    await AsyncStorage.setItem(INSTRUCTION_SEEN_KEY, "true");
  } catch (error) {
    console.error("Error marking instruction seen:", error);
  }
}

