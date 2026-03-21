import { Tabs } from "expo-router";
import { Platform, Text, View } from "react-native";
import { useCallback, useMemo, useRef } from "react";
import { useSafeAreaInsets } from "react-native-safe-area-context";
import { Ionicons, MaterialCommunityIcons } from "@expo/vector-icons";
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
  const badgeBackground = isDark ? colors.textSecondary : colors.accent;
  const badgeIconColor = colors.textOnAccent;
  const premiumLocked = !loading
    && !trialStatus.loading
    && getRequiredGate(status, trialStatus, hasLifetimeAccess) === "paywall";

  const labelStyle = useMemo(
    () => ({
      fontFamily: "Inter_500Medium" as const,
      fontSize: 12.5,
      lineHeight: 14,
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

  const renderTabLabel = useCallback(
    (title: string, locked = false) => (
      <Text
        style={[
          labelStyle,
          {
            color: locked ? lockedColor : colors.accent,
            opacity: locked ? lockedOpacity : 1,
          },
        ]}
      >
        {title}
      </Text>
    ),
    [colors.accent, labelStyle, lockedColor, lockedOpacity],
  );

  const renderTabIcon = useCallback(
    (
      size: number,
      icon: React.ReactNode,
      locked = false,
      offsetY = 0,
    ) => (
      <View
        style={{
          width: size,
          height: size,
          alignItems: "center",
          justifyContent: "center",
          opacity: locked ? lockedOpacity : 1,
        }}
      >
        <View
          style={offsetY ? { transform: [{ translateY: offsetY }] } : undefined}
        >
          {icon}
        </View>
        {locked ? (
          <View
            style={{
              position: "absolute",
              right: -2,
              top: -2,
              width: 15,
              height: 15,
              borderRadius: 7.5,
              alignItems: "center",
              justifyContent: "center",
              backgroundColor: badgeBackground,
            }}
          >
            <MaterialCommunityIcons
              name="crown"
              size={9}
              color={badgeIconColor}
            />
          </View>
        ) : null}
      </View>
    ),
    [badgeBackground, badgeIconColor, lockedOpacity],
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
          tabBarLabel: () => renderTabLabel("Today"),
          tabBarIcon: ({ color, size }) => (
            renderTabIcon(
              size,
              <LightOnWater size={size} color={color} strokeWidth={1.7} />,
            )
          ),
        }}
      />
      <Tabs.Screen
        name="journal"
        listeners={premiumTabListeners}
        options={{
          title: "Notebook",
          tabBarLabel: () => renderTabLabel("Notebook", premiumLocked),
          tabBarIcon: ({ color, size }) => (
            renderTabIcon(
              size,
              <Feather
                size={size}
                color={premiumLocked ? lockedColor : color}
                strokeWidth={1.7}
              />,
              premiumLocked,
              1.5,
            )
          ),
        }}
      />
      <Tabs.Screen
        name="prayers"
        listeners={premiumTabListeners}
        options={{
          title: "Prayers",
          tabBarLabel: () => renderTabLabel("Prayers", premiumLocked),
          tabBarIcon: ({ color, size }) => (
            renderTabIcon(
              size,
              <LeafOnWater
                size={size}
                color={premiumLocked ? lockedColor : color}
                strokeWidth={1.7}
              />,
              premiumLocked,
              1.5,
            )
          ),
        }}
      />
      <Tabs.Screen
        name="speakers"
        listeners={premiumTabListeners}
        options={{
          title: "Speakers",
          tabBarLabel: () => renderTabLabel("Speakers", premiumLocked),
          tabBarIcon: ({ color, size }) => (
            renderTabIcon(
              size,
              <Microphone
                size={size}
                color={premiumLocked ? lockedColor : color}
                strokeWidth={1.7}
              />,
              premiumLocked,
              1.5,
            )
          ),
        }}
      />
      <Tabs.Screen
        name="more"
        options={{
          title: "Settings",
          tabBarLabel: () => renderTabLabel("Settings"),
          tabBarIcon: ({ color, size }) => (
            renderTabIcon(
              size,
              <Nautilus size={size} color={color} strokeWidth={1.55} />,
            )
          ),
        }}
      />
    </Tabs>
  );
}
