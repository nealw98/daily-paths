import React from "react";
import {
  View,
  Text,
  StyleSheet,
  ScrollView,
  TouchableOpacity,
  Switch,
} from "react-native";
import Constants from "expo-constants";
import { useLocalSearchParams } from "expo-router";
import * as Updates from "expo-updates";
import { useRouter } from "expo-router";
import { useSafeAreaInsets } from "react-native-safe-area-context";
import Clipboard from "@react-native-clipboard/clipboard";
import AsyncStorage from "@react-native-async-storage/async-storage";
import { fonts } from "../constants/theme";
import { useTheme } from "../hooks/useTheme";
import { clearQaLogs, useQaLogs, qaLog } from "../utils/qaLog";
import { resetRateShareTracking } from "../utils/rateShareTracking";
import { isDeveloperDevice, setDeveloperDevice, getOrCreateDeviceId } from "../utils/deviceIdentity";
import { getTrialStatus, resetTrial, expireTrial } from "../utils/trialTimer";
import { setLifetimeOverride, getLifetimeOverride } from "../utils/paidAppDetector";
import { useSubscriptionContext } from "../contexts/SubscriptionContext";
import { useSubscription } from "../hooks/useSubscription";

export default function QaLogsScreen() {
  const { colors } = useTheme();
  const params = useLocalSearchParams<{
    checkAndApplyUpdate?: any;
  }>();
  const insets = useSafeAreaInsets();
  const logs = useQaLogs();
  const router = useRouter();
  const { trialStatus, refreshLifetimeAccess } = useSubscriptionContext();
  const { status: subStatus, hasLifetimeAccess } = useSubscription();
  const [updating, setUpdating] = React.useState(false);
  const [updateStatus, setUpdateStatus] = React.useState<string | null>(null);
  const [copyStatus, setCopyStatus] = React.useState<string | null>(null);
  const [isDeveloper, setIsDeveloper] = React.useState(false);
  const [deviceId, setDeviceId] = React.useState<string | null>(null);
  const [lifetimeOverride, setLifetimeOverrideState] = React.useState<boolean | null>(null);

  // Load developer mode, device ID, and lifetime override on mount
  React.useEffect(() => {
    const loadDeviceInfo = async () => {
      const devMode = await isDeveloperDevice();
      setIsDeveloper(devMode);
      const id = await getOrCreateDeviceId();
      setDeviceId(id);
      const override = await getLifetimeOverride();
      setLifetimeOverrideState(override);
    };
    loadDeviceInfo();
  }, []);

  const expoConfig: any = Constants.expoConfig ?? {};
  const appVersion =
    expoConfig.version ?? Constants.nativeAppVersion ?? "dev";
  const iosBuildNumber =
    expoConfig.ios?.buildNumber ?? Constants.nativeBuildVersion ?? "dev";

  const handleCopyAll = () => {
    if (!logs.length) {
      setCopyStatus("No logs to copy");
      return;
    }

    try {
      const payload = logs
        .map((entry) => {
          const time = new Date(entry.timestamp).toISOString();
          const header = `[${time}] ${entry.scope} - ${entry.message}`;
          let details: string | undefined;
          if (entry.details !== undefined && entry.details !== null) {
            if (typeof entry.details === "string") {
              details = entry.details;
            } else {
              // Make sure objects are captured; keep JSON compact.
              details = JSON.stringify(entry.details, null, 2);
            }
          }
          return details ? `${header}\n${details}` : header;
        })
        .join("\n\n");

      Clipboard.setString(payload);
      setCopyStatus("Copied logs to clipboard");
    } catch (err) {
      setCopyStatus(
        err instanceof Error ? `Copy failed: ${err.message}` : "Copy failed"
      );
    }
  };

  React.useEffect(() => {
    qaLog("qa", "Opened QA logs screen", {
      logCount: logs.length,
    });
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, []);

  const handleManualUpdate = async () => {
    if (__DEV__) return;
    if (updating) return;
    setUpdating(true);
    setUpdateStatus("Checking for update...");
    qaLog("ota", "Manual check started");
    try {
      const result = await Updates.checkForUpdateAsync();
      if (!result.isAvailable) {
        setUpdateStatus("No update available");
        qaLog("ota", "No update available");
        setUpdating(false);
        return;
      }
      setUpdateStatus("Downloading update...");
      qaLog("ota", "Update available, downloading");
      await Updates.fetchUpdateAsync();
      qaLog("ota", "Update downloaded, restarting");
      setUpdateStatus("Applying update...");
      await Updates.reloadAsync();
    } catch (err) {
      const msg = err instanceof Error ? err.message : String(err);
      setUpdateStatus(`Update failed: ${msg}`);
      qaLog("ota", "Update failed", msg);
      setUpdating(false);
    }
  };

  const handleResetDeviceId = async () => {
    try {
      await AsyncStorage.removeItem('@daily_paths_device_id');
      qaLog('device', 'Device ID cleared from storage');
      alert('Device ID has been reset. A new ID will be generated on next feedback submission.');
    } catch (err) {
      qaLog('device', 'Error clearing device ID', { error: String(err) });
      alert('Failed to reset device ID');
    }
  };

  const handleResetRateTracking = async () => {
    try {
      await resetRateShareTracking();
      qaLog('rate', 'Rate tracking data reset');
      alert('Rate & Share tracking has been reset for testing.');
    } catch (err) {
      qaLog('rate', 'Error resetting rate tracking', { error: String(err) });
      alert('Failed to reset rate tracking');
    }
  };

  // ─── Freemium testing helpers ──────────────────────────────────────────

  const handleShowTrialStatus = async () => {
    try {
      const status = await getTrialStatus();
      const lines = [
        `isInTrial: ${status.isInTrial}`,
        `trialExpired: ${status.trialExpired}`,
        `neverStarted: ${status.neverStarted}`,
        `daysRemaining: ${status.daysRemaining}`,
        `trialStartDate: ${status.trialStartDate ?? "null"}`,
      ];
      alert(lines.join("\n"));
      qaLog("freemium", "Trial status checked", status);
    } catch (err) {
      alert("Failed to read trial status");
    }
  };

  const handleResetTrial = async () => {
    try {
      await resetTrial();
      await trialStatus.refresh();
      qaLog("freemium", "Trial reset");
      alert("Trial reset. Restart the app to begin a fresh 7-day trial.");
    } catch (err) {
      qaLog("freemium", "Error resetting trial", { error: String(err) });
      alert("Failed to reset trial");
    }
  };

  const handleExpireTrial = async () => {
    try {
      await expireTrial();
      await trialStatus.refresh();
      qaLog("freemium", "Trial expired manually");
      alert("Trial expired. Premium tabs will now show the paywall.");
    } catch (err) {
      qaLog("freemium", "Error expiring trial", { error: String(err) });
      alert("Failed to expire trial");
    }
  };

  const handleToggleLifetimeOverride = async () => {
    if (lifetimeOverride === true) {
      // Currently forced on → turn off
      await setLifetimeOverride(false);
      setLifetimeOverrideState(false);
    } else if (lifetimeOverride === false) {
      // Currently forced off → clear override (use receipt detection)
      await setLifetimeOverride(null);
      setLifetimeOverrideState(null);
    } else {
      // No override → force on
      await setLifetimeOverride(true);
      setLifetimeOverrideState(true);
    }
    await refreshLifetimeAccess();
  };

  const lifetimeOverrideLabel =
    lifetimeOverride === true
      ? "Forced ON"
      : lifetimeOverride === false
        ? "Forced OFF"
        : "Auto (receipt)";

  return (
    <View
      style={[
        styles.container,
        { backgroundColor: colors.pearl, paddingTop: insets.top || 16, paddingBottom: insets.bottom || 16 },
      ]}
    >
      <View style={[styles.header, { borderBottomColor: colors.mist }]}>
        <View style={styles.headerRow}>
          <Text style={[styles.title, { color: colors.deepTeal }]}>QA Diagnostics</Text>
          <TouchableOpacity
            onPress={() => router.back()}
            activeOpacity={0.7}
          >
            <Text style={[styles.closeText, { color: colors.deepTeal }]}>Close</Text>
          </TouchableOpacity>
        </View>
        <Text style={[styles.subtitle, { color: colors.ink }]}>
          Version {appVersion} (build {iosBuildNumber})
        </Text>
        <Text style={styles.meta}>
          App ID: {expoConfig.slug ?? "unknown"}{" "}
          {"\n"}Channel: {expoConfig.extra?.eas?.projectId ? "EAS" : "local"}
          {deviceId && `\nDevice ID: ${deviceId.slice(0, 8)}...`}
        </Text>
        
        <View style={[styles.developerRow, { borderColor: colors.mist }]}>
          <Text style={[styles.developerLabel, { color: colors.ink }]}>Developer Mode (exclude from analytics)</Text>
          <Switch
            value={isDeveloper}
            onValueChange={async (value) => {
              setIsDeveloper(value);
              await setDeveloperDevice(value);
              alert(value 
                ? 'Developer mode enabled. Your usage will not be counted in analytics.' 
                : 'Developer mode disabled. Your usage will be counted in analytics.'
              );
            }}
            trackColor={{ false: colors.mist, true: colors.deepTeal }}
            thumbColor={isDeveloper ? colors.pearl : '#f4f3f4'}
          />
        </View>

        <View style={styles.actionsRow}>
          <TouchableOpacity
            style={[styles.secondaryButton, { borderColor: colors.deepTeal }]}
            activeOpacity={0.8}
            onPress={handleCopyAll}
          >
            <Text style={[styles.secondaryButtonText, { color: colors.deepTeal }]}>Copy all</Text>
          </TouchableOpacity>
          {copyStatus && (
            <Text style={[styles.meta, { width: "100%" }]}>{copyStatus}</Text>
          )}
          <TouchableOpacity
            style={[styles.secondaryButton, { borderColor: colors.deepTeal }]}
            activeOpacity={0.8}
            onPress={clearQaLogs}
          >
            <Text style={[styles.secondaryButtonText, { color: colors.deepTeal }]}>Clear logs</Text>
          </TouchableOpacity>
          <TouchableOpacity
            style={[styles.secondaryButton, { borderColor: colors.deepTeal }]}
            activeOpacity={0.8}
            onPress={handleResetDeviceId}
          >
            <Text style={[styles.secondaryButtonText, { color: colors.deepTeal }]}>Reset Device ID</Text>
          </TouchableOpacity>
          <TouchableOpacity
            style={[styles.secondaryButton, { borderColor: colors.deepTeal }]}
            activeOpacity={0.8}
            onPress={handleResetRateTracking}
          >
            <Text style={[styles.secondaryButtonText, { color: colors.deepTeal }]}>Reset Rate Tracking</Text>
          </TouchableOpacity>
          <TouchableOpacity
            style={[styles.secondaryButton, { borderColor: colors.deepTeal }]}
            activeOpacity={0.8}
            onPress={handleManualUpdate}
            disabled={updating}
          >
            <Text style={[styles.secondaryButtonText, { color: colors.deepTeal }]}>
              {updating ? "Updating..." : "Check for update"}
            </Text>
          </TouchableOpacity>
          {updateStatus && (
            <Text style={[styles.meta, { width: "100%" }]}>{updateStatus}</Text>
          )}
        </View>

        <Text style={[styles.sectionHeader, { marginTop: 16, color: colors.deepTeal }]}>Access States</Text>

        <View style={[styles.stateBox, { backgroundColor: "#fff", borderColor: colors.mist }]}>
          <View style={styles.stateRow}>
            <Text style={[styles.stateIndicator, { color: hasLifetimeAccess ? "#16a34a" : colors.textSecondary }]}>
              {hasLifetimeAccess ? "\u2713" : "\u2717"}
            </Text>
            <Text style={[styles.stateLabel, { color: hasLifetimeAccess ? colors.ink : colors.textSecondary }]}>
              Lifetime Access (paid download)
            </Text>
          </View>
          <View style={styles.stateRow}>
            <Text style={[styles.stateIndicator, { color: subStatus.isLegacy ? "#16a34a" : colors.textSecondary }]}>
              {subStatus.isLegacy ? "\u2713" : "\u2717"}
            </Text>
            <Text style={[styles.stateLabel, { color: subStatus.isLegacy ? colors.ink : colors.textSecondary }]}>
              Legacy Grant (RevenueCat)
            </Text>
          </View>
          <View style={styles.stateRow}>
            <Text style={[styles.stateIndicator, { color: subStatus.isSubscribed ? "#16a34a" : colors.textSecondary }]}>
              {subStatus.isSubscribed ? "\u2713" : "\u2717"}
            </Text>
            <Text style={[styles.stateLabel, { color: subStatus.isSubscribed ? colors.ink : colors.textSecondary }]}>
              Subscription{subStatus.isSubscribed
                ? ` — ${subStatus.productIdentifier ?? "unknown"} (${subStatus.willRenew ? "renews" : "expires"} ${subStatus.expirationDate ? new Date(subStatus.expirationDate).toLocaleDateString() : "\u2014"})`
                : ""}
            </Text>
          </View>
          <View style={styles.stateRow}>
            <Text style={[styles.stateIndicator, { color: trialStatus.isInTrial ? "#16a34a" : colors.textSecondary }]}>
              {trialStatus.isInTrial ? "\u2713" : "\u2717"}
            </Text>
            <Text style={[styles.stateLabel, { color: trialStatus.isInTrial ? colors.ink : colors.textSecondary }]}>
              7-Day Trial{trialStatus.isInTrial
                ? ` (${trialStatus.daysRemaining}d remaining)`
                : trialStatus.trialExpired
                  ? " (expired)"
                  : trialStatus.neverStarted
                    ? " (not started)"
                    : ""}
            </Text>
          </View>
        </View>

        <Text style={[styles.sectionHeader, { marginTop: 16, color: colors.deepTeal }]}>Freemium Testing</Text>

        <View style={[styles.developerRow, { borderColor: colors.mist }]}>
          <View style={{ flex: 1, marginRight: 8 }}>
            <Text style={[styles.developerLabel, { color: colors.ink }]}>Lifetime Access Override</Text>
            <Text style={[styles.meta, { marginTop: 2 }]}>{lifetimeOverrideLabel}</Text>
          </View>
          <TouchableOpacity
            style={[styles.secondaryButton, { borderColor: colors.deepTeal }]}
            activeOpacity={0.8}
            onPress={handleToggleLifetimeOverride}
          >
            <Text style={[styles.secondaryButtonText, { color: colors.deepTeal }]}>
              {lifetimeOverride === true ? "Force OFF" : lifetimeOverride === false ? "Clear" : "Force ON"}
            </Text>
          </TouchableOpacity>
        </View>

        <View style={styles.actionsRow}>
          <TouchableOpacity
            style={[styles.secondaryButton, { borderColor: colors.deepTeal }]}
            activeOpacity={0.8}
            onPress={handleShowTrialStatus}
          >
            <Text style={[styles.secondaryButtonText, { color: colors.deepTeal }]}>Show Trial Status</Text>
          </TouchableOpacity>
          <TouchableOpacity
            style={[styles.secondaryButton, { borderColor: colors.deepTeal }]}
            activeOpacity={0.8}
            onPress={handleResetTrial}
          >
            <Text style={[styles.secondaryButtonText, { color: colors.deepTeal }]}>Reset Trial</Text>
          </TouchableOpacity>
          <TouchableOpacity
            style={[styles.secondaryButton, { borderColor: colors.deepTeal }]}
            activeOpacity={0.8}
            onPress={handleExpireTrial}
          >
            <Text style={[styles.secondaryButtonText, { color: colors.deepTeal }]}>Expire Trial</Text>
          </TouchableOpacity>
        </View>
      </View>

      <ScrollView
        style={styles.logContainer}
        contentContainerStyle={styles.logContent}
      >
        <Text style={[styles.sectionHeader, { marginTop: 12, color: colors.deepTeal }]}>QA Logs</Text>
        {logs.length === 0 ? (
          <Text style={styles.emptyText}>No QA log entries yet.</Text>
        ) : (
          logs.map((entry) => (
            <View key={entry.id} style={styles.logEntry}>
              <Text style={styles.logMeta}>
                [{new Date(entry.timestamp).toLocaleTimeString()}]{" "}
                {entry.scope}
              </Text>
              <Text style={[styles.logMessage, { color: colors.ink }]}>{entry.message}</Text>
              {entry.details && (
                <Text style={styles.logDetails}>{entry.details}</Text>
              )}
            </View>
          ))
        )}
      </ScrollView>
    </View>
  );
}

const styles = StyleSheet.create({
  container: {
    flex: 1,
  },
  header: {
    paddingHorizontal: 16,
    paddingBottom: 12,
    borderBottomWidth: 1,
  },
  headerRow: {
    flexDirection: "row",
    alignItems: "center",
    justifyContent: "space-between",
  },
  title: {
    fontFamily: fonts.headerFamily,
    fontSize: 22,
  },
  closeText: {
    fontFamily: fonts.bodyFamilyRegular,
    fontSize: 14,
  },
  subtitle: {
    marginTop: 4,
    fontFamily: fonts.bodyFamilyRegular,
    fontSize: 14,
  },
  meta: {
    marginTop: 4,
    fontFamily: fonts.bodyFamilyRegular,
    fontSize: 12,
    color: "#6b7280",
  },
  developerRow: {
    flexDirection: "row",
    alignItems: "center",
    justifyContent: "space-between",
    marginTop: 12,
    paddingVertical: 8,
    paddingHorizontal: 12,
    backgroundColor: "#fff",
    borderRadius: 8,
    borderWidth: 1,
  },
  developerLabel: {
    fontFamily: fonts.bodyFamilyRegular,
    fontSize: 13,
    flex: 1,
    marginRight: 8,
  },
  actionsRow: {
    marginTop: 8,
    flexDirection: "row",
    gap: 8,
    flexWrap: "wrap",
  },
  primaryButton: {
    paddingHorizontal: 10,
    paddingVertical: 6,
    borderRadius: 999,
  },
  primaryButtonText: {
    fontFamily: fonts.bodyFamilyRegular,
    fontSize: 12,
    color: "#fff",
  },
  secondaryButton: {
    paddingHorizontal: 10,
    paddingVertical: 6,
    borderRadius: 999,
    borderWidth: 1,
    backgroundColor: "transparent",
  },
  secondaryButtonText: {
    fontFamily: fonts.bodyFamilyRegular,
    fontSize: 12,
  },
  logContainer: {
    flex: 1,
  },
  logContent: {
    paddingHorizontal: 16,
    paddingTop: 12,
    paddingBottom: 24,
  },
  emptyText: {
    fontFamily: fonts.bodyFamilyRegular,
    fontSize: 14,
    color: "#6b7280",
  },
  logEntry: {
    marginBottom: 12,
    padding: 10,
    borderRadius: 8,
    backgroundColor: "#ffffff",
    borderWidth: 1,
    borderColor: "#e5e7eb",
  },
  logMeta: {
    fontFamily: fonts.bodyFamilyRegular,
    fontSize: 11,
    color: "#6b7280",
    marginBottom: 2,
  },
  logMessage: {
    fontFamily: fonts.bodyFamilyRegular,
    fontSize: 13,
    marginBottom: 2,
  },
  logDetails: {
    fontFamily: fonts.bodyFamilyRegular,
    fontSize: 11,
    color: "#4b5563",
  },
  stateBox: {
    marginTop: 8,
    marginBottom: 4,
    paddingVertical: 8,
    paddingHorizontal: 12,
    borderRadius: 8,
    borderWidth: 1,
    gap: 6,
  },
  stateRow: {
    flexDirection: "row",
    alignItems: "flex-start",
  },
  stateIndicator: {
    fontFamily: fonts.bodyFamilyRegular,
    fontSize: 13,
    fontWeight: "700",
    width: 20,
  },
  stateLabel: {
    fontFamily: fonts.bodyFamilyRegular,
    fontSize: 13,
    flex: 1,
  },
  sectionHeader: {
    fontFamily: fonts.headerFamily,
    fontSize: 16,
    marginBottom: 8,
  },
});


