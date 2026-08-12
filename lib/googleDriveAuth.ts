// Google Drive auth (Android cloud backup). Thin wrapper around
// @react-native-google-signin/google-signin that yields an OAuth access token
// with the drive.appdata scope — react-native-cloud-storage's Google Drive
// provider (pure JS/REST) consumes it via setProviderOptions. Play Services
// handles token caching/refresh, so signInSilently() is cheap to call per sync.
// Counterpart of the iOS iCloud container, which needs no token at all.
import { Platform } from "react-native";
import { qaLog } from "../utils/qaLog";

// Defensive require, same pattern as lib/cloudSync.ts: on a binary without the
// native module (an OTA landing on an older build) importing this would crash.
// Degrade to "unsupported" instead; it activates once the app is rebuilt.
let GoogleSignin: any = null;
try {
  GoogleSignin = require("@react-native-google-signin/google-signin").GoogleSignin;
} catch {
  GoogleSignin = null;
}

// Drive's hidden per-app data folder — never visible among the user's own files.
const SCOPES = ["https://www.googleapis.com/auth/drive.appdata"];

let configured = false;
function ensureConfigured(): boolean {
  if (!GoogleSignin) return false;
  if (!configured) {
    try {
      // No webClientId: we only need access tokens (not an idToken for server
      // auth), which Play Services grants against the Android OAuth client
      // registered for this package name + signing SHA-1 in Google Cloud.
      GoogleSignin.configure({ scopes: SCOPES });
      configured = true;
    } catch (err) {
      qaLog("backup", "Google Sign-In configure failed", { error: String(err) });
      return false;
    }
  }
  return true;
}

export function driveAuthSupported(): boolean {
  return Platform.OS === "android" && !!GoogleSignin;
}

// Has the user connected a Google account before? (No network.)
export async function isDriveSignedIn(): Promise<boolean> {
  if (!driveAuthSupported() || !ensureConfigured()) return false;
  try {
    return !!(await GoogleSignin.hasPreviousSignIn());
  } catch {
    return false;
  }
}

export async function getDriveAccountEmail(): Promise<string | null> {
  if (!driveAuthSupported() || !ensureConfigured()) return null;
  try {
    return (await GoogleSignin.getCurrentUser())?.user?.email ?? null;
  } catch {
    return null;
  }
}

// Get a fresh access token. Auto sync passes interactive=false (silent only, so
// it no-ops until the user has connected once); the Backup screen's "Connect"
// passes interactive=true to show the account picker.
export async function getDriveAccessToken(interactive: boolean): Promise<string | null> {
  if (!driveAuthSupported() || !ensureConfigured()) return null;
  try {
    let signedIn = false;
    try {
      const r = await GoogleSignin.signInSilently();
      signedIn = r?.type !== "noSavedCredentialFound";
    } catch {
      signedIn = false;
    }
    if (!signedIn) {
      if (!interactive) return null;
      await GoogleSignin.hasPlayServices({ showPlayServicesUpdateDialog: true });
      const r = await GoogleSignin.signIn();
      if (r?.type === "cancelled") return null;
    }
    const t = await GoogleSignin.getTokens();
    return t?.accessToken ?? null;
  } catch (err) {
    qaLog("backup", "Drive token failed", { error: String(err) });
    return null;
  }
}

// Disconnect: stop auto backup to Drive on this device. The backup file itself
// stays in the account's hidden app data until the user removes app access.
export async function signOutDrive(): Promise<void> {
  if (!driveAuthSupported() || !ensureConfigured()) return;
  try {
    await GoogleSignin.signOut();
  } catch {
    /* ignore */
  }
}
