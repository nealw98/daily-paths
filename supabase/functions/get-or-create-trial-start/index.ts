import { corsHeaders } from "../_shared/cors.ts";

/**
 * Returns the trial start for the given RC App User ID. If no row exists
 * yet, inserts one using `fallback_start_at` (or `now()` if not provided)
 * and returns it.
 *
 * This is the authoritative trial-start: the client treats the returned
 * timestamp as canonical and caches it locally for offline use. Clearing
 * app data no longer resets the trial.
 *
 * Required env:
 *   SUPABASE_URL
 *   SUPABASE_SERVICE_ROLE_KEY
 */

interface TrialStartResponse {
  trial_start_at: string | null;
  created?: boolean;
  reason?: string;
}

function jsonResponse(body: TrialStartResponse, status = 200): Response {
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
    return jsonResponse({ trial_start_at: null, reason: "method_not_allowed" }, 405);
  }

  const supabaseUrl = Deno.env.get("SUPABASE_URL");
  const serviceRoleKey = Deno.env.get("SUPABASE_SERVICE_ROLE_KEY");
  if (!supabaseUrl || !serviceRoleKey) {
    return jsonResponse({ trial_start_at: null, reason: "server_misconfigured" }, 500);
  }

  let appUserId: string;
  let fallbackStartAt: string | null;
  try {
    const body = await req.json();
    appUserId = String(body?.app_user_id ?? "").trim();
    const raw = body?.fallback_start_at;
    fallbackStartAt =
      typeof raw === "string" && raw.trim().length > 0 ? raw.trim() : null;
  } catch {
    return jsonResponse({ trial_start_at: null, reason: "bad_request" }, 400);
  }
  if (!appUserId) {
    return jsonResponse({ trial_start_at: null, reason: "missing_app_user_id" }, 400);
  }

  // Validate the fallback before we trust it.
  if (fallbackStartAt) {
    const ms = Date.parse(fallbackStartAt);
    if (Number.isNaN(ms)) {
      fallbackStartAt = null;
    }
  }

  try {
    // 1. Look for existing row.
    const lookupRes = await fetch(
      `${supabaseUrl}/rest/v1/android_trial_starts?rc_app_user_id=eq.${encodeURIComponent(
        appUserId,
      )}&select=trial_start_at&limit=1`,
      {
        headers: {
          apikey: serviceRoleKey,
          Authorization: `Bearer ${serviceRoleKey}`,
          Accept: "application/json",
        },
      },
    );

    if (!lookupRes.ok) {
      console.error("[get-or-create-trial-start] lookup failed", await lookupRes.text());
      return jsonResponse({ trial_start_at: null, reason: "db_lookup_failed" }, 502);
    }
    const rows = await lookupRes.json();
    const existing = Array.isArray(rows) && rows[0]?.trial_start_at;
    if (existing) {
      return jsonResponse({ trial_start_at: existing, created: false });
    }

    // 2. Insert a new row. Race-safe via upsert with on_conflict.
    const startAt = fallbackStartAt ?? new Date().toISOString();
    const now = new Date().toISOString();
    const insertRes = await fetch(
      `${supabaseUrl}/rest/v1/android_trial_starts?on_conflict=rc_app_user_id`,
      {
        method: "POST",
        headers: {
          apikey: serviceRoleKey,
          Authorization: `Bearer ${serviceRoleKey}`,
          "Content-Type": "application/json",
          // Keep an existing row if one races in between the lookup and now.
          Prefer: "resolution=ignore-duplicates,return=representation",
        },
        body: JSON.stringify({
          rc_app_user_id: appUserId,
          trial_start_at: startAt,
          created_at: now,
          updated_at: now,
        }),
      },
    );
    if (!insertRes.ok) {
      console.error("[get-or-create-trial-start] insert failed", await insertRes.text());
      return jsonResponse({ trial_start_at: null, reason: "db_insert_failed" }, 502);
    }

    // If the insert was a no-op (existing row won), re-fetch.
    const after = await fetch(
      `${supabaseUrl}/rest/v1/android_trial_starts?rc_app_user_id=eq.${encodeURIComponent(
        appUserId,
      )}&select=trial_start_at&limit=1`,
      {
        headers: {
          apikey: serviceRoleKey,
          Authorization: `Bearer ${serviceRoleKey}`,
          Accept: "application/json",
        },
      },
    );
    if (after.ok) {
      const afterRows = await after.json();
      const final = Array.isArray(afterRows) && afterRows[0]?.trial_start_at;
      if (final) {
        return jsonResponse({ trial_start_at: final, created: final === startAt });
      }
    }

    return jsonResponse({ trial_start_at: startAt, created: true });
  } catch (err) {
    console.error("[get-or-create-trial-start] unexpected error", err);
    return jsonResponse({ trial_start_at: null, reason: "internal_error" }, 500);
  }
});
