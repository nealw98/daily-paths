import { createClient } from "https://esm.sh/@supabase/supabase-js@2";
import { corsHeaders } from "../_shared/cors.ts";

/**
 * Edge Function: revoke-lifetime-entitlement
 *
 * Revokes the RevenueCat "lifetime" promotional entitlement for the
 * authenticated user. Called during account deletion so lifetime users
 * lose premium access immediately (before the 60-day data grace period).
 *
 * Flow:
 *  1. Verify the caller is authenticated via Supabase JWT
 *  2. Call RevenueCat REST API to revoke promotional entitlements
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

    // ── Revoke RevenueCat lifetime entitlement ─────────────────────────
    const revenueCatSecret = Deno.env.get("REVENUECAT_SECRET_KEY");
    if (!revenueCatSecret) {
      console.error("REVENUECAT_SECRET_KEY not configured");
      return new Response(
        JSON.stringify({ error: "Server configuration error" }),
        { status: 500, headers: { ...corsHeaders, "Content-Type": "application/json" } },
      );
    }

    const rcUrl = `${REVENUECAT_API_URL}/subscribers/${user.id}/entitlements/${LIFETIME_ENTITLEMENT_ID}/revoke_promotionals`;

    const rcResponse = await fetch(rcUrl, {
      method: "POST",
      headers: {
        "Authorization": `Bearer ${revenueCatSecret}`,
        "Content-Type": "application/json",
      },
    });

    if (!rcResponse.ok) {
      const rcError = await rcResponse.text();
      console.error("RevenueCat API error:", rcResponse.status, rcError);
      return new Response(
        JSON.stringify({ error: "Failed to revoke entitlement", detail: rcError }),
        { status: 502, headers: { ...corsHeaders, "Content-Type": "application/json" } },
      );
    }

    const rcData = await rcResponse.json();

    return new Response(
      JSON.stringify({ success: true, subscriber: rcData.subscriber }),
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
