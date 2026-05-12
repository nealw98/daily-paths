import { corsHeaders } from "../_shared/cors.ts";

/**
 * Grants `lifetime` promotional entitlement in RevenueCat to active Android
 * legacy subscribers. The app only calls this when RevenueCat reports an
 * active `unlimited` subscription and no `lifetime` entitlement.
 *
 * Required env:
 *   REVENUECAT_SECRET_API_KEY
 *   SUPABASE_URL
 *   SUPABASE_SERVICE_ROLE_KEY
 */

const RC_API_BASE = "https://api.revenuecat.com/v1";
const LIFETIME_ENTITLEMENT_ID = "lifetime";
const ENTITLEMENT_ID = "unlimited";

type SubscriptionPlan = "monthly" | "annual" | "unknown";
type GrantStatus = "granted" | "denied" | "grant_failed";

interface GrantResponse {
  granted: boolean;
  migrated?: boolean;
  reason?: string;
  status?: GrantStatus;
  subscriptionPlan?: SubscriptionPlan;
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

function getSubscriptionPlan(
  productIdentifier: string | null,
  expirationDate: string | null,
): SubscriptionPlan {
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

function getFirstString(source: Record<string, any> | null | undefined, keys: string[]): string | null {
  if (!source) return null;
  for (const key of keys) {
    const value = source[key];
    if (typeof value === "string" && value.trim()) return value;
  }
  return null;
}

async function recordGrantStatus(
  supabaseUrl: string,
  serviceRoleKey: string,
  payload: {
    appUserId: string;
    productIdentifier: string | null;
    subscriptionPlan: SubscriptionPlan;
    purchasedAt: string | null;
    originalPurchasedAt: string | null;
    expirationDate: string | null;
    willRenew: boolean;
    storeTransactionId: string | null;
    rawSubscriptionEntitlement: Record<string, any> | null;
    rcFirstSeenAt: string | null;
    status: GrantStatus;
    decisionReason: string;
    lastError?: string | null;
  },
) {
  const now = new Date().toISOString();
  const res = await fetch(
    `${supabaseUrl}/rest/v1/android_subscriber_lifetime_grants?on_conflict=rc_app_user_id`,
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
        subscription_product_identifier: payload.productIdentifier,
        subscription_plan: payload.subscriptionPlan,
        subscription_purchased_at: payload.purchasedAt,
        subscription_original_purchased_at: payload.originalPurchasedAt,
        subscription_expiration_at: payload.expirationDate,
        subscription_will_renew: payload.willRenew,
        store_transaction_id: payload.storeTransactionId,
        raw_subscription_entitlement: payload.rawSubscriptionEntitlement,
        rc_first_seen_at: payload.rcFirstSeenAt,
        status: payload.status,
        decision_reason: payload.decisionReason,
        last_checked_at: now,
        granted_at: payload.status === "granted" ? now : null,
        denied_at: payload.status === "denied" ? now : null,
        last_error: payload.lastError ?? null,
        updated_at: now,
      }),
    },
  );

  if (!res.ok) {
    console.error("[grant-subscriber-lifetime] status upsert failed", await res.text());
  }
}

Deno.serve(async (req: Request) => {
  if (req.method === "OPTIONS") {
    return new Response("ok", { headers: corsHeaders });
  }

  if (req.method !== "POST") {
    return jsonResponse({ granted: false, reason: "method_not_allowed" }, 405);
  }

  const rcSecret = Deno.env.get("REVENUECAT_SECRET_API_KEY");
  const supabaseUrl = Deno.env.get("SUPABASE_URL");
  const serviceRoleKey = Deno.env.get("SUPABASE_SERVICE_ROLE_KEY");

  if (!rcSecret || !supabaseUrl || !serviceRoleKey) {
    console.error("[grant-subscriber-lifetime] missing env config");
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
      console.error("[grant-subscriber-lifetime] RC GET failed", subRes.status, text);
      return jsonResponse({ granted: false, reason: "rc_lookup_failed" }, 502);
    }

    const subBody = await subRes.json();
    const subscriber = subBody?.subscriber;
    if (!subscriber) {
      return jsonResponse({
        granted: false,
        migrated: false,
        reason: "subscriber_not_found",
        status: "denied",
      });
    }

    const entitlements = subscriber.entitlements ?? {};
    const unlimited = entitlements[ENTITLEMENT_ID];
    const lifetime = entitlements[LIFETIME_ENTITLEMENT_ID];
    const hasActiveSubscription = isActiveEntitlement(entitlements, ENTITLEMENT_ID);
    const hasLifetime = isActiveEntitlement(entitlements, LIFETIME_ENTITLEMENT_ID);
    const productIdentifier = unlimited?.product_identifier ?? null;
    const purchasedAt = getFirstString(unlimited, [
      "purchase_date",
      "purchased_at",
      "latest_purchase_date",
    ]);
    const originalPurchasedAt = getFirstString(unlimited, [
      "original_purchase_date",
      "original_purchased_at",
    ]);
    const expirationDate = unlimited?.expires_date ?? null;
    const willRenew = Boolean(unlimited?.will_renew);
    const storeTransactionId = getFirstString(unlimited, [
      "store_transaction_id",
      "transaction_id",
      "original_transaction_id",
    ]);
    const subscriptionPlan = getSubscriptionPlan(productIdentifier, expirationDate);
    const rcFirstSeenAt = subscriber.first_seen ?? null;

    if (!hasActiveSubscription) {
      await recordGrantStatus(supabaseUrl, serviceRoleKey, {
        appUserId,
        productIdentifier,
        subscriptionPlan,
        purchasedAt,
        originalPurchasedAt,
        expirationDate,
        willRenew,
        storeTransactionId,
        rawSubscriptionEntitlement: unlimited ?? null,
        rcFirstSeenAt,
        status: "denied",
        decisionReason: "no_active_subscription",
      });
      return jsonResponse({
        granted: false,
        migrated: false,
        reason: "no_active_subscription",
        status: "denied",
        subscriptionPlan,
      });
    }

    if (hasLifetime) {
      await recordGrantStatus(supabaseUrl, serviceRoleKey, {
        appUserId,
        productIdentifier: lifetime?.product_identifier ?? productIdentifier,
        subscriptionPlan,
        purchasedAt,
        originalPurchasedAt,
        expirationDate,
        willRenew,
        storeTransactionId,
        rawSubscriptionEntitlement: unlimited ?? null,
        rcFirstSeenAt,
        status: "granted",
        decisionReason: "already_lifetime",
      });
      return jsonResponse({
        granted: false,
        migrated: true,
        reason: "already_lifetime",
        status: "granted",
        subscriptionPlan,
      });
    }

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
      console.error("[grant-subscriber-lifetime] RC grant failed", grantRes.status, text);
      await recordGrantStatus(supabaseUrl, serviceRoleKey, {
        appUserId,
        productIdentifier,
        subscriptionPlan,
        purchasedAt,
        originalPurchasedAt,
        expirationDate,
        willRenew,
        storeTransactionId,
        rawSubscriptionEntitlement: unlimited ?? null,
        rcFirstSeenAt,
        status: "grant_failed",
        decisionReason: "rc_grant_failed",
        lastError: text,
      });
      return jsonResponse({
        granted: false,
        migrated: false,
        reason: "rc_grant_failed",
        status: "grant_failed",
        subscriptionPlan,
      }, 502);
    }

    await recordGrantStatus(supabaseUrl, serviceRoleKey, {
      appUserId,
      productIdentifier,
      subscriptionPlan,
      purchasedAt,
      originalPurchasedAt,
      expirationDate,
      willRenew,
      storeTransactionId,
      rawSubscriptionEntitlement: unlimited ?? null,
      rcFirstSeenAt,
      status: "granted",
      decisionReason: "active_subscription",
    });

    return jsonResponse({
      granted: true,
      migrated: true,
      reason: "active_subscription",
      status: "granted",
      subscriptionPlan,
    });
  } catch (err) {
    console.error("[grant-subscriber-lifetime] unexpected error", err);
    return jsonResponse({ granted: false, reason: "internal_error" }, 500);
  }
});

