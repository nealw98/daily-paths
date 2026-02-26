import { Tabs } from "expo-router";
import { Platform } from "react-native";
import { fonts } from "../../constants/theme";
import { useTheme } from "../../hooks/useTheme";
import { LightOnWater, Feather, LeafOnWater, Microphone, Nautilus } from "../../components/icons";

/**
 * Tab navigation layout.
 *
 * In the freemium model the daily reader (Today) and Settings are always
 * accessible.  Premium tabs (Journal, Prayers, Speakers) are gated
 * individually by the <PremiumGate> wrapper inside each tab screen —
 * no global paywall or sign-in modals here.
 */
export default function TabLayout() {
  const { colors } = useTheme();

  return (
    <Tabs
      screenOptions={{
        headerShown: false,
        tabBarStyle: {
          backgroundColor: colors.background,
          borderTopColor: colors.border,
          borderTopWidth: 1,
          height: Platform.OS === "android" ? 70 : 84,
          paddingBottom: Platform.OS === "android" ? 14 : 28,
          paddingTop: 8,
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
  );
}
