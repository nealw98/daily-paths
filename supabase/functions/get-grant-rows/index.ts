import { corsHeaders } from "../_shared/cors.ts";

/**
 * QA helper: returns the current user's row from both grant tables
 * (`android_grandfather_grants`, `android_subscriber_lifetime_grants`) so
 * the QA screen can show them inline without needing the Supabase dashboard.
 *
 * Service-role key is used to read across RLS, but only the requested user's
 * row is returned. The QA screen is the only caller.
 *
 * Required env:
 *   SUPABASE_URL
 *   SUPABASE_SERVICE_ROLE_KEY
 */

interface GrantRowsResponse {
  grandfather: unknown | null;
  subscriber: unknown | null;
  trialStart: unknown | null;
  reason?: string;
}

function jsonResponse(body: GrantRowsResponse, status = 200): Response {
  return new Response(JSON.stringify(body), {
    status,
    headers: { ...corsHeaders, "Content-Type": "application/json" },
  });
}

async function fetchOne(
  supabaseUrl: string,
  serviceRoleKey: string,
  table: string,
  appUserId: string,
): Promise<unknown | null> {
  const res = await fetch(
    `${supabaseUrl}/rest/v1/${table}?rc_app_user_id=eq.${encodeURIComponent(appUserId)}&limit=1`,
    {
      headers: {
        apikey: serviceRoleKey,
        Authorization: `Bearer ${serviceRoleKey}`,
        Accept: "application/json",
      },
    },
  );
  if (!res.ok) {
    console.error(`[get-grant-rows] lookup failed for ${table}`, await res.text());
    return null;
  }
  const rows = await res.json();
  return Array.isArray(rows) ? rows[0] ?? null : null;
}

Deno.serve(async (req: Request) => {
  if (req.method === "OPTIONS") {
    return new Response("ok", { headers: corsHeaders });
  }

  if (req.method !== "POST") {
    return jsonResponse(
      { grandfather: null, subscriber: null, trialStart: null, reason: "method_not_allowed" },
      405,
    );
  }

  const supabaseUrl = Deno.env.get("SUPABASE_URL");
  const serviceRoleKey = Deno.env.get("SUPABASE_SERVICE_ROLE_KEY");
  if (!supabaseUrl || !serviceRoleKey) {
    return jsonResponse(
      { grandfather: null, subscriber: null, trialStart: null, reason: "server_misconfigured" },
      500,
    );
  }

  let appUserId: string;
  try {
    const body = await req.json();
    appUserId = String(body?.app_user_id ?? "").trim();
  } catch {
    return jsonResponse(
      { grandfather: null, subscriber: null, trialStart: null, reason: "bad_request" },
      400,
    );
  }
  if (!appUserId) {
    return jsonResponse(
      { grandfather: null, subscriber: null, trialStart: null, reason: "missing_app_user_id" },
      400,
    );
  }

  try {
    const [grandfather, subscriber, trialStart] = await Promise.all([
      fetchOne(supabaseUrl, serviceRoleKey, "android_grandfather_grants", appUserId),
      fetchOne(supabaseUrl, serviceRoleKey, "android_subscriber_lifetime_grants", appUserId),
      fetchOne(supabaseUrl, serviceRoleKey, "android_trial_starts", appUserId),
    ]);
    return jsonResponse({ grandfather, subscriber, trialStart });
  } catch (err) {
    console.error("[get-grant-rows] unexpected error", err);
    return jsonResponse(
      { grandfather: null, subscriber: null, trialStart: null, reason: "internal_error" },
      500,
    );
  }
});
