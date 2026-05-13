import { corsHeaders } from "../_shared/cors.ts";

/**
 * Marks the matching grant row as acknowledged so the same modal will not
 * fire again. Called by the client when the user dismisses Modal A or B.
 *
 * Required env:
 *   SUPABASE_URL
 *   SUPABASE_SERVICE_ROLE_KEY
 */

type ModalName = "subscriber_to_lifetime" | "grandfathered";

interface AckResponse {
  acknowledged: boolean;
  reason?: string;
}

function jsonResponse(body: AckResponse, status = 200): Response {
  return new Response(JSON.stringify(body), {
    status,
    headers: { ...corsHeaders, "Content-Type": "application/json" },
  });
}

const TABLE_FOR_MODAL: Record<ModalName, string> = {
  subscriber_to_lifetime: "android_subscriber_lifetime_grants",
  grandfathered: "android_grandfather_grants",
};

Deno.serve(async (req: Request) => {
  if (req.method === "OPTIONS") {
    return new Response("ok", { headers: corsHeaders });
  }

  if (req.method !== "POST") {
    return jsonResponse({ acknowledged: false, reason: "method_not_allowed" }, 405);
  }

  const supabaseUrl = Deno.env.get("SUPABASE_URL");
  const serviceRoleKey = Deno.env.get("SUPABASE_SERVICE_ROLE_KEY");

  if (!supabaseUrl || !serviceRoleKey) {
    console.error("[acknowledge-modal] missing env config");
    return jsonResponse({ acknowledged: false, reason: "server_misconfigured" }, 500);
  }

  let appUserId: string;
  let modal: ModalName;
  try {
    const body = await req.json();
    appUserId = String(body?.app_user_id ?? "").trim();
    modal = String(body?.modal ?? "").trim() as ModalName;
  } catch {
    return jsonResponse({ acknowledged: false, reason: "bad_request" }, 400);
  }

  if (!appUserId) {
    return jsonResponse({ acknowledged: false, reason: "missing_app_user_id" }, 400);
  }
  const table = TABLE_FOR_MODAL[modal];
  if (!table) {
    return jsonResponse({ acknowledged: false, reason: "invalid_modal" }, 400);
  }

  try {
    const now = new Date().toISOString();
    const res = await fetch(
      `${supabaseUrl}/rest/v1/${table}?rc_app_user_id=eq.${encodeURIComponent(appUserId)}`,
      {
        method: "PATCH",
        headers: {
          apikey: serviceRoleKey,
          Authorization: `Bearer ${serviceRoleKey}`,
          "Content-Type": "application/json",
          Prefer: "return=minimal",
        },
        body: JSON.stringify({ modal_acknowledged_at: now, updated_at: now }),
      },
    );
    if (!res.ok) {
      const text = await res.text();
      console.error(`[acknowledge-modal] PATCH ${table} failed`, res.status, text);
      return jsonResponse({ acknowledged: false, reason: "db_update_failed" }, 502);
    }
    return jsonResponse({ acknowledged: true });
  } catch (err) {
    console.error("[acknowledge-modal] unexpected error", err);
    return jsonResponse({ acknowledged: false, reason: "internal_error" }, 500);
  }
});
