import { Tabs } from "expo-router";
import { Platform } from "react-native";
import { useSafeAreaInsets } from "react-native-safe-area-context";
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
  const insets = useSafeAreaInsets();

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
        tabBarLabelStyle: {
          fontFamily: "Inter_600SemiBold",
          fontSize: 13,
          fontWeight: "600",
        },
      }}
    >
      <Tabs.Screen
        name="today"
        options={{
          title: "Today",
          tabBarIcon: ({ color, size }) => (
            <LightOnWater size={size + 1} color={color} strokeWidth={1.9} />
          ),
        }}
      />
      <Tabs.Screen
        name="journal"
        options={{
          title: "Notebook",
          tabBarIcon: ({ color, size }) => (
            <Feather size={size + 1} color={color} strokeWidth={1.9} />
          ),
        }}
      />
      <Tabs.Screen
        name="prayers"
        options={{
          title: "Prayers",
          tabBarIcon: ({ color, size }) => (
            <LeafOnWater size={size + 1} color={color} strokeWidth={1.9} />
          ),
        }}
      />
      <Tabs.Screen
        name="speakers"
        options={{
          title: "Speakers",
          tabBarIcon: ({ color, size }) => (
            <Microphone size={size + 1} color={color} strokeWidth={1.9} />
          ),
        }}
      />
      <Tabs.Screen
        name="more"
        options={{
          title: "Settings",
          tabBarIcon: ({ color, size }) => (
            <Nautilus size={size + 1} color={color} strokeWidth={1.7} />
          ),
        }}
      />
    </Tabs>
  );
}
