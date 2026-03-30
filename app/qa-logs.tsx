import React from "react";
import {
  View,
  Text,
  StyleSheet,
  ScrollView,
  TouchableOpacity,
  Switch,
  Alert,
  Modal,
  TextInput,
  KeyboardAvoidingView,
  Platform,
} from "react-native";
import Constants from "expo-constants";
import { useLocalSearchParams } from "expo-router";
import * as Updates from "expo-updates";
import { useRouter } from "expo-router";
import { useSafeAreaInsets } from "react-native-safe-area-context";
import Clipboard from "@react-native-clipboard/clipboard";
import AsyncStorage from "@react-native-async-storage/async-storage";
import * as Sharing from "expo-sharing";
import { fonts } from "../constants/theme";
import { useTheme } from "../hooks/useTheme";
import { clearQaLogs, useQaLogs, qaLog } from "../utils/qaLog";
import { resetRateShareTracking } from "../utils/rateShareTracking";
import { isDeveloperDevice, setDeveloperDevice, getOrCreateDeviceId } from "../utils/deviceIdentity";
import { getTrialStatus, resetTrial, expireTrial } from "../utils/trialTimer";
import {
  setLifetimeOverride,
  getLifetimeOverride,
  getLifetimeAccessDiagnostics,
  type LifetimeAccessDiagnostics,
} from "../utils/paidAppDetector";
import { useSubscriptionContext } from "../contexts/SubscriptionContext";
import { useSubscription } from "../hooks/useSubscription";
import {
  exportQaTransferToFile,
  importQaTransferPayload,
  parseQaTransferText,
  type QaTransferImportMode,
} from "../utils/qaDataTransfer";

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
  const [transferStatus, setTransferStatus] = React.useState<string | null>(null);
  const [showImportJsonModal, setShowImportJsonModal] = React.useState(false);
  const [importJsonText, setImportJsonText] = React.useState("");
  const [pendingImportMode, setPendingImportMode] =
    React.useState<QaTransferImportMode | null>(null);
  const [importingJson, setImportingJson] = React.useState(false);
  const importJsonInputRef = React.useRef<TextInput | null>(null);
  const [isDeveloper, setIsDeveloper] = React.useState(false);
  const [deviceId, setDeviceId] = React.useState<string | null>(null);
  const [lifetimeOverride, setLifetimeOverrideState] = React.useState<boolean | null>(null);
  const [lifetimeDiagnostics, setLifetimeDiagnostics] =
    React.useState<LifetimeAccessDiagnostics | null>(null);

  const loadLifetimeDiagnostics = React.useCallback(async () => {
    const diagnostics = await getLifetimeAccessDiagnostics();
    setLifetimeDiagnostics(diagnostics);
    qaLog("lifetime", "Lifetime access diagnostics", {
      source: diagnostics?.source,
      effectiveAccess: diagnostics?.effectiveStatus.hasLifetimeAccess,
      detectionMethod: diagnostics?.effectiveStatus.detectionMethod,
      originalAppVersion: diagnostics?.effectiveStatus.originalAppVersion,
      originalPurchaseDate: diagnostics?.effectiveStatus.originalPurchaseDate,
      firstFreeBuild: diagnostics?.firstFreeBuildNumber,
      nativeAvailable: diagnostics?.nativeInfo?.available,
      nativeVerified: diagnostics?.nativeInfo?.verified,
      nativeReason: diagnostics?.nativeInfo?.reason ?? diagnostics?.nativeError,
      cachedStatusPresent: !!diagnostics?.cachedStatus,
    });
  }, []);

  // Load developer mode, device ID, and lifetime override on mount
  React.useEffect(() => {
    const loadDeviceInfo = async () => {
      const devMode = await isDeveloperDevice();
      setIsDeveloper(devMode);
      const id = await getOrCreateDeviceId();
      setDeviceId(id);
      const override = await getLifetimeOverride();
      setLifetimeOverrideState(override);
      await loadLifetimeDiagnostics();
    };
    void loadDeviceInfo();
  }, [loadLifetimeDiagnostics]);

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

  const chooseImportMode = React.useCallback((): Promise<QaTransferImportMode | null> => {
    return new Promise((resolve) => {
      Alert.alert(
        "Import mode",
        "Choose how to apply imported notebook entries and personal prayers.",
        [
          {
            text: "Cancel",
            style: "cancel",
            onPress: () => resolve(null),
          },
          {
            text: "Add",
            onPress: () => resolve("merge"),
          },
          {
            text: "Replace",
            style: "destructive",
            onPress: () => resolve("replace"),
          },
        ],
      );
    });
  }, []);

  const handleExportQaData = async () => {
    try {
      setTransferStatus("Preparing export...");
      const canShare = await Sharing.isAvailableAsync();
      const result = await exportQaTransferToFile();
      qaLog("qa-transfer", "Exported QA transfer file", {
        notebookCount: result.notebookCount,
        prayerCount: result.prayerCount,
        fileName: result.fileName,
      });

      if (!canShare) {
        setTransferStatus(
          `Exported ${result.notebookCount} notebook + ${result.prayerCount} prayer records`,
        );
        Alert.alert("Exported", `File saved at:\n${result.fileUri}`);
        return;
      }

      await Sharing.shareAsync(result.fileUri, {
        mimeType: "text/plain",
        UTI: "public.plain-text",
        dialogTitle: "Export QA Test Data",
      });
      setTransferStatus(
        `Exported ${result.notebookCount} notebook + ${result.prayerCount} prayer records`,
      );
    } catch (err) {
      const msg = err instanceof Error ? err.message : String(err);
      qaLog("qa-transfer", "Export failed", { error: msg });
      setTransferStatus(`Export failed: ${msg}`);
      Alert.alert("Export failed", msg);
    }
  };

  const handleImportQaData = async () => {
    const importMode = await chooseImportMode();
    if (!importMode) return;

    try {
      const clipboardRaw = await Clipboard.getString();
      setPendingImportMode(importMode);
      setImportJsonText(clipboardRaw ?? "");
      setShowImportJsonModal(true);
      setTransferStatus("Paste transfer JSON and tap Import.");
    } catch (err) {
      const msg = err instanceof Error ? err.message : String(err);
      qaLog("qa-transfer", "Import failed", { error: msg });
      setTransferStatus(`Import failed: ${msg}`);
      Alert.alert("Import failed", msg);
    }
  };

  const handlePasteFromClipboard = async () => {
    try {
      const clipboardRaw = await Clipboard.getString();
      if (!clipboardRaw?.trim()) {
        Alert.alert(
          "Clipboard is empty",
          "Copy the JSON text content (not the file itself), then tap 'Paste from Clipboard' again.",
        );
        return;
      }
      setImportJsonText(clipboardRaw ?? "");
    } catch {
      Alert.alert("Clipboard error", "Unable to read clipboard content.");
    }
  };

  React.useEffect(() => {
    if (!showImportJsonModal) return;
    const timer = setTimeout(() => {
      importJsonInputRef.current?.focus();
    }, 200);
    return () => clearTimeout(timer);
  }, [showImportJsonModal]);

  const handleConfirmImportJson = async () => {
    if (!pendingImportMode) return;
    if (!importJsonText.trim()) {
      Alert.alert("Import failed", "Paste transfer JSON before importing.");
      return;
    }

    setImportingJson(true);
    try {
      const validPayload = parseQaTransferText(importJsonText);
      const result = await importQaTransferPayload(validPayload, pendingImportMode);
      const verb = pendingImportMode === "merge" ? "Added" : "Imported";
      qaLog("qa-transfer", "Imported QA transfer from pasted JSON", {
        importMode: pendingImportMode,
        notebookAdded: result.notebookAdded,
        prayerAdded: result.prayerAdded,
        notebookCount: result.notebookCount,
        prayerCount: result.prayerCount,
      });

      setTransferStatus(
        pendingImportMode === "merge"
          ? `Added ${result.notebookAdded} notebook + ${result.prayerAdded} prayers (totals: ${result.notebookCount}/${result.prayerCount})`
          : `Imported ${result.notebookCount} notebook + ${result.prayerCount} prayer records`,
      );

      setShowImportJsonModal(false);
      setImportJsonText("");
      setPendingImportMode(null);

      Alert.alert(
        "Import complete",
        pendingImportMode === "merge"
          ? `${verb} ${result.notebookAdded} notebook entries and ${result.prayerAdded} personal prayers. Reload now to refresh all screens?`
          : `${verb} ${result.notebookCount} notebook entries and ${result.prayerCount} personal prayers. Reload now to refresh all screens?`,
        [
          { text: "Later", style: "cancel" },
          {
            text: "Reload now",
            onPress: () => {
              void Updates.reloadAsync();
            },
          },
        ],
      );
    } catch (err) {
      const msg = err instanceof Error ? err.message : String(err);
      qaLog("qa-transfer", "Import failed", { error: msg });
      setTransferStatus(`Import failed: ${msg}`);
      Alert.alert("Import failed", msg);
    } finally {
      setImportingJson(false);
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
    await loadLifetimeDiagnostics();
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
      <ScrollView contentContainerStyle={styles.scrollContent}>
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
        
        <View style={[styles.developerRow, { borderColor: colors.mist, backgroundColor: colors.surfaceContainerLowest }]}>
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

        <View style={[styles.stateBox, { backgroundColor: colors.surfaceContainerLowest, borderColor: colors.mist }]}>
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

        <View style={[styles.developerRow, { borderColor: colors.mist, backgroundColor: colors.surfaceContainerLowest }]}>
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

        <Text style={[styles.sectionHeader, { marginTop: 16, color: colors.deepTeal }]}>
          Data Transfer (QA)
        </Text>
        <View style={styles.actionsRow}>
          <TouchableOpacity
            style={[styles.secondaryButton, { borderColor: colors.deepTeal }]}
            activeOpacity={0.8}
            onPress={handleExportQaData}
          >
            <Text style={[styles.secondaryButtonText, { color: colors.deepTeal }]}>
              Export Notebook + Personal Prayers
            </Text>
          </TouchableOpacity>
          <TouchableOpacity
            style={[styles.secondaryButton, { borderColor: colors.deepTeal }]}
            activeOpacity={0.8}
            onPress={handleImportQaData}
          >
            <Text style={[styles.secondaryButtonText, { color: colors.deepTeal }]}>
              Import Notebook + Personal Prayers
            </Text>
          </TouchableOpacity>
          {transferStatus && (
            <Text style={[styles.meta, { width: "100%" }]}>{transferStatus}</Text>
          )}
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

        <View style={[styles.logContainer, styles.logContent]}>
        <Text style={[styles.sectionHeader, { marginTop: 12, color: colors.deepTeal }]}>QA Logs</Text>
        {logs.length === 0 ? (
          <Text style={styles.emptyText}>No QA log entries yet.</Text>
        ) : (
          logs.map((entry) => (
            <View key={entry.id} style={[styles.logEntry, { backgroundColor: colors.surfaceContainerLowest, borderColor: colors.mist }]}>
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
        </View>
      </ScrollView>

      <Modal
        visible={showImportJsonModal}
        transparent
        animationType="fade"
        onRequestClose={() => {
          if (!importingJson) setShowImportJsonModal(false);
        }}
      >
        <KeyboardAvoidingView
          style={styles.modalBackdrop}
          behavior={Platform.OS === "ios" ? "padding" : undefined}
          keyboardVerticalOffset={insets.bottom + 8}
        >
          <View style={[styles.modalCard, { backgroundColor: colors.modalBackground, borderColor: colors.modalBorder }]}>
            <Text style={[styles.modalTitle, { color: colors.text }]}>Paste Transfer JSON</Text>
            <Text style={[styles.modalSubtitle, { color: colors.textSecondary }]}>
              Paste exported QA JSON text (not the file), then tap Import.
            </Text>
            <TextInput
              ref={importJsonInputRef}
              style={[styles.modalInput, { color: colors.text, borderColor: colors.modalBorder }]}
              multiline
              value={importJsonText}
              onChangeText={setImportJsonText}
              autoCorrect={false}
              autoCapitalize="none"
              autoFocus
              editable={!importingJson}
              placeholder="Paste transfer JSON here..."
              placeholderTextColor={colors.textSecondary}
            />
            <View style={styles.modalActions}>
              <TouchableOpacity
                style={[styles.secondaryButton, { borderColor: colors.deepTeal }]}
                activeOpacity={0.8}
                disabled={importingJson}
                onPress={handlePasteFromClipboard}
              >
                <Text style={[styles.secondaryButtonText, { color: colors.deepTeal }]}>Paste from Clipboard</Text>
              </TouchableOpacity>
              <TouchableOpacity
                style={[styles.secondaryButton, { borderColor: colors.deepTeal }]}
                activeOpacity={0.8}
                disabled={importingJson}
                onPress={() => {
                  setShowImportJsonModal(false);
                  setPendingImportMode(null);
                }}
              >
                <Text style={[styles.secondaryButtonText, { color: colors.deepTeal }]}>Cancel</Text>
              </TouchableOpacity>
              <TouchableOpacity
                style={[styles.secondaryButton, { borderColor: colors.deepTeal }]}
                activeOpacity={0.8}
                disabled={importingJson}
                onPress={handleConfirmImportJson}
              >
                <Text style={[styles.secondaryButtonText, { color: colors.deepTeal }]}>
                  {importingJson ? "Importing..." : "Import"}
                </Text>
              </TouchableOpacity>
            </View>
          </View>
        </KeyboardAvoidingView>
      </Modal>
    </View>
  );
}

const styles = StyleSheet.create({
  container: {
    flex: 1,
  },
  scrollContent: {
    paddingBottom: 24,
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
    borderWidth: 1,
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
  modalBackdrop: {
    flex: 1,
    backgroundColor: "rgba(0,0,0,0.35)",
    justifyContent: "center",
    paddingHorizontal: 16,
  },
  modalCard: {
    borderWidth: 1,
    borderRadius: 12,
    padding: 12,
    maxHeight: "85%",
  },
  modalTitle: {
    fontFamily: fonts.headerFamily,
    fontSize: 18,
  },
  modalSubtitle: {
    marginTop: 4,
    marginBottom: 8,
    fontFamily: fonts.bodyFamilyRegular,
    fontSize: 13,
  },
  modalInput: {
    minHeight: 140,
    maxHeight: 240,
    borderWidth: 1,
    borderRadius: 8,
    paddingHorizontal: 10,
    paddingVertical: 8,
    textAlignVertical: "top",
    fontFamily: fonts.bodyFamilyRegular,
    fontSize: 12,
  },
  modalActions: {
    marginTop: 10,
    flexDirection: "row",
    gap: 8,
    flexWrap: "wrap",
  },
});


