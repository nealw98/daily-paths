import { Tabs } from "expo-router";
import { Platform, Text, View } from "react-native";
import { useCallback, useMemo, useRef } from "react";
import { useSafeAreaInsets } from "react-native-safe-area-context";
import { Ionicons } from "@expo/vector-icons";
import RevenueCatUI, { PAYWALL_RESULT } from "react-native-purchases-ui";
import { fonts } from "../../constants/theme";
import { useTheme } from "../../hooks/useTheme";
import { LightOnWater, Feather, LeafOnWater, Microphone, Nautilus } from "../../components/icons";
import { useSubscription } from "../../hooks/useSubscription";
import { useTrialStatus } from "../../hooks/useTrialStatus";
import { getRequiredGate } from "../../utils/accessControl";
import { qaLog } from "../../utils/qaLog";

/**
 * Tab navigation layout.
 *
 * In the freemium model the daily reader (Today) and Settings are always
 * accessible.  Premium tabs (Journal, Prayers, Speakers) are gated
 * individually by the <PremiumGate> wrapper inside each tab screen —
 * no global paywall or sign-in modals here.
 */
export default function TabLayout() {
  const { colors, isDark } = useTheme();
  const insets = useSafeAreaInsets();
  const { status, hasLifetimeAccess, refresh, loading } = useSubscription();
  const trialStatus = useTrialStatus();
  const presentingPaywall = useRef(false);
  const lockedColor = isDark ? colors.textSecondary + "CC" : colors.highlight;
  const lockedOpacity = isDark ? 0.68 : 0.82;
  const premiumLocked = !loading
    && !trialStatus.loading
    && getRequiredGate(status, trialStatus, hasLifetimeAccess) === "paywall";

  const labelStyle = useMemo(
    () => ({
      fontFamily: "Inter_500Medium" as const,
      fontSize: 12.5,
      fontWeight: "500" as const,
    }),
    [],
  );

  const presentPremiumPaywall = useCallback(async () => {
    if (presentingPaywall.current) return;

    presentingPaywall.current = true;
    qaLog("paywall", "Tab bar presenting paywall");

    try {
      const result = await RevenueCatUI.presentPaywall();
      qaLog("paywall", "Tab bar paywall result", { result });

      if (result === PAYWALL_RESULT.PURCHASED || result === PAYWALL_RESULT.RESTORED) {
        await refresh();
        await new Promise((resolve) => setTimeout(resolve, 350));
        await refresh();
      }
    } finally {
      presentingPaywall.current = false;
    }
  }, [refresh]);

  const renderPremiumLabel = useCallback(
    (title: string) => (
      <Text
        style={[
          labelStyle,
          {
            color: premiumLocked ? lockedColor : colors.accent,
            opacity: premiumLocked ? lockedOpacity : 1,
          },
        ]}
      >
        {title}
      </Text>
    ),
    [colors.accent, labelStyle, lockedColor, lockedOpacity, premiumLocked],
  );

  const premiumTabListeners = useMemo(
    () => ({
      tabPress: (e: { preventDefault: () => void }) => {
        if (!premiumLocked) return;
        e.preventDefault();
        void presentPremiumPaywall();
      },
    }),
    [presentPremiumPaywall, premiumLocked],
  );

  return (
    <Tabs
      screenOptions={{
        headerShown: false,
        tabBarStyle: {
          backgroundColor: colors.background,
          borderTopColor: colors.border,
          borderTopWidth: 1,
          height: (Platform.OS === "android" ? 56 : 56) + insets.bottom,
          paddingBottom: insets.bottom,
          paddingTop: 8,
        },
        tabBarActiveTintColor: colors.accent,
        tabBarInactiveTintColor: colors.accent,
        tabBarLabelStyle: labelStyle,
      }}
    >
      <Tabs.Screen
        name="today"
        options={{
          title: "Today",
          tabBarIcon: ({ color, size }) => (
            <LightOnWater size={size} color={color} strokeWidth={1.7} />
          ),
        }}
      />
      <Tabs.Screen
        name="journal"
        listeners={premiumTabListeners}
        options={{
          title: "Notebook",
          tabBarLabel: () => renderPremiumLabel("Notebook"),
          tabBarIcon: ({ color, size }) => (
            <View style={premiumLocked ? { opacity: lockedOpacity } : undefined}>
              {premiumLocked ? (
                <Ionicons name="lock-closed-outline" size={size - 1} color={lockedColor} />
              ) : (
                <Feather
                  size={size}
                  color={color}
                  strokeWidth={1.7}
                />
              )}
            </View>
          ),
        }}
      />
      <Tabs.Screen
        name="prayers"
        listeners={premiumTabListeners}
        options={{
          title: "Prayers",
          tabBarLabel: () => renderPremiumLabel("Prayers"),
          tabBarIcon: ({ color, size }) => (
            <View style={premiumLocked ? { opacity: lockedOpacity } : undefined}>
              {premiumLocked ? (
                <Ionicons name="lock-closed-outline" size={size - 1} color={lockedColor} />
              ) : (
                <LeafOnWater
                  size={size}
                  color={color}
                  strokeWidth={1.7}
                />
              )}
            </View>
          ),
        }}
      />
      <Tabs.Screen
        name="speakers"
        listeners={premiumTabListeners}
        options={{
          title: "Speakers",
          tabBarLabel: () => renderPremiumLabel("Speakers"),
          tabBarIcon: ({ color, size }) => (
            <View style={premiumLocked ? { opacity: lockedOpacity } : undefined}>
              {premiumLocked ? (
                <Ionicons name="lock-closed-outline" size={size - 1} color={lockedColor} />
              ) : (
                <Microphone
                  size={size}
                  color={color}
                  strokeWidth={1.7}
                />
              )}
            </View>
          ),
        }}
      />
      <Tabs.Screen
        name="more"
        options={{
          title: "Settings",
          tabBarIcon: ({ color, size }) => (
            <Nautilus size={size} color={color} strokeWidth={1.55} />
          ),
        }}
      />
    </Tabs>
  );
}
