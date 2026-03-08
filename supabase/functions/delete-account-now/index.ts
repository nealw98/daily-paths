import { createClient } from "https://esm.sh/@supabase/supabase-js@2";
import { corsHeaders } from "../_shared/cors.ts";

/**
 * Edge Function: delete-account-now
 *
 * Immediately deletes the authenticated user's account:
 *  1. Revokes any RevenueCat promotional entitlements (lifetime access)
 *  2. Deletes all user data from Supabase tables
 *  3. Deletes the auth user
 *
 * RevenueCat owns access. Supabase owns data.
 * Entitlement revocation is the meaningful act; Supabase deletion is cleanup.
 *
 * Note: Subscription entitlements tied to App Store receipts cannot be revoked
 * server-side — the user must cancel in App Store / Google Play settings.
 */

const REVENUECAT_API_URL = "https://api.revenuecat.com/v1";
const LIFETIME_ENTITLEMENT_ID = "lifetime";

Deno.serve(async (req: Request) => {
  if (req.method === "OPTIONS") {
    return new Response("ok", { headers: corsHeaders });
  }

  try {
    // ── Auth verification ──────────────────────────────────────────────
    const authHeader = req.headers.get("Authorization");
    if (!authHeader) {
      return new Response(
        JSON.stringify({ error: "Missing authorization header" }),
        { status: 401, headers: { ...corsHeaders, "Content-Type": "application/json" } },
      );
    }

    const supabase = createClient(
      Deno.env.get("SUPABASE_URL")!,
      Deno.env.get("SUPABASE_ANON_KEY")!,
      { global: { headers: { Authorization: authHeader } } },
    );

    const { data: { user }, error: authError } = await supabase.auth.getUser();
    if (authError || !user) {
      return new Response(
        JSON.stringify({ error: "Unauthorized" }),
        { status: 401, headers: { ...corsHeaders, "Content-Type": "application/json" } },
      );
    }

    const userId = user.id;

    // ── 1. Revoke RevenueCat lifetime promotional entitlement ────────
    const revenueCatSecret = Deno.env.get("REVENUECAT_SECRET_KEY");
    if (revenueCatSecret) {
      try {
        const rcUrl = `${REVENUECAT_API_URL}/subscribers/${userId}/entitlements/${LIFETIME_ENTITLEMENT_ID}/revoke_promotionals`;
        const rcResponse = await fetch(rcUrl, {
          method: "POST",
          headers: {
            "Authorization": `Bearer ${revenueCatSecret}`,
            "Content-Type": "application/json",
          },
        });
        if (!rcResponse.ok) {
          // Log but don't fail — user may not have a lifetime entitlement
          const rcError = await rcResponse.text();
          console.warn("RevenueCat revoke (non-fatal):", rcResponse.status, rcError);
        }
      } catch (rcErr) {
        console.warn("RevenueCat revoke error (non-fatal):", rcErr);
      }
    }

    // ── 2. Delete user data (service role bypasses RLS) ──────────────
    const serviceClient = createClient(
      Deno.env.get("SUPABASE_URL")!,
      Deno.env.get("SUPABASE_SERVICE_ROLE_KEY")!,
    );

    // All tables have ON DELETE CASCADE from auth.users, so step 3 would
    // cascade-delete remaining rows. Explicit deletion here is for
    // completeness and audit logging.

    const { count: journalCount, error: e1 } = await serviceClient
      .from("journal_entries")
      .delete({ count: "exact" })
      .eq("user_id", userId);
    if (e1) console.error("journal_entries:", e1.message);

    const { count: gratitudeCount, error: e2 } = await serviceClient
      .from("gratitude_entries")
      .delete({ count: "exact" })
      .eq("user_id", userId);
    if (e2) console.error("gratitude_entries:", e2.message);

    const { count: prayerCount, error: e3 } = await serviceClient
      .from("prayer_notes")
      .delete({ count: "exact" })
      .eq("user_id", userId);
    if (e3) console.error("prayer_notes:", e3.message);

    const { count: prefCount, error: e4 } = await serviceClient
      .from("user_preferences")
      .delete({ count: "exact" })
      .eq("user_id", userId);
    if (e4) console.error("user_preferences:", e4.message);

    const { error: e5 } = await serviceClient
      .from("user_profiles")
      .delete()
      .eq("id", userId);
    if (e5) console.error("user_profiles:", e5.message);

    // ── 3. Delete auth user ─────────────────────────────────────────
    const { error: deleteAuthError } = await serviceClient.auth.admin.deleteUser(userId);
    if (deleteAuthError) {
      console.error("auth.deleteUser:", deleteAuthError.message);
      return new Response(
        JSON.stringify({ error: "Failed to delete auth user", detail: deleteAuthError.message }),
        { status: 500, headers: { ...corsHeaders, "Content-Type": "application/json" } },
      );
    }

    console.log(`Account deleted: ${userId}`, {
      journal_entries: journalCount ?? 0,
      gratitude_entries: gratitudeCount ?? 0,
      prayer_notes: prayerCount ?? 0,
      user_preferences: prefCount ?? 0,
    });

    return new Response(
      JSON.stringify({ success: true }),
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
