import { corsHeaders } from "../_shared/cors.ts";

interface GrantRowsResponse {
  grandfather: unknown | null;
  subscriber: unknown | null;
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
  const response = await fetch(
    `${supabaseUrl}/rest/v1/${table}?rc_app_user_id=eq.${encodeURIComponent(appUserId)}&select=*&limit=1`,
    {
      headers: {
        apikey: serviceRoleKey,
        Authorization: `Bearer ${serviceRoleKey}`,
        Accept: "application/json",
      },
    },
  );
  if (!response.ok) return null;
  const rows = await response.json();
  return Array.isArray(rows) ? rows[0] ?? null : null;
}

Deno.serve(async (request: Request) => {
  if (request.method === "OPTIONS") return new Response("ok", { headers: corsHeaders });
  if (request.method !== "POST") {
    return jsonResponse({ grandfather: null, subscriber: null, reason: "method_not_allowed" }, 405);
  }

  const supabaseUrl = Deno.env.get("SUPABASE_URL");
  const serviceRoleKey = Deno.env.get("SUPABASE_SERVICE_ROLE_KEY");
  if (!supabaseUrl || !serviceRoleKey) {
    return jsonResponse({ grandfather: null, subscriber: null, reason: "server_misconfigured" }, 500);
  }

  let appUserId = "";
  try {
    appUserId = String((await request.json())?.app_user_id ?? "").trim();
  } catch {
    return jsonResponse({ grandfather: null, subscriber: null, reason: "bad_request" }, 400);
  }
  if (!appUserId) {
    return jsonResponse({ grandfather: null, subscriber: null, reason: "missing_app_user_id" }, 400);
  }

  const [grandfather, subscriber] = await Promise.all([
    fetchOne(supabaseUrl, serviceRoleKey, "android_grandfather_grants", appUserId),
    fetchOne(supabaseUrl, serviceRoleKey, "android_subscriber_lifetime_grants", appUserId),
  ]);
  return jsonResponse({ grandfather, subscriber });
});
