import { useState, useEffect } from "react";
import { supabase } from "../lib/supabase";

export function useBookmark(readingId: string) {
  const [isBookmarked, setIsBookmarked] = useState(false);
  const [loading, setLoading] = useState(false);

  useEffect(() => {
    checkBookmark();
  }, [readingId]);

  async function checkBookmark() {
    try {
      const {
        data: { user },
      } = await supabase.auth.getUser();
      if (!user) return;

      const { data } = await supabase
        .from("user_bookmarks")
        .select("id")
        .eq("user_id", user.id)
        .eq("reading_id", readingId)
        .maybeSingle();

      setIsBookmarked(!!data);
    } catch (err) {
      console.error("Error checking bookmark:", err);
    }
  }

  async function toggleBookmark() {
    try {
      setLoading(true);

      // Get or create anonymous user
      let {
        data: { user },
      } = await supabase.auth.getUser();

      if (!user) {
        const { data: signInData, error: signInError } =
          await supabase.auth.signInAnonymously();
        if (signInError) throw signInError;
        user = signInData.user;
      }

      if (!user) throw new Error("No user found");

      if (isBookmarked) {
        // Remove bookmark
        const { error } = await supabase
          .from("user_bookmarks")
          .delete()
          .eq("user_id", user.id)
          .eq("reading_id", readingId);

        if (error) throw error;
        setIsBookmarked(false);
      } else {
        // Add bookmark
        const { error } = await supabase.from("user_bookmarks").insert({
          user_id: user.id,
          reading_id: readingId,
        });

        if (error) throw error;
        setIsBookmarked(true);
      }
    } catch (err) {
      console.error("Error toggling bookmark:", err);
    } finally {
      setLoading(false);
    }
  }

  return { isBookmarked, loading, toggleBookmark };
}

