import React, { useCallback, useEffect, useState } from "react";
import {
  ActivityIndicator,
  Alert,
  Platform,
  ScrollView,
  StyleSheet,
  Text,
  TouchableOpacity,
  View,
} from "react-native";
import { SafeAreaView } from "react-native-safe-area-context";
import { useRouter } from "expo-router";
import { Ionicons } from "@expo/vector-icons";
import { useTheme } from "../hooks/useTheme";
import { useTypography } from "../hooks/useTypography";
import { TealHeader } from "../components/shared/TealHeader";
import { PageTitle } from "../components/ui/PageTitle";
import { layout } from "../constants/theme";
import {
  CLOUD_NAME,
  cloudAvailable,
  cloudBackupSupported,
  deleteCloudBackup,
  isSyncPaused,
  setSyncPaused,
  syncWithCloud,
} from "../lib/cloudSync";
import { getDriveAccessToken, isDriveSignedIn, signOutDrive } from "../lib/googleDriveAuth";

async function reloadApp(): Promise<void> {
  try {
    const Updates = await import("expo-updates");
    await Updates.reloadAsync();
  } catch {
    // Development clients reflect synchronized storage on their next launch.
  }
}

export default function BackupScreen() {
  const router = useRouter();
  const { colors } = useTheme();
  const { typography: typ } = useTypography();
  const isAndroid = Platform.OS === "android";
  const supported = cloudBackupSupported();

  const [busy, setBusy] = useState(false);
  const [available, setAvailable] = useState<boolean | null>(null);
  const [connected, setConnected] = useState<boolean | null>(null);
  const [paused, setPaused] = useState(false);

  const refreshStatus = useCallback(async () => {
    setPaused(await isSyncPaused());
    if (!supported) return;
    if (isAndroid) {
      setConnected(await isDriveSignedIn().catch(() => false));
    } else {
      setAvailable(await cloudAvailable().catch(() => false));
    }
  }, [isAndroid, supported]);

  useEffect(() => {
    void refreshStatus();
  }, [refreshStatus]);

  const syncNow = async () => {
    setBusy(true);
    try {
      await setSyncPaused(false);
      setPaused(false);
      const result = await syncWithCloud(false, true);
      await refreshStatus();
      if (!result.success) {
        Alert.alert(
          `${CLOUD_NAME} unavailable`,
          isAndroid
            ? "Reconnect Google Drive and try again."
            : "Make sure you are signed into iCloud and iCloud Drive is turned on.",
        );
      } else if (result.localChanged) {
        Alert.alert("Sync complete", "Changes from another device are ready.", [
          { text: "OK", onPress: reloadApp },
        ]);
      } else {
        Alert.alert("Up to date", `Your Daily Paths data is synchronized with ${CLOUD_NAME}.`);
      }
    } finally {
      setBusy(false);
    }
  };

  const connectDrive = async () => {
    setBusy(true);
    try {
      const token = await getDriveAccessToken(true);
      if (!token) {
        Alert.alert("Couldn't connect", "Google sign-in didn't complete. Please try again.");
        return;
      }
      setConnected(true);
      await setSyncPaused(false);
      setPaused(false);
      const result = await syncWithCloud(false, true);
      if (!result.success) {
        Alert.alert("Couldn't sync", "Google Drive connected, but synchronization didn't complete. Please try again.");
      } else if (result.localChanged) {
        Alert.alert("Google Drive connected", "Your data from Google Drive is ready.", [
          { text: "OK", onPress: reloadApp },
        ]);
      } else {
        Alert.alert("Google Drive connected", "Your data will now stay synchronized automatically.");
      }
      await refreshStatus();
    } finally {
      setBusy(false);
    }
  };

  const confirmDisconnect = () => {
    Alert.alert(
      "Disconnect Google Drive?",
      "Your data will remain on this device and in Google Drive, but it will stop synchronizing here.",
      [
        { text: "Cancel", style: "cancel" },
        {
          text: "Disconnect",
          onPress: async () => {
            await signOutDrive();
            setConnected(false);
          },
        },
      ],
    );
  };

  const confirmDelete = () => {
    Alert.alert(
      "Delete cloud data?",
      `This removes Daily Paths data from ${CLOUD_NAME} and turns off synchronization. Data already on this device will remain.`,
      [
        { text: "Cancel", style: "cancel" },
        {
          text: "Delete",
          style: "destructive",
          onPress: async () => {
            setBusy(true);
            try {
              const deleted = await deleteCloudBackup();
              if (deleted) {
                setPaused(true);
                Alert.alert("Cloud data deleted", "Your data remains on this device. Automatic sync is off.");
              } else {
                Alert.alert("Couldn't delete cloud data", `Please check your ${CLOUD_NAME} connection and try again.`);
              }
              await refreshStatus();
            } finally {
              setBusy(false);
            }
          },
        },
      ],
    );
  };

  const checking = supported && (isAndroid ? connected === null : available === null);
  const serviceReady = isAndroid ? connected === true : available === true;
  const syncOn = serviceReady && !paused;
  const statusText = checking ? "Checking…" : syncOn ? "On" : paused ? "Off" : isAndroid ? "Not connected" : "Unavailable";

  return (
    <SafeAreaView style={[styles.container, { backgroundColor: colors.surface }]} edges={[]}>
      <TealHeader onBack={() => router.back()} />
      <PageTitle
        title="Backup & Sync"
        subtitle="Your data stays protected automatically"
        size="lg"
      />

      <ScrollView contentContainerStyle={styles.content} showsVerticalScrollIndicator={false}>
        <Text style={[styles.intro, { color: colors.text, fontSize: typ.body.fontSize, lineHeight: typ.body.lineHeight }]}>
          Your journal, gratitude entries, prayers, bookmarks and listening progress are saved automatically and stay up to date across your devices.
        </Text>

        {!supported ? (
          <View style={[styles.notice, { backgroundColor: colors.surfaceContainerLowest, borderColor: colors.outlineVariant }]}>
            <Ionicons name="cloud-offline-outline" size={24} color={colors.textSecondary} />
            <Text style={[styles.noticeText, { color: colors.textSecondary, fontSize: typ.bodySmall.fontSize, lineHeight: typ.bodySmall.lineHeight }]}>
              Backup & Sync requires the latest version of Daily Paths from the {isAndroid ? "Play Store" : "App Store"}.
            </Text>
          </View>
        ) : (
          <>
            <View style={[styles.statusCard, { backgroundColor: colors.surfaceContainerLowest, borderColor: colors.outlineVariant }]}>
              <View style={[styles.iconTile, { backgroundColor: colors.secondaryContainer }]}>
                {checking || busy ? (
                  <ActivityIndicator color={colors.secondary} />
                ) : (
                  <Ionicons
                    name={syncOn ? "cloud-done-outline" : "cloud-offline-outline"}
                    size={26}
                    color={syncOn ? colors.secondary : colors.textSecondary}
                  />
                )}
              </View>
              <View style={styles.statusCopy}>
                <Text style={[styles.statusTitle, { color: colors.text, fontSize: typ.body.fontSize }]}>
                  {CLOUD_NAME} Sync
                </Text>
                <Text style={[styles.statusState, { color: syncOn ? colors.secondary : colors.textSecondary, fontSize: typ.bodySmall.fontSize }]}>
                  {statusText}
                </Text>
              </View>
            </View>

            {!isAndroid && available === false ? (
              <Text style={[styles.help, { color: colors.textSecondary, fontSize: typ.bodySmall.fontSize, lineHeight: typ.bodySmall.lineHeight }]}>
                Sign into iCloud and turn on iCloud Drive in your device Settings to protect your data.
              </Text>
            ) : null}

            {isAndroid && connected === false ? (
              <TouchableOpacity
                style={[styles.primaryButton, { backgroundColor: colors.secondary }]}
                onPress={connectDrive}
                disabled={busy}
                activeOpacity={0.8}
              >
                <Ionicons name="logo-google" size={18} color={colors.onSecondary} />
                <Text style={[styles.primaryButtonText, { color: colors.onSecondary, fontSize: typ.body.fontSize }]}>
                  Connect Google Drive
                </Text>
              </TouchableOpacity>
            ) : null}

            {paused && serviceReady ? (
              <TouchableOpacity
                style={[styles.primaryButton, { backgroundColor: colors.secondary }]}
                onPress={syncNow}
                disabled={busy}
                activeOpacity={0.8}
              >
                <Ionicons name="cloud-upload-outline" size={18} color={colors.onSecondary} />
                <Text style={[styles.primaryButtonText, { color: colors.onSecondary, fontSize: typ.body.fontSize }]}>Turn On Sync</Text>
              </TouchableOpacity>
            ) : null}

            <Text style={[styles.privacy, { color: colors.textSecondary, fontSize: typ.bodySmall.fontSize, lineHeight: typ.bodySmall.lineHeight }]}>
              Your data stays in your private {CLOUD_NAME} account and is never sent to our servers. Device settings, purchases and downloaded audio are not included.
            </Text>

            {serviceReady ? (
              <View style={[styles.manageRow, { borderTopColor: colors.outlineVariant }]}>
                <TouchableOpacity onPress={syncNow} disabled={busy} style={styles.linkButton}>
                  <Text style={[styles.linkText, { color: colors.secondary, fontSize: typ.bodySmall.fontSize }]}>Sync now</Text>
                </TouchableOpacity>
                {isAndroid ? (
                  <>
                    <Text style={[styles.dot, { color: colors.textSecondary }]}>·</Text>
                    <TouchableOpacity onPress={confirmDisconnect} disabled={busy} style={styles.linkButton}>
                      <Text style={[styles.linkText, { color: colors.textSecondary, fontSize: typ.bodySmall.fontSize }]}>Disconnect</Text>
                    </TouchableOpacity>
                  </>
                ) : null}
                <Text style={[styles.dot, { color: colors.textSecondary }]}>·</Text>
                <TouchableOpacity onPress={confirmDelete} disabled={busy} style={styles.linkButton}>
                  <Text style={[styles.linkText, { color: colors.danger, fontSize: typ.bodySmall.fontSize }]}>Delete cloud data</Text>
                </TouchableOpacity>
              </View>
            ) : null}
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
    gap: layout.spacing.lg,
  },
  intro: {},
  notice: {
    flexDirection: "row",
    alignItems: "center",
    gap: layout.spacing.md,
    borderRadius: 16,
    borderWidth: 1,
    padding: layout.spacing.lg,
  },
  noticeText: { flex: 1 },
  statusCard: {
    flexDirection: "row",
    alignItems: "center",
    gap: layout.spacing.md,
    borderRadius: 16,
    borderWidth: 1,
    padding: layout.spacing.lg,
  },
  iconTile: {
    width: 52,
    height: 52,
    borderRadius: 15,
    alignItems: "center",
    justifyContent: "center",
  },
  statusCopy: { flex: 1, gap: 3 },
  statusTitle: { fontWeight: "700" },
  statusState: { fontWeight: "600" },
  help: {},
  primaryButton: {
    flexDirection: "row",
    alignItems: "center",
    justifyContent: "center",
    gap: layout.spacing.sm,
    borderRadius: 14,
    paddingVertical: 15,
  },
  primaryButtonText: { fontWeight: "700" },
  privacy: {},
  manageRow: {
    flexDirection: "row",
    flexWrap: "wrap",
    alignItems: "center",
    justifyContent: "center",
    borderTopWidth: StyleSheet.hairlineWidth,
    paddingTop: layout.spacing.md,
  },
  linkButton: { paddingHorizontal: 8, paddingVertical: 8 },
  linkText: { fontWeight: "600" },
  dot: { fontSize: 14 },
});
