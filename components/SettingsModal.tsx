import React from "react";
import { Modal, View, StyleSheet, TouchableOpacity, Text } from "react-native";
import { colors, fonts } from "../constants/theme";

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
  return (
    <Modal
      visible={visible}
      transparent
      animationType="fade"
      onRequestClose={onClose}
    >
      <TouchableOpacity
        style={styles.backdrop}
        activeOpacity={1}
        onPress={onClose}
      >
        <View
          style={styles.modalContainer}
          // Capture taps so inner content doesn't close when interacted with
          onStartShouldSetResponder={() => true}
        >
          <View style={styles.header}>
            <Text style={styles.title}>Settings</Text>
            <TouchableOpacity onPress={onClose} style={styles.doneButton}>
              <Text style={styles.doneButtonText}>Done</Text>
            </TouchableOpacity>
          </View>

          {children}
        </View>
      </TouchableOpacity>
    </Modal>
  );
};

const styles = StyleSheet.create({
  backdrop: {
    flex: 1,
    backgroundColor: "rgba(0, 0, 0, 0.5)",
    justifyContent: "flex-end",
    paddingBottom: 82,
  },
  modalContainer: {
    backgroundColor: colors.pearl,
    borderTopLeftRadius: 20,
    borderTopRightRadius: 20,
    paddingTop: 32,
    paddingHorizontal: 20,
    paddingTop: 32,
    paddingBottom: 24,
    maxHeight: "80%",
  },
  header: {
    flexDirection: "row",
    alignItems: "center",
    justifyContent: "space-between",
    paddingBottom: 24,
    borderBottomWidth: 1,
    borderBottomColor: "#f3f4f6",
    marginBottom: 0,
  },
  title: {
    fontFamily: fonts.headerFamilyItalic,
    fontSize: 32,
    color: colors.deepTeal,
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
    color: colors.deepTeal,
  },
});


