import { Tabs } from "expo-router";
import { Platform, Text, View } from "react-native";
import { useCallback, useMemo } from "react";
import { useSafeAreaInsets } from "react-native-safe-area-context";
import { MaterialCommunityIcons, MaterialIcons } from "@expo/vector-icons";
import { fonts } from "../../constants/theme";
import { useTheme } from "../../hooks/useTheme";
import { SpeakersProvider } from "../../hooks/useSpeakers";

/**
 * Tab navigation layout.
 *
 * On Android, gating happens at the app root via the onboarding flow
 * (see app/_layout.tsx). Non-entitled users never reach this tab bar, so per-tab
 * crown badges and tab-press interception are no longer needed.
 */
export default function TabLayout() {
  const { colors } = useTheme();
  const insets = useSafeAreaInsets();
  const activeColor = colors.secondary;
  const inactiveColor = colors.onSurfaceVariant;
  const activeIconColor = colors.secondary;

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

  const renderTabLabel = useCallback(
    (title: string, focused: boolean) => (
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
              color: focused ? activeColor : inactiveColor,
              includeFontPadding: false,
              textAlign: "center",
            },
          ]}
        >
          {title}
        </Text>
      </View>
    ),
    [activeColor, inactiveColor, labelStyle],
  );

  const renderTabIcon = useCallback(
    (icon: React.ReactNode) => (
      <View
        style={{
          width: 32,
          height: 30,
          alignItems: "center",
          justifyContent: "flex-end",
        }}
      >
        {icon}
      </View>
    ),
    [],
  );

  return (
    <SpeakersProvider>
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
        options={{
          title: "Notebook",
          tabBarLabel: ({ focused }) => renderTabLabel("Notebook", focused),
          tabBarIcon: ({ focused }) => (
            renderTabIcon(
              <MaterialIcons
                name="edit-note"
                size={24}
                color={focused ? activeIconColor : inactiveColor}
              />,
            )
          ),
        }}
      />
      <Tabs.Screen
        name="speakers"
        options={{
          title: "Speakers",
          tabBarLabel: ({ focused }) => renderTabLabel("Speakers", focused),
          tabBarIcon: ({ focused }) => (
            renderTabIcon(
              <MaterialIcons
                name="record-voice-over"
                size={24}
                color={focused ? activeIconColor : inactiveColor}
              />,
            )
          ),
        }}
      />
      <Tabs.Screen
        name="prayers"
        options={{
          title: "Prayers",
          tabBarLabel: ({ focused }) => renderTabLabel("Prayers", focused),
          tabBarIcon: ({ focused }) => (
            renderTabIcon(
              <MaterialCommunityIcons
                name="hands-pray"
                size={24}
                color={focused ? activeIconColor : inactiveColor}
              />,
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
    </SpeakersProvider>
  );
}
