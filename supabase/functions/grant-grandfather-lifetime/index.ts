import { corsHeaders } from "../_shared/cors.ts";

/**
 * Grants the `lifetime` promotional entitlement in RevenueCat to existing
 * pre-2.6.6 Android users so they retain free access after the model change.
 *
 * Eligibility (all server-verified, not forgeable):
 *   1. RC subscriber exists.
 *   2. `subscriber.first_seen` is older than GRANDFATHER_CUTOFF_DATE (the
 *      ship date of 2.6.6) — proves the user existed under the prior model.
 *   3. Has no active `unlimited` or `lifetime` entitlement (idempotent on
 *      re-call; doesn't double-grant).
 *
 * Required env:
 *   REVENUECAT_SECRET_API_KEY  — RC v1 secret key (sk_...)
 *   GRANDFATHER_CUTOFF_DATE    — ISO date, e.g. "2026-05-15T00:00:00Z"
 */

const RC_API_BASE = "https://api.revenuecat.com/v1";
const LIFETIME_ENTITLEMENT_ID = "lifetime";
const ENTITLEMENT_ID = "unlimited";

interface GrantResponse {
  granted: boolean;
  reason?: string;
}

function jsonResponse(body: GrantResponse, status = 200): Response {
  return new Response(JSON.stringify(body), {
    status,
    headers: { ...corsHeaders, "Content-Type": "application/json" },
  });
}

Deno.serve(async (req: Request) => {
  if (req.method === "OPTIONS") {
    return new Response("ok", { headers: corsHeaders });
  }

  if (req.method !== "POST") {
    return jsonResponse({ granted: false, reason: "method_not_allowed" }, 405);
  }

  const rcSecret = Deno.env.get("REVENUECAT_SECRET_API_KEY");
  const cutoffStr = Deno.env.get("GRANDFATHER_CUTOFF_DATE");

  if (!rcSecret || !cutoffStr) {
    console.error("[grant-grandfather-lifetime] missing env config");
    return jsonResponse({ granted: false, reason: "server_misconfigured" }, 500);
  }

  const cutoffMs = Date.parse(cutoffStr);
  if (Number.isNaN(cutoffMs)) {
    console.error("[grant-grandfather-lifetime] invalid GRANDFATHER_CUTOFF_DATE");
    return jsonResponse({ granted: false, reason: "server_misconfigured" }, 500);
  }

  let appUserId: string;
  try {
    const body = await req.json();
    appUserId = String(body?.app_user_id ?? "").trim();
  } catch {
    return jsonResponse({ granted: false, reason: "bad_request" }, 400);
  }

  if (!appUserId) {
    return jsonResponse({ granted: false, reason: "missing_app_user_id" }, 400);
  }

  try {
    // Fetch RC subscriber to verify eligibility
    const subRes = await fetch(
      `${RC_API_BASE}/subscribers/${encodeURIComponent(appUserId)}`,
      {
        headers: {
          Authorization: `Bearer ${rcSecret}`,
          Accept: "application/json",
        },
      },
    );

    if (!subRes.ok) {
      const text = await subRes.text();
      console.error("[grant-grandfather-lifetime] RC GET failed", subRes.status, text);
      return jsonResponse({ granted: false, reason: "rc_lookup_failed" }, 502);
    }

    const subBody = await subRes.json();
    const subscriber = subBody?.subscriber;
    if (!subscriber) {
      return jsonResponse({ granted: false, reason: "subscriber_not_found" });
    }

    const firstSeenStr: string | undefined = subscriber.first_seen;
    if (!firstSeenStr) {
      return jsonResponse({ granted: false, reason: "no_first_seen" });
    }

    const firstSeenMs = Date.parse(firstSeenStr);
    if (Number.isNaN(firstSeenMs)) {
      return jsonResponse({ granted: false, reason: "invalid_first_seen" });
    }

    if (firstSeenMs >= cutoffMs) {
      return jsonResponse({ granted: false, reason: "post_cutoff" });
    }

    const entitlements = subscriber.entitlements ?? {};
    const nowMs = Date.now();

    const isActive = (id: string) => {
      const ent = entitlements[id];
      if (!ent) return false;
      const expiresStr = ent.expires_date as string | null | undefined;
      if (!expiresStr) return true;
      const expiresMs = Date.parse(expiresStr);
      return Number.isNaN(expiresMs) || expiresMs > nowMs;
    };

    if (isActive(LIFETIME_ENTITLEMENT_ID) || isActive(ENTITLEMENT_ID)) {
      return jsonResponse({ granted: false, reason: "already_entitled" });
    }

    // Grant the lifetime promotional entitlement
    const grantRes = await fetch(
      `${RC_API_BASE}/subscribers/${encodeURIComponent(appUserId)}/entitlements/${LIFETIME_ENTITLEMENT_ID}/promotional`,
      {
        method: "POST",
        headers: {
          Authorization: `Bearer ${rcSecret}`,
          "Content-Type": "application/json",
          Accept: "application/json",
        },
        body: JSON.stringify({ duration: "lifetime" }),
      },
    );

    if (!grantRes.ok) {
      const text = await grantRes.text();
      console.error("[grant-grandfather-lifetime] RC grant failed", grantRes.status, text);
      return jsonResponse({ granted: false, reason: "rc_grant_failed" }, 502);
    }

    return jsonResponse({ granted: true });
  } catch (err) {
    console.error("[grant-grandfather-lifetime] unexpected error", err);
    return jsonResponse({ granted: false, reason: "internal_error" }, 500);
  }
});
