import { createClient } from "https://esm.sh/@supabase/supabase-js@2";
import { corsHeaders } from "../_shared/cors.ts";

/**
 * RevenueCat webhook handler.
 *
 * With Supabase auth and user-specific tables removed, this function simply
 * logs expiry events to `subscription_expiry_events` for audit / analytics.
 * No user data deletion is performed — all user data is now local-only.
 */

const EXPIRY_EVENT_TYPES = new Set([
  "EXPIRATION",
  "SUBSCRIPTION_EXPIRED",
  "NON_RENEWING_PURCHASE_EXPIRED",
]);

Deno.serve(async (req: Request) => {
  if (req.method === "OPTIONS") {
    return new Response("ok", { headers: corsHeaders });
  }

  if (req.method !== "POST") {
    return new Response(JSON.stringify({ error: "Method not allowed" }), {
      status: 405,
      headers: { ...corsHeaders, "Content-Type": "application/json" },
    });
  }

  try {
    const webhookSecret = Deno.env.get("REVENUECAT_WEBHOOK_SECRET");
    if (webhookSecret) {
      const incoming = req.headers.get("X-RevenueCat-Webhook-Secret");
      if (incoming !== webhookSecret) {
        return new Response(JSON.stringify({ error: "Unauthorized" }), {
          status: 401,
          headers: { ...corsHeaders, "Content-Type": "application/json" },
        });
      }
    }

    const body = await req.json();
    const event = body?.event ?? body;
    const eventType = String(event?.type ?? "");
    const appUserId = String(event?.app_user_id ?? "");
    const eventId = String(event?.id ?? crypto.randomUUID());

    if (!eventType || !appUserId) {
      return new Response(JSON.stringify({ error: "Missing required event payload" }), {
        status: 400,
        headers: { ...corsHeaders, "Content-Type": "application/json" },
      });
    }

    // Log expiry events for audit / analytics
    if (EXPIRY_EVENT_TYPES.has(eventType)) {
      const serviceClient = createClient(
        Deno.env.get("SUPABASE_URL")!,
        Deno.env.get("SUPABASE_SERVICE_ROLE_KEY")!,
      );

      await serviceClient.from("subscription_expiry_events").upsert(
        {
          event_id: eventId,
          user_id: appUserId,
          event_type: eventType,
          payload: event,
          status: "processed",
          processed_at: new Date().toISOString(),
        },
        { onConflict: "event_id" },
      );
    }

    return new Response(JSON.stringify({ success: true }), {
      status: 200,
      headers: { ...corsHeaders, "Content-Type": "application/json" },
    });
  } catch (err) {
    return new Response(JSON.stringify({ error: "Internal server error" }), {
      status: 500,
      headers: { ...corsHeaders, "Content-Type": "application/json" },
    });
  }
});
