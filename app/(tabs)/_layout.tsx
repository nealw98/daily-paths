import { useState, useEffect, useRef } from "react";
import Constants from "expo-constants";
import { Tabs } from "expo-router";
import { Ionicons } from "@expo/vector-icons";
import { fonts } from "../../constants/theme";
import { useTheme } from "../../hooks/useTheme";
import { LightOnWater, Feather, LeafOnWater, Microphone, Nautilus } from "../../components/icons";
import { useAuth } from "../../contexts/AuthContext";
import { useSubscription } from "../../hooks/useSubscription";
import { isRevenueCatInitialized } from "../../lib/subscription";
import { canAccessUnlimitedFeatures } from "../../utils/accessControl";
import { PaywallModal } from "../../components/PaywallModal";
import { SignInModal } from "../../components/SignInModal";

export default function TabLayout() {
  const { colors, isDark } = useTheme();
  const { user, isAuthenticated, loading: authLoading } = useAuth();
  const { status: subStatus, loading: subLoading, refresh: refreshSub } = useSubscription(user?.id);
  const wasAuthenticated = useRef(isAuthenticated);
  const [paywallDismissed, setPaywallDismissed] = useState(false);
  const [signInDismissed, setSignInDismissed] = useState(false);

  // Reset sign-in dismissed state when user signs out
  // (so the sign-in modal reappears), but do NOT reset paywallDismissed —
  // entitlements are device-level and persist across sign-out.
  useEffect(() => {
    if (wasAuthenticated.current && !isAuthenticated) {
      setSignInDismissed(false);
    }
    wasAuthenticated.current = isAuthenticated;
  }, [isAuthenticated]);

  // Wait for both checks to complete
  const stillLoading = authLoading || subLoading;

  // If RevenueCat is not configured (no API key, e.g. dev mode),
  // skip the entitlement gate — only auth matters for testing.
  const revenueCatActive = isRevenueCatInitialized();
  const hasEntitlement = !revenueCatActive
    ? true // RC not set up, treat entitlement as satisfied (dev/testing)
    : canAccessUnlimitedFeatures(subStatus);

  // Two independent gates:
  //   1. PaywallModal — shown when no entitlement (no trial, no sub, no lifetime)
  //   2. SignInModal — shown when entitlement exists but user isn't signed in
  const showPaywall = !stillLoading && !hasEntitlement && !paywallDismissed;
  const showSignIn = !stillLoading && hasEntitlement && !isAuthenticated && !signInDismissed;

  // In dev mode (no RC keys), paywall is never shown, so the close button
  // on SignInModal serves as the dev bypass to test the app without auth.
  const signInDismissable = !revenueCatActive; // dismissable only in dev mode

  // Simulator/emulator: allow dismissing paywall for testing (no real purchases)
  const isSimulator = !Constants.isDevice;
  const paywallDismissable = __DEV__ || isSimulator;

  return (
    <>
      <PaywallModal
        visible={showPaywall}
        dismissable={paywallDismissable}
        onClose={() => {
          refreshSub();
          setPaywallDismissed(true);
        }}
      />
      <SignInModal
        visible={showSignIn}
        dismissable={signInDismissable}
        onClose={() => {
          setSignInDismissed(true);
        }}
      />
      <Tabs
        screenOptions={{
          headerShown: false,
          tabBarStyle: {
            backgroundColor: colors.background,
            borderTopColor: colors.border,
            borderTopWidth: 1,
          },
          tabBarActiveTintColor: colors.accent,
          tabBarInactiveTintColor: colors.textSecondary,
          tabBarLabelStyle: {
            fontFamily: fonts.bodyFamilyRegular,
            fontSize: 12,
            fontWeight: "600",
          },
        }}
      >
        <Tabs.Screen
          name="today"
          options={{
            title: "Today",
            tabBarIcon: ({ color, size }) => (
              <LightOnWater size={size} color={color} />
            ),
          }}
        />
        <Tabs.Screen
          name="journal"
          options={{
            title: "Journal",
            tabBarIcon: ({ color, size }) => (
              <Feather size={size} color={color} />
            ),
          }}
        />
        <Tabs.Screen
          name="prayers"
          options={{
            title: "Prayers",
            tabBarIcon: ({ color, size }) => (
              <LeafOnWater size={size} color={color} />
            ),
          }}
        />
        <Tabs.Screen
          name="speakers"
          options={{
            title: "Speakers",
            tabBarIcon: ({ color, size }) => (
              <Microphone size={size} color={color} />
            ),
          }}
        />
        <Tabs.Screen
          name="more"
          options={{
            title: "Settings",
            tabBarIcon: ({ color, size }) => (
              <Nautilus size={size} color={color} />
            ),
          }}
        />
      </Tabs>
    </>
  );
}
