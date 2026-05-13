import { corsHeaders } from "../_shared/cors.ts";

/**
 * Returns at most ONE modal name for the current Android user.
 *
 * The client renders whichever modal this function names and POSTs to
 * `acknowledge-modal` on dismiss. RevenueCat remains the source of truth for
 * paid access; this function only decides which one-time congratulatory
 * message a user should see, using the existing grant tables as memory.
 *
 * Decision (first match wins):
 *   1. RC has `unlimited` AND `lifetime`, and the subscriber-lifetime row
 *      is not yet acknowledged → `subscriber_to_lifetime` (annual | monthly).
 *   2. RC has `lifetime`, a grandfather row exists with status=granted, and
 *      it is not yet acknowledged → `grandfathered`.
 *   3. Otherwise → null.
 *
 * Required env:
 *   REVENUECAT_SECRET_API_KEY
 *   SUPABASE_URL
 *   SUPABASE_SERVICE_ROLE_KEY
 */

const RC_API_BASE = "https://api.revenuecat.com/v1";
const LIFETIME_ENTITLEMENT_ID = "lifetime";
const ENTITLEMENT_ID = "unlimited";

type Plan = "monthly" | "annual" | "unknown";
type ModalName = "subscriber_to_lifetime" | "grandfathered";

interface WhichModalResponse {
  modal: ModalName | null;
  plan?: Plan;
  reason?: string;
}

function jsonResponse(body: WhichModalResponse, status = 200): Response {
  return new Response(JSON.stringify(body), {
    status,
    headers: { ...corsHeaders, "Content-Type": "application/json" },
  });
}

function isActiveEntitlement(entitlements: Record<string, any>, id: string): boolean {
  const ent = entitlements[id];
  if (!ent) return false;
  const expiresStr = ent.expires_date as string | null | undefined;
  if (!expiresStr) return true;
  const expiresMs = Date.parse(expiresStr);
  return Number.isNaN(expiresMs) || expiresMs > Date.now();
}

function getPlan(productIdentifier: string | null, expirationDate: string | null): Plan {
  const id = productIdentifier?.toLowerCase() ?? "";
  if (id.includes("annual") || id.includes("year")) return "annual";
  if (id.includes("monthly") || id.includes("month")) return "monthly";

  if (expirationDate) {
    const expiresMs = Date.parse(expirationDate);
    if (!Number.isNaN(expiresMs)) {
      return expiresMs - Date.now() > 60 * 24 * 60 * 60 * 1000
        ? "annual"
        : "monthly";
    }
  }
  return "unknown";
}

async function getRow(
  supabaseUrl: string,
  serviceRoleKey: string,
  table: string,
  appUserId: string,
): Promise<{ status?: string; modal_acknowledged_at?: string | null; subscription_plan?: Plan } | null> {
  const res = await fetch(
    `${supabaseUrl}/rest/v1/${table}?rc_app_user_id=eq.${encodeURIComponent(
      appUserId,
    )}&select=status,modal_acknowledged_at,subscription_plan&limit=1`,
    {
      headers: {
        apikey: serviceRoleKey,
        Authorization: `Bearer ${serviceRoleKey}`,
        Accept: "application/json",
      },
    },
  );
  if (!res.ok) {
    console.error(`[which-modal] row lookup failed for ${table}`, await res.text());
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
    return jsonResponse({ modal: null, reason: "method_not_allowed" }, 405);
  }

  const rcSecret = Deno.env.get("REVENUECAT_SECRET_API_KEY");
  const supabaseUrl = Deno.env.get("SUPABASE_URL");
  const serviceRoleKey = Deno.env.get("SUPABASE_SERVICE_ROLE_KEY");

  if (!rcSecret || !supabaseUrl || !serviceRoleKey) {
    console.error("[which-modal] missing env config");
    return jsonResponse({ modal: null, reason: "server_misconfigured" }, 500);
  }

  let appUserId: string;
  try {
    const body = await req.json();
    appUserId = String(body?.app_user_id ?? "").trim();
  } catch {
    return jsonResponse({ modal: null, reason: "bad_request" }, 400);
  }

  if (!appUserId) {
    return jsonResponse({ modal: null, reason: "missing_app_user_id" }, 400);
  }

  try {
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
      console.error("[which-modal] RC GET failed", subRes.status, await subRes.text());
      return jsonResponse({ modal: null, reason: "rc_lookup_failed" }, 502);
    }

    const subBody = await subRes.json();
    const subscriber = subBody?.subscriber;
    if (!subscriber) {
      return jsonResponse({ modal: null, reason: "subscriber_not_found" });
    }

    const entitlements = subscriber.entitlements ?? {};
    const hasUnlimited = isActiveEntitlement(entitlements, ENTITLEMENT_ID);
    const hasLifetime = isActiveEntitlement(entitlements, LIFETIME_ENTITLEMENT_ID);

    if (!hasLifetime) {
      // No lifetime → no congratulatory modal applies.
      return jsonResponse({ modal: null, reason: "no_lifetime" });
    }

    // 1. Subscriber-to-lifetime takes priority — they had a paid sub.
    if (hasUnlimited) {
      const row = await getRow(
        supabaseUrl,
        serviceRoleKey,
        "android_subscriber_lifetime_grants",
        appUserId,
      );
      if (row && !row.modal_acknowledged_at) {
        const unlimited = entitlements[ENTITLEMENT_ID];
        const plan: Plan =
          (row.subscription_plan as Plan | undefined) ??
          getPlan(unlimited?.product_identifier ?? null, unlimited?.expires_date ?? null);
        return jsonResponse({ modal: "subscriber_to_lifetime", plan });
      }
      // Already acknowledged or no row — fall through.
    }

    // 2. Grandfathered (free legacy user) — only if a granted row exists.
    const gfRow = await getRow(
      supabaseUrl,
      serviceRoleKey,
      "android_grandfather_grants",
      appUserId,
    );
    if (gfRow && gfRow.status === "granted" && !gfRow.modal_acknowledged_at) {
      return jsonResponse({ modal: "grandfathered" });
    }

    return jsonResponse({ modal: null, reason: "no_pending_modal" });
  } catch (err) {
    console.error("[which-modal] unexpected error", err);
    return jsonResponse({ modal: null, reason: "internal_error" }, 500);
  }
});
