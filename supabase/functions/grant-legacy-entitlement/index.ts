import { createClient } from "https://esm.sh/@supabase/supabase-js@2";
import { corsHeaders } from "../_shared/cors.ts";

/**
 * Edge Function: grant-legacy-entitlement
 *
 * Grants the RevenueCat "lifetime" promotional entitlement to verified
 * legacy users (those who purchased the original paid app).
 *
 * Flow:
 *  1. Verify the caller is authenticated via Supabase JWT
 *  2. Confirm `user_profiles.legacy_user = true` in the database
 *  3. Call RevenueCat REST API to grant the "lifetime" entitlement
 */

const REVENUECAT_API_URL = "https://api.revenuecat.com/v1";
const LIFETIME_ENTITLEMENT_ID = "lifetime";

Deno.serve(async (req: Request) => {
  // Handle CORS preflight
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

    // ── Verify legacy status (service role — bypasses RLS) ─────────────
    const serviceClient = createClient(
      Deno.env.get("SUPABASE_URL")!,
      Deno.env.get("SUPABASE_SERVICE_ROLE_KEY")!,
    );

    const { data: profile, error: profileError } = await serviceClient
      .from("user_profiles")
      .select("legacy_user")
      .eq("id", user.id)
      .single();

    if (profileError || !profile?.legacy_user) {
      return new Response(
        JSON.stringify({ error: "User is not a verified legacy user" }),
        { status: 403, headers: { ...corsHeaders, "Content-Type": "application/json" } },
      );
    }

    // ── Grant RevenueCat lifetime entitlement ──────────────────────────
    const revenueCatSecret = Deno.env.get("REVENUECAT_SECRET_KEY");
    if (!revenueCatSecret) {
      console.error("REVENUECAT_SECRET_KEY not configured");
      return new Response(
        JSON.stringify({ error: "Server configuration error" }),
        { status: 500, headers: { ...corsHeaders, "Content-Type": "application/json" } },
      );
    }

    const rcUrl = `${REVENUECAT_API_URL}/subscribers/${user.id}/entitlements/${LIFETIME_ENTITLEMENT_ID}/promotional`;

    const rcResponse = await fetch(rcUrl, {
      method: "POST",
      headers: {
        "Authorization": `Bearer ${revenueCatSecret}`,
        "Content-Type": "application/json",
      },
      body: JSON.stringify({ duration: "lifetime" }),
    });

    if (!rcResponse.ok) {
      const rcError = await rcResponse.text();
      console.error("RevenueCat API error:", rcResponse.status, rcError);
      return new Response(
        JSON.stringify({ error: "Failed to grant entitlement", detail: rcError }),
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
