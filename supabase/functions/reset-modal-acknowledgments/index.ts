import { corsHeaders } from "../_shared/cors.ts";

/**
 * QA-only: nulls `modal_acknowledged_at` on both grant tables for the given
 * app_user_id so Modal A / Modal B will fire again on the next launch.
 * Production builds should not expose a UI for this; the QA screen does.
 *
 * Required env:
 *   SUPABASE_URL
 *   SUPABASE_SERVICE_ROLE_KEY
 */

interface ResetResponse {
  reset: boolean;
  reason?: string;
  grandfatherRowsReset?: number;
  subscriberRowsReset?: number;
}

function jsonResponse(body: ResetResponse, status = 200): Response {
  return new Response(JSON.stringify(body), {
    status,
    headers: { ...corsHeaders, "Content-Type": "application/json" },
  });
}

async function resetTable(
  supabaseUrl: string,
  serviceRoleKey: string,
  table: string,
  appUserId: string,
): Promise<number> {
  const res = await fetch(
    `${supabaseUrl}/rest/v1/${table}?rc_app_user_id=eq.${encodeURIComponent(appUserId)}`,
    {
      method: "PATCH",
      headers: {
        apikey: serviceRoleKey,
        Authorization: `Bearer ${serviceRoleKey}`,
        "Content-Type": "application/json",
        Prefer: "return=representation",
      },
      body: JSON.stringify({
        modal_acknowledged_at: null,
        updated_at: new Date().toISOString(),
      }),
    },
  );
  if (!res.ok) {
    console.error(`[reset-modal-acknowledgments] PATCH ${table} failed`, res.status, await res.text());
    return 0;
  }
  const rows = await res.json();
  return Array.isArray(rows) ? rows.length : 0;
}

Deno.serve(async (req: Request) => {
  if (req.method === "OPTIONS") {
    return new Response("ok", { headers: corsHeaders });
  }

  if (req.method !== "POST") {
    return jsonResponse({ reset: false, reason: "method_not_allowed" }, 405);
  }

  const supabaseUrl = Deno.env.get("SUPABASE_URL");
  const serviceRoleKey = Deno.env.get("SUPABASE_SERVICE_ROLE_KEY");
  if (!supabaseUrl || !serviceRoleKey) {
    return jsonResponse({ reset: false, reason: "server_misconfigured" }, 500);
  }

  let appUserId: string;
  try {
    const body = await req.json();
    appUserId = String(body?.app_user_id ?? "").trim();
  } catch {
    return jsonResponse({ reset: false, reason: "bad_request" }, 400);
  }
  if (!appUserId) {
    return jsonResponse({ reset: false, reason: "missing_app_user_id" }, 400);
  }

  try {
    const grandfatherRowsReset = await resetTable(
      supabaseUrl,
      serviceRoleKey,
      "android_grandfather_grants",
      appUserId,
    );
    const subscriberRowsReset = await resetTable(
      supabaseUrl,
      serviceRoleKey,
      "android_subscriber_lifetime_grants",
      appUserId,
    );
    return jsonResponse({
      reset: true,
      grandfatherRowsReset,
      subscriberRowsReset,
    });
  } catch (err) {
    console.error("[reset-modal-acknowledgments] unexpected error", err);
    return jsonResponse({ reset: false, reason: "internal_error" }, 500);
  }
});
