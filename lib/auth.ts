import { supabase } from "./supabase";
import { qaLog } from "../utils/qaLog";
import { getOrCreateDeviceId } from "../utils/deviceIdentity";
import * as AppleAuthentication from "expo-apple-authentication";
import { Platform } from "react-native";
import {
  GoogleSignin,
  isErrorWithCode,
  statusCodes,
} from "@react-native-google-signin/google-signin";

// Configure Google Sign-In at module load
// iOS requires iosClientId (or GoogleService-Info.plist); webClientId alone works for Android
const webClientId = process.env.EXPO_PUBLIC_GOOGLE_WEB_CLIENT_ID;
const iosClientId = process.env.EXPO_PUBLIC_GOOGLE_IOS_CLIENT_ID;

if (webClientId && (Platform.OS !== "ios" || iosClientId)) {
  GoogleSignin.configure({
    webClientId,
    ...(Platform.OS === "ios" && iosClientId && { iosClientId }),
  });
} else if (__DEV__) {
  qaLog(
    "auth",
    "Google Sign-In not configured: need EXPO_PUBLIC_GOOGLE_WEB_CLIENT_ID and (on iOS) EXPO_PUBLIC_GOOGLE_IOS_CLIENT_ID in .env"
  );
}

/**
 * Authentication library for Daily Paths Unlimited.
 * Supports email/password, Google, and Apple sign-in via Supabase Auth.
 */

// ─── Email/Password Auth ────────────────────────────────────────────────────

export async function signInWithEmail(email: string, password: string) {
  qaLog("auth", "Signing in with email", { email });
  const { data, error } = await supabase.auth.signInWithPassword({
    email,
    password,
  });
  if (error) {
    qaLog("auth", "Email sign-in failed", { error: error.message });
    throw error;
  }
  qaLog("auth", "Email sign-in successful", { userId: data.user?.id });
  // Link device to user after successful sign-in
  if (data.user) {
    await linkDeviceToUser(data.user.id);
  }
  return data;
}

export async function signUpWithEmail(email: string, password: string) {
  qaLog("auth", "Signing up with email", { email });
  const { data, error } = await supabase.auth.signUp({
    email,
    password,
  });
  if (error) {
    qaLog("auth", "Email sign-up failed", { error: error.message });
    throw error;
  }

  // If no session was created, email confirmation is likely still enabled.
  // We don't support that flow — surface a clear error instead of silently hanging.
  if (!data.session) {
    qaLog("auth", "Sign-up returned no session (email confirmation required?)");
    throw new Error(
      "Account created but requires email confirmation. Please check your email, then sign in."
    );
  }

  qaLog("auth", "Email sign-up successful", { userId: data.user?.id });
  // Link device and create profile after successful sign-up
  if (data.user) {
    await linkDeviceToUser(data.user.id);
    await createUserProfile(data.user.id);
  }
  return data;
}

// ─── Apple Sign In ──────────────────────────────────────────────────────────

export async function signInWithApple() {
  qaLog("auth", "Starting Apple sign-in");

  if (Platform.OS !== "ios") {
    throw new Error("Apple Sign In is only available on iOS");
  }

  try {
    const credential = await AppleAuthentication.signInAsync({
      requestedScopes: [
        AppleAuthentication.AppleAuthenticationScope.FULL_NAME,
        AppleAuthentication.AppleAuthenticationScope.EMAIL,
      ],
    });

    if (!credential.identityToken) {
      throw new Error("No identity token received from Apple");
    }

    const { data, error } = await supabase.auth.signInWithIdToken({
      provider: "apple",
      token: credential.identityToken,
    });

    if (error) {
      qaLog("auth", "Apple sign-in Supabase error", { error: error.message });
      throw error;
    }

    qaLog("auth", "Apple sign-in successful", { userId: data.user?.id });

    if (data.user) {
      await linkDeviceToUser(data.user.id);
      await createUserProfile(data.user.id);
    }

    return data;
  } catch (err: any) {
    if (err.code === "ERR_REQUEST_CANCELED") {
      qaLog("auth", "Apple sign-in cancelled by user");
      return null; // User cancelled, not an error
    }
    qaLog("auth", "Apple sign-in failed", { error: String(err) });
    throw err;
  }
}

// ─── Google Sign In ─────────────────────────────────────────────────────────

export async function signInWithGoogle() {
  qaLog("auth", "Starting Google sign-in");

  if (Platform.OS === "ios" && !iosClientId) {
    throw new Error(
      "Google Sign-In is not configured for iOS. Add EXPO_PUBLIC_GOOGLE_IOS_CLIENT_ID to your .env file and restart Metro."
    );
  }

  try {
    // Check for Play Services on Android (no-op on iOS)
    await GoogleSignin.hasPlayServices({ showPlayServicesUpdateDialog: true });

    // Trigger the native Google sign-in dialog
    const response = await GoogleSignin.signIn();

    if (response.type === "cancelled") {
      qaLog("auth", "Google sign-in cancelled by user");
      return null; // User cancelled, not an error
    }

    const idToken = response.data?.idToken;

    if (!idToken) {
      throw new Error("No ID token received from Google");
    }

    // Exchange the Google ID token with Supabase — same pattern as Apple
    const { data, error } = await supabase.auth.signInWithIdToken({
      provider: "google",
      token: idToken,
    });

    if (error) {
      qaLog("auth", "Google sign-in Supabase error", { error: error.message });
      throw error;
    }

    qaLog("auth", "Google sign-in successful", { userId: data.user?.id });

    if (data.user) {
      await linkDeviceToUser(data.user.id);
      await createUserProfile(data.user.id);
    }

    return data;
  } catch (err: any) {
    if (isErrorWithCode(err)) {
      switch (err.code) {
        case statusCodes.SIGN_IN_CANCELLED:
          qaLog("auth", "Google sign-in cancelled by user");
          return null;
        case statusCodes.IN_PROGRESS:
          qaLog("auth", "Google sign-in already in progress");
          return null;
        case statusCodes.PLAY_SERVICES_NOT_AVAILABLE:
          qaLog("auth", "Play Services not available");
          throw new Error(
            "Google Play Services is not available. Please update Google Play Services and try again."
          );
        default:
          qaLog("auth", "Google sign-in failed", { code: err.code, error: String(err) });
          throw err;
      }
    }

    qaLog("auth", "Google sign-in exception", { error: String(err) });
    throw err;
  }
}

// ─── Sign Out ───────────────────────────────────────────────────────────────

export async function signOut() {
  qaLog("auth", "Signing out");
  try {
    await GoogleSignin.signOut();
  } catch (e) {
    qaLog("auth", "GoogleSignin.signOut non-fatal", { error: String(e) });
  }
  const { error } = await supabase.auth.signOut();
  if (error) {
    qaLog("auth", "Sign out failed", { error: error.message });
    throw error;
  }
  qaLog("auth", "Sign out successful");
}

// ─── Session Management ─────────────────────────────────────────────────────

export async function getSession() {
  const { data, error } = await supabase.auth.getSession();
  if (error) {
    qaLog("auth", "Get session error", { error: error.message });
    return null;
  }
  return data.session;
}

export async function getUser() {
  const {
    data: { user },
    error,
  } = await supabase.auth.getUser();
  if (error) {
    qaLog("auth", "Get user error", { error: error.message });
    return null;
  }
  return user;
}

// ─── Device & Profile Linking ───────────────────────────────────────────────

export async function linkDeviceToUser(userId: string) {
  try {
    const deviceId = await getOrCreateDeviceId();
    qaLog("auth", "Linking device to user", { userId, deviceId });

    const { error } = await supabase.from("user_profiles").upsert(
      {
        id: userId,
        device_id: deviceId,
        updated_at: new Date().toISOString(),
      },
      { onConflict: "id" }
    );

    if (error) {
      qaLog("auth", "Error linking device to user", { error: error.message });
    } else {
      qaLog("auth", "Device linked to user successfully");
    }
  } catch (err) {
    qaLog("auth", "Exception linking device to user", { error: String(err) });
  }
}

async function createUserProfile(userId: string) {
  try {
    const deviceId = await getOrCreateDeviceId();

    const { error } = await supabase.from("user_profiles").upsert(
      {
        id: userId,
        device_id: deviceId,
        legacy_user: false,
        created_at: new Date().toISOString(),
        updated_at: new Date().toISOString(),
      },
      { onConflict: "id" }
    );

    if (error) {
      qaLog("auth", "Error creating user profile", { error: error.message });
    }
  } catch (err) {
    qaLog("auth", "Exception creating user profile", { error: String(err) });
  }
}

// ─── Legacy User Check ─────────────────────────────────────────────────────

export async function isLegacyUser(userId: string): Promise<boolean> {
  try {
    const { data, error } = await supabase
      .from("user_profiles")
      .select("legacy_user")
      .eq("id", userId)
      .single();

    if (error || !data) return false;
    return data.legacy_user === true;
  } catch {
    return false;
  }
}

// ─── Password Reset ─────────────────────────────────────────────────────────

export async function resetPassword(email: string) {
  qaLog("auth", "Requesting password reset", { email });
  const { error } = await supabase.auth.resetPasswordForEmail(email);
  if (error) {
    qaLog("auth", "Password reset failed", { error: error.message });
    throw error;
  }
  qaLog("auth", "Password reset email sent");
}
