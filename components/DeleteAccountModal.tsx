import React, { useState } from "react";
import {
  Modal,
  View,
  Text,
  TextInput,
  TouchableOpacity,
  StyleSheet,
  KeyboardAvoidingView,
  Platform,
  ActivityIndicator,
  ScrollView,
} from "react-native";
import { Ionicons } from "@expo/vector-icons";
import { fonts } from "../constants/theme";
import { useTheme } from "../hooks/useTheme";

interface DeleteAccountModalProps {
  visible: boolean;
  onClose: () => void;
  onConfirm: () => Promise<void>;
  isLegacy: boolean;
}

export const DeleteAccountModal: React.FC<DeleteAccountModalProps> = ({
  visible,
  onClose,
  onConfirm,
  isLegacy,
}) => {
  const { colors } = useTheme();
  const [confirmText, setConfirmText] = useState("");
  const [loading, setLoading] = useState(false);

  const isConfirmed = confirmText === "DELETE";

  const handleClose = () => {
    if (loading) return;
    setConfirmText("");
    onClose();
  };

  const handleConfirm = async () => {
    if (!isConfirmed || loading) return;
    setLoading(true);
    try {
      await onConfirm();
    } finally {
      setLoading(false);
      setConfirmText("");
    }
  };

  return (
    <Modal
      visible={visible}
      transparent
      animationType="slide"
      onRequestClose={handleClose}
    >
      <KeyboardAvoidingView
        behavior={Platform.OS === "ios" ? "padding" : "height"}
        style={[styles.container, { backgroundColor: "rgba(0,0,0,0.5)" }]}
        keyboardVerticalOffset={Platform.OS === "ios" ? 10 : 0}
      >
        <View style={styles.keyboardAvoid}>
          <View style={[styles.content, { backgroundColor: colors.background }]}>
            {/* Header */}
            <View style={styles.header}>
              <TouchableOpacity onPress={handleClose} style={styles.closeButton} disabled={loading}>
                <Ionicons name="close" size={28} color={colors.textSecondary} />
              </TouchableOpacity>
            </View>

            <ScrollView
              style={styles.scrollContent}
              showsVerticalScrollIndicator={false}
              keyboardShouldPersistTaps="handled"
              contentContainerStyle={{ paddingBottom: 20 }}
            >
              {/* Icon */}
              <View style={styles.iconRow}>
                <Ionicons name="warning-outline" size={40} color={colors.danger} />
              </View>

              {/* Title */}
              <Text style={[styles.title, { color: colors.danger }]}>Delete Account</Text>

              {/* Warning text */}
              <Text style={[styles.warning, { color: colors.text }]}>
                This will permanently delete all your data — journal entries, spot checks, nightly
                reviews, preferences, and prayer notes.
              </Text>

              {isLegacy && (
                <Text style={[styles.warning, { color: colors.text, marginTop: 12 }]}>
                  Your lifetime access to premium features will be restored if you create a new
                  account with the same Apple ID, but your data cannot be recovered.
                </Text>
              )}

              <Text style={[styles.gracePeriod, { color: colors.textSecondary }]}>
                You have 30 days to change your mind by signing back in. After 30 days, this cannot
                be undone.
              </Text>

              {/* Confirmation input */}
              <Text style={[styles.inputLabel, { color: colors.text }]}>
                Type <Text style={styles.deleteWord}>DELETE</Text> to confirm
              </Text>
              <TextInput
                style={[
                  styles.input,
                  {
                    color: colors.text,
                    borderColor: confirmText.length > 0 && !isConfirmed ? colors.danger : colors.border,
                    backgroundColor: colors.cardBackground,
                  },
                ]}
                value={confirmText}
                onChangeText={setConfirmText}
                placeholder="DELETE"
                placeholderTextColor={colors.textSecondary}
                autoCapitalize="characters"
                autoCorrect={false}
                editable={!loading}
              />

              {/* Buttons */}
              <View style={styles.buttons}>
                <TouchableOpacity
                  style={[styles.cancelButton, { backgroundColor: colors.mist }]}
                  onPress={handleClose}
                  disabled={loading}
                  activeOpacity={0.8}
                >
                  <Text style={[styles.cancelButtonText, { color: colors.ink }]}>Cancel</Text>
                </TouchableOpacity>

                <TouchableOpacity
                  style={[
                    styles.deleteButton,
                    { backgroundColor: isConfirmed ? colors.danger : colors.mist, opacity: isConfirmed ? 1 : 0.5 },
                  ]}
                  onPress={handleConfirm}
                  disabled={!isConfirmed || loading}
                  activeOpacity={0.8}
                >
                  {loading ? (
                    <ActivityIndicator color="#fff" />
                  ) : (
                    <Text style={[styles.deleteButtonText, { color: isConfirmed ? "#fff" : colors.textSecondary }]}>
                      Delete My Account
                    </Text>
                  )}
                </TouchableOpacity>
              </View>
            </ScrollView>
          </View>
        </View>
      </KeyboardAvoidingView>
    </Modal>
  );
};

const styles = StyleSheet.create({
  container: {
    flex: 1,
  },
  keyboardAvoid: {
    flex: 1,
    justifyContent: "flex-end",
  },
  content: {
    borderTopLeftRadius: 20,
    borderTopRightRadius: 20,
    maxHeight: "90%",
    paddingBottom: 20,
  },
  header: {
    flexDirection: "row",
    justifyContent: "flex-end",
    paddingHorizontal: 20,
    paddingTop: 16,
  },
  closeButton: {
    width: 36,
    height: 36,
    borderRadius: 18,
    alignItems: "center",
    justifyContent: "center",
  },
  scrollContent: {
    paddingHorizontal: 24,
  },
  iconRow: {
    alignItems: "center",
    marginBottom: 8,
  },
  title: {
    fontFamily: fonts.headerFamily,
    fontSize: 28,
    fontWeight: "700",
    textAlign: "center",
    marginBottom: 20,
  },
  warning: {
    fontFamily: fonts.bodyFamilyRegular,
    fontSize: 15,
    lineHeight: 22,
    textAlign: "center",
  },
  gracePeriod: {
    fontFamily: fonts.bodyFamilyRegular,
    fontSize: 14,
    lineHeight: 20,
    textAlign: "center",
    marginTop: 16,
    marginBottom: 24,
  },
  inputLabel: {
    fontFamily: fonts.bodyFamilyRegular,
    fontSize: 14,
    marginBottom: 8,
    textAlign: "center",
  },
  deleteWord: {
    fontWeight: "700",
    letterSpacing: 1,
  },
  input: {
    fontFamily: fonts.bodyFamilyRegular,
    fontSize: 16,
    borderWidth: 1,
    borderRadius: 10,
    paddingHorizontal: 14,
    paddingVertical: 12,
    textAlign: "center",
    letterSpacing: 2,
  },
  buttons: {
    flexDirection: "row",
    gap: 12,
    marginTop: 20,
  },
  cancelButton: {
    flex: 1,
    borderRadius: 12,
    paddingVertical: 14,
    alignItems: "center",
  },
  cancelButtonText: {
    fontFamily: fonts.bodyFamilyRegular,
    fontSize: 16,
    fontWeight: "600",
  },
  deleteButton: {
    flex: 1,
    borderRadius: 12,
    paddingVertical: 14,
    alignItems: "center",
  },
  deleteButtonText: {
    fontFamily: fonts.bodyFamilyRegular,
    fontSize: 16,
    fontWeight: "600",
  },
});
