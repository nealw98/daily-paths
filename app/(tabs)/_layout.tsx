import { useState, useEffect, useRef } from "react";
import { Tabs } from "expo-router";
import { Ionicons } from "@expo/vector-icons";
import { fonts } from "../../constants/theme";
import { useTheme } from "../../hooks/useTheme";
import { useAuth } from "../../contexts/AuthContext";
import { useSubscription } from "../../hooks/useSubscription";
import { isRevenueCatInitialized } from "../../lib/subscription";
import { canAccessPlusFeatures } from "../../utils/accessControl";
import { PaywallModal } from "../../components/PaywallModal";

export default function TabLayout() {
  const { colors, isDark } = useTheme();
  const { user, isAuthenticated, loading: authLoading } = useAuth();
  const { status: subStatus, loading: subLoading, refresh: refreshSub } = useSubscription(user?.id);
  const wasAuthenticated = useRef(isAuthenticated);
  const [dismissed, setDismissed] = useState(false);

  // Reset dismissed state when user signs out
  useEffect(() => {
    if (wasAuthenticated.current && !isAuthenticated) {
      setDismissed(false);
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
    : canAccessPlusFeatures(subStatus);

  // Determine which gate to show:
  //   no entitlement → paywall (subscription pitch)
  //   entitlement but not signed in → signin only
  //   entitlement + signed in → full access, no gate
  let gateMode: "paywall" | "signin" | null = null;
  if (!stillLoading && !dismissed) {
    if (!hasEntitlement) {
      gateMode = "paywall";
    } else if (!isAuthenticated) {
      gateMode = "signin";
    }
  }

  const handleGateClose = () => {
    refreshSub(); // re-check entitlement after any purchase
    setDismissed(true);
  };

  const showGate = gateMode !== null;

  return (
    <>
    <PaywallModal
      visible={showGate}
      mode={gateMode || "paywall"}
      onClose={handleGateClose}
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
            <Ionicons name="book" size={size} color={color} />
          ),
        }}
      />
      <Tabs.Screen
        name="journal"
        options={{
          title: "Journal",
          tabBarIcon: ({ color, size }) => (
            <Ionicons name="create" size={size} color={color} />
          ),
        }}
      />
      <Tabs.Screen
        name="steps"
        options={{
          title: "Steps",
          tabBarIcon: ({ color, size }) => (
            <Ionicons name="list" size={size} color={color} />
          ),
        }}
      />
      <Tabs.Screen
        name="more"
        options={{
          title: "More",
          tabBarIcon: ({ color, size }) => (
            <Ionicons name="ellipsis-horizontal" size={size} color={color} />
          ),
        }}
      />
    </Tabs>
    </>
  );
}
