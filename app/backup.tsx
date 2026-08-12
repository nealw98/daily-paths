// Backup & Restore. One JSON snapshot of the user's data in their own private
// cloud: iCloud on iOS (no sign-in), Google Drive on Android (connect a Google
// account once; automatic backup runs silently after).
//
// Core lives in lib/cloudSync.ts + lib/userDataSync.ts (+ lib/googleDriveAuth.ts).
// Automatic push/pull is driven by <CloudSyncGate /> in app/_layout.tsx; this
// screen is the manual surface and the Android connect flow.
import React, { useCallback, useEffect, useState } from "react";
import {
  View,
  Text,
  ScrollView,
  TouchableOpacity,
  StyleSheet,
  ActivityIndicator,
  Alert,
  Platform,
} from "react-native";
import { SafeAreaView } from "react-native-safe-area-context";
import { useRouter } from "expo-router";
import { Ionicons } from "@expo/vector-icons";
import { useTheme } from "../hooks/useTheme";
import { useTypography } from "../hooks/useTypography";
import { TealHeader } from "../components/shared/TealHeader";
import { PageTitle } from "../components/ui/PageTitle";
import { layout } from "../constants/theme";
import { countStoredItems } from "../lib/userDataSync";
import {
  CLOUD_NAME,
  cloudAvailable,
  cloudBackupSupported,
  deleteCloudBackup,
  isSyncPaused,
  lastSyncedAt,
  pullFromCloud,
  pushToCloud,
  setSyncPaused,
} from "../lib/cloudSync";
import {
  getDriveAccessToken,
  getDriveAccountEmail,
  isDriveSignedIn,
  signOutDrive,
} from "../lib/googleDriveAuth";

const reloadApp = async () => {
  try {
    const Updates = await import("expo-updates");
    await Updates.reloadAsync();
  } catch {
    /* dev client / no updates module */
  }
};

function formatWhen(d: Date | null): string {
  if (!d) return "Never";
  return d.toLocaleString(undefined, {
    month: "short",
    day: "numeric",
    hour: "numeric",
    minute: "2-digit",
  });
}

export default function BackupScreen() {
  const router = useRouter();
  const { colors } = useTheme();
  const { typography: typ } = useTypography();

  const isAndroid = Platform.OS === "android";
  const supported = cloudBackupSupported();

  const [busy, setBusy] = useState(false);
  const [count, setCount] = useState<number | null>(null);
  const [syncedAt, setSyncedAt] = useState<Date | null>(null);
  const [available, setAvailable] = useState<boolean | null>(null); // iOS: iCloud signed in
  const [connected, setConnected] = useState<boolean | null>(null); // Android: Google account
  const [email, setEmail] = useState<string | null>(null);

  const refreshStatus = useCallback(() => {
    countStoredItems().then(setCount).catch(() => {});
    lastSyncedAt().then(setSyncedAt).catch(() => {});
    if (!supported) return;
    if (isAndroid) {
      isDriveSignedIn()
        .then((s) => {
          setConnected(s);
          if (s) getDriveAccountEmail().then(setEmail).catch(() => {});
        })
        .catch(() => setConnected(false));
    } else {
      cloudAvailable().then(setAvailable).catch(() => setAvailable(false));
    }
  }, [supported, isAndroid]);

  useEffect(refreshStatus, [refreshStatus]);

  const backupNow = async () => {
    setBusy(true);
    try {
      await setSyncPaused(false); // an explicit backup resumes automatic sync
      const ok = await pushToCloud(true);
      refreshStatus();
      Alert.alert(
        ok ? `Backed up to ${CLOUD_NAME}` : `${CLOUD_NAME} unavailable`,
        ok
          ? `Your writing is saved to ${CLOUD_NAME}. It will come back automatically if you reinstall or set up a new device.`
          : isAndroid
            ? "Connect your Google account, then try again."
            : "Sign in to iCloud in your device Settings, then try again.",
      );
    } finally {
      setBusy(false);
    }
  };

  const restoreNow = async () => {
    setBusy(true);
    try {
      const restored = await pullFromCloud(true); // force past the newer-than gate
      refreshStatus();
      if (restored) {
        Alert.alert("Restored", "Daily Paths will reload.", [
          { text: "OK", onPress: reloadApp },
        ]);
      } else {
        Alert.alert("Nothing to restore", `No ${CLOUD_NAME} backup was found yet.`);
      }
    } finally {
      setBusy(false);
    }
  };

  // Android: connect a Google account, then do the right thing immediately —
  // restore if this account already holds a backup (the reinstall / new-phone
  // case), otherwise seed the first backup. Automatic sync takes over after.
  const connectDrive = async () => {
    setBusy(true);
    try {
      const token = await getDriveAccessToken(true);
      if (!token) {
        Alert.alert("Couldn't connect", "Google sign-in didn't complete. Please try again.");
        return;
      }
      setConnected(true);
      getDriveAccountEmail().then(setEmail).catch(() => {});
      const restored = await pullFromCloud();
      if (restored) {
        Alert.alert("Backup found", "Your writing was restored. Daily Paths will reload.", [
          { text: "OK", onPress: reloadApp },
        ]);
      } else {
        await setSyncPaused(false);
        const ok = await pushToCloud(true);
        refreshStatus();
        if (ok) {
          Alert.alert(
            "Google Drive connected",
            "Your writing is backed up and will stay backed up automatically.",
          );
        }
      }
    } finally {
      setBusy(false);
    }
  };

  const disconnectDrive = async () => {
    await signOutDrive();
    setConnected(false);
    setEmail(null);
  };

  const confirmDelete = () => {
    Alert.alert(
      "Delete backup",
      `This removes your backup from ${CLOUD_NAME}. Everything on this device stays where it is.`,
      [
        { text: "Cancel", style: "cancel" },
        {
          text: "Delete",
          style: "destructive",
          onPress: async () => {
            setBusy(true);
            try {
              await deleteCloudBackup();
              refreshStatus();
            } finally {
              setBusy(false);
            }
          },
        },
      ],
    );
  };

  const statusLabel = isAndroid
    ? connected === false
      ? "Not connected"
      : connected
        ? email ?? "Connected"
        : "Checking…"
    : available === false
      ? "Not signed in to iCloud"
      : available
        ? "On"
        : "Checking…";

  const renderButton = (
    label: string,
    icon: keyof typeof Ionicons.glyphMap,
    onPress: () => void,
    primary = false,
  ) => (
    <TouchableOpacity
      style={[
        styles.button,
        primary
          ? { backgroundColor: colors.secondary }
          : { backgroundColor: colors.surfaceContainerLowest, borderColor: colors.outlineVariant, borderWidth: 1 },
      ]}
      onPress={onPress}
      disabled={busy}
      activeOpacity={0.8}
    >
      <Ionicons
        name={icon}
        size={18}
        color={primary ? colors.onSecondary : colors.secondary}
      />
      <Text
        style={[
          styles.buttonText,
          {
            fontSize: typ.body.fontSize,
            color: primary ? colors.onSecondary : colors.secondary,
          },
        ]}
      >
        {label}
      </Text>
    </TouchableOpacity>
  );

  return (
    <SafeAreaView style={[styles.container, { backgroundColor: colors.surface }]} edges={[]}>
      <TealHeader onBack={() => router.back()} />
      <PageTitle title="Backup" subtitle={`Keep your writing safe in ${CLOUD_NAME}`} size="lg" />

      <ScrollView contentContainerStyle={styles.content} showsVerticalScrollIndicator={false}>
        {!supported ? (
          <Text style={[styles.body, { color: colors.textSecondary, fontSize: typ.body.fontSize }]}>
            Backup isn't available in this build yet. It arrives with the next
            update from the {Platform.OS === "ios" ? "App Store" : "Play Store"}.
          </Text>
        ) : (
          <>
            <View
              style={[
                styles.card,
                { backgroundColor: colors.surfaceContainerLowest, borderColor: colors.outlineVariant },
              ]}
            >
              <View style={styles.statusRow}>
                <Text style={[styles.statusKey, { color: colors.textSecondary, fontSize: typ.bodySmall.fontSize }]}>
                  {CLOUD_NAME}
                </Text>
                <Text style={[styles.statusValue, { color: colors.text, fontSize: typ.bodySmall.fontSize }]}>
                  {statusLabel}
                </Text>
              </View>
              <View style={styles.statusRow}>
                <Text style={[styles.statusKey, { color: colors.textSecondary, fontSize: typ.bodySmall.fontSize }]}>
                  Last backed up
                </Text>
                <Text style={[styles.statusValue, { color: colors.text, fontSize: typ.bodySmall.fontSize }]}>
                  {formatWhen(syncedAt)}
                </Text>
              </View>
              {count !== null && (
                <View style={styles.statusRow}>
                  <Text style={[styles.statusKey, { color: colors.textSecondary, fontSize: typ.bodySmall.fontSize }]}>
                    Items on this device
                  </Text>
                  <Text style={[styles.statusValue, { color: colors.text, fontSize: typ.bodySmall.fontSize }]}>
                    {count}
                  </Text>
                </View>
              )}
            </View>

            <Text style={[styles.body, { color: colors.textSecondary, fontSize: typ.bodySmall.fontSize }]}>
              Your journal, gratitude lists, prayers, bookmarks and settings are
              saved to your own {CLOUD_NAME} account — not to our servers. We
              can't read it.
            </Text>

            {busy && <ActivityIndicator style={styles.spinner} color={colors.secondary} />}

            {isAndroid && connected === false
              ? renderButton("Connect Google account", "logo-google", connectDrive, true)
              : renderButton("Back up now", "cloud-upload-outline", backupNow, true)}

            {renderButton("Restore from backup", "cloud-download-outline", restoreNow)}

            {isAndroid && connected ? (
              <TouchableOpacity onPress={disconnectDrive} disabled={busy} style={styles.link}>
                <Text style={[styles.linkText, { color: colors.textSecondary, fontSize: typ.bodySmall.fontSize }]}>
                  Disconnect Google account
                </Text>
              </TouchableOpacity>
            ) : null}

            <TouchableOpacity onPress={confirmDelete} disabled={busy} style={styles.link}>
              <Text style={[styles.linkText, { color: colors.danger, fontSize: typ.bodySmall.fontSize }]}>
                Delete backup from {CLOUD_NAME}
              </Text>
            </TouchableOpacity>
          </>
        )}
      </ScrollView>
    </SafeAreaView>
  );
}

const styles = StyleSheet.create({
  container: { flex: 1 },
  content: {
    paddingHorizontal: layout.spacing.lg,
    paddingBottom: layout.spacing.xl,
    gap: layout.spacing.md,
  },
  card: {
    borderRadius: 12,
    borderWidth: 1,
    padding: layout.spacing.md,
    gap: layout.spacing.sm,
  },
  statusRow: { flexDirection: "row", justifyContent: "space-between", gap: layout.spacing.md },
  statusKey: { flexShrink: 0 },
  statusValue: { flexShrink: 1, textAlign: "right", fontWeight: "600" },
  body: { lineHeight: 22 },
  button: {
    flexDirection: "row",
    alignItems: "center",
    justifyContent: "center",
    gap: layout.spacing.sm,
    borderRadius: 12,
    paddingVertical: 14,
  },
  buttonText: { fontWeight: "600" },
  link: { alignItems: "center", paddingVertical: layout.spacing.sm },
  linkText: { textDecorationLine: "underline" },
  spinner: { marginVertical: layout.spacing.sm },
});
