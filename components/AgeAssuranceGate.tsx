import React, { useCallback, useEffect, useRef, useState } from "react";
import { ActivityIndicator, AppState, Linking, Modal, Platform, Pressable, StyleSheet, Text, View } from "react-native";
import * as Application from "expo-application";
import { Ionicons } from "@expo/vector-icons";
import { fonts, layout } from "../constants/theme";
import { useTheme } from "../hooks/useTheme";
import { isAgeCheckDue, runAgeCheck, type AgeBlockReason } from "../utils/ageAssurance";

/**
 * Runs the store age check (utils/ageAssurance.ts) on launch and whenever the
 * app returns to the foreground, at most once a day — or every time while the
 * user is blocked. When the store reports a minor without a parent's approval,
 * or Google needs the user to confirm their age, it covers the app with a calm
 * notice and a "Check again" button. Nothing is deleted.
 *
 * Mounted once in app/_layout.tsx, only while the main app is showing.
 */

// QA (app/qa-logs.tsx): preview the notice, or run the check now.
type Listener = (action: { preview?: AgeBlockReason; checkNow?: boolean }) => void;
const listeners = new Set<Listener>();
export function previewAgeNotice(reason: AgeBlockReason) {
  listeners.forEach((l) => l({ preview: reason }));
}
export function runAgeCheckNow() {
  listeners.forEach((l) => l({ checkNow: true }));
}

const COPY: Record<AgeBlockReason, { title: string; body: string; storeLabel: string | null }> = {
  parentApproval: {
    title: "A parent needs to approve Daily Paths",
    body:
      Platform.OS === "android"
        ? "Ask your parent or guardian to approve Daily Paths in Google Play (Family Link). Your notebook and prayers are safe and will be here when it's approved."
        : "Ask your parent or guardian to approve Daily Paths in the App Store. Your notebook and prayers are safe and will be here when it's approved.",
    storeLabel: null,
  },
  verificationRequired: {
    title: "Google Play needs to confirm your age",
    body: "Open Google Play to confirm your age, then come back and tap Check again. Your notebook and prayers are safe.",
    storeLabel: "Open Google Play",
  },
};

export function AgeAssuranceGate() {
  const { colors } = useTheme();
  const [blocked, setBlocked] = useState<AgeBlockReason | null>(null);
  const [checking, setChecking] = useState(false);
  const running = useRef(false);
  const blockedRef = useRef<AgeBlockReason | null>(null);
  blockedRef.current = blocked;

  const check = useCallback(async (force: boolean) => {
    if (running.current) return;
    if (!force && !blockedRef.current && !(await isAgeCheckDue())) return;
    running.current = true;
    setChecking(true);
    try {
      const result = await runAgeCheck();
      setBlocked(result.outcome === "blocked" ? result.reason : null);
    } finally {
      running.current = false;
      setChecking(false);
    }
  }, []);

  useEffect(() => {
    void check(false);
    const sub = AppState.addEventListener("change", (state) => {
      if (state === "active") void check(false);
    });
    const listener: Listener = ({ preview, checkNow }) => {
      if (preview) setBlocked(preview);
      if (checkNow) void check(true);
    };
    listeners.add(listener);
    return () => {
      sub.remove();
      listeners.delete(listener);
    };
  }, [check]);

  if (!blocked) return null;
  const copy = COPY[blocked];

  const openStore = () => {
    const id = Application.applicationId ?? "com.nealw98.dailypaths";
    Linking.openURL(`market://details?id=${id}`).catch(() =>
      Linking.openURL(`https://play.google.com/store/apps/details?id=${id}`),
    );
  };

  return (
    <Modal visible animationType="fade" presentationStyle="fullScreen" onRequestClose={() => {}}>
      <View style={[styles.root, { backgroundColor: colors.surface }]}>
        <View style={styles.content}>
          <View style={[styles.pip, { backgroundColor: colors.secondary }]}>
            <Ionicons name="people-outline" size={26} color={colors.onSecondary} />
          </View>
          <Text style={[styles.title, { color: colors.onSurface }]}>{copy.title}</Text>
          <Text style={[styles.body, { color: colors.onSurfaceVariant }]}>{copy.body}</Text>

          {copy.storeLabel ? (
            <Pressable
              onPress={openStore}
              accessibilityRole="button"
              style={({ pressed }) => [styles.button, { borderColor: colors.secondary }, pressed && styles.pressed]}
            >
              <Text style={[styles.buttonText, { color: colors.secondary }]}>{copy.storeLabel}</Text>
            </Pressable>
          ) : null}

          <Pressable
            onPress={() => void check(true)}
            disabled={checking}
            accessibilityRole="button"
            accessibilityLabel="Check again"
            style={({ pressed }) => [
              styles.button,
              styles.primary,
              { backgroundColor: colors.secondary, borderColor: colors.secondary },
              pressed && styles.pressed,
            ]}
          >
            {checking ? (
              <ActivityIndicator color={colors.onSecondary} />
            ) : (
              <Text style={[styles.buttonText, { color: colors.onSecondary }]}>Check again</Text>
            )}
          </Pressable>
        </View>
      </View>
    </Modal>
  );
}

const styles = StyleSheet.create({
  root: { flex: 1, alignItems: "center", justifyContent: "center", padding: 28 },
  content: { width: "100%", maxWidth: 440, alignItems: "center", gap: 16 },
  pip: { width: 56, height: 56, borderRadius: 16, alignItems: "center", justifyContent: "center", marginBottom: 4 },
  title: { fontFamily: fonts.cormorantGaramondSemiBold, fontSize: 30, lineHeight: 36, textAlign: "center" },
  body: { fontFamily: fonts.bodyFamilyRegular, fontSize: 17, lineHeight: 25, textAlign: "center", marginBottom: 8 },
  button: {
    alignSelf: "stretch",
    minHeight: 52,
    borderRadius: layout.borderRadiusLarge,
    borderWidth: 1.5,
    alignItems: "center",
    justifyContent: "center",
    paddingHorizontal: 20,
  },
  primary: {},
  buttonText: { fontFamily: fonts.bodyFamilySemiBold, fontSize: 17 },
  pressed: { opacity: 0.85 },
});
