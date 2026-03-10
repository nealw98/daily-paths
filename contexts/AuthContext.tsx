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
  signInApple: () => Promise<unknown>;
  signInGoogle: () => Promise<unknown>;
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
        // getSession() returns whatever is cached in AsyncStorage.
        // Trust it immediately so the UI unblocks, then validate in the background.
        const {
          data: { session: currentSession },
        } = await supabase.auth.getSession();

        if (!mounted.current) return;

        if (currentSession?.user) {
          // Accept cached session right away so the app renders instantly
          setUser(currentSession.user);
          setSession(currentSession);
          setLoading(false);

          // Check legacy status (non-blocking)
          isLegacyUser(currentSession.user.id).then((legacy) => {
            if (mounted.current) setIsLegacy(legacy);
          });

          // Validate with the server in the background — if the token is
          // truly expired, onAuthStateChange will fire SIGNED_OUT and clear state.
          supabase.auth.getUser().then(({ error: userError }) => {
            if (!mounted.current) return;
            if (userError) {
              qaLog("auth", "Background validation failed, signing out", { error: userError.message });
              supabase.auth.signOut();
              setUser(null);
              setSession(null);
            }
          });
          return; // loading already set to false above
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
    signingOut.current = false;
    await signInWithEmail(email, password);
  }, []);

  const signUp = useCallback(async (email: string, password: string) => {
    signingOut.current = false;
    await signUpWithEmail(email, password);
  }, []);

  const signInApple = useCallback(async () => {
    signingOut.current = false;
    return signInWithApple();
  }, []);

  const signInGoogle = useCallback(async () => {
    signingOut.current = false;
    return signInWithGoogle();
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
    // signingOut guard stays active until the user explicitly signs in again,
    // preventing stale token-refresh events from silently restoring the session.
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
