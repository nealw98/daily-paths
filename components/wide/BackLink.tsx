import React from "react";
import { Pressable, StyleSheet, Text } from "react-native";
import { useRouter } from "expo-router";
import { wideType } from "../../constants/theme";
import { useTheme } from "../../hooks/useTheme";

/**
 * "‹ Back" for screens opened on top of a tab in the wide layout (SPEC §4).
 * Back returns to the screen the person came from, not always to Today.
 * Rail tabs never show it.
 */
export function BackLink({ onPress }: { onPress?: () => void }) {
  const { colors } = useTheme();
  const router = useRouter();
  const goBack = () => {
    if (onPress) return onPress();
    if (router.canGoBack()) router.back();
    else router.navigate("/home");
  };
  return (
    <Pressable
      onPress={goBack}
      accessibilityRole="button"
      accessibilityLabel="Back"
      hitSlop={12}
      style={({ pressed }) => [styles.back, pressed && { opacity: 0.6 }]}
    >
      <Text style={[wideType.row, { color: colors.secondary }]}>‹ Back</Text>
    </Pressable>
  );
}

const styles = StyleSheet.create({
  back: { minHeight: 44, justifyContent: "center", alignSelf: "flex-start" },
});
