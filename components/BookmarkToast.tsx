import React, { useEffect, useState } from "react";
import { View, Text, StyleSheet, Animated } from "react-native";
import { Ionicons } from "@expo/vector-icons";
import { colors } from "../constants/theme";

interface BookmarkToastProps {
  visible: boolean;
  message: string;
  onHide: () => void;
}

export const BookmarkToast: React.FC<BookmarkToastProps> = ({
  visible,
  message,
  onHide,
}) => {
  const [opacity] = useState(new Animated.Value(0));

  useEffect(() => {
    if (visible) {
      // Fade in
      Animated.timing(opacity, {
        toValue: 1,
        duration: 200,
        useNativeDriver: true,
      }).start();

      // Auto-hide after 1.5s
      const timeout = setTimeout(() => {
        Animated.timing(opacity, {
          toValue: 0,
          duration: 200,
          useNativeDriver: true,
        }).start(() => {
          onHide();
        });
      }, 1500);

      return () => clearTimeout(timeout);
    }
  }, [visible]);

  if (!visible && opacity._value === 0) {
    return null;
  }

  const isRemoved = message.toLowerCase().startsWith("removed");
  const iconName = isRemoved ? "heart-outline" : "heart";

  return (
    <Animated.View style={[styles.container, { opacity }]}>
      <View style={styles.toast}>
        <Ionicons name={iconName} size={20} color="#fff" style={styles.icon} />
        <Text style={styles.message}>{message}</Text>
      </View>
    </Animated.View>
  );
};

const styles = StyleSheet.create({
  container: {
    position: "absolute",
    top: 0,
    bottom: 0,
    left: 0,
    right: 0,
    justifyContent: "center",
    alignItems: "center",
    zIndex: 1000,
    pointerEvents: "none",
  },
  toast: {
    flexDirection: "row",
    alignItems: "center",
    backgroundColor: colors.deepTeal,
    paddingVertical: 12,
    paddingHorizontal: 20,
    borderRadius: 8,
    minWidth: 200,
    justifyContent: "center",
  },
  icon: {
    marginRight: 8,
  },
  message: {
    color: "#fff",
    fontSize: 15,
    fontWeight: "600",
  },
});

