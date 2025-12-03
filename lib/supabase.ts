import "react-native-url-polyfill/auto";
import { createClient, type SupabaseClient } from "@supabase/supabase-js";
import AsyncStorage from "@react-native-async-storage/async-storage";
import { qaLog } from "../utils/qaLog";

const supabaseUrl = process.env.EXPO_PUBLIC_SUPABASE_URL || "";
const supabaseAnonKey = process.env.EXPO_PUBLIC_SUPABASE_ANON_KEY || "";

/**
 * Create a safe Supabase client that won't crash the native app if env vars
 * are missing in an EAS preview / release build.
 *
 * - In development (Expo CLI), `.env` is loaded locally so we get real values.
 * - In cloud builds, env must be configured in EAS; if not, we fall back to a
 *   proxy client that throws a descriptive error the first time it's used.
 */
function createSafeClient(): SupabaseClient {
  if (!supabaseUrl || !supabaseAnonKey) {
    const msg =
      "EXPO_PUBLIC_SUPABASE_URL / EXPO_PUBLIC_SUPABASE_ANON_KEY are not set. " +
      "Running in offline mode; remote reads will fail gracefully.";
    console.warn("[Supabase]", msg);
    qaLog("supabase", msg);

    // Proxy that throws a clear error when any method is accessed.
    return new Proxy({} as SupabaseClient, {
      get() {
        throw new Error(
          "Supabase is not configured. Set EXPO_PUBLIC_SUPABASE_URL and " +
            "EXPO_PUBLIC_SUPABASE_ANON_KEY in your EAS environment.",
        );
      },
    });
  }

  qaLog("supabase", "Creating Supabase client", {
    urlDefined: !!supabaseUrl,
    keyDefined: !!supabaseAnonKey,
  });

  return createClient(supabaseUrl, supabaseAnonKey, {
    auth: {
      storage: AsyncStorage,
      autoRefreshToken: true,
      persistSession: true,
      detectSessionInUrl: false,
    },
  });
}

export const supabase = createSafeClient();



