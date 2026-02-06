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
  /** DEV ONLY: bypass auth for simulator testing */
  devBypass?: () => void;
}

const AuthContext = createContext<AuthContextValue | undefined>(undefined);

export const AuthProvider: React.FC<{ children: React.ReactNode }> = ({ children }) => {
  const [user, setUser] = useState<User | null>(null);
  const [session, setSession] = useState<Session | null>(null);
  const [loading, setLoading] = useState(true);
  const [isLegacy, setIsLegacy] = useState(false);
  const mounted = useRef(true);

  // Initialize auth state from existing session
  useEffect(() => {
    mounted.current = true;

    const initAuth = async () => {
      try {
        const {
          data: { session: currentSession },
        } = await supabase.auth.getSession();

        if (!mounted.current) return;

        if (currentSession?.user) {
          setUser(currentSession.user);
          setSession(currentSession);
          // Check legacy status
          const legacy = await isLegacyUser(currentSession.user.id);
          if (mounted.current) setIsLegacy(legacy);
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
    await authSignOut();
  }, []);

  const forgotPassword = useCallback(async (email: string) => {
    await resetPassword(email);
  }, []);

  // DEV ONLY: set a fake user so isAuthenticated becomes true without Supabase
  const [devUser, setDevUser] = useState(false);

  const devBypass = __DEV__
    ? () => {
        setDevUser(true);
        setUser({ id: "dev-bypass-user", email: "dev@test.local" } as unknown as User);
      }
    : undefined;

  const value: AuthContextValue = {
    user,
    session,
    loading,
    isAuthenticated: !!user || devUser,
    isLegacy,
    signIn,
    signUp,
    signInApple,
    signInGoogle,
    signOut,
    forgotPassword,
    devBypass,
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
