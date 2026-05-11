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
import { Ionicons } from "@expo/vector-icons";
import Clipboard from "@react-native-clipboard/clipboard";
import AsyncStorage from "@react-native-async-storage/async-storage";
import * as Sharing from "expo-sharing";
import * as Notifications from "expo-notifications";
import { fonts, fallbackColors } from "../constants/theme";
import { clearQaLogs, useQaLogs, qaLog } from "../utils/qaLog";
import { resetRateShareTracking } from "../utils/rateShareTracking";
import { resetNotificationCoachmark } from "../utils/coachmarkStorage";
import { isDeveloperDevice, setDeveloperDevice, getOrCreateDeviceId } from "../utils/deviceIdentity";
import {
  getTrialStatus,
  getLegacyTrialMarker,
  resetTrial,
  expireTrial,
} from "../utils/trialTimer";
import {
  resetGrandfatherState,
  simulateGrandfatherGrant,
} from "../lib/grandfather";
import { SubscriberToLifetimeModal } from "../components/SubscriberToLifetimeModal";
import { GrandfatheredLifetimeModal } from "../components/GrandfatheredLifetimeModal";
import {
  setLifetimeOverride,
  getLifetimeOverride,
  clearLifetimeAccessCache,
  getLifetimeAccessDiagnostics,
} from "../utils/paidAppDetector";
import {
  getSubscriptionOverride,
  enableSubscriptionOverride,
  clearSubscriptionOverride,
} from "../utils/subscriptionOverride";
import { useSubscriptionContext } from "../contexts/SubscriptionContext";
import { QA_REFLECTION_IMAGE_OVERRIDE_KEY } from "./(tabs)/home";
import { useSubscription } from "../hooks/useSubscription";
import {
  getRawEntitlements,
  isRevenueCatInitialized,
  type RawEntitlements,
} from "../lib/subscription";
import RevenueCatUI from "react-native-purchases-ui";
import Purchases from "react-native-purchases";
import {
  exportQaTransferToFile,
  importQaTransferPayload,
  parseQaTransferText,
  type QaTransferImportMode,
} from "../utils/qaDataTransfer";

export default function QaLogsScreen() {
  // QA screen is dev-only and should always render in the light palette,
  // regardless of the user's theme setting.
  const colors = fallbackColors;
  const params = useLocalSearchParams<{
    checkAndApplyUpdate?: any;
  }>();
  const insets = useSafeAreaInsets();
  const logs = useQaLogs();
  const router = useRouter();
  const {
    trialStatus,
    refreshLifetimeAccess,
    gate,
    loading: subscriptionLoading,
    refresh: refreshSubscription,
  } = useSubscriptionContext();
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
  const [rcUserId, setRcUserId] = React.useState<string | null>(null);
  const [lifetimeOverride, setLifetimeOverrideState] = React.useState<boolean | null>(null);
  const [subscriptionOverride, setSubscriptionOverrideState] = React.useState<boolean>(false);
  const [refreshingLifetime, setRefreshingLifetime] = React.useState(false);
  const [reflectionImageInput, setReflectionImageInput] = React.useState("");
  const [reflectionImageStatus, setReflectionImageStatus] = React.useState<string | null>(null);
  // Direct-mount modal previews (bypass entitlement check so we can preview
  // copy/styling without setting up matching RC sandbox state).
  const [previewSubAnnual, setPreviewSubAnnual] = React.useState(false);
  const [previewSubMonthly, setPreviewSubMonthly] = React.useState(false);
  const [previewGrandfathered, setPreviewGrandfathered] = React.useState(false);
  // Raw RC entitlement details for the Access States panel — read directly
  // (not through the collapsed `getSubscriptionStatus()` view).
  const [rawEntitlements, setRawEntitlements] = React.useState<RawEntitlements | null>(null);
  const [refreshingEntitlements, setRefreshingEntitlements] = React.useState(false);
  const [presentingRcPaywall, setPresentingRcPaywall] = React.useState(false);
  const refreshRawEntitlements = React.useCallback(async () => {
    setRefreshingEntitlements(true);
    try {
      const raw = await getRawEntitlements();
      setRawEntitlements(raw);
    } finally {
      setRefreshingEntitlements(false);
    }
  }, []);
  React.useEffect(() => {
    void refreshRawEntitlements();
  }, [refreshRawEntitlements]);

  const getQaAccessSnapshot = React.useCallback(
    async (label: string) => {
      const [
        currentTrial,
        legacyTrialMarker,
        raw,
        overrideActive,
        grandfatherPending,
        grandfatherSeen,
        modalASeen,
      ] = await Promise.all([
        getTrialStatus(),
        getLegacyTrialMarker(),
        getRawEntitlements(),
        getSubscriptionOverride(),
        AsyncStorage.getItem("@daily_paths_grandfather_modal_pending"),
        AsyncStorage.getItem("@daily_paths_grandfather_modal_seen"),
        AsyncStorage.getItem("@daily_paths_modal_sub_to_lifetime_seen"),
      ]);

      const snapshot = {
        label,
        gate,
        subscriptionLoading,
        subscriptionStatus: subStatus,
        hasLifetimeAccess,
        trial: currentTrial,
        legacyTrialMarker,
        rawEntitlements: raw,
        qaSubscriptionOverrideActive: overrideActive,
        grandfatherFlags: {
          modalPending: grandfatherPending === "true",
          modalSeen: grandfatherSeen === "true",
        },
        modalASeen: modalASeen === "true",
        rcUserId,
        platform: Platform.OS,
      };
      qaLog("qa-snapshot", label, snapshot);
      return snapshot;
    },
    [gate, hasLifetimeAccess, rcUserId, subStatus, subscriptionLoading],
  );

  React.useEffect(() => {
    AsyncStorage.getItem(QA_REFLECTION_IMAGE_OVERRIDE_KEY)
      .then((value) => {
        if (value) {
          setReflectionImageInput(value);
          setReflectionImageStatus(`Override active: reflections-${value}.webp`);
        }
      })
      .catch(() => {});
  }, []);

  const handleSetReflectionImage = async () => {
    const trimmed = reflectionImageInput.trim().replace(/^reflections-/, "").replace(/\.webp$/, "");
    if (!/^\d+$/.test(trimmed)) {
      setReflectionImageStatus("Enter the image number (e.g. 33 for reflections-33.webp).");
      return;
    }
    await AsyncStorage.setItem(QA_REFLECTION_IMAGE_OVERRIDE_KEY, trimmed);
    setReflectionImageInput(trimmed);
    setReflectionImageStatus(`Override set to reflections-${trimmed}.webp. Reloading...`);
    setTimeout(() => Updates.reloadAsync().catch(() => {}), 250);
  };

  const handleClearReflectionImage = async () => {
    await AsyncStorage.removeItem(QA_REFLECTION_IMAGE_OVERRIDE_KEY);
    setReflectionImageInput("");
    setReflectionImageStatus("Override cleared. Reloading...");
    setTimeout(() => Updates.reloadAsync().catch(() => {}), 250);
  };

  // Load developer mode, device ID, and lifetime override on mount
  React.useEffect(() => {
    const loadDeviceInfo = async () => {
      const devMode = await isDeveloperDevice();
      setIsDeveloper(devMode);
      const id = await getOrCreateDeviceId();
      setDeviceId(id);
      const override = await getLifetimeOverride();
      setLifetimeOverrideState(override);
      const subOverride = await getSubscriptionOverride();
      setSubscriptionOverrideState(subOverride);
      try {
        const id = await Purchases.getAppUserID();
        setRcUserId(id);
      } catch {
        setRcUserId(null);
      }
    };
    void loadDeviceInfo();
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

  const handleResetNotificationCoachmark = async () => {
    try {
      await resetNotificationCoachmark();
      qaLog('coachmark', 'Notification coachmark flag cleared');
      alert('Notification coachmark has been reset. It will appear again on the next qualifying reading visit.');
    } catch (err) {
      qaLog('coachmark', 'Error resetting notification coachmark', { error: String(err) });
      alert('Failed to reset notification coachmark');
    }
  };

  const handleDumpScheduledNotifications = async () => {
    try {
      const all = await Notifications.getAllScheduledNotificationsAsync();

      // Build a list of { when, body } so we can detect duplicate trigger
      // times (the bug we just fixed scheduled both a one-time DATE trigger
      // and a repeating CALENDAR/DAILY trigger at the same minute).
      const items = all.map((n) => {
        const trigger = n.trigger as any;
        let when = 'unknown';
        if (trigger?.type === 'date' && (trigger.value || trigger.date)) {
          const v = trigger.value ?? trigger.date;
          when = new Date(typeof v === 'number' ? v : v).toLocaleString();
        } else if (trigger?.dateComponents) {
          const dc = trigger.dateComponents;
          when = `repeating ${dc.hour}:${String(dc.minute ?? 0).padStart(2, '0')}`;
        } else if (trigger?.hour != null) {
          when = `${trigger.type ?? 'repeating'} ${trigger.hour}:${String(trigger.minute ?? 0).padStart(2, '0')}`;
        } else {
          when = JSON.stringify(trigger);
        }
        return { when, body: n.content.body ?? '', id: n.identifier };
      });

      // Sort by trigger date string for readability
      items.sort((a, b) => a.when.localeCompare(b.when));

      qaLog('notifications', `Scheduled total: ${all.length}`);
      items.forEach((it, i) =>
        qaLog('notifications', `[${i + 1}] ${it.when} — ${it.body}`)
      );

      // Detect duplicate trigger times
      const dateCounts = new Map<string, number>();
      items.forEach((it) => dateCounts.set(it.when, (dateCounts.get(it.when) ?? 0) + 1));
      const dupes = Array.from(dateCounts.entries()).filter(([, c]) => c > 1);
      const dupMsg =
        dupes.length === 0
          ? '✓ No duplicate trigger times'
          : `⚠ Duplicates:\n${dupes.map(([d, c]) => `  ${d} (${c}x)`).join('\n')}`;

      if (dupes.length > 0) {
        qaLog('notifications', dupMsg);
      }

      Alert.alert(
        'Scheduled Notifications',
        `Total: ${all.length}\n${dupMsg}\n\nFull list written to QA logs below.`
      );
    } catch (err) {
      qaLog('notifications', 'Failed to dump scheduled notifications', { error: String(err) });
      Alert.alert('Error', 'Failed to read scheduled notifications. See logs.');
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
      const before = await getQaAccessSnapshot("before Reset trial");
      await resetTrial();
      await trialStatus.refresh();
      const after = await getQaAccessSnapshot("after Reset trial");
      qaLog("qa-action", "Reset trial", { before, after });
      alert("Trial reset. Restart the app to begin a fresh 3-day trial.");
    } catch (err) {
      qaLog("freemium", "Error resetting trial", { error: String(err) });
      alert("Failed to reset trial");
    }
  };

  const handleExpireTrial = async () => {
    try {
      const before = await getQaAccessSnapshot("before Expire trial");
      await expireTrial();
      await trialStatus.refresh();
      const after = await getQaAccessSnapshot("after Expire trial");
      qaLog("qa-action", "Expire trial", { before, after });
      alert(
        "Trial expired. The gate should switch to paywall; the RevenueCat paywall may open automatically. If not, leave this screen or background/foreground the app.",
      );
    } catch (err) {
      qaLog("freemium", "Error expiring trial", { error: String(err) });
      alert("Failed to expire trial");
    }
  };

  /** Direct-mount preview: opens the modal regardless of entitlement state.
   *  Use to verify copy/styling. Does not set the seen-flag, does not affect
   *  real production firing. */
  const handlePreviewGrandfatheredModal = () => {
    qaLog("qa-action", "Preview Modal B (UI only)");
    setPreviewGrandfathered(true);
  };

  const handlePreviewSubToLifetimeModalAnnual = () => {
    qaLog("qa-action", "Preview Modal A annual (UI only)");
    setPreviewSubAnnual(true);
  };

  const handlePreviewSubToLifetimeModalMonthly = () => {
    qaLog("qa-action", "Preview Modal A monthly (UI only)");
    setPreviewSubMonthly(true);
  };

  /** Clears the sub→lifetime modal seen flag so the *real* modal can fire
   *  again on the next launch — requires both `unlimited` AND `lifetime`
   *  entitlements active in RC for that user. */
  const handleResetSubToLifetimeSeenFlag = async () => {
    try {
      const before = await getQaAccessSnapshot("before Reset Modal A seen flag");
      await AsyncStorage.removeItem("@daily_paths_modal_sub_to_lifetime_seen");
      const after = await getQaAccessSnapshot("after Reset Modal A seen flag");
      qaLog("qa-action", "Reset Modal A seen flag", { before, after });
      Alert.alert(
        "Seen flag cleared",
        "On next launch, the real Modal A will fire if your RC user has both `unlimited` AND `lifetime` entitlements active.",
      );
    } catch (err) {
      qaLog("freemium", "Error clearing sub→lifetime modal flag", { error: String(err) });
      Alert.alert("Error", "Could not clear the modal seen flag.");
    }
  };

  /** Sets the grandfather modal-pending flag — used to test the modal
   *  presenter wiring when you don't want to invoke the edge function. */
  const handlePrimeGrandfatherModalPending = async () => {
    try {
      const before = await getQaAccessSnapshot("before Prime Modal B pending");
      await simulateGrandfatherGrant();
      const after = await getQaAccessSnapshot("after Prime Modal B pending");
      qaLog("qa-action", "Prime Modal B pending", { before, after });
      Alert.alert(
        "Pending flag set",
        "On next launch, the real Modal B will fire (Android only).",
      );
    } catch (err) {
      qaLog("freemium", "Error priming grandfather modal", { error: String(err) });
      Alert.alert("Error", "Could not prime the modal-pending flag.");
    }
  };

  const handleResetGrandfather = async () => {
    try {
      const before = await getQaAccessSnapshot("before Reset Grandfather state");
      await resetGrandfatherState();
      const after = await getQaAccessSnapshot("after Reset Grandfather state");
      qaLog("qa-action", "Reset Grandfather state", { before, after });
      Alert.alert(
        "Grandfather reset",
        "Local Modal B flags are cleared. The server-side grant status is not changed.",
      );
    } catch (err) {
      qaLog("freemium", "Error resetting grandfather", { error: String(err) });
      Alert.alert("Error", "Could not reset grandfather state.");
    }
  };

  const handleToggleLifetimeOverride = async () => {
    const before = await getQaAccessSnapshot("before Toggle iOS lifetime override");
    let nextOverride: boolean | null;
    if (lifetimeOverride === true) {
      // Currently forced on → turn off
      nextOverride = false;
    } else if (lifetimeOverride === false) {
      // Currently forced off → clear override (use receipt detection)
      nextOverride = null;
    } else {
      // No override → force on
      nextOverride = true;
    }
    await setLifetimeOverride(nextOverride);
    setLifetimeOverrideState(nextOverride);
    await refreshLifetimeAccess();
    const after = await getQaAccessSnapshot("after Toggle iOS lifetime override");
    qaLog("qa-action", "Toggle iOS lifetime override", {
      before,
      after,
      previousOverride: lifetimeOverride,
      nextOverride,
    });
  };

  // QA: force getSubscriptionStatus() to report "not subscribed" so the
  // Android paywall can be exercised even when the active RC entitlement
  // (rc_promo_lifetime, an active unlimited sub, etc.) would otherwise
  // grant premium. App reload clears any in-memory caches and re-runs
  // the gate decision with the override applied.
  const handleToggleSubscriptionOverride = async () => {
    const before = await getQaAccessSnapshot("before Toggle Force NOT subscribed");
    if (subscriptionOverride) {
      await clearSubscriptionOverride();
      setSubscriptionOverrideState(false);
      const after = await getQaAccessSnapshot("after Clear Force NOT subscribed");
      qaLog("qa-action", "Clear Force NOT subscribed", { before, after });
    } else {
      await enableSubscriptionOverride();
      setSubscriptionOverrideState(true);
      const after = await getQaAccessSnapshot("after Enable Force NOT subscribed");
      qaLog("qa-action", "Enable Force NOT subscribed", { before, after });
    }
    setTimeout(() => Updates.reloadAsync().catch(() => {}), 250);
  };

  const handlePresentRcPaywallFromQa = async () => {
    if (Platform.OS !== "android") return;
    const before = await getQaAccessSnapshot("before Present RC paywall from QA");
    if (subscriptionLoading) {
      qaLog("qa-action", "Present RC paywall blocked: subscription loading", { before });
      Alert.alert("Wait", "Subscription state is still loading.");
      return;
    }
    if (gate !== "paywall") {
      qaLog("qa-action", "Present RC paywall blocked: gate not paywall", { before });
      Alert.alert(
        "Gate is not paywall",
        "Current gate: " +
          gate +
          ". Expire the local 3-day trial (or wait), and ensure you are not entitled in RevenueCat—or enable Force NOT subscribed and let the app reload.",
      );
      return;
    }
    setPresentingRcPaywall(true);
    try {
      qaLog("qa-action", "Present RC paywall from QA", { before });
      const result = await RevenueCatUI.presentPaywall();
      qaLog("qa-action", "RC paywall from QA returned", { result });
      await refreshSubscription();
      await trialStatus.refresh();
      const after = await getQaAccessSnapshot("after Present RC paywall from QA");
      qaLog("qa-action", "Present RC paywall complete", { before, after, result });
    } catch (err) {
      const afterError = await getQaAccessSnapshot("after Present RC paywall error");
      qaLog("qa-action", "Present RC paywall error", {
        before,
        after: afterError,
        error: String(err),
      });
      Alert.alert("presentPaywall failed", String(err));
    } finally {
      setPresentingRcPaywall(false);
    }
  };

  const handleLogLifetimeDiagnostics = async () => {
    setRefreshingLifetime(true);
    try {
      await clearLifetimeAccessCache();
      await refreshLifetimeAccess();
      const d = await getLifetimeAccessDiagnostics();
      qaLog("lifetime", "Receipt diagnostics", {
        source: d?.source ?? null,
        effectiveAccess: d?.effectiveStatus.hasLifetimeAccess ?? null,
        detectionMethod: d?.effectiveStatus.detectionMethod ?? null,
        originalAppVersion: d?.effectiveStatus.originalAppVersion ?? null,
        originalPurchaseDate: d?.effectiveStatus.originalPurchaseDate ?? null,
        firstFreeBuild: d?.firstFreeBuildNumber ?? null,
        nativeAvailable: d?.nativeInfo?.available ?? null,
        nativeVerified: d?.nativeInfo?.verified ?? null,
        nativeReason: d?.nativeInfo?.reason ?? d?.nativeError ?? null,
        cachedStatusPresent: !!d?.cachedStatus,
      });
    } finally {
      setRefreshingLifetime(false);
    }
  };

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
        {rcUserId && (
          <TouchableOpacity
            activeOpacity={0.7}
            onPress={() => {
              Clipboard.setString(rcUserId);
              setCopyStatus("RC user ID copied");
              setTimeout(() => setCopyStatus(null), 1500);
            }}
          >
            <Text style={styles.meta}>
              RC User ID: {rcUserId} (tap to copy)
            </Text>
          </TouchableOpacity>
        )}
        
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

        {Platform.OS === "android" ? (
          <>
            <Text style={[styles.sectionHeader, { marginTop: 16, color: colors.deepTeal }]}>
              Android: gate and overrides
            </Text>
            <View style={[styles.playbookBlock, { borderColor: colors.mist }]}>
              <Text style={[styles.playbookLine, { color: colors.ink }]}>
                <Text style={styles.playbookBold}>App gate: </Text>
                {subscriptionLoading
                  ? "Loading…"
                  : gate === "paywall"
                    ? "PAYWALL (tabs not mounted)"
                    : "FULL ACCESS"}
              </Text>
              <Text style={[styles.playbookLine, { color: colors.ink }]}>
                <Text style={styles.playbookBold}>RevenueCat SDK: </Text>
                {isRevenueCatInitialized() ? "initialized" : "not initialized"}
              </Text>
              <Text style={[styles.playbookLine, { color: colors.ink }]}>
                <Text style={styles.playbookBold}>Force NOT subscribed (QA): </Text>
                {subscriptionOverride ? "ON (reloads app when toggled)" : "off"}
              </Text>
              <Text style={[styles.playbookHint, { color: colors.textSecondary }]}>
                Green rows below are real RC entitlements. The gate can still be PAYWALL if the QA override is on and the local trial is expired.
              </Text>
            </View>

            <Text style={[styles.sectionHeader, { marginTop: 16, color: colors.deepTeal }]}>
              Scenario playbook
            </Text>
            <View style={[styles.playbookBlock, { borderColor: colors.mist }]}>
              <Text style={[styles.playbookScenarioTitle, { color: colors.deepTeal }]}>A — Fresh 3-day trial</Text>
              <Text style={[styles.playbookBody, { color: colors.ink }]}>
                Clear Force NOT subscribed if on. Tap Reset trial, then fully kill the app and reopen. Expect full access.
              </Text>
              <Text style={[styles.playbookScenarioTitle, { color: colors.deepTeal }]}>B — Expired trial → paywall</Text>
              <Text style={[styles.playbookBody, { color: colors.ink }]}>
                Clear the override if needed. Tap Expire trial. Expect gate PAYWALL; root may present the RC paywall automatically.
              </Text>
              <Text style={[styles.playbookScenarioTitle, { color: colors.deepTeal }]}>C — RC entitled but must see paywall</Text>
              <Text style={[styles.playbookBody, { color: colors.ink }]}>
                Tap Force NOT subscribed (app reloads). Then Expire trial. RC rows can still show ✓ while gate stays PAYWALL.
              </Text>
              <Text style={[styles.playbookScenarioTitle, { color: colors.deepTeal }]}>D — Back to real RC state</Text>
              <Text style={[styles.playbookBody, { color: colors.ink }]}>
                Tap Restore (clear override) and reload. Refresh from RevenueCat to update the panel.
              </Text>
              <Text style={[styles.playbookScenarioTitle, { color: colors.deepTeal }]}>E — Real Modal A</Text>
              <Text style={[styles.playbookBody, { color: colors.ink }]}>
                RC user needs both unlimited + lifetime. Reset Modal A seen flag, then kill and reopen.
              </Text>
              <Text style={[styles.playbookScenarioTitle, { color: colors.deepTeal }]}>F — Grandfather / Modal B</Text>
              <Text style={[styles.playbookBody, { color: colors.ink }]}>
                Reset Grandfather state to retry the edge function. Prime Modal B only tests local wiring (no server).
              </Text>
              <Text style={[styles.playbookScenarioTitle, { color: colors.deepTeal }]}>G — Present RC paywall now</Text>
              <Text style={[styles.playbookBody, { color: colors.ink }]}>
                Use the button below only when gate is already PAYWALL (e.g. after B or C).
              </Text>
            </View>

            <View style={styles.actionsRow}>
              <TouchableOpacity
                style={[styles.secondaryButton, { borderColor: colors.deepTeal }]}
                activeOpacity={0.8}
                disabled={presentingRcPaywall}
                onPress={() => void handlePresentRcPaywallFromQa()}
              >
                <Text style={[styles.secondaryButtonText, { color: colors.deepTeal }]}>
                  {presentingRcPaywall ? "Presenting…" : "Present RC paywall now"}
                </Text>
              </TouchableOpacity>
            </View>
          </>
        ) : null}

        <Text style={[styles.sectionHeader, { marginTop: 16, color: colors.deepTeal }]}>
          Local 3-day trial (device storage)
        </Text>
        <Text style={[styles.playbookHint, { color: colors.textSecondary, marginBottom: 4 }]}>
          Reset: clears the start time — kill and reopen the app so a new trial begins. Expire: sets start in the past so the gate becomes paywall (if RC does not grant access).
        </Text>
        <View style={styles.actionsRow}>
          <TouchableOpacity
            style={[styles.secondaryButton, { borderColor: colors.deepTeal }]}
            activeOpacity={0.8}
            onPress={handleShowTrialStatus}
          >
            <Text style={[styles.secondaryButtonText, { color: colors.deepTeal }]}>Show trial status</Text>
          </TouchableOpacity>
          <TouchableOpacity
            style={[styles.secondaryButton, { borderColor: colors.deepTeal }]}
            activeOpacity={0.8}
            onPress={handleResetTrial}
          >
            <Text style={[styles.secondaryButtonText, { color: colors.deepTeal }]}>Reset trial</Text>
          </TouchableOpacity>
          <TouchableOpacity
            style={[styles.secondaryButton, { borderColor: colors.deepTeal }]}
            activeOpacity={0.8}
            onPress={handleExpireTrial}
          >
            <Text style={[styles.secondaryButtonText, { color: colors.deepTeal }]}>Expire trial</Text>
          </TouchableOpacity>
        </View>

        <Text style={[styles.sectionHeader, { marginTop: 16, color: colors.deepTeal }]}>
          QA overrides
        </Text>
        <Text style={[styles.playbookHint, { color: colors.textSecondary, marginBottom: 4 }]}>
          Force NOT subscribed makes getSubscriptionStatus() return false even if RC shows lifetime/subscription. Android: use with an expired trial to reach the paywall. Toggling reloads the app.
        </Text>
        <View style={styles.actionsRow}>
          {Platform.OS === "ios" ? (
            <TouchableOpacity
              style={[styles.secondaryButton, { borderColor: colors.deepTeal }]}
              activeOpacity={0.8}
              onPress={handleToggleLifetimeOverride}
            >
              <Text style={[styles.secondaryButtonText, { color: colors.deepTeal }]}>
                {lifetimeOverride === true
                  ? "Lifetime: Force OFF"
                  : lifetimeOverride === false
                    ? "Lifetime: Clear Override"
                    : "Lifetime: Force ON"}
              </Text>
            </TouchableOpacity>
          ) : (
            <Text style={[styles.playbookHint, { color: colors.textSecondary, flexBasis: "100%" }]}>
              Paid-download lifetime override: iOS only. On Android use RevenueCat entitlements + Force NOT subscribed.
            </Text>
          )}
          <TouchableOpacity
            style={[styles.secondaryButton, { borderColor: colors.deepTeal }]}
            activeOpacity={0.8}
            onPress={handleToggleSubscriptionOverride}
          >
            <Text style={[styles.secondaryButtonText, { color: colors.deepTeal }]}>
              {subscriptionOverride
                ? "Force NOT subscribed: OFF (reload)"
                : "Force NOT subscribed: ON (reload)"}
            </Text>
          </TouchableOpacity>
        </View>

        <Text style={[styles.sectionHeader, { marginTop: 16, color: colors.deepTeal }]}>Access States</Text>
        <View style={[styles.stateBox, { backgroundColor: "#fff", borderColor: colors.mist }]}>
          {Platform.OS === "ios" ? (
            <View style={styles.stateRow}>
              <Text style={[styles.stateIndicator, { color: hasLifetimeAccess ? "#16a34a" : colors.textSecondary }]}>
                {hasLifetimeAccess ? "\u2713" : "\u2717"}
              </Text>
              <Text style={[styles.stateLabel, { color: hasLifetimeAccess ? colors.ink : colors.textSecondary }]}>
                Paid Download (iOS receipt)
              </Text>
            </View>
          ) : null}
          {(() => {
            const has = rawEntitlements?.hasUnlimited ?? false;
            const product = rawEntitlements?.unlimitedProductIdentifier;
            const expIso = rawEntitlements?.unlimitedExpirationDate;
            const willRenew = rawEntitlements?.unlimitedWillRenew ?? false;
            const detail = has
              ? ` \u2014 ${product ?? "unknown"} (${willRenew ? "renews" : "expires"} ${
                  expIso ? new Date(expIso).toLocaleDateString() : "\u2014"
                })`
              : "";
            return (
              <View style={styles.stateRow}>
                <Text style={[styles.stateIndicator, { color: has ? "#16a34a" : colors.textSecondary }]}>
                  {has ? "\u2713" : "\u2717"}
                </Text>
                <Text style={[styles.stateLabel, { color: has ? colors.ink : colors.textSecondary }]}>
                  Subscription (unlimited){detail}
                </Text>
              </View>
            );
          })()}
          {(() => {
            const has = rawEntitlements?.hasLifetime ?? false;
            const product = rawEntitlements?.lifetimeProductIdentifier;
            const detail = has && product ? ` \u2014 ${product}` : "";
            return (
              <View style={styles.stateRow}>
                <Text style={[styles.stateIndicator, { color: has ? "#16a34a" : colors.textSecondary }]}>
                  {has ? "\u2713" : "\u2717"}
                </Text>
                <Text style={[styles.stateLabel, { color: has ? colors.ink : colors.textSecondary }]}>
                  Lifetime (lifetime){detail}
                </Text>
              </View>
            );
          })()}
          <View style={styles.stateRow}>
            <Text style={[styles.stateIndicator, { color: trialStatus.isInTrial ? "#16a34a" : colors.textSecondary }]}>
              {trialStatus.isInTrial ? "\u2713" : "\u2717"}
            </Text>
            <Text style={[styles.stateLabel, { color: trialStatus.isInTrial ? colors.ink : colors.textSecondary }]}>
              3-Day Trial{trialStatus.isInTrial
                ? ` (${trialStatus.daysRemaining}d remaining)`
                : trialStatus.trialExpired
                  ? " (expired)"
                  : trialStatus.neverStarted
                    ? " (not started)"
                    : ""}
            </Text>
          </View>
        </View>

        <View style={[styles.actionsRow, { marginTop: 8 }]}>
          <TouchableOpacity
            style={[styles.secondaryButton, { borderColor: colors.deepTeal }]}
            activeOpacity={0.8}
            onPress={() => void refreshRawEntitlements()}
            disabled={refreshingEntitlements}
          >
            <Text style={[styles.secondaryButtonText, { color: colors.deepTeal }]}>
              {refreshingEntitlements ? "Refreshing..." : "Refresh from RevenueCat"}
            </Text>
          </TouchableOpacity>
          <TouchableOpacity
            style={[styles.secondaryButton, { borderColor: colors.deepTeal }]}
            activeOpacity={0.8}
            onPress={handleLogLifetimeDiagnostics}
            disabled={refreshingLifetime}
          >
            <Text style={[styles.secondaryButtonText, { color: colors.deepTeal }]}>
              {refreshingLifetime ? "Logging..." : "Log Lifetime Diagnostics"}
            </Text>
          </TouchableOpacity>
        </View>

        <Text style={[styles.sectionHeader, { marginTop: 16, color: colors.deepTeal }]}>Modals</Text>
        <View style={styles.actionsRow}>
          <TouchableOpacity
            style={[styles.secondaryButton, { borderColor: colors.deepTeal }]}
            activeOpacity={0.8}
            onPress={handlePreviewSubToLifetimeModalAnnual}
          >
            <Text style={[styles.secondaryButtonText, { color: colors.deepTeal }]}>
              Preview Modal A (Annual)
            </Text>
          </TouchableOpacity>
          <TouchableOpacity
            style={[styles.secondaryButton, { borderColor: colors.deepTeal }]}
            activeOpacity={0.8}
            onPress={handlePreviewSubToLifetimeModalMonthly}
          >
            <Text style={[styles.secondaryButtonText, { color: colors.deepTeal }]}>
              Preview Modal A (Monthly)
            </Text>
          </TouchableOpacity>
          <TouchableOpacity
            style={[styles.secondaryButton, { borderColor: colors.deepTeal }]}
            activeOpacity={0.8}
            onPress={() => void handleResetSubToLifetimeSeenFlag()}
          >
            <Text style={[styles.secondaryButtonText, { color: colors.deepTeal }]}>
              Reset Modal A Seen Flag
            </Text>
          </TouchableOpacity>
          <TouchableOpacity
            style={[styles.secondaryButton, { borderColor: colors.deepTeal }]}
            activeOpacity={0.8}
            onPress={handlePreviewGrandfatheredModal}
          >
            <Text style={[styles.secondaryButtonText, { color: colors.deepTeal }]}>
              Preview Modal B (Grandfathered)
            </Text>
          </TouchableOpacity>
          <TouchableOpacity
            style={[styles.secondaryButton, { borderColor: colors.deepTeal }]}
            activeOpacity={0.8}
            onPress={() => void handlePrimeGrandfatherModalPending()}
          >
            <Text style={[styles.secondaryButtonText, { color: colors.deepTeal }]}>
              Prime Modal B Pending
            </Text>
          </TouchableOpacity>
          <TouchableOpacity
            style={[styles.secondaryButton, { borderColor: colors.deepTeal }]}
            activeOpacity={0.8}
            onPress={() => void handleResetGrandfather()}
          >
            <Text style={[styles.secondaryButtonText, { color: colors.deepTeal }]}>
              Reset Grandfather State
            </Text>
          </TouchableOpacity>
        </View>

        <Text style={[styles.sectionHeader, { marginTop: 16, color: colors.deepTeal }]}>Utilities</Text>
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
            onPress={handleResetNotificationCoachmark}
          >
            <Text style={[styles.secondaryButtonText, { color: colors.deepTeal }]}>Reset Notification Coachmark</Text>
          </TouchableOpacity>
          <TouchableOpacity
            style={[styles.secondaryButton, { borderColor: colors.deepTeal }]}
            activeOpacity={0.8}
            onPress={handleDumpScheduledNotifications}
          >
            <Text style={[styles.secondaryButtonText, { color: colors.deepTeal }]}>Dump Scheduled Notifications</Text>
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

        <Text style={[styles.sectionHeader, { marginTop: 16, color: colors.deepTeal }]}>
          Screenshot: Reflection Image
        </Text>
        <View style={styles.actionsRow}>
          <TextInput
            style={{
              flexBasis: "100%",
              borderWidth: 1,
              borderColor: colors.mist,
              borderRadius: 8,
              paddingHorizontal: 10,
              paddingVertical: 8,
              fontFamily: fonts.bodyFamilyRegular,
              fontSize: 14,
              color: colors.ink,
            }}
            placeholder="Image number (e.g. 33) or reflections-33.webp"
            placeholderTextColor="#9ca3af"
            autoCapitalize="none"
            autoCorrect={false}
            keyboardType="default"
            value={reflectionImageInput}
            onChangeText={setReflectionImageInput}
          />
          <TouchableOpacity
            style={[styles.secondaryButton, { borderColor: colors.deepTeal }]}
            activeOpacity={0.8}
            onPress={handleSetReflectionImage}
          >
            <Text style={[styles.secondaryButtonText, { color: colors.deepTeal }]}>
              Set & Reload
            </Text>
          </TouchableOpacity>
          <TouchableOpacity
            style={[styles.secondaryButton, { borderColor: colors.deepTeal }]}
            activeOpacity={0.8}
            onPress={handleClearReflectionImage}
          >
            <Text style={[styles.secondaryButtonText, { color: colors.deepTeal }]}>
              Clear & Reload
            </Text>
          </TouchableOpacity>
          {reflectionImageStatus && (
            <Text style={[styles.meta, { width: "100%" }]}>{reflectionImageStatus}</Text>
          )}
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
      </View>

        <View style={[styles.logContainer, styles.logContent]}>
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
        </View>
      </ScrollView>

      {/* Direct-mount modal previews — bypass entitlement state */}
      <SubscriberToLifetimeModal
        visible={previewSubAnnual}
        isAnnual={true}
        onClose={() => setPreviewSubAnnual(false)}
      />
      <SubscriberToLifetimeModal
        visible={previewSubMonthly}
        isAnnual={false}
        onClose={() => setPreviewSubMonthly(false)}
      />
      <GrandfatheredLifetimeModal
        visible={previewGrandfathered}
        onClose={() => setPreviewGrandfathered(false)}
      />

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
  playbookBlock: {
    marginTop: 4,
    paddingVertical: 10,
    paddingHorizontal: 12,
    borderRadius: 8,
    borderWidth: 1,
    backgroundColor: "#fff",
  },
  playbookLine: {
    fontFamily: fonts.bodyFamilyRegular,
    fontSize: 13,
    marginBottom: 6,
  },
  playbookBold: {
    fontFamily: fonts.bodyFamilySemiBold,
    fontSize: 13,
  },
  playbookHint: {
    fontFamily: fonts.bodyFamilyRegular,
    fontSize: 12,
    marginTop: 6,
    lineHeight: 17,
  },
  playbookScenarioTitle: {
    fontFamily: fonts.bodyFamilySemiBold,
    fontSize: 13,
    marginTop: 8,
    marginBottom: 2,
  },
  playbookBody: {
    fontFamily: fonts.bodyFamilyRegular,
    fontSize: 12,
    lineHeight: 17,
  },
  accordionHeaderRow: {
    flexDirection: "row",
    alignItems: "center",
    justifyContent: "space-between",
    marginTop: 16,
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


