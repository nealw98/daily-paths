import { corsHeaders } from "../_shared/cors.ts";

/**
 * Grants the `lifetime` promotional entitlement in RevenueCat to existing
 * Android users who used the 2.6.x free-era app and move to 2.7 without an
 * active subscription, during the 30-day post-launch migration window.
 *
 * Eligibility (any of the marker checks below pass, plus the window check):
 *   - Local 2.6.x trial start marker exists and predates GRANDFATHER_CUTOFF_DATE.
 *     OR
 *   - RC subscriber.first_seen predates GRANDFATHER_LAUNCH_DATE (catches
 *     legacy users whose AsyncStorage was wiped).
 *
 * Window: requests after GRANDFATHER_LAUNCH_DATE + 30 days are denied with
 * `grandfather_window_closed`. The grandfather program is time-limited.
 *
 * Always denied:
 *   - Active `unlimited` subscription (subscriber-to-lifetime path handles them).
 *   - Already has `lifetime`.
 *
 * Required env:
 *   REVENUECAT_SECRET_API_KEY     — RC v1 secret key (sk_...)
 *   GRANDFATHER_LAUNCH_DATE       — ISO date, e.g. "2026-05-15T00:00:00Z"
 *                                   (2.7 launch). Window closes 30 days after.
 *   GRANDFATHER_CUTOFF_DATE       — ISO date. Legacy markers must predate
 *                                   this. Typically same as LAUNCH_DATE.
 *   SUPABASE_URL
 *   SUPABASE_SERVICE_ROLE_KEY
 */

const DAY_MS = 24 * 60 * 60 * 1000;
const GRANDFATHER_WINDOW_DAYS = 30;

const RC_API_BASE = "https://api.revenuecat.com/v1";
const LIFETIME_ENTITLEMENT_ID = "lifetime";
const ENTITLEMENT_ID = "unlimited";

interface GrantResponse {
  granted: boolean;
  grandfathered?: boolean;
  reason?: string;
  status?: "granted" | "denied" | "grant_failed";
}

function jsonResponse(body: GrantResponse, status = 200): Response {
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

async function recordGrantStatus(
  supabaseUrl: string,
  serviceRoleKey: string,
  payload: {
    appUserId: string;
    legacyTrialStartAt: string | null;
    migrationCutoffAt: string;
    rcFirstSeenAt: string | null;
    status: "granted" | "denied" | "grant_failed";
    decisionReason: string;
    hasActiveSubscription: boolean;
    hasLifetime: boolean;
    lastError?: string | null;
  },
) {
  const now = new Date().toISOString();
  const res = await fetch(
    `${supabaseUrl}/rest/v1/android_grandfather_grants?on_conflict=rc_app_user_id`,
    {
      method: "POST",
      headers: {
        apikey: serviceRoleKey,
        Authorization: `Bearer ${serviceRoleKey}`,
        "Content-Type": "application/json",
        Prefer: "resolution=merge-duplicates",
      },
      body: JSON.stringify({
        rc_app_user_id: payload.appUserId,
        legacy_trial_start_at: payload.legacyTrialStartAt,
        migration_cutoff_at: payload.migrationCutoffAt,
        rc_first_seen_at: payload.rcFirstSeenAt,
        status: payload.status,
        decision_reason: payload.decisionReason,
        has_active_subscription: payload.hasActiveSubscription,
        has_lifetime: payload.hasLifetime,
        last_checked_at: now,
        granted_at: payload.status === "granted" ? now : null,
        denied_at: payload.status === "denied" ? now : null,
        last_error: payload.lastError ?? null,
        updated_at: now,
      }),
    },
  );

  if (!res.ok) {
    console.error("[grant-grandfather-lifetime] status upsert failed", await res.text());
  }
}

async function getExistingGrant(
  supabaseUrl: string,
  serviceRoleKey: string,
  appUserId: string,
): Promise<{ status?: string; decision_reason?: string } | null> {
  const res = await fetch(
    `${supabaseUrl}/rest/v1/android_grandfather_grants?rc_app_user_id=eq.${encodeURIComponent(appUserId)}&select=status,decision_reason&limit=1`,
    {
      headers: {
        apikey: serviceRoleKey,
        Authorization: `Bearer ${serviceRoleKey}`,
        Accept: "application/json",
      },
    },
  );

  if (!res.ok) {
    console.error("[grant-grandfather-lifetime] existing grant lookup failed", await res.text());
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
    return jsonResponse({ granted: false, reason: "method_not_allowed" }, 405);
  }

  const rcSecret = Deno.env.get("REVENUECAT_SECRET_API_KEY");
  const cutoffStr = Deno.env.get("GRANDFATHER_CUTOFF_DATE");
  const launchStr = Deno.env.get("GRANDFATHER_LAUNCH_DATE");
  const supabaseUrl = Deno.env.get("SUPABASE_URL");
  const serviceRoleKey = Deno.env.get("SUPABASE_SERVICE_ROLE_KEY");

  if (!rcSecret || !cutoffStr || !launchStr || !supabaseUrl || !serviceRoleKey) {
    console.error("[grant-grandfather-lifetime] missing env config");
    return jsonResponse({ granted: false, reason: "server_misconfigured" }, 500);
  }

  const cutoffMs = Date.parse(cutoffStr);
  const launchMs = Date.parse(launchStr);
  if (Number.isNaN(cutoffMs) || Number.isNaN(launchMs)) {
    console.error("[grant-grandfather-lifetime] invalid cutoff/launch env values");
    return jsonResponse({ granted: false, reason: "server_misconfigured" }, 500);
  }

  let appUserId: string;
  let legacyTrialStartAt: string | null;
  try {
    const body = await req.json();
    appUserId = String(body?.app_user_id ?? "").trim();
    const raw = body?.legacy_trial_start_date;
    legacyTrialStartAt =
      typeof raw === "string" && raw.trim().length > 0 ? raw.trim() : null;
  } catch {
    return jsonResponse({ granted: false, reason: "bad_request" }, 400);
  }

  if (!appUserId) {
    return jsonResponse({ granted: false, reason: "missing_app_user_id" }, 400);
  }

  // 30-day forward window — grandfathering closes 30d after launch.
  const windowCloseMs = launchMs + GRANDFATHER_WINDOW_DAYS * DAY_MS;
  if (Date.now() > windowCloseMs) {
    await recordGrantStatus(supabaseUrl, serviceRoleKey, {
      appUserId,
      legacyTrialStartAt,
      migrationCutoffAt: cutoffStr,
      rcFirstSeenAt: null,
      status: "denied",
      decisionReason: "grandfather_window_closed",
      hasActiveSubscription: false,
      hasLifetime: false,
    });
    return jsonResponse({
      granted: false,
      grandfathered: false,
      reason: "grandfather_window_closed",
      status: "denied",
    });
  }

  // Validate the legacy marker when provided; null is accepted because the
  // RC first_seen fallback (below) can still establish eligibility.
  let legacyMarkerEligible = false;
  if (legacyTrialStartAt) {
    const legacyTrialStartMs = Date.parse(legacyTrialStartAt);
    if (Number.isNaN(legacyTrialStartMs)) {
      return jsonResponse({ granted: false, reason: "invalid_legacy_trial_marker" }, 400);
    }
    legacyMarkerEligible = legacyTrialStartMs < cutoffMs;
    if (!legacyMarkerEligible) {
      // Marker exists but is too new. Don't reject yet — RC first_seen may
      // still qualify the user. We fall through to the RC subscriber lookup.
      console.log("[grant-grandfather-lifetime] legacy marker post-cutoff; will check RC first_seen", {
        appUserId,
      });
    }
  }

  const existingGrant = await getExistingGrant(supabaseUrl, serviceRoleKey, appUserId);

  try {
    // Fetch RC subscriber to verify current entitlement state.
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
      await recordGrantStatus(supabaseUrl, serviceRoleKey, {
        appUserId,
        legacyTrialStartAt,
        migrationCutoffAt: cutoffStr,
        rcFirstSeenAt: null,
        status: "denied",
        decisionReason: "subscriber_not_found",
        hasActiveSubscription: false,
        hasLifetime: false,
      });
      return jsonResponse({
        granted: false,
        grandfathered: false,
        reason: "subscriber_not_found",
        status: "denied",
      });
    }

    const entitlements = subscriber.entitlements ?? {};
    const hasLifetime = isActiveEntitlement(entitlements, LIFETIME_ENTITLEMENT_ID);
    const hasActiveSubscription = isActiveEntitlement(entitlements, ENTITLEMENT_ID);
    const rcFirstSeenAt = subscriber.first_seen ?? null;

    // RC first_seen fallback: users who lost their AsyncStorage marker (factory
    // reset, etc.) can still be grandfathered if RC sees them as pre-launch.
    const rcFirstSeenMs = rcFirstSeenAt ? Date.parse(rcFirstSeenAt) : NaN;
    const rcFirstSeenEligible =
      !Number.isNaN(rcFirstSeenMs) && rcFirstSeenMs < launchMs;

    if (!legacyMarkerEligible && !rcFirstSeenEligible) {
      const decisionReason = legacyTrialStartAt
        ? "legacy_marker_post_cutoff"
        : "missing_legacy_trial_marker";
      await recordGrantStatus(supabaseUrl, serviceRoleKey, {
        appUserId,
        legacyTrialStartAt,
        migrationCutoffAt: cutoffStr,
        rcFirstSeenAt,
        status: "denied",
        decisionReason,
        hasActiveSubscription,
        hasLifetime,
      });
      return jsonResponse({
        granted: false,
        grandfathered: false,
        reason: decisionReason,
        status: "denied",
      });
    }

    if (hasLifetime) {
      if (existingGrant?.status === "granted") {
        await recordGrantStatus(supabaseUrl, serviceRoleKey, {
          appUserId,
          legacyTrialStartAt,
          migrationCutoffAt: cutoffStr,
          rcFirstSeenAt,
          status: "granted",
          decisionReason: existingGrant.decision_reason ?? "already_grandfathered",
          hasActiveSubscription,
          hasLifetime,
        });
        return jsonResponse({
          granted: false,
          grandfathered: true,
          reason: existingGrant.decision_reason ?? "already_grandfathered",
          status: "granted",
        });
      }

      await recordGrantStatus(supabaseUrl, serviceRoleKey, {
        appUserId,
        legacyTrialStartAt,
        migrationCutoffAt: cutoffStr,
        rcFirstSeenAt,
        status: "denied",
        decisionReason: "already_lifetime",
        hasActiveSubscription,
        hasLifetime,
      });
      return jsonResponse({
        granted: false,
        grandfathered: false,
        reason: "already_lifetime",
        status: "denied",
      });
    }

    if (hasActiveSubscription) {
      await recordGrantStatus(supabaseUrl, serviceRoleKey, {
        appUserId,
        legacyTrialStartAt,
        migrationCutoffAt: cutoffStr,
        rcFirstSeenAt,
        status: "denied",
        decisionReason: "active_subscription",
        hasActiveSubscription,
        hasLifetime,
      });
      return jsonResponse({
        granted: false,
        grandfathered: false,
        reason: "active_subscription",
        status: "denied",
      });
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
      await recordGrantStatus(supabaseUrl, serviceRoleKey, {
        appUserId,
        legacyTrialStartAt,
        migrationCutoffAt: cutoffStr,
        rcFirstSeenAt,
        status: "grant_failed",
        decisionReason: "rc_grant_failed",
        hasActiveSubscription,
        hasLifetime,
        lastError: text,
      });
      return jsonResponse({
        granted: false,
        grandfathered: false,
        reason: "rc_grant_failed",
        status: "grant_failed",
      }, 502);
    }

    const decisionReason = legacyMarkerEligible
      ? "legacy_trial_marker"
      : "rc_first_seen_pre_launch";

    await recordGrantStatus(supabaseUrl, serviceRoleKey, {
      appUserId,
      legacyTrialStartAt,
      migrationCutoffAt: cutoffStr,
      rcFirstSeenAt,
      status: "granted",
      decisionReason,
      hasActiveSubscription,
      hasLifetime: true,
    });

    return jsonResponse({
      granted: true,
      grandfathered: true,
      reason: decisionReason,
      status: "granted",
    });
  } catch (err) {
    console.error("[grant-grandfather-lifetime] unexpected error", err);
    return jsonResponse({ granted: false, reason: "internal_error" }, 500);
  }
});
