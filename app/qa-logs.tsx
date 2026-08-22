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
  setLegacyTrialMarkerForQa,
  clearLegacyTrialMarkerForQa,
  resetTrial,
  expireTrial,
} from "../utils/trialTimer";
import {
  attemptGrandfatherGrantIfEligible,
} from "../lib/grandfather";
import { resetModalAcknowledgments } from "../lib/modalDecision";
import { revokeRcLifetime } from "../lib/revokeLifetime";
import { fetchQaGrantRows, type QaGrantRows } from "../lib/grantRows";
import { attemptSubscriberLifetimeGrantIfEligible, getSubscriberPlanFromRaw } from "../lib/subscriberMigration";
import { GrandfatheredLifetimeModal } from "../components/GrandfatheredLifetimeModal";
import { SubscriberToLifetimeModal } from "../components/SubscriberToLifetimeModal";
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
  clearLocalSubscriptionCache,
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
  const [supportStatus, setSupportStatus] = React.useState<string | null>(null);
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
  const [legacyMarkerText, setLegacyMarkerText] = React.useState<string | null>(null);
  const [lifetimeOverride, setLifetimeOverrideState] = React.useState<boolean | null>(null);
  const [subscriptionOverride, setSubscriptionOverrideState] = React.useState<boolean>(false);
  const [refreshingLifetime, setRefreshingLifetime] = React.useState(false);
  const [reflectionImageInput, setReflectionImageInput] = React.useState("");
  const [reflectionImageStatus, setReflectionImageStatus] = React.useState<string | null>(null);
  // Direct-mount modal previews (bypass entitlement check so we can preview
  // copy/styling without setting up matching RC sandbox state).
  const [previewGrandfathered, setPreviewGrandfathered] = React.useState(false);
  const [previewSubscriber, setPreviewSubscriber] = React.useState(false);
  // Raw RC entitlement details for the Access States panel — read directly
  // (not through the collapsed `getSubscriptionStatus()` view).
  const [rawEntitlements, setRawEntitlements] = React.useState<RawEntitlements | null>(null);
  const [refreshingEntitlements, setRefreshingEntitlements] = React.useState(false);
  const [presentingRcPaywall, setPresentingRcPaywall] = React.useState(false);
  const [revoking, setRevoking] = React.useState(false);
  const [grantRows, setGrantRows] = React.useState<QaGrantRows | null>(null);
  const [grantRowsLoading, setGrantRowsLoading] = React.useState(false);
  const [grantRowsView, setGrantRowsView] = React.useState<"grandfather" | "subscriber" | "trial_start" | null>(null);
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
      const legacyMarker = await getLegacyTrialMarker();
      setLegacyMarkerText(legacyMarker.trialStartDate);
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

  const describeAccess = (
    snapshot: Awaited<ReturnType<typeof getQaAccessSnapshot>>,
  ): string => {
    const raw = snapshot.rawEntitlements;
    if (raw.hasLifetime) return "Full access because RevenueCat shows Lifetime.";
    if (raw.hasUnlimited) return "Full access because RevenueCat shows an active subscription.";
    if (snapshot.gate === "paywall") return "Onboarding required: no lifetime purchase or active subscription.";
    return "Full access, but the exact reason needs review in the raw details below.";
  };

  const handleCopySupportReport = async () => {
    try {
      const snapshot = await getQaAccessSnapshot("Copy Support Report");
      const raw = snapshot.rawEntitlements;
      const lines = [
        "Daily Paths Support Report",
        "",
        `User: ${snapshot.rcUserId ?? "RevenueCat user ID not available"}`,
        `Platform: ${snapshot.platform}`,
        `App version: ${appVersion} (build ${iosBuildNumber})`,
        "",
        `Access: ${snapshot.gate === "paywall" ? "PAYWALL" : "FULL ACCESS"}`,
        `Why: ${describeAccess(snapshot)}`,
        "",
        `RevenueCat subscription: ${raw.hasUnlimited ? "YES" : "no"}`,
        `Subscription product: ${raw.unlimitedProductIdentifier ?? "none"}`,
        `Subscriber type: ${raw.hasUnlimited ? getSubscriberPlanFromRaw(raw) : "none"}`,
        `RevenueCat lifetime: ${raw.hasLifetime ? "YES" : "no"}`,
        `Lifetime product: ${raw.lifetimeProductIdentifier ?? "none"}`,
        "",
        `Legacy trial marker (does not grant access): ${
          snapshot.trial.isInTrial
            ? `active, ${snapshot.trial.daysRemaining} day(s) left`
            : snapshot.trial.trialExpired
              ? "expired"
              : "not started"
        }`,
        `Old app marker: ${
          snapshot.legacyTrialMarker.hasValidMarker
            ? `present (${snapshot.legacyTrialMarker.trialStartDate})`
            : "missing"
        }`,
        "",
        `Grandfather modal seen: ${snapshot.grandfatherFlags.modalSeen ? "yes" : "no"}`,
        `Subscriber-to-lifetime modal seen: ${snapshot.modalASeen ? "yes" : "no"}`,
        `Force NOT subscribed override: ${snapshot.qaSubscriptionOverrideActive ? "ON" : "off"}`,
      ];
      Clipboard.setString(lines.join("\n"));
      setSupportStatus("Support report copied");
      setCopyStatus("Support report copied");
      qaLog("qa-action", "Copied support report", { snapshot });
    } catch (err) {
      const msg = err instanceof Error ? err.message : String(err);
      setSupportStatus(`Support report failed: ${msg}`);
      qaLog("qa-action", "Copy support report failed", { error: msg });
      Alert.alert("Could not copy support report", msg);
    }
  };

  const handleClearLocalAccessCache = async () => {
    try {
      const before = await getQaAccessSnapshot("before Clear local access cache");
      await clearLocalSubscriptionCache();
      await clearLifetimeAccessCache();
      await refreshSubscription();
      await refreshRawEntitlements();
      const after = await getQaAccessSnapshot("after Clear local access cache");
      qaLog("qa-action", "Clear local access cache", { before, after });
      Alert.alert(
        "Local access cache cleared",
        "This only clears what the app stored locally. It does not remove a RevenueCat lifetime entitlement or a Google Play purchase. If Lifetime shows again after refresh, it is coming from RevenueCat or Google Play.",
      );
    } catch (err) {
      qaLog("qa-action", "Clear local access cache failed", { error: String(err) });
      Alert.alert("Could not clear local access cache", String(err));
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
      alert("Legacy trial marker reset. This does not grant access in 2.8.");
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
      alert("Legacy trial marker expired. This does not change access in 2.8.");
    } catch (err) {
      qaLog("freemium", "Error expiring trial", { error: String(err) });
      alert("Failed to expire trial");
    }
  };

  const handleSetOldAppMarker = async () => {
    try {
      const before = await getQaAccessSnapshot("before Set old app marker");
      const marker = await setLegacyTrialMarkerForQa();
      setLegacyMarkerText(marker);
      const after = await getQaAccessSnapshot("after Set old app marker");
      qaLog("qa-action", "Set old app marker", { before, after, marker });
      Alert.alert(
        "Old app marker set",
        "This device now looks like it opened the old 2.6.x app. Use this only for grandfather testing.",
      );
    } catch (err) {
      qaLog("qa-action", "Set old app marker failed", { error: String(err) });
      Alert.alert("Error", "Could not set the old app marker.");
    }
  };

  const handleClearOldAppMarker = async () => {
    try {
      const before = await getQaAccessSnapshot("before Clear old app marker");
      await clearLegacyTrialMarkerForQa();
      setLegacyMarkerText(null);
      const after = await getQaAccessSnapshot("after Clear old app marker");
      qaLog("qa-action", "Clear old app marker", { before, after });
      Alert.alert(
        "Old app marker cleared",
        "This device now looks like a new 2.7 install for grandfather testing.",
      );
    } catch (err) {
      qaLog("qa-action", "Clear old app marker failed", { error: String(err) });
      Alert.alert("Error", "Could not clear the old app marker.");
    }
  };

  const handleRunGrandfatherCheck = async () => {
    try {
      const before = await getQaAccessSnapshot("before Run grandfather check");
      const granted = await attemptGrandfatherGrantIfEligible();
      await refreshSubscription();
      await refreshRawEntitlements();
      const after = await getQaAccessSnapshot("after Run grandfather check");
      qaLog("qa-action", "Run grandfather check", { before, after, granted });
      Alert.alert(
        "Grandfather check complete",
        granted
          ? "Lifetime was granted. Check RevenueCat and the Supabase grandfather table."
          : "No new grant happened. Check the support report/logs for the likely reason: missing old marker, active subscription, already lifetime, or server denial.",
      );
    } catch (err) {
      qaLog("qa-action", "Run grandfather check failed", { error: String(err) });
      Alert.alert("Grandfather check failed", String(err));
    }
  };

  const handleRunSubscriberMigration = async () => {
    try {
      const before = await getQaAccessSnapshot("before Run subscriber-to-lifetime check");
      const raw = await getRawEntitlements();
      if (!raw.hasUnlimited) {
        Alert.alert(
          "No active subscription",
          "RevenueCat does not show an active subscription for this user, so there is no subscriber migration to run.",
        );
        qaLog("qa-action", "Subscriber migration blocked: no active subscription", { before, raw });
        return;
      }
      if (raw.hasLifetime) {
        Alert.alert(
          "Already lifetime",
          "RevenueCat already shows Lifetime. You can cancel the Play subscription renewal after matching the order.",
        );
        qaLog("qa-action", "Subscriber migration skipped: already lifetime", { before, raw });
        return;
      }

      const migrated = await attemptSubscriberLifetimeGrantIfEligible(raw);
      await refreshSubscription();
      await refreshRawEntitlements();
      const after = await getQaAccessSnapshot("after Run subscriber-to-lifetime check");
      qaLog("qa-action", "Run subscriber-to-lifetime check", { before, after, migrated });
      Alert.alert(
        "Subscriber check complete",
        migrated
          ? "Lifetime was granted or already confirmed. Use the Supabase subscriber table to match the Play order timestamp, then cancel renewal."
          : "No migration happened. Check logs/Supabase for the denial or failure reason.",
      );
    } catch (err) {
      qaLog("qa-action", "Run subscriber-to-lifetime check failed", { error: String(err) });
      Alert.alert("Subscriber check failed", String(err));
    }
  };

  /** Direct-mount preview: opens the modal regardless of entitlement state.
   *  Use to verify copy/styling. Does not set the seen-flag, does not affect
   *  real production firing. */
  const handlePreviewGrandfatheredModal = () => {
    qaLog("qa-action", "Preview grandfather modal (UI only)");
    setPreviewGrandfathered(true);
  };

  const handlePreviewSubscriberModal = () => {
    qaLog("qa-action", "Preview subscriber-to-lifetime modal (UI only)");
    setPreviewSubscriber(true);
  };

  const handleRevokeRcLifetime = async () => {
    Alert.alert(
      "Revoke RC lifetime?",
      "This calls the RevenueCat server and revokes promotional `lifetime` entitlements for this user. Real $4.99 IAP lifetime is not affected. Modal acknowledgments are cleared so flows can be replayed. Continue?",
      [
        { text: "Cancel", style: "cancel" },
        {
          text: "Revoke",
          style: "destructive",
          onPress: async () => {
            setRevoking(true);
            try {
              const before = await getQaAccessSnapshot("before Revoke RC lifetime");
              const result = await revokeRcLifetime();
              await refreshSubscription();
              await refreshRawEntitlements();
              const after = await getQaAccessSnapshot("after Revoke RC lifetime");
              qaLog("qa-action", "Revoke RC lifetime", { before, after, result });
              const failureDetail = [
                result.rcStatus ? `RC ${result.rcStatus}` : null,
                result.reason ?? "unknown",
                result.rcBody ? `\n\n${result.rcBody}` : null,
              ]
                .filter(Boolean)
                .join(": ")
                .replace(": \n\n", "\n\n");
              Alert.alert(
                result.ok ? "Lifetime revoked" : "Revoke failed",
                result.ok
                  ? "RC lifetime has been revoked and modal acknowledgments cleared. Pull-to-refresh access status to confirm."
                  : `Reason: ${failureDetail}`,
              );
            } finally {
              setRevoking(false);
            }
          },
        },
      ],
    );
  };

  const handleViewGrantRows = async () => {
    setGrantRowsLoading(true);
    try {
      const rows = await fetchQaGrantRows();
      setGrantRows(rows);
      if (!rows) {
        Alert.alert("Could not load rows", "The edge function call failed. Check QA logs.");
      }
    } finally {
      setGrantRowsLoading(false);
    }
  };

  const handleScenarioFreshUser = async () => {
    const before = await getQaAccessSnapshot("before Scenario: Fresh 2.7 user");
    await clearLegacyTrialMarkerForQa();
    setLegacyMarkerText(null);
    await resetTrial();
    await AsyncStorage.removeItem("@daily_paths_first_launch_modal_seen");
    await clearSubscriptionOverride();
    setSubscriptionOverrideState(false);
    await setLifetimeOverride(null);
    setLifetimeOverrideState(null);
    const after = await getQaAccessSnapshot("after Scenario: Fresh 2.7 user");
    qaLog("qa-action", "Scenario: Fresh 2.7 user", { before, after });
    setTimeout(() => Updates.reloadAsync().catch(() => {}), 250);
  };

  const handleScenarioExpiredTrial = async () => {
    const before = await getQaAccessSnapshot("before Scenario: Expired trial");
    await clearLegacyTrialMarkerForQa();
    setLegacyMarkerText(null);
    await expireTrial();
    await trialStatus.refresh();
    if (rawEntitlements?.hasUnlimited || rawEntitlements?.hasLifetime) {
      Alert.alert(
        "Heads-up",
        "Trial is expired but RC still shows an entitlement. The gate will stay FULL ACCESS until you revoke the entitlement or enable Force NOT subscribed.",
      );
    }
    const after = await getQaAccessSnapshot("after Scenario: Expired trial");
    qaLog("qa-action", "Scenario: Expired trial", { before, after });
    setTimeout(() => Updates.reloadAsync().catch(() => {}), 250);
  };

  /**
   * Simulate the experience of an old 2.6.5 free user updating to 2.7:
   *   - legacy marker present (proves they opened 2.6.x)
   *   - no 2.7 trial yet
   *   - no RC promotional lifetime (so the grandfather grant has work to do)
   *   - server modal acks cleared (so Modal B will fire)
   *
   * On reload, the grandfather check runs, RC gets the lifetime entitlement,
   * `which-modal` returns `grandfathered`, and the trial-start gate skips
   * `ensureTrialStarted()` because the user is now entitled.
   */
  const handleScenarioGrandfatherUpgrade = async () => {
    Alert.alert(
      "Simulate 2.6.5 → 2.7 upgrade?",
      "Sets the old-app marker, clears the 2.7 trial, revokes any RC promotional lifetime, and clears server modal acknowledgments — then reloads. Expected on next launch: grandfather grant fires, RC shows lifetime, Modal B appears, and no 3-day trial runs.",
      [
        { text: "Cancel", style: "cancel" },
        {
          text: "Simulate upgrade",
          onPress: async () => {
            const before = await getQaAccessSnapshot("before Scenario: 2.6.5 upgrade");
            const marker = await setLegacyTrialMarkerForQa();
            setLegacyMarkerText(marker);
            await resetTrial();
            await AsyncStorage.removeItem("@daily_paths_first_launch_modal_seen");
            await clearSubscriptionOverride();
            setSubscriptionOverrideState(false);
            await setLifetimeOverride(null);
            setLifetimeOverrideState(null);
            await clearLocalSubscriptionCache();
            await clearLifetimeAccessCache();
            // Always attempt revoke — it only affects promotional grants, never
            // real $4.99 IAP purchases. No-op if there's nothing to revoke.
            await revokeRcLifetime();
            await resetModalAcknowledgments();
            const after = await getQaAccessSnapshot("after Scenario: 2.6.5 upgrade");
            qaLog("qa-action", "Scenario: 2.6.5 → 2.7 upgrade", { before, after });
            setTimeout(() => Updates.reloadAsync().catch(() => {}), 250);
          },
        },
      ],
    );
  };

  const handleScenarioPristineReset = async () => {
    Alert.alert(
      "Pristine reset?",
      "Wipes every trial / marker / modal-ack / override key on this device AND revokes any RC promotional lifetime. Continue?",
      [
        { text: "Cancel", style: "cancel" },
        {
          text: "Reset everything",
          style: "destructive",
          onPress: async () => {
            const before = await getQaAccessSnapshot("before Scenario: Pristine reset");
            await clearLegacyTrialMarkerForQa();
            setLegacyMarkerText(null);
            await resetTrial();
            await AsyncStorage.removeItem("@daily_paths_first_launch_modal_seen");
            await clearSubscriptionOverride();
            setSubscriptionOverrideState(false);
            await setLifetimeOverride(null);
            setLifetimeOverrideState(null);
            await clearLocalSubscriptionCache();
            await clearLifetimeAccessCache();
            if (rawEntitlements?.hasLifetime) {
              await revokeRcLifetime();
            }
            await resetModalAcknowledgments();
            const after = await getQaAccessSnapshot("after Scenario: Pristine reset");
            qaLog("qa-action", "Scenario: Pristine reset", { before, after });
            setTimeout(() => Updates.reloadAsync().catch(() => {}), 250);
          },
        },
      ],
    );
  };

  const handleResetModalAcknowledgments = async () => {
    try {
      const before = await getQaAccessSnapshot("before Reset Modal Acknowledgments");
      const ok = await resetModalAcknowledgments();
      await refreshSubscription();
      await refreshRawEntitlements();
      const after = await getQaAccessSnapshot("after Reset Modal Acknowledgments");
      qaLog("qa-action", "Reset Modal Acknowledgments", { before, after, ok });
      Alert.alert(
        ok ? "Acknowledgments cleared" : "Reset failed",
        ok
          ? "Server modal_acknowledged_at columns were cleared. On next launch the appropriate modal (A or B) will fire if RevenueCat entitlements qualify."
          : "Could not reach the edge function. Check QA logs for details.",
      );
    } catch (err) {
      qaLog("qa-action", "Reset Modal Acknowledgments failed", { error: String(err) });
      Alert.alert("Error", String(err));
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

        <Text style={[styles.sectionHeader, { marginTop: 16, color: colors.deepTeal }]}>
          Troubleshoot a user
        </Text>
        <View style={[styles.playbookBlock, { borderColor: colors.mist }]}>
          <Text style={[styles.plainStatusTitle, { color: gate === "paywall" ? "#b91c1c" : "#166534" }]}>
            {subscriptionLoading
              ? "Checking access..."
              : gate === "paywall"
                ? "This user is blocked by the paywall"
                : "This user has full access"}
          </Text>
          <Text style={[styles.playbookLine, { color: colors.ink }]}>
            <Text style={styles.playbookBold}>Why: </Text>
            {rawEntitlements?.hasLifetime
              ? "RevenueCat shows Lifetime."
              : rawEntitlements?.hasUnlimited
                ? "RevenueCat shows an active subscription."
                : gate === "paywall"
                    ? "No lifetime purchase or active subscription."
                    : "Refresh the status to confirm the exact reason."}
          </Text>
          <Text style={[styles.playbookLine, { color: colors.ink }]}>
            <Text style={styles.playbookBold}>What to copy for support: </Text>
            RevenueCat user ID, access reason, subscription/lifetime status, trial status, old app marker, and modal seen flags.
          </Text>
          <Text style={[styles.playbookHint, { color: colors.textSecondary }]}>
            To check whether Lifetime is only stuck locally, tap Clear Local Access Cache. If Lifetime comes back after refresh, it is not local cache; it is RevenueCat or Google Play.
          </Text>
          <View style={styles.actionsRow}>
            <TouchableOpacity
              style={[styles.secondaryButton, { borderColor: colors.deepTeal }]}
              activeOpacity={0.8}
              onPress={() => void handleCopySupportReport()}
            >
              <Text style={[styles.secondaryButtonText, { color: colors.deepTeal }]}>
                Copy Support Report
              </Text>
            </TouchableOpacity>
            <TouchableOpacity
              style={[styles.secondaryButton, { borderColor: colors.deepTeal }]}
              activeOpacity={0.8}
              onPress={() => {
                void refreshSubscription();
                void refreshRawEntitlements();
              }}
            >
              <Text style={[styles.secondaryButtonText, { color: colors.deepTeal }]}>
                Refresh Access Status
              </Text>
            </TouchableOpacity>
            <TouchableOpacity
              style={[styles.secondaryButton, { borderColor: colors.deepTeal }]}
              activeOpacity={0.8}
              onPress={() => void handleClearLocalAccessCache()}
            >
              <Text style={[styles.secondaryButtonText, { color: colors.deepTeal }]}>
                Clear Local Access Cache
              </Text>
            </TouchableOpacity>
          </View>
          {supportStatus ? (
            <Text style={[styles.meta, { width: "100%" }]}>{supportStatus}</Text>
          ) : null}
        </View>

        <Text style={[styles.sectionHeader, { marginTop: 16, color: colors.deepTeal }]}>
          Set up test users
        </Text>
        <View style={[styles.playbookBlock, { borderColor: colors.mist }]}>
          <Text style={[styles.playbookLine, { color: colors.ink }]}>
            <Text style={styles.playbookBold}>Old app marker: </Text>
            {legacyMarkerText ? `present (${legacyMarkerText})` : "missing"}
          </Text>
          <Text style={[styles.playbookHint, { color: colors.textSecondary }]}>
            Set the old app marker to test grandfathering. Clear it to test a brand-new 2.7 user.
          </Text>
          <View style={styles.actionsRow}>
            <TouchableOpacity
              style={[styles.secondaryButton, { borderColor: colors.deepTeal }]}
              activeOpacity={0.8}
              onPress={() => void handleSetOldAppMarker()}
            >
              <Text style={[styles.secondaryButtonText, { color: colors.deepTeal }]}>
                Set Old App Marker
              </Text>
            </TouchableOpacity>
            <TouchableOpacity
              style={[styles.secondaryButton, { borderColor: colors.deepTeal }]}
              activeOpacity={0.8}
              onPress={() => void handleClearOldAppMarker()}
            >
              <Text style={[styles.secondaryButtonText, { color: colors.deepTeal }]}>
                Clear Old App Marker
              </Text>
            </TouchableOpacity>
            <TouchableOpacity
              style={[styles.secondaryButton, { borderColor: colors.deepTeal }]}
              activeOpacity={0.8}
              onPress={() => void handleRunGrandfatherCheck()}
            >
              <Text style={[styles.secondaryButtonText, { color: colors.deepTeal }]}>
                Run Grandfather Check
              </Text>
            </TouchableOpacity>
            <TouchableOpacity
              style={[styles.secondaryButton, { borderColor: colors.deepTeal }]}
              activeOpacity={0.8}
              onPress={() => void handleRunSubscriberMigration()}
            >
              <Text style={[styles.secondaryButtonText, { color: colors.deepTeal }]}>
                Run Subscriber-to-Lifetime Check
              </Text>
            </TouchableOpacity>
            {Platform.OS === "android" ? (
              <TouchableOpacity
                style={[styles.secondaryButton, { borderColor: "#b91c1c" }]}
                activeOpacity={0.8}
                disabled={revoking}
                onPress={() => void handleRevokeRcLifetime()}
              >
                <Text style={[styles.secondaryButtonText, { color: "#b91c1c" }]}>
                  {revoking ? "Revoking…" : "Revoke RC lifetime (QA only)"}
                </Text>
              </TouchableOpacity>
            ) : null}
          </View>

          {Platform.OS === "android" ? (
            <>
              <Text style={[styles.playbookLine, { color: colors.ink, marginTop: 10 }]}>
                <Text style={styles.playbookBold}>Scenarios: </Text>one-tap composite setups (reloads the app).
              </Text>
              <View style={styles.actionsRow}>
                <TouchableOpacity
                  style={[styles.secondaryButton, { borderColor: colors.deepTeal }]}
                  activeOpacity={0.8}
                  onPress={() => void handleScenarioFreshUser()}
                >
                  <Text style={[styles.secondaryButtonText, { color: colors.deepTeal }]}>
                    Scenario: Fresh 2.7 user
                  </Text>
                </TouchableOpacity>
                <TouchableOpacity
                  style={[styles.secondaryButton, { borderColor: colors.deepTeal }]}
                  activeOpacity={0.8}
                  onPress={() => void handleScenarioExpiredTrial()}
                >
                  <Text style={[styles.secondaryButtonText, { color: colors.deepTeal }]}>
                    Scenario: Expired trial
                  </Text>
                </TouchableOpacity>
                <TouchableOpacity
                  style={[styles.secondaryButton, { borderColor: colors.deepTeal }]}
                  activeOpacity={0.8}
                  onPress={() => void handleScenarioGrandfatherUpgrade()}
                >
                  <Text style={[styles.secondaryButtonText, { color: colors.deepTeal }]}>
                    Scenario: 2.6.5 → 2.7 upgrade
                  </Text>
                </TouchableOpacity>
                <TouchableOpacity
                  style={[styles.secondaryButton, { borderColor: "#b91c1c" }]}
                  activeOpacity={0.8}
                  onPress={() => void handleScenarioPristineReset()}
                >
                  <Text style={[styles.secondaryButtonText, { color: "#b91c1c" }]}>
                    Scenario: Pristine reset
                  </Text>
                </TouchableOpacity>
              </View>

              <Text style={[styles.playbookLine, { color: colors.ink, marginTop: 10 }]}>
                <Text style={styles.playbookBold}>View grant rows: </Text>read this device's server records.
              </Text>
              <View style={styles.actionsRow}>
                <TouchableOpacity
                  style={[styles.secondaryButton, { borderColor: colors.deepTeal }]}
                  activeOpacity={0.8}
                  disabled={grantRowsLoading}
                  onPress={() => void handleViewGrantRows()}
                >
                  <Text style={[styles.secondaryButtonText, { color: colors.deepTeal }]}>
                    {grantRowsLoading ? "Loading…" : "Load my grant rows"}
                  </Text>
                </TouchableOpacity>
                {grantRows ? (
                  <>
                    <TouchableOpacity
                      style={[styles.secondaryButton, { borderColor: colors.deepTeal }]}
                      activeOpacity={0.8}
                      onPress={() => setGrantRowsView("grandfather")}
                    >
                      <Text style={[styles.secondaryButtonText, { color: colors.deepTeal }]}>
                        Grandfather row
                      </Text>
                    </TouchableOpacity>
                    <TouchableOpacity
                      style={[styles.secondaryButton, { borderColor: colors.deepTeal }]}
                      activeOpacity={0.8}
                      onPress={() => setGrantRowsView("subscriber")}
                    >
                      <Text style={[styles.secondaryButtonText, { color: colors.deepTeal }]}>
                        Subscriber row
                      </Text>
                    </TouchableOpacity>
                    <TouchableOpacity
                      style={[styles.secondaryButton, { borderColor: colors.deepTeal }]}
                      activeOpacity={0.8}
                      onPress={() => setGrantRowsView("trial_start")}
                    >
                      <Text style={[styles.secondaryButtonText, { color: colors.deepTeal }]}>
                        Trial-start row
                      </Text>
                    </TouchableOpacity>
                  </>
                ) : null}
              </View>
              {grantRows && grantRowsView ? (
                <View style={[styles.playbookBlock, { borderColor: colors.mist, marginTop: 8 }]}>
                  <Text style={[styles.playbookBold, { color: colors.ink }]}>
                    {grantRowsView === "grandfather"
                      ? "android_grandfather_grants"
                      : grantRowsView === "subscriber"
                        ? "android_subscriber_lifetime_grants"
                        : "android_trial_starts"}
                  </Text>
                  <Text style={[styles.playbookBody, { color: colors.ink, fontFamily: fonts.bodyFamilyRegular }]}>
                    {JSON.stringify(
                      grantRowsView === "grandfather"
                        ? grantRows.grandfather
                        : grantRowsView === "subscriber"
                          ? grantRows.subscriber
                          : grantRows.trialStart,
                      null,
                      2,
                    ) || "no row"}
                  </Text>
                </View>
              ) : null}
            </>
          ) : null}
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
                Green rows below are real RC entitlements. The gate can still require onboarding if the QA override is on. Legacy trial state never grants access in 2.8.
              </Text>
            </View>

            <Text style={[styles.sectionHeader, { marginTop: 16, color: colors.deepTeal }]}>
              Scenario playbook
            </Text>
            <View style={[styles.playbookBlock, { borderColor: colors.mist }]}>
              <Text style={[styles.playbookScenarioTitle, { color: colors.deepTeal }]}>A — Fresh unentitled install</Text>
              <Text style={[styles.playbookBody, { color: colors.ink }]}>
                Clear local access state, then fully kill the app and reopen. Expect onboarding page 1, not full access.
              </Text>
              <Text style={[styles.playbookScenarioTitle, { color: colors.deepTeal }]}>B — Onboarding → checkout</Text>
              <Text style={[styles.playbookBody, { color: colors.ink }]}>
                Continue to page 2 or tap Skip. Expect the RevenueCat paywall only after that explicit action.
              </Text>
              <Text style={[styles.playbookScenarioTitle, { color: colors.deepTeal }]}>C — RC entitled but must see paywall</Text>
              <Text style={[styles.playbookBody, { color: colors.ink }]}>
                Tap Force NOT subscribed (app reloads). RC rows can still show ✓ while the app shows onboarding.
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
                Use the button below only when the gate already requires onboarding.
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
          Legacy trial marker (device storage; no access)
        </Text>
        <Text style={[styles.playbookHint, { color: colors.textSecondary, marginBottom: 4 }]}>
          Retained only for upgrade diagnostics. Resetting or expiring this marker does not change access in 2.8.
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
          Force NOT subscribed makes getSubscriptionStatus() return false even if RC shows lifetime/subscription. Android then shows onboarding. Toggling reloads the app.
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
              Legacy Trial Marker{trialStatus.isInTrial
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
            onPress={handlePreviewGrandfatheredModal}
          >
            <Text style={[styles.secondaryButtonText, { color: colors.deepTeal }]}>
              Preview Grandfather Modal
            </Text>
          </TouchableOpacity>
          <TouchableOpacity
            style={[styles.secondaryButton, { borderColor: colors.deepTeal }]}
            activeOpacity={0.8}
            onPress={handlePreviewSubscriberModal}
          >
            <Text style={[styles.secondaryButtonText, { color: colors.deepTeal }]}>
              Preview Subscriber Modal
            </Text>
          </TouchableOpacity>
          <TouchableOpacity
            style={[styles.secondaryButton, { borderColor: colors.deepTeal }]}
            activeOpacity={0.8}
            onPress={() => void handleResetModalAcknowledgments()}
          >
            <Text style={[styles.secondaryButtonText, { color: colors.deepTeal }]}>
              Reset Modal Acknowledgments (server)
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
      <GrandfatheredLifetimeModal
        visible={previewGrandfathered}
        onClose={() => setPreviewGrandfathered(false)}
      />
      <SubscriberToLifetimeModal
        visible={previewSubscriber}
        onClose={() => setPreviewSubscriber(false)}
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
  plainStatusTitle: {
    fontFamily: fonts.bodyFamilySemiBold,
    fontSize: 15,
    marginBottom: 8,
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
