import React from "react";
import { View, Text, StyleSheet, ScrollView, TouchableOpacity } from "react-native";
import { SafeAreaView } from "react-native-safe-area-context";
import { Ionicons } from "@expo/vector-icons";
import { useTheme } from "../../hooks/useTheme";

export default function MoreTab() {
  const { colors } = useTheme();

  const menuItems = [
    { id: "gratitude", title: "Gratitude List", icon: "heart", available: false },
    { id: "prayers", title: "Prayers", icon: "book-outline", available: false },
    { id: "export", title: "Export Journal", icon: "download-outline", available: false },
    { id: "settings", title: "Settings", icon: "settings-outline", available: true },
    { id: "subscription", title: "Manage Subscription", icon: "card-outline", available: false },
    { id: "account", title: "Account", icon: "person-outline", available: false },
  ];

  return (
    <SafeAreaView style={[styles.container, { backgroundColor: colors.background }]} edges={["top"]}>
      <View style={[styles.header, { backgroundColor: colors.background, borderBottomColor: colors.border }]}>
        <Text style={[styles.headerTitle, { color: colors.text }]}>More</Text>
      </View>
      <ScrollView style={styles.content}>
        {menuItems.map((item) => (
          <TouchableOpacity
            key={item.id}
            style={[styles.menuItem, { borderBottomColor: colors.border }]}
            onPress={() => {}}
            disabled={!item.available}
          >
            <View style={styles.menuItemLeft}>
              <Ionicons name={item.icon as any} size={24} color={item.available ? colors.accent : colors.textSecondary} />
              <Text style={[styles.menuItemText, { color: item.available ? colors.text : colors.textSecondary }]}>
                {item.title}
              </Text>
            </View>
            {!item.available && (
              <Text style={[styles.comingSoon, { color: colors.textSecondary }]}>Coming soon</Text>
            )}
            {item.available && (
              <Ionicons name="chevron-forward" size={20} color={colors.textSecondary} />
            )}
          </TouchableOpacity>
        ))}
      </ScrollView>
    </SafeAreaView>
  );
}

const styles = StyleSheet.create({
  container: {
    flex: 1,
  },
  header: {
    paddingHorizontal: 20,
    paddingVertical: 16,
    borderBottomWidth: 1,
  },
  headerTitle: {
    fontSize: 28,
    fontWeight: "700",
  },
  content: {
    flex: 1,
  },
  menuItem: {
    flexDirection: "row",
    alignItems: "center",
    justifyContent: "space-between",
    paddingHorizontal: 20,
    paddingVertical: 16,
    borderBottomWidth: 1,
  },
  menuItemLeft: {
    flexDirection: "row",
    alignItems: "center",
    gap: 16,
  },
  menuItemText: {
    fontSize: 16,
    fontWeight: "500",
  },
  comingSoon: {
    fontSize: 12,
    fontStyle: "italic",
  },
});
