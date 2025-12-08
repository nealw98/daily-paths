import React, { useEffect, useRef } from "react";
import {
  Animated,
  StyleSheet,
  Text,
  TouchableOpacity,
  View,
} from "react-native";
import { Ionicons } from "@expo/vector-icons";
import { colors } from "../constants/theme";

interface DismissibleToastProps {
  visible: boolean;
  message: string;
  onDismiss: () => void;
}

/**
 * Lightweight toast for non-blocking errors.
 * - Fades in/out.
 * - User can dismiss by tapping the close icon.
 * - Auto hides after a short duration to avoid lingering overlays.
 */
export const DismissibleToast: React.FC<DismissibleToastProps> = ({
  visible,
  message,
  onDismiss,
}) => {
  const opacity = useRef(new Animated.Value(0)).current;

  useEffect(() => {
    if (visible) {
      Animated.timing(opacity, {
        toValue: 1,
        duration: 180,
        useNativeDriver: true,
      }).start();

      const timeout = setTimeout(() => {
        hide();
      }, 2800);

      return () => clearTimeout(timeout);
    } else {
      hide();
    }
  }, [visible]);

  const hide = () => {
    Animated.timing(opacity, {
      toValue: 0,
      duration: 160,
      useNativeDriver: true,
    }).start();
  };

  if (!visible && opacity.__getValue() === 0) {
    return null;
  }

  return (
    <Animated.View style={[styles.container, { opacity }]}>
      <View style={styles.toast}>
        <Ionicons
          name="information-circle-outline"
          size={20}
          color="#fff"
          style={styles.icon}
        />
        <Text style={styles.message}>{message}</Text>
        <TouchableOpacity onPress={onDismiss} style={styles.closeButton}>
          <Ionicons name="close" size={18} color="#fff" />
        </TouchableOpacity>
      </View>
    </Animated.View>
  );
};

const styles = StyleSheet.create({
  container: {
    position: "absolute",
    top: 70,
    left: 0,
    right: 0,
    alignItems: "center",
    zIndex: 1200,
  },
  toast: {
    flexDirection: "row",
    alignItems: "center",
    backgroundColor: "rgba(0, 0, 0, 0.75)",
    paddingVertical: 12,
    paddingHorizontal: 16,
    borderRadius: 10,
    marginHorizontal: 16,
  },
  icon: {
    marginRight: 8,
  },
  message: {
    color: "#fff",
    fontSize: 15,
    flexShrink: 1,
  },
  closeButton: {
    marginLeft: 12,
    padding: 4,
  },
});

