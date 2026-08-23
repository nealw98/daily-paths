import AsyncStorage from "@react-native-async-storage/async-storage";
import { qaLog } from "./qaLog";
import { isPreviewBuild } from "./buildProfile";

const CACHE_KEY = "@daily_paths_lifetime_access_v1";

// ─── Version threshold ───────────────────────────────────────────────────────
// The first build number published as a free download on the App Store.
// Any user whose originalAppVersion is numerically below this has lifetime
// access (they paid for the app).
// Set to null while the app is still a paid download (all iOS users are paid).
const FIRST_FREE_BUILD_NUMBER: number | null = null;

export interface LifetimeAccessStatus {
  /** True if the user paid for the app download (lifetime access) */
  hasLifetimeAccess: boolean;
  /** The build number the user originally downloaded, if available */
  originalAppVersion: string | null;
  /** ISO date of the original purchase, if available */
  originalPurchaseDate: string | null;
  /** How the status was determined */
  detectionMethod:
    | "storekit2"
    | "storekit2-error"
    | "unavailable"
    | "cache"
    | "default";
}

export interface NativeAppTransactionInfo {
  originalAppVersion: string | null;
  originalPurchaseDate: string | null;
  available: boolean;
  verified: boolean;
  reason: string | null;
  error?: boolean;
}

export interface LifetimeAccessDiagnostics {
  source: "override" | "cache" | "native" | "default";
  firstFreeBuildNumber: number | null;
  override: boolean | null;
  cachedStatus: LifetimeAccessStatus | null;
  nativeInfo: NativeAppTransactionInfo | null;
  nativeError: string | null;
  effectiveStatus: LifetimeAccessStatus;
}

function buildStatusFromNativeInfo(
  info: NativeAppTransactionInfo,
): LifetimeAccessStatus {
  if (!info.available) {
    // Android or iOS < 16: no lifetime access from app purchase
    return {
      hasLifetimeAccess: false,
      originalAppVersion: null,
      originalPurchaseDate: null,
      detectionMethod: "unavailable",
    };
  }

  if (info.error) {
    // iOS 16+ but AppTransaction threw an error — transient OS issue.
    // Grant lifetime access so legitimate paid users aren't locked out.
    return {
      hasLifetimeAccess: true,
      originalAppVersion: null,
      originalPurchaseDate: null,
      detectionMethod: "storekit2-error",
    };
  }

  if (!info.verified) {
    // Unverified receipt — likely tampered (jailbreak / piracy).
    // No lifetime access.
    return {
      hasLifetimeAccess: false,
      originalAppVersion: null,
      originalPurchaseDate: null,
      detectionMethod: "storekit2",
    };
  }

  // Verified receipt — check version against threshold.
  return {
    hasLifetimeAccess: isLifetimeVersion(info.originalAppVersion),
    originalAppVersion: info.originalAppVersion,
    originalPurchaseDate: info.originalPurchaseDate,
    detectionMethod: "storekit2",
  };
}

async function getNativeTransactionInfo(): Promise<{
  info: NativeAppTransactionInfo | null;
  error: string | null;
}> {
  try {
    const { getAppTransactionInfo } = require("../modules/paid-app-detector");
    const info = await getAppTransactionInfo();
    return { info, error: null };
  } catch (err) {
    return {
      info: null,
      error: String(err),
    };
  }
}

/**
 * Determine whether the current user paid for the app download (lifetime access).
 *
 * On iOS 16+, reads the App Store receipt via StoreKit 2's AppTransaction.
 * On Android and iOS < 16, returns false (no lifetime access from app purchase).
 * Results are cached in AsyncStorage — the original purchase is immutable.
 */
export async function detectLifetimeAccess(): Promise<LifetimeAccessStatus> {
  // 0. Dev/QA override takes priority
  // A preview-build purchase bypass must never carry into a store build after
  // an update. Production ignores the stored QA override completely.
  const override = isPreviewBuild() ? await getLifetimeOverride() : null;
  if (override !== null) {
    const status: LifetimeAccessStatus = {
      hasLifetimeAccess: override,
      originalAppVersion: null,
      originalPurchaseDate: null,
      detectionMethod: "cache",
    };
    qaLog("lifetime-access", `Using dev override: ${override}`);
    qaLog("lifetime-access", "Effective lifetime access resolved", {
      source: "override",
      ...status,
    });
    return status;
  }

  // 1. Try cache first for instant access
  const cached = await getCachedStatus();
  if (cached) {
    qaLog("lifetime-access", "Using cached status", cached);
    const status = { ...cached, detectionMethod: "cache" as const };
    qaLog("lifetime-access", "Effective lifetime access resolved", {
      source: "cache",
      ...status,
    });
    return status;
  }

  // 2. Call native module
  try {
    const { getAppTransactionInfo } = require("../modules/paid-app-detector");
    const info = await getAppTransactionInfo();

    qaLog("lifetime-access", "Native module result", info);
    const status = buildStatusFromNativeInfo(info);

    await cacheStatus(status);
    qaLog("lifetime-access", "Effective lifetime access resolved", {
      source: "native",
      ...status,
      nativeAvailable: info.available,
      nativeVerified: info.verified,
      nativeReason: info.reason,
      nativeError: !!info.error,
    });
    return status;
  } catch (err) {
    qaLog("lifetime-access", "Native module failed", {
      error: String(err),
    });
    // Module not available (e.g. Expo Go) — no lifetime access
    const status: LifetimeAccessStatus = {
      hasLifetimeAccess: false,
      originalAppVersion: null,
      originalPurchaseDate: null,
      detectionMethod: "default",
    };
    qaLog("lifetime-access", "Effective lifetime access resolved", {
      source: "default",
      ...status,
      nativeError: String(err),
    });
    return status;
  }
}

export async function clearLifetimeAccessCache(): Promise<void> {
  await AsyncStorage.removeItem(CACHE_KEY);
  qaLog("lifetime-access", "Lifetime access cache cleared");
}

export async function getLifetimeAccessDiagnostics(): Promise<LifetimeAccessDiagnostics> {
  const override = await getLifetimeOverride();
  const cachedStatus = await getCachedStatus();
  const { info: nativeInfo, error: nativeError } = await getNativeTransactionInfo();

  if (override !== null) {
    return {
      source: "override",
      firstFreeBuildNumber: FIRST_FREE_BUILD_NUMBER,
      override,
      cachedStatus,
      nativeInfo,
      nativeError,
      effectiveStatus: {
        hasLifetimeAccess: override,
        originalAppVersion: null,
        originalPurchaseDate: null,
        detectionMethod: "cache",
      },
    };
  }

  if (cachedStatus) {
    return {
      source: "cache",
      firstFreeBuildNumber: FIRST_FREE_BUILD_NUMBER,
      override,
      cachedStatus,
      nativeInfo,
      nativeError,
      effectiveStatus: {
        ...cachedStatus,
        detectionMethod: "cache",
      },
    };
  }

  if (nativeInfo) {
    return {
      source: "native",
      firstFreeBuildNumber: FIRST_FREE_BUILD_NUMBER,
      override,
      cachedStatus,
      nativeInfo,
      nativeError,
      effectiveStatus: buildStatusFromNativeInfo(nativeInfo),
    };
  }

  return {
    source: "default",
    firstFreeBuildNumber: FIRST_FREE_BUILD_NUMBER,
    override,
    cachedStatus,
    nativeInfo,
    nativeError,
    effectiveStatus: {
      hasLifetimeAccess: false,
      originalAppVersion: null,
      originalPurchaseDate: null,
      detectionMethod: "default",
    },
  };
}

/**
 * Check whether the original build number predates the freemium transition.
 */
function isLifetimeVersion(originalAppVersion: string | null): boolean {
  // App is still paid — all verified receipts indicate a paid download
  if (FIRST_FREE_BUILD_NUMBER === null) return true;

  if (!originalAppVersion) return false;

  const buildNum = parseInt(originalAppVersion, 10);
  if (isNaN(buildNum)) return false;

  return buildNum < FIRST_FREE_BUILD_NUMBER;
}

// ─── Dev / QA override ───────────────────────────────────────────────────────

const OVERRIDE_KEY = "@daily_paths_lifetime_override";

/**
 * Force lifetime access on or off for testing.
 * Pass `null` to clear the override and return to receipt-based detection.
 */
export async function setLifetimeOverride(
  value: boolean | null,
): Promise<void> {
  if (value === null) {
    await AsyncStorage.removeItem(OVERRIDE_KEY);
    await AsyncStorage.removeItem(CACHE_KEY);
    qaLog("lifetime-access", "Override cleared — will re-detect on next refresh");
  } else {
    await AsyncStorage.setItem(OVERRIDE_KEY, JSON.stringify(value));
    await AsyncStorage.removeItem(CACHE_KEY);
    qaLog("lifetime-access", `Override set to ${value}`);
  }
}

/**
 * Read the current override value, if any.
 */
export async function getLifetimeOverride(): Promise<boolean | null> {
  try {
    const raw = await AsyncStorage.getItem(OVERRIDE_KEY);
    if (raw === null) return null;
    return JSON.parse(raw) as boolean;
  } catch {
    return null;
  }
}

// ─── Cache helpers ───────────────────────────────────────────────────────────

async function cacheStatus(status: LifetimeAccessStatus): Promise<void> {
  try {
    await AsyncStorage.setItem(CACHE_KEY, JSON.stringify(status));
  } catch {
    // Non-critical
  }
}

async function getCachedStatus(): Promise<LifetimeAccessStatus | null> {
  try {
    const raw = await AsyncStorage.getItem(CACHE_KEY);
    if (!raw) return null;
    return JSON.parse(raw) as LifetimeAccessStatus;
  } catch {
    return null;
  }
}
