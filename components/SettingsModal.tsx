import React from "react";
import { Modal, View, StyleSheet, TouchableOpacity, Text, Animated } from "react-native";
import { fonts } from "../constants/theme";
import { useTheme } from "../hooks/useTheme";

interface SettingsModalProps {
  visible: boolean;
  onClose: () => void;
  children: React.ReactNode;
}

export const SettingsModal: React.FC<SettingsModalProps> = ({
  visible,
  onClose,
  children,
}) => {
  const { colors } = useTheme();
  const slideAnim = React.useRef(new Animated.Value(0)).current;

  React.useEffect(() => {
    if (visible) {
      Animated.spring(slideAnim, {
        toValue: 1,
        useNativeDriver: true,
        tension: 50,
        friction: 8,
      }).start();
    } else {
      Animated.timing(slideAnim, {
        toValue: 0,
        duration: 200,
        useNativeDriver: true,
      }).start();
    }
  }, [visible]);

  const translateY = slideAnim.interpolate({
    inputRange: [0, 1],
    outputRange: [600, 0],
  });

  return (
    <Modal
      visible={visible}
      transparent
      animationType="fade"
      onRequestClose={onClose}
    >
      <View style={styles.backdrop}>
        {/* Backdrop tap area - closes modal when tapping dark area */}
        <TouchableOpacity
          style={StyleSheet.absoluteFill}
          activeOpacity={1}
          onPress={onClose}
        />

        {/* Modal content - NOT inside TouchableOpacity so scrolling works */}
        <Animated.View
          style={[
            styles.modalContainer,
            { transform: [{ translateY }], backgroundColor: colors.pearl },
          ]}
        >
          <View style={styles.header}>
            <TouchableOpacity onPress={onClose} style={styles.doneButton}>
              <Text style={[styles.doneButtonText, { color: colors.deepTeal }]}>Done</Text>
            </TouchableOpacity>
          </View>

          {children}
        </Animated.View>
      </View>
    </Modal>
  );
};

const styles = StyleSheet.create({
  backdrop: {
    flex: 1,
    backgroundColor: "rgba(0, 0, 0, 0.5)",
    justifyContent: "flex-end",
  },
  modalContainer: {
    borderTopLeftRadius: 20,
    borderTopRightRadius: 20,
    paddingTop: 20,
    paddingHorizontal: 20,
    paddingBottom: 24,
    maxHeight: "90%",
    width: "100%",
    flex: 1,
  },
  header: {
    alignItems: "flex-end",
    justifyContent: "flex-end",
    paddingBottom: 12,
  },
  doneButton: {
    paddingHorizontal: 8,
    paddingVertical: 4,
    borderRadius: 999,
    backgroundColor: "transparent",
  },
  doneButtonText: {
    fontFamily: fonts.bodyFamilyRegular,
    fontSize: 16,
  },
});


