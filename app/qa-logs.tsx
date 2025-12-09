import React from "react";
import {
  View,
  Text,
  StyleSheet,
  ScrollView,
  TouchableOpacity,
} from "react-native";
import Constants from "expo-constants";
import { useLocalSearchParams } from "expo-router";
import * as Updates from "expo-updates";
import { useRouter } from "expo-router";
import { useSafeAreaInsets } from "react-native-safe-area-context";
import Clipboard from "@react-native-clipboard/clipboard";
import AsyncStorage from "@react-native-async-storage/async-storage";
import { colors, fonts } from "../constants/theme";
import { clearQaLogs, useQaLogs, qaLog } from "../utils/qaLog";

export default function QaLogsScreen() {
  const params = useLocalSearchParams<{
    checkAndApplyUpdate?: any;
  }>();
  const insets = useSafeAreaInsets();
  const logs = useQaLogs();
  const router = useRouter();
  const [updating, setUpdating] = React.useState(false);
  const [updateStatus, setUpdateStatus] = React.useState<string | null>(null);

  const expoConfig: any = Constants.expoConfig ?? {};
  const appVersion =
    expoConfig.version ?? Constants.nativeAppVersion ?? "dev";
  const iosBuildNumber =
    expoConfig.ios?.buildNumber ?? Constants.nativeBuildVersion ?? "dev";

  const handleCopyAll = () => {
    if (!logs.length) {
      return;
    }

    const payload = logs
      .map((entry) => {
        const time = new Date(entry.timestamp).toISOString();
        const header = `[${time}] ${entry.scope} - ${entry.message}`;
        const details = entry.details ? `\n${entry.details}` : "";
        return `${header}${details}`;
      })
      .join("\n\n");

    Clipboard.setString(payload);
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

  return (
    <View
      style={[
        styles.container,
        { paddingTop: insets.top || 16, paddingBottom: insets.bottom || 16 },
      ]}
    >
      <View style={styles.header}>
        <View style={styles.headerRow}>
          <Text style={styles.title}>QA Diagnostics</Text>
          <TouchableOpacity
            onPress={() => router.back()}
            activeOpacity={0.7}
          >
            <Text style={styles.closeText}>Close</Text>
          </TouchableOpacity>
        </View>
        <Text style={styles.subtitle}>
          Version {appVersion} (build {iosBuildNumber})
        </Text>
        <Text style={styles.meta}>
          App ID: {expoConfig.slug ?? "unknown"}{" "}
          {"\n"}Channel: {expoConfig.extra?.eas?.projectId ? "EAS" : "local"}
        </Text>
        <View style={styles.actionsRow}>
          <TouchableOpacity
            style={styles.secondaryButton}
            activeOpacity={0.8}
            onPress={handleCopyAll}
          >
            <Text style={styles.secondaryButtonText}>Copy all</Text>
          </TouchableOpacity>
          <TouchableOpacity
            style={styles.primaryButton}
            activeOpacity={0.8}
            onPress={clearQaLogs}
          >
            <Text style={styles.primaryButtonText}>Clear logs</Text>
          </TouchableOpacity>
          <TouchableOpacity
            style={styles.secondaryButton}
            activeOpacity={0.8}
            onPress={handleResetDeviceId}
          >
            <Text style={styles.secondaryButtonText}>Reset Device ID</Text>
          </TouchableOpacity>
          <TouchableOpacity
            style={styles.primaryButton}
            activeOpacity={0.8}
            onPress={handleManualUpdate}
            disabled={updating}
          >
            <Text style={styles.primaryButtonText}>
              {updating ? "Updating..." : "Check for update"}
            </Text>
          </TouchableOpacity>
          {updateStatus && (
            <Text style={[styles.meta, { width: "100%" }]}>{updateStatus}</Text>
          )}
        </View>
      </View>

      <ScrollView
        style={styles.logContainer}
        contentContainerStyle={styles.logContent}
      >
        <Text style={[styles.sectionHeader, { marginTop: 12 }]}>QA Logs</Text>
        {logs.length === 0 ? (
          <Text style={styles.emptyText}>No QA log entries yet.</Text>
        ) : (
          logs.map((entry) => (
            <View key={entry.id} style={styles.logEntry}>
              <Text style={styles.logMeta}>
                [{new Date(entry.timestamp).toLocaleTimeString()}]{" "}
                {entry.scope}
              </Text>
              <Text style={styles.logMessage}>{entry.message}</Text>
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
    backgroundColor: colors.pearl,
  },
  header: {
    paddingHorizontal: 16,
    paddingBottom: 12,
    borderBottomWidth: 1,
    borderBottomColor: colors.mist,
  },
  headerRow: {
    flexDirection: "row",
    alignItems: "center",
    justifyContent: "space-between",
  },
  title: {
    fontFamily: fonts.headerFamily,
    fontSize: 22,
    color: colors.deepTeal,
  },
  closeText: {
    fontFamily: fonts.bodyFamilyRegular,
    fontSize: 14,
    color: colors.deepTeal,
  },
  subtitle: {
    marginTop: 4,
    fontFamily: fonts.bodyFamilyRegular,
    fontSize: 14,
    color: colors.ink,
  },
  meta: {
    marginTop: 4,
    fontFamily: fonts.bodyFamilyRegular,
    fontSize: 12,
    color: "#6b7280",
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
    backgroundColor: colors.deepTeal,
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
    borderColor: colors.deepTeal,
    backgroundColor: "transparent",
  },
  secondaryButtonText: {
    fontFamily: fonts.bodyFamilyRegular,
    fontSize: 12,
    color: colors.deepTeal,
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
    color: colors.ink,
    marginBottom: 2,
  },
  logDetails: {
    fontFamily: fonts.bodyFamilyRegular,
    fontSize: 11,
    color: "#4b5563",
  },
  sectionHeader: {
    fontFamily: fonts.headerFamily,
    fontSize: 16,
    color: colors.deepTeal,
    marginBottom: 8,
  },
});


