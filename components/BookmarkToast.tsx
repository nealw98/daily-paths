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
  const timeoutRef = React.useRef<NodeJS.Timeout | null>(null);
  const isAnimatingRef = React.useRef(false);

  const FADE_IN_MS = 140;
  const FADE_OUT_MS = 140;
  const DISPLAY_MS = 900;

  useEffect(() => {
    // Clear any pending timer when visibility changes.
    if (timeoutRef.current) {
      clearTimeout(timeoutRef.current);
      timeoutRef.current = null;
    }

    if (visible) {
      // Stop any in-flight animation to avoid flashes.
      if (isAnimatingRef.current) {
        opacity.stopAnimation();
      }
      opacity.setValue(0);
      isAnimatingRef.current = true;
      Animated.timing(opacity, {
        toValue: 1,
        duration: FADE_IN_MS,
        useNativeDriver: true,
      }).start(() => {
        isAnimatingRef.current = false;
      });

      timeoutRef.current = setTimeout(() => {
        if (isAnimatingRef.current) {
          opacity.stopAnimation();
        }
        isAnimatingRef.current = true;
        Animated.timing(opacity, {
          toValue: 0,
          duration: FADE_OUT_MS,
          useNativeDriver: true,
        }).start(() => {
          isAnimatingRef.current = false;
          onHide();
        });
      }, DISPLAY_MS);
    } else {
      // If parent hides us early, fade out quickly.
      if (isAnimatingRef.current) {
        opacity.stopAnimation();
      }
      isAnimatingRef.current = true;
      Animated.timing(opacity, {
        toValue: 0,
        duration: FADE_OUT_MS,
        useNativeDriver: true,
      }).start(() => {
        isAnimatingRef.current = false;
      });
    }

    return () => {
      if (timeoutRef.current) {
        clearTimeout(timeoutRef.current);
        timeoutRef.current = null;
      }
      if (isAnimatingRef.current) {
        opacity.stopAnimation();
        isAnimatingRef.current = false;
      }
    };
  }, [visible, opacity, onHide]);

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

