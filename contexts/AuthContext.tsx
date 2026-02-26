import React, { createContext, useContext, useEffect, useState, useCallback, useRef } from "react";
import { supabase } from "../lib/supabase";
import {
  signInWithEmail,
  signUpWithEmail,
  signInWithApple,
  signInWithGoogle,
  signOut as authSignOut,
  isLegacyUser,
  resetPassword,
} from "../lib/auth";
import { qaLog } from "../utils/qaLog";
import type { User, Session } from "@supabase/supabase-js";

interface AuthContextValue {
  user: User | null;
  session: Session | null;
  loading: boolean;
  isAuthenticated: boolean;
  isLegacy: boolean;
  signIn: (email: string, password: string) => Promise<void>;
  signUp: (email: string, password: string) => Promise<void>;
  signInApple: () => Promise<void>;
  signInGoogle: () => Promise<void>;
  signOut: () => Promise<void>;
  forgotPassword: (email: string) => Promise<void>;
}

const AuthContext = createContext<AuthContextValue | undefined>(undefined);

export const AuthProvider: React.FC<{ children: React.ReactNode }> = ({ children }) => {
  const [user, setUser] = useState<User | null>(null);
  const [session, setSession] = useState<Session | null>(null);
  const [loading, setLoading] = useState(true);
  const [isLegacy, setIsLegacy] = useState(false);
  const mounted = useRef(true);
  const signingOut = useRef(false);

  // Initialize auth state from existing session
  useEffect(() => {
    mounted.current = true;

    const initAuth = async () => {
      try {
        // getSession() returns whatever is cached in AsyncStorage, even if expired.
        // Use getUser() to actually validate the token with the server.
        const {
          data: { session: currentSession },
        } = await supabase.auth.getSession();

        if (!mounted.current) return;

        if (currentSession?.user) {
          // Validate the session is still active by calling getUser()
          const { data: { user: validatedUser }, error: userError } = await supabase.auth.getUser();

          if (!mounted.current) return;

          if (userError || !validatedUser) {
            // Session is stale/expired — clear it
            qaLog("auth", "Stored session invalid, clearing", { error: userError?.message });
            await supabase.auth.signOut();
            setUser(null);
            setSession(null);
          } else {
            setUser(validatedUser);
            setSession(currentSession);
            // Check legacy status
            const legacy = await isLegacyUser(validatedUser.id);
            if (mounted.current) setIsLegacy(legacy);
          }
        }
      } catch (err) {
        qaLog("auth", "Error initializing auth", { error: String(err) });
      } finally {
        if (mounted.current) setLoading(false);
      }
    };

    initAuth();

    // Listen for auth state changes
    const {
      data: { subscription },
    } = supabase.auth.onAuthStateChange(async (event, newSession) => {
      qaLog("auth", `Auth state changed: ${event}`, { userId: newSession?.user?.id });

      if (!mounted.current) return;
      if (signingOut.current && newSession?.user) return; // Don't let listener restore user during sign-out

      setSession(newSession);
      setUser(newSession?.user ?? null);

      if (newSession?.user) {
        const legacy = await isLegacyUser(newSession.user.id);
        if (mounted.current) setIsLegacy(legacy);
      } else {
        setIsLegacy(false);
      }
    });

    return () => {
      mounted.current = false;
      subscription.unsubscribe();
    };
  }, []);

  const signIn = useCallback(async (email: string, password: string) => {
    await signInWithEmail(email, password);
  }, []);

  const signUp = useCallback(async (email: string, password: string) => {
    await signUpWithEmail(email, password);
  }, []);

  const signInApple = useCallback(async () => {
    await signInWithApple();
  }, []);

  const signInGoogle = useCallback(async () => {
    await signInWithGoogle();
  }, []);

  const signOut = useCallback(async () => {
    signingOut.current = true;
    try {
      await authSignOut();
    } catch (err) {
      qaLog("auth", "Sign out error, clearing local state anyway", { error: String(err) });
    }
    // Always clear local state, even if Supabase call fails or
    // onAuthStateChange doesn't fire (e.g. expired/stale session)
    setUser(null);
    setSession(null);
    setIsLegacy(false);
    // Keep the guard active briefly so any in-flight auth listener events
    // (e.g. a token refresh that was already in progress) are blocked.
    setTimeout(() => {
      signingOut.current = false;
    }, 2000);
  }, []);

  const forgotPassword = useCallback(async (email: string) => {
    await resetPassword(email);
  }, []);

  const value: AuthContextValue = {
    user,
    session,
    loading,
    isAuthenticated: !!user,
    isLegacy,
    signIn,
    signUp,
    signInApple,
    signInGoogle,
    signOut,
    forgotPassword,
  };

  return React.createElement(AuthContext.Provider, { value }, children);
};

export function useAuth(): AuthContextValue {
  const ctx = useContext(AuthContext);
  if (!ctx) {
    throw new Error("useAuth must be used within an AuthProvider");
  }
  return ctx;
}
