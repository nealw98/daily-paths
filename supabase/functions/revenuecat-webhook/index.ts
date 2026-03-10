import { createClient } from "https://esm.sh/@supabase/supabase-js@2";
import { corsHeaders } from "../_shared/cors.ts";

const EXPIRY_EVENT_TYPES = new Set([
  "EXPIRATION",
  "SUBSCRIPTION_EXPIRED",
  "NON_RENEWING_PURCHASE_EXPIRED",
]);

async function deleteUserDataAndAuth(serviceClient: ReturnType<typeof createClient>, userId: string) {
  await serviceClient.from("journal_entries").delete().eq("user_id", userId);
  await serviceClient.from("gratitude_entries").delete().eq("user_id", userId);
  await serviceClient.from("prayer_notes").delete().eq("user_id", userId);
  await serviceClient.from("user_preferences").delete().eq("user_id", userId);
  await serviceClient.from("user_profiles").delete().eq("id", userId);
  const { error: authError } = await serviceClient.auth.admin.deleteUser(userId);
  if (authError) throw authError;
}

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
    const userId = String(event?.app_user_id ?? "");
    const eventId = String(event?.id ?? crypto.randomUUID());

    if (!eventType || !userId) {
      return new Response(JSON.stringify({ error: "Missing required event payload" }), {
        status: 400,
        headers: { ...corsHeaders, "Content-Type": "application/json" },
      });
    }

    const serviceClient = createClient(
      Deno.env.get("SUPABASE_URL")!,
      Deno.env.get("SUPABASE_SERVICE_ROLE_KEY")!,
    );

    // Queue every expiry-like event for fallback reconciliation.
    if (EXPIRY_EVENT_TYPES.has(eventType)) {
      await serviceClient.from("subscription_expiry_events").upsert(
        {
          event_id: eventId,
          user_id: userId,
          event_type: eventType,
          payload: event,
          status: "pending",
        },
        { onConflict: "event_id" },
      );

      try {
        await deleteUserDataAndAuth(serviceClient, userId);
        await serviceClient
          .from("subscription_expiry_events")
          .update({ status: "processed", processed_at: new Date().toISOString(), error: null })
          .eq("event_id", eventId);
      } catch (err) {
        await serviceClient
          .from("subscription_expiry_events")
          .update({
            status: "pending",
            error: err instanceof Error ? err.message : String(err),
          })
          .eq("event_id", eventId);
      }
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
