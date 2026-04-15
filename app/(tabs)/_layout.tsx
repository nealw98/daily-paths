import { Tabs } from "expo-router";
import { Platform, Text, View } from "react-native";
import { useCallback, useMemo, useRef } from "react";
import { useSafeAreaInsets } from "react-native-safe-area-context";
import { MaterialCommunityIcons, MaterialIcons } from "@expo/vector-icons";
import RevenueCatUI, { PAYWALL_RESULT } from "react-native-purchases-ui";
import { fonts } from "../../constants/theme";
import { useTheme } from "../../hooks/useTheme";
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
  const activeColor = colors.secondary;
  const inactiveColor = colors.onSurfaceVariant;
  const lockedColor = colors.onSurfaceVariant;
  const lockedOpacity = isDark ? 0.68 : 0.82;
  const badgeBackground = "#8F5546";
  const badgeIconColor = "#FFFFFF";
  const activeIconColor = colors.secondary;
  const premiumLocked = !loading
    && !trialStatus.loading
    && getRequiredGate(status, trialStatus, hasLifetimeAccess) === "paywall";

  const labelStyle = useMemo(
    () => ({
      fontFamily: fonts.bodyFamilyMedium,
      fontSize: 11,
      lineHeight: 14,
      fontWeight: "500" as const,
      letterSpacing: 0.25,
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
    (
      title: string,
      focused: boolean,
      locked = false,
    ) => (
      <View
        style={{
          minWidth: 60,
          height: 16,
          alignItems: "center",
          justifyContent: "flex-end",
        }}
      >
        <Text
          style={[
            labelStyle,
            {
              color: locked ? lockedColor : (focused ? activeColor : inactiveColor),
              opacity: locked ? lockedOpacity : 1,
              includeFontPadding: false,
              textAlign: "center",
            },
          ]}
        >
          {title}
        </Text>
      </View>
    ),
    [activeColor, inactiveColor, labelStyle, lockedColor, lockedOpacity],
  );

  const renderTabIcon = useCallback(
    (
      icon: React.ReactNode,
      locked = false,
    ) => (
      <View
        style={{
          width: 32,
          height: 30,
          alignItems: "center",
          justifyContent: "flex-end",
          opacity: locked ? lockedOpacity : 1,
        }}
      >
        {icon}
        {locked ? (
          <View
            style={{
              position: "absolute",
              right: -1,
              top: -1,
              width: 20,
              height: 20,
              borderRadius: 10,
              alignItems: "center",
              justifyContent: "center",
              backgroundColor: badgeBackground,
            }}
          >
            <MaterialCommunityIcons
              name="crown"
              size={12}
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
          backgroundColor: colors.surface,
          borderTopColor: "transparent",
          borderTopWidth: 0,
          height: (Platform.OS === "android" ? 60 : 60) + insets.bottom,
          paddingBottom: Math.max(insets.bottom, 10),
          paddingTop: 8,
          shadowColor: colors.ambientShadow,
          shadowOpacity: 1,
          shadowRadius: 24,
          shadowOffset: { width: 0, height: -8 },
          elevation: 10,
        },
        tabBarItemStyle: {
          paddingTop: 2,
          paddingBottom: 2,
          justifyContent: "center",
        },
        tabBarShowLabel: true,
        tabBarActiveTintColor: activeColor,
        tabBarInactiveTintColor: inactiveColor,
        tabBarLabelStyle: labelStyle,
      }}
    >
      <Tabs.Screen
        name="home"
        options={{
          title: "Today",
          tabBarLabel: ({ focused }) => renderTabLabel("Today", focused),
          tabBarIcon: ({ focused }) => (
            renderTabIcon(
              <MaterialIcons
                name="home"
                size={24}
                color={focused ? activeIconColor : inactiveColor}
              />,
            )
          ),
        }}
      />
      <Tabs.Screen
        name="journal"
        listeners={premiumTabListeners}
        options={{
          title: "Notebook",
          tabBarLabel: ({ focused }) => renderTabLabel("Notebook", focused, premiumLocked),
          tabBarIcon: ({ focused }) => (
            renderTabIcon(
              <MaterialIcons
                name="edit-note"
                size={24}
                color={
                  premiumLocked
                    ? lockedColor
                    : focused
                      ? activeIconColor
                      : inactiveColor
                }
              />,
              premiumLocked,
            )
          ),
        }}
      />
      <Tabs.Screen
        name="speakers"
        listeners={premiumTabListeners}
        options={{
          title: "Speakers",
          tabBarLabel: ({ focused }) => renderTabLabel("Speakers", focused, premiumLocked),
          tabBarIcon: ({ focused }) => (
            renderTabIcon(
              <MaterialIcons
                name="record-voice-over"
                size={24}
                color={
                  premiumLocked
                    ? lockedColor
                    : focused
                      ? activeIconColor
                      : inactiveColor
                }
              />,
              premiumLocked,
            )
          ),
        }}
      />
      <Tabs.Screen
        name="prayers"
        listeners={premiumTabListeners}
        options={{
          title: "Prayers",
          tabBarLabel: ({ focused }) => renderTabLabel("Prayers", focused, premiumLocked),
          tabBarIcon: ({ focused }) => (
            renderTabIcon(
              <MaterialCommunityIcons
                name="hands-pray"
                size={24}
                color={
                  premiumLocked
                    ? lockedColor
                    : focused
                      ? activeIconColor
                      : inactiveColor
                }
              />,
              premiumLocked,
            )
          ),
        }}
      />
      <Tabs.Screen
        name="more"
        options={{
          title: "Settings",
          tabBarLabel: ({ focused }) => renderTabLabel("Settings", focused),
          tabBarIcon: ({ focused }) => (
            renderTabIcon(
              <MaterialIcons
                name="settings"
                size={24}
                color={focused ? activeIconColor : inactiveColor}
              />,
            )
          ),
        }}
      />
      <Tabs.Screen
        name="reading"
        options={{
          href: null,
          title: "Reflection",
        }}
      />
    </Tabs>
  );
}
