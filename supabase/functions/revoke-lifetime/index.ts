import { corsHeaders } from "../_shared/cors.ts";

/**
 * QA-only: revokes all promotional `lifetime` entitlements for the given RC
 * App User ID, and clears any modal acknowledgments so the modal flow can be
 * re-tested on the same device. Logs an audit row in
 * `android_lifetime_revocations`.
 *
 * This is intended for development / QA — do not surface a UI for it in a
 * production build. Real lifetime entitlements (from the $4.99 IAP) should
 * never be revoked through this path; the function calls the RC promotional
 * revoke endpoint which only removes manually-granted promotional entitlements.
 *
 * Required env:
 *   REVENUECAT_SECRET_API_KEY
 *   SUPABASE_URL
 *   SUPABASE_SERVICE_ROLE_KEY
 */

const RC_API_BASE = "https://api.revenuecat.com/v1";
const LIFETIME_ENTITLEMENT_ID = "lifetime";

interface RevokeResponse {
  revoked: boolean;
  reason?: string;
  rcStatus?: number;
  rcBody?: string;
}

function jsonResponse(body: RevokeResponse, status = 200): Response {
  return new Response(JSON.stringify(body), {
    status,
    headers: { ...corsHeaders, "Content-Type": "application/json" },
  });
}

async function recordRevocation(
  supabaseUrl: string,
  serviceRoleKey: string,
  appUserId: string,
  status: "revoked" | "revoke_failed",
  lastError: string | null,
) {
  const res = await fetch(
    `${supabaseUrl}/rest/v1/android_lifetime_revocations`,
    {
      method: "POST",
      headers: {
        apikey: serviceRoleKey,
        Authorization: `Bearer ${serviceRoleKey}`,
        "Content-Type": "application/json",
        Prefer: "return=minimal",
      },
      body: JSON.stringify({
        rc_app_user_id: appUserId,
        status,
        last_error: lastError,
      }),
    },
  );
  if (!res.ok) {
    console.error("[revoke-lifetime] audit insert failed", await res.text());
  }
}

async function clearModalAcknowledgments(
  supabaseUrl: string,
  serviceRoleKey: string,
  appUserId: string,
) {
  const tables = [
    "android_grandfather_grants",
    "android_subscriber_lifetime_grants",
  ];
  for (const table of tables) {
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
        body: JSON.stringify({
          modal_acknowledged_at: null,
          updated_at: new Date().toISOString(),
        }),
      },
    );
    if (!res.ok) {
      console.error(`[revoke-lifetime] failed to clear ack on ${table}`, await res.text());
    }
  }
}

Deno.serve(async (req: Request) => {
  if (req.method === "OPTIONS") {
    return new Response("ok", { headers: corsHeaders });
  }

  if (req.method !== "POST") {
    return jsonResponse({ revoked: false, reason: "method_not_allowed" }, 405);
  }

  const rcSecret = Deno.env.get("REVENUECAT_SECRET_API_KEY");
  const supabaseUrl = Deno.env.get("SUPABASE_URL");
  const serviceRoleKey = Deno.env.get("SUPABASE_SERVICE_ROLE_KEY");
  if (!rcSecret || !supabaseUrl || !serviceRoleKey) {
    return jsonResponse({ revoked: false, reason: "server_misconfigured" }, 500);
  }

  let appUserId: string;
  try {
    const body = await req.json();
    appUserId = String(body?.app_user_id ?? "").trim();
  } catch {
    return jsonResponse({ revoked: false, reason: "bad_request" }, 400);
  }
  if (!appUserId) {
    return jsonResponse({ revoked: false, reason: "missing_app_user_id" }, 400);
  }

  try {
    // RC requires Content-Type: application/json even on requests with no
    // body. Omitting it returns RC error code 7227.
    const revokeRes = await fetch(
      `${RC_API_BASE}/subscribers/${encodeURIComponent(appUserId)}/entitlements/${LIFETIME_ENTITLEMENT_ID}/revoke_promotionals`,
      {
        method: "POST",
        headers: {
          Authorization: `Bearer ${rcSecret}`,
          Accept: "application/json",
          "Content-Type": "application/json",
        },
      },
    );

    if (!revokeRes.ok) {
      const text = await revokeRes.text();
      console.error(
        "[revoke-lifetime] RC revoke failed",
        revokeRes.status,
        text,
      );
      await recordRevocation(
        supabaseUrl,
        serviceRoleKey,
        appUserId,
        "revoke_failed",
        text,
      );
      // Return HTTP 200 with a business-level failure so the client gets
      // the full reason + RC status. Returning a non-2xx status causes
      // supabase-js to wrap the response in FunctionsHttpError and drop
      // the body, leaving the QA panel undiagnosable.
      return jsonResponse({
        revoked: false,
        reason: "rc_revoke_failed",
        rcStatus: revokeRes.status,
        rcBody: text,
      });
    }

    await clearModalAcknowledgments(supabaseUrl, serviceRoleKey, appUserId);
    await recordRevocation(supabaseUrl, serviceRoleKey, appUserId, "revoked", null);

    return jsonResponse({ revoked: true });
  } catch (err) {
    console.error("[revoke-lifetime] unexpected error", err);
    await recordRevocation(
      supabaseUrl,
      serviceRoleKey,
      appUserId,
      "revoke_failed",
      String(err),
    );
    return jsonResponse({ revoked: false, reason: "internal_error" }, 500);
  }
});
