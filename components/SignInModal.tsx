import React, { useState } from "react";
import {
  View,
  Text,
  TextInput,
  TouchableOpacity,
  StyleSheet,
  Modal,
  ActivityIndicator,
  Alert,
  ScrollView,
  Platform,
  KeyboardAvoidingView,
} from "react-native";
import { Ionicons } from "@expo/vector-icons";
import { fonts } from "../constants/theme";
import { useTheme } from "../hooks/useTheme";
import { useAuth } from "../contexts/AuthContext";

interface SignInModalProps {
  visible: boolean;
  /** When false, close button is hidden (used as mandatory gate). */
  dismissable?: boolean;
  onClose: () => void;
}

export const SignInModal: React.FC<SignInModalProps> = ({
  visible,
  dismissable = true,
  onClose,
}) => {
  const { colors } = useTheme();
  const { signIn, signUp, signInApple, signInGoogle } = useAuth();

  const [email, setEmail] = useState("");
  const [password, setPassword] = useState("");
  const [loading, setLoading] = useState(false);
  const [mode, setMode] = useState<"signin" | "signup">("signin");
  const [showPassword, setShowPassword] = useState(false);

  const handleSubmit = async () => {
    if (!email.trim() || !password.trim()) {
      Alert.alert("Missing Fields", "Enter both email and password.");
      return;
    }
    setLoading(true);
    try {
      if (mode === "signup") {
        await signUp(email.trim(), password.trim());
        Alert.alert(
          "Account Created",
          "Check your email to confirm your account, then sign in.",
          [{ text: "OK", onPress: onClose }]
        );
      } else {
        await signIn(email.trim(), password.trim());
        onClose();
      }
    } catch (err: any) {
      Alert.alert("Auth Error", err.message || "Something went wrong.");
    } finally {
      setLoading(false);
    }
  };

  const handleAppleSignIn = async () => {
    setLoading(true);
    try {
      const result = await signInApple();
      // Only close if sign-in succeeded (null = user cancelled)
      if (result !== null && result !== undefined) {
        onClose();
      }
    } catch (err: any) {
      Alert.alert("Apple Sign In Error", err.message || "Something went wrong.");
    } finally {
      setLoading(false);
    }
  };

  const handleGoogleSignIn = async () => {
    setLoading(true);
    try {
      const result = await signInGoogle();
      // Only close if sign-in succeeded (null = user cancelled)
      if (result !== null && result !== undefined) {
        onClose();
      }
    } catch (err: any) {
      Alert.alert("Google Sign In Error", err.message || "Something went wrong.");
    } finally {
      setLoading(false);
    }
  };

  return (
    <Modal
      visible={visible}
      transparent
      animationType="slide"
      onRequestClose={dismissable ? onClose : undefined}
    >
      <KeyboardAvoidingView
        behavior={Platform.OS === "ios" ? "padding" : "height"}
        style={[styles.container, { backgroundColor: colors.backdrop }]}
        keyboardVerticalOffset={Platform.OS === "ios" ? 10 : 0}
      >
        <View style={styles.keyboardAvoid}>
        <View style={[styles.content, { backgroundColor: colors.background }]}>
          {/* Header */}
          <View style={styles.header}>
            {dismissable ? (
              <TouchableOpacity onPress={onClose} style={styles.closeButton}>
                <Ionicons name="close" size={28} color={colors.textSecondary} />
              </TouchableOpacity>
            ) : (
              <View style={styles.closeButton} />
            )}
          </View>

          <ScrollView
            style={styles.scrollContent}
            showsVerticalScrollIndicator={false}
            keyboardShouldPersistTaps="handled"
            contentContainerStyle={{ paddingBottom: 20 }}
          >
            {/* Title */}
            <Text style={[styles.title, { color: colors.text }]}>
              {mode === "signin" ? "Welcome Back" : "Create Account"}
            </Text>
            <Text style={[styles.subtitle, { color: colors.textSecondary }]}>
              {mode === "signin"
                ? "Sign in to sync your data across devices"
                : "Create an account to get started"}
            </Text>

            {/* Social Sign-In Buttons */}
            <View style={styles.socialButtons}>
              {Platform.OS === "ios" && (
                <TouchableOpacity
                  style={[styles.socialButton, { backgroundColor: "#000", borderColor: "#000" }]}
                  onPress={handleAppleSignIn}
                  disabled={loading}
                >
                  <Ionicons name="logo-apple" size={20} color="#fff" />
                  <Text style={[styles.socialButtonText, { color: "#fff" }]}>
                    Continue with Apple
                  </Text>
                </TouchableOpacity>
              )}
              <TouchableOpacity
                style={[styles.socialButton, { backgroundColor: colors.background, borderColor: colors.border }]}
                onPress={handleGoogleSignIn}
                disabled={loading}
              >
                <Ionicons name="logo-google" size={20} color={colors.text} />
                <Text style={[styles.socialButtonText, { color: colors.text }]}>
                  Continue with Google
                </Text>
              </TouchableOpacity>
            </View>

            {/* Divider */}
            <View style={styles.dividerRow}>
              <View style={[styles.dividerLine, { backgroundColor: colors.border }]} />
              <Text style={[styles.dividerText, { color: colors.textSecondary }]}>or</Text>
              <View style={[styles.dividerLine, { backgroundColor: colors.border }]} />
            </View>

            {/* Email/Password Form */}
            <View style={styles.form}>
              <TextInput
                style={[styles.input, { color: colors.text, borderColor: colors.border, backgroundColor: colors.cardBackground }]}
                placeholder="Email"
                placeholderTextColor={colors.textSecondary}
                value={email}
                onChangeText={setEmail}
                autoCapitalize="none"
                keyboardType="email-address"
                autoCorrect={false}
                autoComplete="email"
                textContentType="emailAddress"
              />
              <View style={[styles.passwordRow, { borderColor: colors.border, backgroundColor: colors.cardBackground }]}>
                <TextInput
                  style={[styles.passwordInput, { color: colors.text }]}
                  placeholder="Password"
                  placeholderTextColor={colors.textSecondary}
                  value={password}
                  onChangeText={setPassword}
                  secureTextEntry={!showPassword}
                  autoComplete="password"
                  textContentType="password"
                />
                <TouchableOpacity
                  onPress={() => setShowPassword((prev) => !prev)}
                  hitSlop={{ top: 10, bottom: 10, left: 10, right: 10 }}
                  style={styles.eyeButton}
                >
                  <Ionicons
                    name={showPassword ? "eye-off-outline" : "eye-outline"}
                    size={20}
                    color={colors.textSecondary}
                  />
                </TouchableOpacity>
              </View>
              <TouchableOpacity
                style={[styles.submitButton, { backgroundColor: colors.buttonPrimary }]}
                onPress={handleSubmit}
                disabled={loading}
              >
                {loading ? (
                  <ActivityIndicator color={colors.textOnAccent} />
                ) : (
                  <Text style={[styles.submitText, { color: colors.textOnAccent }]}>
                    {mode === "signin" ? "Sign In" : "Create Account"}
                  </Text>
                )}
              </TouchableOpacity>

              {/* Toggle sign-in / sign-up */}
              <TouchableOpacity
                onPress={() => setMode(mode === "signin" ? "signup" : "signin")}
              >
                <Text style={[styles.toggleText, { color: colors.accent }]}>
                  {mode === "signin"
                    ? "Need an account? Create one"
                    : "Already have an account? Sign in"}
                </Text>
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
  title: {
    fontFamily: fonts.headerFamily,
    fontSize: 32,
    fontWeight: "700",
    textAlign: "center",
    marginTop: 8,
  },
  subtitle: {
    fontFamily: fonts.bodyFamilyRegular,
    fontSize: 16,
    textAlign: "center",
    marginTop: 8,
    marginBottom: 28,
  },
  socialButtons: {
    gap: 12,
    marginBottom: 20,
  },
  socialButton: {
    flexDirection: "row",
    alignItems: "center",
    justifyContent: "center",
    gap: 10,
    paddingVertical: 14,
    borderRadius: 12,
    borderWidth: 1,
  },
  socialButtonText: {
    fontFamily: fonts.bodyFamilyRegular,
    fontSize: 16,
    fontWeight: "600",
  },
  dividerRow: {
    flexDirection: "row",
    alignItems: "center",
    gap: 12,
    marginBottom: 20,
  },
  dividerLine: {
    flex: 1,
    height: 1,
  },
  dividerText: {
    fontFamily: fonts.bodyFamilyRegular,
    fontSize: 13,
  },
  form: {
    gap: 10,
  },
  input: {
    fontFamily: fonts.bodyFamilyRegular,
    fontSize: 15,
    borderWidth: 1,
    borderRadius: 10,
    paddingHorizontal: 14,
    paddingVertical: 12,
  },
  passwordRow: {
    flexDirection: "row",
    alignItems: "center",
    borderWidth: 1,
    borderRadius: 10,
    paddingHorizontal: 14,
  },
  passwordInput: {
    flex: 1,
    fontFamily: fonts.bodyFamilyRegular,
    fontSize: 15,
    paddingVertical: 12,
  },
  eyeButton: {
    padding: 4,
  },
  submitButton: {
    borderRadius: 12,
    paddingVertical: 14,
    alignItems: "center",
    marginTop: 4,
  },
  submitText: {
    fontFamily: fonts.bodyFamilyRegular,
    fontSize: 16,
    fontWeight: "600",
  },
  toggleText: {
    fontFamily: fonts.bodyFamilyRegular,
    fontSize: 13,
    textAlign: "center",
    paddingVertical: 12,
  },
});
