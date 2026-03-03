import { createClient } from "https://esm.sh/@supabase/supabase-js@2";
import { corsHeaders } from "../_shared/cors.ts";

/**
 * Edge Function: process-account-deletions
 *
 * Runs daily via cron. For every user whose 30-day grace period has expired,
 * deletes all user data and the auth user.
 *
 * Auth: CRON_SECRET header (not user JWT).
 *
 * Deletion order:
 *  1. journal_entries (all entry types: journal, gratitude, spot_check, nightly_review)
 *  2. gratitude_entries (legacy table)
 *  3. prayer_notes
 *  4. user_preferences
 *  5. user_profiles
 *  6. auth user (via admin API)
 *
 * Note: All tables have ON DELETE CASCADE from auth.users, so step 6 would
 * cascade-delete remaining rows. Explicit deletion in steps 1-5 is for
 * audit logging and to ensure completeness.
 */

Deno.serve(async (req: Request) => {
  if (req.method === "OPTIONS") {
    return new Response("ok", { headers: corsHeaders });
  }

  try {
    // ── Verify cron secret ───────────────────────────────────────────────
    const authHeader = req.headers.get("Authorization");
    const cronSecret = Deno.env.get("CRON_SECRET");

    if (!cronSecret || !authHeader || authHeader !== `Bearer ${cronSecret}`) {
      return new Response(
        JSON.stringify({ error: "Unauthorized" }),
        { status: 401, headers: { ...corsHeaders, "Content-Type": "application/json" } },
      );
    }

    // ── Service role client (bypasses RLS) ────────────────────────────────
    const serviceClient = createClient(
      Deno.env.get("SUPABASE_URL")!,
      Deno.env.get("SUPABASE_SERVICE_ROLE_KEY")!,
    );

    // ── Find users past their grace period ────────────────────────────────
    const { data: pendingUsers, error: queryError } = await serviceClient
      .from("user_profiles")
      .select("id, deletion_scheduled_for")
      .not("deletion_scheduled_for", "is", null)
      .lte("deletion_scheduled_for", new Date().toISOString())
      .limit(100);

    if (queryError) {
      console.error("Query error:", queryError);
      return new Response(
        JSON.stringify({ error: "Failed to query pending deletions", detail: queryError.message }),
        { status: 500, headers: { ...corsHeaders, "Content-Type": "application/json" } },
      );
    }

    if (!pendingUsers || pendingUsers.length === 0) {
      return new Response(
        JSON.stringify({ processed: 0, message: "No pending deletions" }),
        { status: 200, headers: { ...corsHeaders, "Content-Type": "application/json" } },
      );
    }

    const results: Array<{ userId: string; success: boolean; error?: string; counts?: Record<string, number> }> = [];

    for (const user of pendingUsers) {
      const userId = user.id;
      const counts: Record<string, number> = {};

      try {
        // 1. Delete journal_entries
        const { count: journalCount, error: e1 } = await serviceClient
          .from("journal_entries")
          .delete({ count: "exact" })
          .eq("user_id", userId);
        if (e1) throw new Error(`journal_entries: ${e1.message}`);
        counts.journal_entries = journalCount ?? 0;

        // 2. Delete gratitude_entries (legacy)
        const { count: gratitudeCount, error: e2 } = await serviceClient
          .from("gratitude_entries")
          .delete({ count: "exact" })
          .eq("user_id", userId);
        if (e2) throw new Error(`gratitude_entries: ${e2.message}`);
        counts.gratitude_entries = gratitudeCount ?? 0;

        // 3. Delete prayer_notes
        const { count: prayerCount, error: e3 } = await serviceClient
          .from("prayer_notes")
          .delete({ count: "exact" })
          .eq("user_id", userId);
        if (e3) throw new Error(`prayer_notes: ${e3.message}`);
        counts.prayer_notes = prayerCount ?? 0;

        // 4. Delete user_preferences
        const { count: prefCount, error: e4 } = await serviceClient
          .from("user_preferences")
          .delete({ count: "exact" })
          .eq("user_id", userId);
        if (e4) throw new Error(`user_preferences: ${e4.message}`);
        counts.user_preferences = prefCount ?? 0;

        // 5. Delete user_profiles
        const { error: e5 } = await serviceClient
          .from("user_profiles")
          .delete()
          .eq("id", userId);
        if (e5) throw new Error(`user_profiles: ${e5.message}`);
        counts.user_profiles = 1;

        // 6. Delete auth user
        const { error: authError } = await serviceClient.auth.admin.deleteUser(userId);
        if (authError) throw new Error(`auth.deleteUser: ${authError.message}`);

        console.log(`Deleted user ${userId}:`, JSON.stringify(counts));
        results.push({ userId, success: true, counts });
      } catch (err) {
        const message = err instanceof Error ? err.message : String(err);
        console.error(`Failed to delete user ${userId}:`, message);
        results.push({ userId, success: false, error: message });
      }
    }

    const processed = results.filter((r) => r.success).length;
    const failed = results.filter((r) => !r.success).length;

    return new Response(
      JSON.stringify({ processed, failed, results }),
      { status: 200, headers: { ...corsHeaders, "Content-Type": "application/json" } },
    );
  } catch (err) {
    console.error("Unexpected error:", err);
    return new Response(
      JSON.stringify({ error: "Internal server error" }),
      { status: 500, headers: { ...corsHeaders, "Content-Type": "application/json" } },
    );
  }
});
